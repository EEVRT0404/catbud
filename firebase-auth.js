import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    onSnapshot,
    serverTimestamp,
    setDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDtBHE6XCeAQT_WRT__HvGFtTrvsvbnKBE",
    authDomain: "meowtabs-app.firebaseapp.com",
    projectId: "meowtabs-app",
    storageBucket: "meowtabs-app.firebasestorage.app",
    messagingSenderId: "511788121825",
    appId: "1:511788121825:web:c4a7ec9a9e5dfb15e501a0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const statusElement = document.getElementById('auth-status');
const syncStatusElement = document.getElementById('sync-status');
const syncDescriptionElement = document.getElementById('sync-description');
const signInButton = document.getElementById('google-sign-in');
const signOutButton = document.getElementById('google-sign-out');

let activeUserId = null;
let authStateResolved = false;
let authInitializationId = 0;
let unsubscribeSettings = null;
let unsubscribeTransactions = null;
let syncReady = false;
let writesInFlight = 0;
let remoteSettingsLoaded = false;
let remoteTransactionsLoaded = false;
let remoteSettings = null;
let remoteTransactions = [];
let remoteNeedsRefresh = false;
let latestLocalData = null;
let lastSyncedData = null;
let latestLocalSignature = '';
let writeQueue = Promise.resolve();
let pendingLocalData = null;
let pendingLocalBaseData = null;
let authFallbackData = null;
let lastSyncError = null;

function setStatus(message, isError = false) {
    statusElement.textContent = message;
    statusElement.classList.toggle('text-rose-600', isError);
    statusElement.classList.toggle('text-slate-500', !isError);
}

function setSyncStatus(message, isError = false) {
    if (!isError && lastSyncError) {
        message = `同步失敗：${lastSyncError}`;
        isError = true;
    }
    syncStatusElement.textContent = message;
    syncStatusElement.classList.toggle('text-rose-600', isError);
    syncStatusElement.classList.toggle('text-emerald-600', !isError);
    syncDescriptionElement.textContent = isError
        ? '雲端同步發生問題；此裝置上的資料仍保留在瀏覽器中。修正 Firebase 設定後可重新載入重試。'
        : '登入後會使用 Firestore 同步此帳號的記帳資料；尚未登入時，資料只保存在此瀏覽器。';
}

function normalizeData(data) {
    if (!data || !Array.isArray(data.transactions)) {
        throw new Error('Firestore 中的記帳資料格式不正確。');
    }

    const transactions = data.transactions.map(transaction => {
        if (!transaction || typeof transaction !== 'object' || transaction.id === undefined) {
            throw new Error('記帳資料中有缺少編號的交易。');
        }

        const normalizedTransaction = Object.fromEntries(
            Object.entries(transaction).filter(([key, value]) => key !== 'updatedAt' && value !== undefined)
        );
        normalizedTransaction.id = String(transaction.id);
        if (!normalizedTransaction.id || normalizedTransaction.id.includes('/')) {
            throw new Error('交易編號格式無效，無法同步。');
        }
        return normalizedTransaction;
    });

    const clone = value => value === null ? null : JSON.parse(JSON.stringify(value));
    return {
        transactions,
        budgetTarget: Number.isFinite(data.budgetTarget) ? data.budgetTarget : 30000,
        categories: clone(data.categories ?? null),
        preferences: clone(data.preferences ?? null)
    };
}

function signature(data) {
    const normalizedData = normalizeData(data);
    normalizedData.transactions.sort((left, right) => left.id.localeCompare(right.id));
    return JSON.stringify(normalizedData);
}

function readLocalData() {
    const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    const categories = JSON.parse(localStorage.getItem('catmoney_categories') || 'null');
    const preferences = JSON.parse(localStorage.getItem('catmoney_prefs') || 'null');
    const budgetValue = Number.parseFloat(localStorage.getItem('monthly_budget') || '');

    return normalizeData({
        transactions,
        budgetTarget: Number.isFinite(budgetValue) ? budgetValue : 30000,
        categories,
        preferences
    });
}

const initialLocalData = normalizeData(window.meowtabsInitialData || readLocalData());

function getSettingsRef(uid) {
    return doc(db, 'users', uid, 'appData', 'settings');
}

function getTransactionsRef(uid) {
    return collection(db, 'users', uid, 'appData', 'settings', 'transactions');
}

function applyCloudData(data) {
    const normalizedData = normalizeData(data);
    latestLocalData = normalizedData;
    lastSyncedData = normalizedData;
    latestLocalSignature = signature(normalizedData);
    window.dispatchEvent(new CustomEvent('meowtabs:cloud-data-loaded', {
        detail: normalizedData
    }));
}

function applyLocalOverlay(data) {
    const normalizedData = normalizeData(data);
    latestLocalData = normalizedData;
    latestLocalSignature = signature(normalizedData);
    window.dispatchEvent(new CustomEvent('meowtabs:cloud-data-loaded', {
        detail: normalizedData
    }));
}

function getCloudData(settings, transactions, fallbackData) {
    return normalizeData({
        transactions,
        budgetTarget: Number.isFinite(settings?.budgetTarget)
            ? settings.budgetTarget
            : fallbackData.budgetTarget,
        categories: settings?.categories ?? fallbackData.categories,
        preferences: settings?.preferences ?? fallbackData.preferences
    });
}

function mergeLocalChanges(baseData, localData, remoteData) {
    const baseTransactions = new Map(
        baseData.transactions.map(transaction => [transaction.id, transaction])
    );
    const localTransactions = new Map(
        localData.transactions.map(transaction => [transaction.id, transaction])
    );
    const deletedIds = new Set(
        [...baseTransactions.keys()].filter(id => !localTransactions.has(id))
    );
    const changedTransactions = localData.transactions.filter(transaction => {
        const baseTransaction = baseTransactions.get(transaction.id);
        return !baseTransaction || JSON.stringify(baseTransaction) !== JSON.stringify(transaction);
    });
    const changedIds = new Set(changedTransactions.map(transaction => transaction.id));

    return normalizeData({
        transactions: [
            ...changedTransactions,
            ...remoteData.transactions.filter(transaction =>
                !deletedIds.has(transaction.id) && !changedIds.has(transaction.id)
            )
        ],
        budgetTarget: localData.budgetTarget !== baseData.budgetTarget
            ? localData.budgetTarget
            : remoteData.budgetTarget,
        categories: JSON.stringify(localData.categories) !== JSON.stringify(baseData.categories)
            ? localData.categories
            : remoteData.categories,
        preferences: JSON.stringify(localData.preferences) !== JSON.stringify(baseData.preferences)
            ? localData.preferences
            : remoteData.preferences
    });
}

function getWriteOperations(previousData, nextData, uid) {
    const operations = [];
    const previousTransactions = new Map(
        (previousData?.transactions || []).map(transaction => [String(transaction.id), transaction])
    );
    const nextTransactions = new Map(
        nextData.transactions.map(transaction => [String(transaction.id), transaction])
    );
    const transactionsRef = getTransactionsRef(uid);

    for (const id of previousTransactions.keys()) {
        if (!nextTransactions.has(id)) {
            operations.push({ type: 'delete', ref: doc(transactionsRef, id) });
        }
    }
    for (const [id, transaction] of nextTransactions) {
        const previousTransaction = previousTransactions.get(id);
        if (JSON.stringify(previousTransaction) !== JSON.stringify(transaction)) {
            operations.push({
                type: 'set',
                ref: doc(transactionsRef, id),
                data: { ...transaction, updatedAt: serverTimestamp() }
            });
        }
    }

    operations.push({
        type: 'set',
        ref: getSettingsRef(uid),
        data: {
            budgetTarget: nextData.budgetTarget,
            categories: nextData.categories,
            preferences: nextData.preferences,
            updatedAt: serverTimestamp()
        }
    });
    return operations;
}

async function commitOperations(operations) {
    for (let index = 0; index < operations.length; index += 450) {
        const batch = writeBatch(db);
        const chunk = operations.slice(index, index + 450);
        for (const operation of chunk) {
            if (operation.type === 'delete') batch.delete(operation.ref);
            else batch.set(operation.ref, operation.data);
        }
        await batch.commit();
    }
}

async function fetchCloudData(uid, fallbackData) {
    const [settingsSnapshot, transactionsSnapshot] = await Promise.all([
        getDoc(getSettingsRef(uid)),
        getDocs(getTransactionsRef(uid))
    ]);

    if (!settingsSnapshot.exists() && transactionsSnapshot.empty) return null;

    return getCloudData(
        settingsSnapshot.exists() ? settingsSnapshot.data() : null,
        transactionsSnapshot.docs.map(transactionDoc => ({
            ...transactionDoc.data(),
            id: transactionDoc.id
        })),
        fallbackData
    );
}

function handleSyncError(error, action) {
    console.error(`Firestore ${action} failed:`, error);
    lastSyncError = `${action}：${error.message}`;
    setSyncStatus(`同步失敗：${lastSyncError}`, true);
}

function reconcileRemoteData(remoteData) {
    if (!pendingLocalData) return remoteData;

    const mergedData = mergeLocalChanges(
        pendingLocalBaseData || lastSyncedData || remoteData,
        pendingLocalData,
        remoteData
    );
    if (signature(mergedData) === signature(remoteData)) {
        pendingLocalData = null;
        pendingLocalBaseData = null;
        lastSyncError = null;
        return remoteData;
    }
    return mergedData;
}

function applyLatestRemoteData() {
    if (!remoteSettingsLoaded || !remoteTransactionsLoaded || !syncReady) return;
    if (writesInFlight > 0) {
        remoteNeedsRefresh = true;
        return;
    }

    if (!remoteSettings && remoteTransactions.length === 0) {
        setSyncStatus('雲端資料不存在；為避免清除本機資料，已暫停同步。', true);
        syncReady = false;
        return;
    }

    try {
        const remoteData = getCloudData(remoteSettings, remoteTransactions, readLocalData());
        const reconciledData = reconcileRemoteData(remoteData);
        if (signature(reconciledData) !== latestLocalSignature) {
            if (reconciledData === remoteData) applyCloudData(remoteData);
            else applyLocalOverlay(reconciledData);
        }
        setSyncStatus('雲端同步中');
    } catch (error) {
        handleSyncError(error, 'read');
    }
}

async function refreshCloudData(uid) {
    const cloudData = await fetchCloudData(uid, readLocalData());
    if (!cloudData) {
        setSyncStatus('雲端資料不存在；為避免清除本機資料，已暫停同步。', true);
        syncReady = false;
        return;
    }
    if (activeUserId === uid) {
        const reconciledData = reconcileRemoteData(cloudData);
        if (signature(reconciledData) !== latestLocalSignature) {
            if (reconciledData === cloudData) applyCloudData(cloudData);
            else applyLocalOverlay(reconciledData);
        }
    }
}

onAuthStateChanged(auth, async user => {
    const initializationId = ++authInitializationId;
    const queuedInitialData = authStateResolved ? null : pendingLocalData;
    const queuedInitialBaseData = authStateResolved ? null : pendingLocalBaseData;
    authStateResolved = true;
    if (unsubscribeSettings) unsubscribeSettings();
    if (unsubscribeTransactions) unsubscribeTransactions();
    unsubscribeSettings = null;
    unsubscribeTransactions = null;
    syncReady = false;
    writesInFlight = 0;
    remoteSettingsLoaded = false;
    remoteTransactionsLoaded = false;
    remoteSettings = null;
    remoteTransactions = [];
    remoteNeedsRefresh = false;
    latestLocalData = null;
    lastSyncedData = null;
    authFallbackData = null;
    lastSyncError = null;
    pendingLocalData = queuedInitialData;
    pendingLocalBaseData = queuedInitialBaseData;
    writeQueue = Promise.resolve();
    activeUserId = user ? user.uid : null;

    signInButton.classList.toggle('hidden', Boolean(user));
    signOutButton.classList.toggle('hidden', !user);

    if (!user) {
        pendingLocalData = null;
        pendingLocalBaseData = null;
        setStatus('尚未登入');
        setSyncStatus('登入後即可開始雲端同步');
        return;
    }

    setStatus(`已登入：${user.email || user.displayName || 'Google 帳號'}`);
    setSyncStatus('正在連接 Firestore...');
    const userId = user.uid;

    try {
        const fallbackData = readLocalData();
        authFallbackData = fallbackData;
        const cloudData = await fetchCloudData(userId, fallbackData);
        if (activeUserId !== userId || initializationId !== authInitializationId) return;

        let initialData = mergeLocalChanges(
            initialLocalData,
            fallbackData,
            cloudData || fallbackData
        );
        if (pendingLocalData) {
            initialData = mergeLocalChanges(
                pendingLocalBaseData || fallbackData,
                pendingLocalData,
                initialData
            );
            pendingLocalData = null;
            pendingLocalBaseData = null;
        }

        if (!cloudData || signature(initialData) !== signature(cloudData)) {
            await commitOperations(getWriteOperations(cloudData, initialData, userId));
            if (activeUserId !== userId || initializationId !== authInitializationId) return;
        }

        while (pendingLocalData) {
            const latestPendingData = pendingLocalData;
            const latestPendingBaseData = pendingLocalBaseData || fallbackData;
            pendingLocalData = null;
            pendingLocalBaseData = null;
            const nextData = mergeLocalChanges(latestPendingBaseData, latestPendingData, initialData);
            if (signature(nextData) !== signature(initialData)) {
                await commitOperations(getWriteOperations(initialData, nextData, userId));
                if (activeUserId !== userId || initializationId !== authInitializationId) return;
            }
            initialData = nextData;
        }

        applyCloudData(initialData);
        setSyncStatus(cloudData
            ? '已載入雲端資料，正在保持同步'
            : '本機資料已首次備份至雲端');

        unsubscribeSettings = onSnapshot(getSettingsRef(userId), { includeMetadataChanges: true }, snapshot => {
            if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) {
                remoteNeedsRefresh = true;
                return;
            }
            remoteSettingsLoaded = true;
            remoteSettings = snapshot.exists() ? snapshot.data() : null;
            applyLatestRemoteData();
        }, error => handleSyncError(error, 'settings listener'));

        unsubscribeTransactions = onSnapshot(getTransactionsRef(userId), { includeMetadataChanges: true }, snapshot => {
            if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) {
                remoteNeedsRefresh = true;
                return;
            }
            remoteTransactionsLoaded = true;
            remoteTransactions = snapshot.docs.map(transactionDoc => ({
                ...transactionDoc.data(),
                id: transactionDoc.id
            }));
            applyLatestRemoteData();
        }, error => handleSyncError(error, 'transactions listener'));

        syncReady = true;
        applyLatestRemoteData();
    } catch (error) {
        handleSyncError(error, 'initialization');
    }
}, error => {
    console.error('Unable to read Firebase auth state:', error);
    setStatus(`無法確認登入狀態：${error.message}`, true);
});

window.addEventListener('meowtabs:local-data-changed', event => {
    let nextData;
    try {
        nextData = normalizeData(event.detail);
    } catch (error) {
        handleSyncError(error, 'prepare');
        return;
    }

    if (!authStateResolved) {
        if (!pendingLocalData) pendingLocalBaseData = initialLocalData;
        pendingLocalData = nextData;
        return;
    }

    if (!activeUserId) return;

    if (!syncReady) {
        if (!pendingLocalData) {
            pendingLocalBaseData = authFallbackData || initialLocalData;
        }
        pendingLocalData = nextData;
        return;
    }

    if (signature(nextData) === latestLocalSignature) return;

    if (!pendingLocalData) pendingLocalBaseData = lastSyncedData || latestLocalData;
    pendingLocalData = nextData;
    latestLocalData = nextData;
    latestLocalSignature = signature(nextData);
    const userId = activeUserId;
    writesInFlight += 1;
    setSyncStatus('正在同步變更...');

    let writeFailed = false;
    writeQueue = writeQueue.then(async () => {
        if (activeUserId !== userId) return;
        await commitOperations(getWriteOperations(lastSyncedData, nextData, userId));
        lastSyncedData = nextData;
        lastSyncError = null;
    }).catch(error => {
        writeFailed = true;
        handleSyncError(error, 'write');
    }).finally(async () => {
        writesInFlight = Math.max(0, writesInFlight - 1);
        if (activeUserId !== userId || writesInFlight !== 0) return;
        if (remoteNeedsRefresh) {
            remoteNeedsRefresh = false;
            try {
                await refreshCloudData(userId);
            } catch (error) {
                handleSyncError(error, 'refresh');
            }
        }
        if (syncReady && !writeFailed) setSyncStatus('雲端同步完成');
    });
});

signInButton.addEventListener('click', async () => {
    signInButton.disabled = true;
    setStatus('正在開啟 Google 登入...');

    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.error('Google sign-in failed:', error);
        setStatus(`登入失敗：${error.message}`, true);
    } finally {
        signInButton.disabled = false;
    }
});

signOutButton.addEventListener('click', async () => {
    signOutButton.disabled = true;
    setStatus('正在登出...');

    try {
        await signOut(auth);
    } catch (error) {
        console.error('Google sign-out failed:', error);
        setStatus(`登出失敗：${error.message}`, true);
    } finally {
        signOutButton.disabled = false;
    }
});
