import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

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
const googleProvider = new GoogleAuthProvider();
const statusElement = document.getElementById('auth-status');
const signInButton = document.getElementById('google-sign-in');
const signOutButton = document.getElementById('google-sign-out');

function setStatus(message, isError = false) {
    statusElement.textContent = message;
    statusElement.classList.toggle('text-rose-600', isError);
    statusElement.classList.toggle('text-slate-500', !isError);
}

onAuthStateChanged(auth, user => {
    signInButton.classList.toggle('hidden', Boolean(user));
    signOutButton.classList.toggle('hidden', !user);
    setStatus(user ? `已登入：${user.email || user.displayName || 'Google 帳號'}` : '尚未登入');
}, error => {
    console.error('Unable to read Firebase auth state:', error);
    setStatus(`無法確認登入狀態：${error.message}`, true);
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
