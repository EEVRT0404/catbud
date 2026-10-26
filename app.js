// ==========================================
// CatBud 喵算記帳 - 核心邏輯 (app.js)
// Ver. 2.1.0 (喵力升級版)
// ==========================================

// 預設分類設定
const DEFAULT_CATEGORIES = {
    expense: [
        { name: '餐飲食品', icon: 'utensils', color: '#f97316' },
        { name: '日常交通', icon: 'bus', color: '#06b6d4' },
        { name: '休閒娛樂', icon: 'gamepad-2', color: '#8b5cf6' },
        { name: '購物消費', icon: 'shopping-bag', color: '#ec4899' },
        { name: '毛孩專區', icon: 'paw-print', color: '#f59e0b' },
        { name: '居家生活', icon: 'home', color: '#10b981' },
        { name: '醫療健康', icon: 'heart-pulse', color: '#ef4444' },
        { name: '學習教育', icon: 'book-open', color: '#3b82f6' },
        { name: '其他支出', icon: 'more-horizontal', color: '#64748b' }
    ],
    income: [
        { name: '工作薪資', icon: 'briefcase', color: '#10b981' },
        { name: '副業兼職', icon: 'laptop', color: '#06b6d4' },
        { name: '投資理財', icon: 'trending-up', color: '#8b5cf6' },
        { name: '紅利獎金', icon: 'gift', color: '#f59e0b' },
        { name: '其他收入', icon: 'plus-circle', color: '#64748b' }
    ]
};

// 喵星人伴侶性格語錄庫
const MASCOT_QUOTES = {
    orange: {
        name: '橘貓阿財',
        avatar: '🐱',
        quotes: [
            '喵～今天又多了一筆紀錄！有買好吃的罐罐嗎？🐾',
            '呼嚕呼嚕～勤勞記帳的主人最帥氣最漂亮了喵！',
            '每記一筆帳，距離吃大餐就更進一步了喵！🍖',
            '這筆花費值得喵！主人開心最重要～',
            '生活就是吃吃喝喝與快樂記帳喵～'
        ],
        highExpense: '喵嗚！這筆有點大筆喔～罐罐基金要看緊點喵！🙀',
        income: '哇哇哇！賺錢錢了喵！今晚可以加菜吃鮪魚罐頭嗎？✨'
    },
    calico: {
        name: '三花喵喵',
        avatar: '🐾',
        quotes: [
            '招財喵在此！每一筆清楚紀錄，財運就滾滾來喵～💰',
            '細心規劃收支，生活就會越來越充裕唷！',
            '本喵幫你記在心裡的小本本上了，喵～',
            '今天也很有理財 Sense 呢！繼續保持喵！',
            '開源節流，財富自由指日可待喵！'
        ],
        highExpense: '提醒主人：預算要多留意一點，別讓荷包太快瘦下來喵！',
        income: '恭喜有收入進帳！金幣叮叮噹噹，招財進寶喵～🧧'
    },
    black: {
        name: '黑貓吉吉',
        avatar: '🐈‍⬛',
        quotes: [
            '哼～本喵正在敏銳地監視著你的錢包呢！',
            '審慎花費、定期檢視，才是成為富翁的捷徑，喵。',
            '已經妥善登記完畢，繼續維持理財紀律吧。',
            '生活需要講究，但記帳更要講究！',
            '冷靜消費，不被慾望支配，喵。'
        ],
        highExpense: '注意！這筆支出金額可不小，確認真的是必需品嗎？喵。',
        income: '收入增加是好事，不過要記得規劃一部分存下來喵。'
    }
};

// 彈窗圖示與代表色選項
const AVAILABLE_ICONS = [
    'utensils', 'coffee', 'shopping-bag', 'bus', 'car', 'plane',
    'home', 'heart-pulse', 'book-open', 'gift', 'gamepad-2',
    'paw-print', 'sparkles', 'dumbbell', 'film', 'music'
];
const AVAILABLE_COLORS = [
    '#f97316', '#06b6d4', '#8b5cf6', '#ec4899', '#10b981', '#ef4444', '#3b82f6', '#f59e0b'
];

// 全域狀態
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let budgetTarget = parseFloat(localStorage.getItem('monthly_budget')) || 30000;
let CATEGORIES = JSON.parse(localStorage.getItem('catmoney_categories')) || DEFAULT_CATEGORIES;
let userPrefs = JSON.parse(localStorage.getItem('catmoney_prefs')) || {
    currency: 'NT$',
    mascot: 'orange',
    defaultType: 'expense',
    defaultPayment: '現金',
    alertThreshold: 80
};

let activeTab = 'dashboard';
let prevTab = 'dashboard';
let deleteTargetId = null;
let dashChartType = 'expense';
let settingsCategoryTab = 'expense';

// Chart instances
let dashCategoryChart = null;
let analyticsCategoryChart = null;
let monthlyTrendChart = null;

// ==========================================
// 初始化
// ==========================================
window.onload = function () {
    applyPreferencesToUI();

    const today = new Date();
    const yearMonth = today.toISOString().slice(0, 7);
    const dateInput = document.getElementById('filter-month');
    if (dateInput) dateInput.value = yearMonth;

    const formDate = document.getElementById('form-date');
    if (formDate) formDate.value = today.toISOString().slice(0, 10);

    populateCategoryFilterOptions();
    updateDashboard();
    renderTransactions();

    // 讀取先前儲存或 URL 指定的頁籤，避免重新整理時跳回首頁
    const hashTab = window.location.hash.replace('#', '');
    const savedTab = localStorage.getItem('catmoney_active_tab');
    let targetTab = 'dashboard';

    if (hashTab && document.getElementById(`tab-${hashTab}`)) {
        targetTab = hashTab;
    } else if (savedTab && document.getElementById(`tab-${savedTab}`)) {
        targetTab = savedTab;
    }

    if (targetTab === 'add') {
        openAddPage();
    } else {
        switchTab(targetTab, false);
    }

    lucide.createIcons();
};

// 監聽瀏覽器上一頁/下一頁切換
window.addEventListener('hashchange', function () {
    const hashTab = window.location.hash.replace('#', '');
    if (hashTab && document.getElementById(`tab-${hashTab}`) && activeTab !== hashTab) {
        if (hashTab === 'add') {
            openAddPage();
        } else {
            switchTab(hashTab, false);
        }
    }
});

function applyPreferencesToUI() {
    // Currency Symbol Updates
    const currency = userPrefs.currency || 'NT$';
    document.querySelectorAll('.currency-symbol').forEach(el => el.textContent = currency);
    document.querySelectorAll('.currency-symbol-display').forEach(el => el.textContent = currency);

    // Mascot Speech & Avatar
    updateCatSpeech('default');
}

function saveToLocalStorage() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
    localStorage.setItem('monthly_budget', budgetTarget.toString());
    localStorage.setItem('catmoney_categories', JSON.stringify(CATEGORIES));
    localStorage.setItem('catmoney_prefs', JSON.stringify(userPrefs));
}

function getCategoryMeta(categoryName, type = 'expense') {
    const list = (CATEGORIES[type] || []).concat(CATEGORIES[type === 'expense' ? 'income' : 'expense'] || []);
    const found = list.find(c => c.name === categoryName);
    if (found) return found;
    return { name: categoryName, icon: 'tag', color: '#64748b' };
}

// ==========================================
// 分頁切換 (Navigation)
// ==========================================
function switchTab(tabId, updateHash = true) {
    activeTab = tabId;

    // 儲存目前分頁至 LocalStorage，重整時可還原
    localStorage.setItem('catmoney_active_tab', tabId);

    // 更新 URL Hash 方便書籤或瀏覽歷史
    if (updateHash && window.location.hash !== `#${tabId}`) {
        try {
            history.replaceState(null, '', `#${tabId}`);
        } catch (e) {
            window.location.hash = tabId;
        }
    }

    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.remove('hidden');

    // Update Bottom Nav state
    if (tabId !== 'add') {
        document.querySelectorAll('.nav-item-bottom').forEach(btn => {
            btn.className = "nav-item-bottom flex flex-col items-center justify-center flex-1 py-1 text-slate-400 hover:text-slate-600 font-medium transition-all group focus:outline-none";
        });
        const activeBottomBtn = document.getElementById(`nav-bottom-${tabId}`);
        if (activeBottomBtn) {
            activeBottomBtn.className = "nav-item-bottom flex flex-col items-center justify-center flex-1 py-1 text-emerald-600 font-bold transition-all group focus:outline-none";
        }

        // Update Sidebar Nav state
        document.querySelectorAll('.nav-item-side').forEach(btn => {
            btn.className = "nav-item-side w-full flex items-center space-x-3.5 px-4 py-3.5 rounded-2xl text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all focus:outline-none";
        });
        const activeSideBtn = document.getElementById(`nav-side-${tabId}`);
        if (activeSideBtn) {
            activeSideBtn.className = "nav-item-side w-full flex items-center space-x-3.5 px-4 py-3.5 rounded-2xl text-sm font-bold text-emerald-600 transition-all focus:outline-none";
        }
    }

    // Reset scroll position to top
    const mainContainer = document.querySelector('.app-main');
    if (mainContainer) mainContainer.scrollTop = 0;
    window.scrollTo(0, 0);

    if (tabId === 'dashboard') {
        updateDashboard();
    } else if (tabId === 'transactions') {
        renderTransactions();
    } else if (tabId === 'analytics') {
        renderAnalyticsCharts();
    } else if (tabId === 'settings') {
        renderSettings();
    }

    lucide.createIcons();
}

// ==========================================
// 新增 / 編輯紀錄模組 (Add & Edit Record)
// ==========================================
function openAddPage(editId = null) {
    if (activeTab !== 'add') prevTab = activeTab;
    const form = document.getElementById('transaction-form');
    if (form) form.reset();

    const initialType = userPrefs.defaultType || 'expense';
    const initialPayment = userPrefs.defaultPayment || '現金';

    if (editId) {
        const item = transactions.find(t => t.id === editId);
        if (item) {
            document.getElementById('add-page-title').textContent = '編輯紀錄';
            document.getElementById('edit-id').value = item.id;
            document.getElementById('form-amount').value = item.amount;
            document.getElementById('form-date').value = item.date;
            document.getElementById('form-note').value = item.note || '';
            setType(item.type);
            selectCategory(item.category);
            selectPaymentChip(item.paymentMethod || initialPayment);
            updateCatSpeech('custom', `正在編輯「${item.category}」的紀錄喵～🐾`);
            const btnSaveAnother = document.getElementById('btn-save-another');
            if (btnSaveAnother) btnSaveAnother.classList.add('hidden');
        }
    } else {
        document.getElementById('add-page-title').textContent = '新增記帳紀錄';
        document.getElementById('edit-id').value = '';
        document.getElementById('form-date').value = new Date().toISOString().slice(0, 10);
        setType(initialType);
        selectPaymentChip(initialPayment);
        setQuickDate(0);
        updateCatSpeech('default');
        const btnSaveAnother = document.getElementById('btn-save-another');
        if (btnSaveAnother) btnSaveAnother.classList.remove('hidden');
    }

    switchTab('add');
    const mainScroll = document.querySelector('.app-main');
    if (mainScroll) mainScroll.scrollTop = 0;
    window.scrollTo(0, 0);
}

function closeAddPage() {
    switchTab(prevTab);
}

function openModal(editId = null) {
    openAddPage(editId);
}

function closeModal() {
    closeAddPage();
}

function setType(type) {
    document.getElementById('transaction-type').value = type;
    const expenseBtn = document.getElementById('btn-type-expense');
    const incomeBtn = document.getElementById('btn-type-income');

    if (type === 'expense') {
        expenseBtn.className = "py-3 rounded-xl text-sm font-bold transition-all bg-white text-rose-600 shadow-sm flex items-center justify-center space-x-2";
        incomeBtn.className = "py-3 rounded-xl text-sm font-bold transition-all text-slate-500 hover:text-slate-900 flex items-center justify-center space-x-2";
    } else {
        incomeBtn.className = "py-3 rounded-xl text-sm font-bold transition-all bg-white text-emerald-600 shadow-sm flex items-center justify-center space-x-2";
        expenseBtn.className = "py-3 rounded-xl text-sm font-bold transition-all text-slate-500 hover:text-slate-900 flex items-center justify-center space-x-2";
    }

    // Default select first category of this type
    const cats = CATEGORIES[type] || [];
    const firstCatName = cats[0]?.name || '';
    document.getElementById('form-category').value = firstCatName;

    renderCategoryGrid(type);
    updateCatSpeech(type === 'income' ? 'income' : 'default');
}

function renderCategoryGrid(type) {
    const container = document.getElementById('add-category-grid');
    if (!container) return;

    const cats = CATEGORIES[type] || [];
    const currentVal = document.getElementById('form-category')?.value || (cats[0]?.name || '');

    container.innerHTML = cats.map(cat => {
        const isSelected = cat.name === currentVal;
        const activeClass = isSelected
            ? 'ring-2 ring-emerald-500 shadow-md scale-[1.02] bg-white'
            : 'hover:bg-white/80 bg-slate-50/70 border border-slate-200/60';

        return `
            <button type="button" onclick="selectCategory('${cat.name}')" id="cat-card-${cat.name}"
                class="cat-item-btn flex flex-col items-center justify-center p-2.5 rounded-2xl transition-all ${activeClass}">
                <div class="w-10 h-10 rounded-2xl flex items-center justify-center mb-1.5 shadow-xs"
                    style="background-color: ${cat.color}20; color: ${cat.color}">
                    <i data-lucide="${cat.icon}" class="w-5 h-5"></i>
                </div>
                <span class="text-[11px] font-bold text-slate-700 tracking-tight text-center truncate w-full">${cat.name}</span>
            </button>
        `;
    }).join('');

    const badge = document.getElementById('selected-cat-badge');
    if (badge) badge.textContent = currentVal;

    lucide.createIcons();
}

function selectCategory(name) {
    const formCat = document.getElementById('form-category');
    if (formCat) formCat.value = name;

    const badge = document.getElementById('selected-cat-badge');
    if (badge) badge.textContent = name;

    const container = document.getElementById('add-category-grid');
    if (container) {
        container.querySelectorAll('.cat-item-btn').forEach(btn => {
            btn.className = "cat-item-btn flex flex-col items-center justify-center p-2.5 rounded-2xl transition-all hover:bg-white/80 bg-slate-50/70 border border-slate-200/60";
        });
        const activeBtn = document.getElementById(`cat-card-${name}`);
        if (activeBtn) {
            activeBtn.className = "cat-item-btn flex flex-col items-center justify-center p-2.5 rounded-2xl transition-all ring-2 ring-emerald-500 shadow-md scale-[1.02] bg-white";
        }
    }

    if (name === '毛孩專區') {
        updateCatSpeech('custom', '喵！最喜歡主人買罐罐和零食給我了！蹭蹭～🐾');
    } else if (name === '餐飲食品') {
        updateCatSpeech('custom', '好吃的最療癒心靈了！今天吃什麼美味好料喵？😋');
    } else if (name === '工作薪資') {
        updateCatSpeech('income');
    }
}

function quickAddAmount(val) {
    const input = document.getElementById('form-amount');
    if (!input) return;
    const current = parseFloat(input.value) || 0;
    input.value = current + val;
    onAmountInputChanged();
}

function clearAmount() {
    const input = document.getElementById('form-amount');
    if (input) {
        input.value = '';
        input.focus();
    }
}

function onAmountInputChanged() {
    const input = document.getElementById('form-amount');
    const val = parseFloat(input?.value) || 0;
    const type = document.getElementById('transaction-type')?.value || 'expense';

    if (val >= 5000 && type === 'expense') {
        updateCatSpeech('highExpense');
    } else if (val >= 10000 && type === 'income') {
        updateCatSpeech('income');
    }
}

function setQuickDate(offsetDays) {
    const today = new Date();
    today.setDate(today.getDate() + offsetDays);
    const dateStr = today.toISOString().slice(0, 10);
    document.getElementById('form-date').value = dateStr;

    const btnToday = document.getElementById('btn-date-today');
    const btnYesterday = document.getElementById('btn-date-yesterday');
    const btnBefore = document.getElementById('btn-date-before');

    if (btnToday) btnToday.className = offsetDays === 0 ? "px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-100 text-emerald-800 transition-all" : "px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all";
    if (btnYesterday) btnYesterday.className = offsetDays === -1 ? "px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-100 text-emerald-800 transition-all" : "px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all";
    if (btnBefore) btnBefore.className = offsetDays === -2 ? "px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-100 text-emerald-800 transition-all" : "px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all";
}

function selectPaymentChip(method) {
    const formPay = document.getElementById('form-payment');
    if (formPay) formPay.value = method;

    const container = document.getElementById('payment-chips-container');
    if (container) {
        container.querySelectorAll('.payment-chip').forEach(btn => {
            if (btn.getAttribute('data-payment') === method) {
                btn.className = "payment-chip py-2.5 px-3 rounded-xl border border-emerald-500 bg-emerald-50/80 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs";
            } else {
                btn.className = "payment-chip py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-all";
            }
        });
    }
}

function appendNoteTag(tag) {
    const input = document.getElementById('form-note');
    if (!input) return;
    const cleanTag = tag.replace(/^[^\w\s\u4e00-\u9fa5]+/, '').trim();
    if (!input.value.trim()) {
        input.value = cleanTag;
    } else if (!input.value.includes(cleanTag)) {
        input.value = `${input.value.trim()}，${cleanTag}`;
    }
    input.focus();
}

function updateCatSpeech(type = 'default', customMsg = null) {
    const mascotKey = userPrefs.mascot || 'orange';
    const mascot = MASCOT_QUOTES[mascotKey] || MASCOT_QUOTES.orange;
    const avatarEl = document.getElementById('cat-avatar-icon');
    const speechEl = document.getElementById('cat-speech-text');

    if (avatarEl) avatarEl.textContent = mascot.avatar;
    if (!speechEl) return;

    if (customMsg) {
        speechEl.textContent = customMsg;
        return;
    }

    if (type === 'income') {
        speechEl.textContent = mascot.income;
    } else if (type === 'highExpense') {
        speechEl.textContent = mascot.highExpense;
    } else {
        const randIndex = Math.floor(Math.random() * mascot.quotes.length);
        speechEl.textContent = mascot.quotes[randIndex];
    }
}

function handleFormSubmit(e, keepOpen = false) {
    if (e) e.preventDefault();
    const editId = document.getElementById('edit-id').value;
    const type = document.getElementById('transaction-type').value;
    const amount = parseFloat(document.getElementById('form-amount').value);
    const category = document.getElementById('form-category').value;
    const date = document.getElementById('form-date').value;
    const paymentMethod = document.getElementById('form-payment').value;
    const note = document.getElementById('form-note').value.trim();

    if (!amount || amount <= 0) {
        showToast('請輸入有效的金額喵！', 'error');
        return;
    }

    if (editId) {
        const index = transactions.findIndex(t => t.id === editId);
        if (index !== -1) {
            transactions[index] = { id: editId, type, amount, category, date, paymentMethod, note };
            showToast('紀錄更新成功！🐾', 'success');
        }
    } else {
        const newTransaction = {
            id: Date.now().toString(),
            type,
            amount,
            category,
            date,
            paymentMethod,
            note
        };
        transactions.unshift(newTransaction);
        showToast('成功記錄一筆帳目！🐱', 'success');
    }

    saveToLocalStorage();

    if (keepOpen) {
        // Clear amount and note, keep date, category, and payment
        document.getElementById('form-amount').value = '';
        document.getElementById('form-note').value = '';
        document.getElementById('edit-id').value = '';
        document.getElementById('form-amount').focus();
        updateCatSpeech('custom', '已儲存！請繼續記錄下一筆喵～🐾');
        // Update other views in background
        updateDashboard();
        renderTransactions();
    } else {
        switchTab(prevTab);
        if (prevTab === 'dashboard') updateDashboard();
        else if (prevTab === 'transactions') renderTransactions();
        else if (prevTab === 'analytics') renderAnalyticsCharts();
    }
}

// ==========================================
// 設定頁面模組 (Settings Tab)
// ==========================================
function renderSettings() {
    // 1. Budget input
    const input = document.getElementById('settings-budget-input');
    if (input) input.value = budgetTarget;

    // Budget insight calculation
    calculateBudgetInsight();

    // Threshold buttons active state
    const threshold = userPrefs.alertThreshold || 80;
    [70, 80, 90].forEach(th => {
        const btn = document.getElementById(`btn-threshold-${th}`);
        if (btn) {
            if (th === threshold) {
                btn.className = "py-2 px-3 text-xs font-bold rounded-xl border border-emerald-500 bg-emerald-50 text-emerald-800 shadow-xs transition-all";
            } else {
                btn.className = "py-2 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition-all";
            }
        }
    });

    // 2. Categories
    renderSettingsCategories(settingsCategoryTab);

    // 3. Preferences Selects
    const prefCurrency = document.getElementById('pref-currency');
    if (prefCurrency) prefCurrency.value = userPrefs.currency || 'NT$';

    const prefMascot = document.getElementById('pref-mascot');
    if (prefMascot) prefMascot.value = userPrefs.mascot || 'orange';

    const prefType = document.getElementById('pref-default-type');
    if (prefType) prefType.value = userPrefs.defaultType || 'expense';

    const prefPayment = document.getElementById('pref-default-payment');
    if (prefPayment) prefPayment.value = userPrefs.defaultPayment || '現金';

    lucide.createIcons();
}

function calculateBudgetInsight() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    let monthExpense = 0;
    transactions.forEach(t => {
        if (t.type === 'expense' && t.date.startsWith(currentMonth)) {
            monthExpense += t.amount;
        }
    });

    const currency = userPrefs.currency || 'NT$';
    const pct = budgetTarget > 0 ? Math.round((monthExpense / budgetTarget) * 100) : 0;
    const remaining = Math.max(0, budgetTarget - monthExpense);

    // Days remaining in this month
    const now = new Date();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = Math.max(1, lastDayOfMonth - now.getDate() + 1);
    const dailyBudget = Math.round(remaining / daysRemaining);

    const summaryEl = document.getElementById('budget-insight-summary');
    const dailyEl = document.getElementById('budget-insight-daily');

    if (summaryEl) {
        summaryEl.textContent = `本月已支出 ${currency}${monthExpense.toLocaleString()}，佔預算 ${pct}% (剩餘可支配 ${currency}${remaining.toLocaleString()})`;
    }
    if (dailyEl) {
        dailyEl.textContent = `本月尚餘 ${daysRemaining} 天，平均每日可用預算約 ${currency}${dailyBudget.toLocaleString()}`;
    }
}

function saveSettingsBudget() {
    const val = parseFloat(document.getElementById('settings-budget-input').value);
    if (!isNaN(val) && val >= 0) {
        budgetTarget = val;
        saveToLocalStorage();
        updateDashboard();
        calculateBudgetInsight();
        showToast('每月預算設定已更新！', 'success');
    } else {
        showToast('請輸入有效的預算金額', 'error');
    }
}

function setBudgetAlertThreshold(threshold) {
    userPrefs.alertThreshold = threshold;
    saveToLocalStorage();
    renderSettings();
    showToast(`超支警示已設定為達 ${threshold}% 提醒！`, 'success');
}

function savePreferences() {
    userPrefs.currency = document.getElementById('pref-currency').value;
    userPrefs.mascot = document.getElementById('pref-mascot').value;
    userPrefs.defaultType = document.getElementById('pref-default-type').value;
    userPrefs.defaultPayment = document.getElementById('pref-default-payment').value;

    saveToLocalStorage();
    applyPreferencesToUI();
    updateDashboard();
    showToast('個人化偏好已儲存！', 'success');
}

function switchSettingsCategoryTab(type) {
    settingsCategoryTab = type;
    const expenseTab = document.getElementById('settings-cat-tab-expense');
    const incomeTab = document.getElementById('settings-cat-tab-income');

    if (type === 'expense') {
        expenseTab.className = "flex-1 py-1.5 rounded-lg text-xs font-bold bg-white text-rose-600 shadow-sm transition-all";
        incomeTab.className = "flex-1 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 transition-all";
    } else {
        incomeTab.className = "flex-1 py-1.5 rounded-lg text-xs font-bold bg-white text-emerald-600 shadow-sm transition-all";
        expenseTab.className = "flex-1 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 transition-all";
    }

    renderSettingsCategories(type);
}

function renderSettingsCategories(type = settingsCategoryTab) {
    const listEl = document.getElementById('settings-categories-list');
    const countExpense = document.getElementById('cat-count-expense');
    const countIncome = document.getElementById('cat-count-income');

    if (countExpense) countExpense.textContent = (CATEGORIES.expense || []).length;
    if (countIncome) countIncome.textContent = (CATEGORIES.income || []).length;

    if (!listEl) return;

    const list = CATEGORIES[type] || [];
    listEl.innerHTML = list.map(cat => {
        return `
            <div class="flex items-center space-x-2 py-1.5 px-3 rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-white hover:shadow-xs transition-all">
                <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: ${cat.color}"></span>
                <i data-lucide="${cat.icon}" class="w-3.5 h-3.5 text-slate-500"></i>
                <span class="text-xs font-semibold text-slate-800">${cat.name}</span>
                ${list.length > 1 ? `
                    <button onclick="deleteCategory('${type}', '${cat.name}')" class="text-slate-300 hover:text-rose-500 transition-colors ml-1 p-0.5" title="刪除此分類">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

// Category Modal Functions
function openCategoryModal() {
    const modal = document.getElementById('category-modal');
    if (!modal) return;

    setModalCategoryType(settingsCategoryTab);
    document.getElementById('modal-category-name').value = '';
    renderCategoryModalOptions();
    modal.classList.remove('hidden');
    lucide.createIcons();
}

function closeCategoryModal() {
    const modal = document.getElementById('category-modal');
    if (modal) modal.classList.add('hidden');
}

function setModalCategoryType(type) {
    document.getElementById('modal-category-type').value = type;
    const btnExp = document.getElementById('modal-cat-type-expense');
    const btnInc = document.getElementById('modal-cat-type-income');

    if (type === 'expense') {
        btnExp.className = "py-2 rounded-lg text-xs font-bold bg-white text-rose-600 shadow-sm transition-all";
        btnInc.className = "py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 transition-all";
    } else {
        btnInc.className = "py-2 rounded-lg text-xs font-bold bg-white text-emerald-600 shadow-sm transition-all";
        btnExp.className = "py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 transition-all";
    }
}

function renderCategoryModalOptions() {
    // Icons
    const iconContainer = document.getElementById('modal-icon-selector');
    if (iconContainer) {
        const currentIcon = document.getElementById('modal-category-icon').value || 'paw-print';
        iconContainer.innerHTML = AVAILABLE_ICONS.map(icon => {
            const isSelected = icon === currentIcon;
            return `
                <button type="button" onclick="selectModalIcon('${icon}')" id="modal-icon-${icon}"
                    class="p-2 rounded-lg flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100'}">
                    <i data-lucide="${icon}" class="w-4 h-4"></i>
                </button>
            `;
        }).join('');
    }

    // Colors
    const colorContainer = document.getElementById('modal-color-selector');
    if (colorContainer) {
        const currentColor = document.getElementById('modal-category-color').value || '#f97316';
        colorContainer.innerHTML = AVAILABLE_COLORS.map(color => {
            const isSelected = color === currentColor;
            return `
                <button type="button" onclick="selectModalColor('${color}')" id="modal-color-${color.replace('#', '')}"
                    class="w-6 h-6 rounded-full transition-transform ${isSelected ? 'scale-125 ring-2 ring-indigo-500 ring-offset-2' : 'hover:scale-110'}"
                    style="background-color: ${color}"></button>
            `;
        }).join('');
    }
}

function selectModalIcon(icon) {
    document.getElementById('modal-category-icon').value = icon;
    AVAILABLE_ICONS.forEach(i => {
        const btn = document.getElementById(`modal-icon-${i}`);
        if (btn) {
            btn.className = i === icon
                ? "p-2 rounded-lg flex items-center justify-center transition-all bg-indigo-600 text-white shadow-sm"
                : "p-2 rounded-lg flex items-center justify-center transition-all bg-white text-slate-600 hover:bg-slate-100";
        }
    });
}

function selectModalColor(color) {
    document.getElementById('modal-category-color').value = color;
    AVAILABLE_COLORS.forEach(c => {
        const btn = document.getElementById(`modal-color-${c.replace('#', '')}`);
        if (btn) {
            btn.className = c === color
                ? "w-6 h-6 rounded-full transition-transform scale-125 ring-2 ring-indigo-500 ring-offset-2"
                : "w-6 h-6 rounded-full transition-transform hover:scale-110";
        }
    });
}

function handleCreateCategory(e) {
    e.preventDefault();
    const type = document.getElementById('modal-category-type').value;
    const name = document.getElementById('modal-category-name').value.trim();
    const icon = document.getElementById('modal-category-icon').value;
    const color = document.getElementById('modal-category-color').value;

    if (!name) {
        showToast('請輸入分類名稱', 'error');
        return;
    }

    // Check duplicate
    const exists = (CATEGORIES[type] || []).some(c => c.name === name);
    if (exists) {
        showToast('已存在同名分類，請更換名稱', 'error');
        return;
    }

    CATEGORIES[type].push({ name, icon, color });
    saveToLocalStorage();
    closeCategoryModal();
    renderSettingsCategories(type);
    populateCategoryFilterOptions();
    showToast(`成功新增「${name}」分類！🐾`, 'success');
}

function deleteCategory(type, name) {
    if (!confirm(`確定要刪除「${name}」分類嗎？`)) return;

    CATEGORIES[type] = CATEGORIES[type].filter(c => c.name !== name);
    saveToLocalStorage();
    renderSettingsCategories(type);
    populateCategoryFilterOptions();
    showToast(`已刪除「${name}」分類`, 'info');
}

function resetToDefaultCategories() {
    if (!confirm('確定要還原為系統預設的分類組合嗎？自訂分類將會被重置。')) return;

    CATEGORIES = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    saveToLocalStorage();
    renderSettingsCategories(settingsCategoryTab);
    populateCategoryFilterOptions();
    showToast('已還原為預設分類！', 'success');
}

// Export to CSV Report
function exportCSV() {
    if (transactions.length === 0) {
        showToast('目前尚無交易紀錄可供匯出', 'error');
        return;
    }

    const headers = ['日期', '類型', '分類', '金額', '支付方式', '備註說明'];
    const rows = transactions.map(t => [
        t.date,
        t.type === 'expense' ? '支出' : '收入',
        t.category,
        t.amount,
        t.paymentMethod || '現金',
        `"${(t.note || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", url);
    downloadAnchor.setAttribute("download", `CatBud_記帳明細_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
    showToast('已成功匯出 CSV 報表！', 'success');
}

// ==========================================
// 資料庫操作 (Data Backup & Seeding)
// ==========================================
function seedSampleData() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');

    transactions = [
        { id: '1', type: 'income', amount: 48000, category: '工作薪資', date: `${y}-${m}-05`, paymentMethod: '銀行轉帳', note: '本月薪資發放' },
        { id: '2', type: 'expense', amount: 160, category: '餐飲食品', date: `${y}-${m}-10`, paymentMethod: '現金', note: '美味午餐排骨飯' },
        { id: '3', type: 'expense', amount: 1200, category: '日常交通', date: `${y}-${m}-12`, paymentMethod: '信用卡', note: '悠遊卡加值與加油' },
        { id: '4', type: 'expense', amount: 850, category: '毛孩專區', date: `${y}-${m}-14`, paymentMethod: '信用卡', note: '主食罐與貓抓板' },
        { id: '5', type: 'expense', amount: 3200, category: '購物消費', date: `${y}-${m}-15`, paymentMethod: '行動支付', note: '購買換季衣物' },
        { id: '6', type: 'expense', amount: 800, category: '休閒娛樂', date: `${y}-${m}-18`, paymentMethod: '行動支付', note: '週末電影票兩張' },
        { id: '7', type: 'income', amount: 3500, category: '投資理財', date: `${y}-${m}-20`, paymentMethod: '銀行轉帳', note: '高股息ETF配息' }
    ];
    saveToLocalStorage();
    updateDashboard();
    renderTransactions();
    showToast('已載入範例資料！🐱', 'info');
}

function exportData() {
    const backupObj = {
        version: '2.1.0',
        exportDate: new Date().toISOString(),
        transactions,
        budgetTarget,
        categories: CATEGORIES,
        preferences: userPrefs
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `CatBud_財務備份_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('已匯出完整備份 JSON 檔案！', 'info');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (Array.isArray(imported)) {
                // Old array format
                transactions = imported;
            } else if (imported && Array.isArray(imported.transactions)) {
                // New full backup format
                transactions = imported.transactions;
                if (imported.budgetTarget) budgetTarget = imported.budgetTarget;
                if (imported.categories) CATEGORIES = imported.categories;
                if (imported.preferences) userPrefs = imported.preferences;
            } else {
                showToast('檔案格式不正確', 'error');
                return;
            }

            saveToLocalStorage();
            applyPreferencesToUI();
            updateDashboard();
            renderTransactions();
            populateCategoryFilterOptions();
            showToast('成功還原備份資料！🎉', 'success');
        } catch (err) {
            showToast('解析 JSON 檔案失敗', 'error');
        }
    };
    reader.readAsText(file);
}

function triggerClearAllData() {
    document.getElementById('clear-all-modal').classList.remove('hidden');
}

function closeClearAllModal() {
    document.getElementById('clear-all-modal').classList.add('hidden');
}

function confirmClearAllData() {
    transactions = [];
    saveToLocalStorage();
    updateDashboard();
    renderTransactions();
    closeClearAllModal();
    showToast('所有記帳紀錄已清空', 'info');
}

// ==========================================
// 儀表板與明細渲染 (Dashboard & Transactions)
// ==========================================
function updateDashboard() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currency = userPrefs.currency || 'NT$';

    let totalBalance = 0;
    let monthIncome = 0;
    let monthExpense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    transactions.forEach(t => {
        if (t.type === 'income') {
            totalBalance += t.amount;
            if (t.date.startsWith(currentMonth)) {
                monthIncome += t.amount;
                incomeCount++;
            }
        } else if (t.type === 'expense') {
            totalBalance -= t.amount;
            if (t.date.startsWith(currentMonth)) {
                monthExpense += t.amount;
                expenseCount++;
            }
        }
    });

    const totalBalanceEl = document.getElementById('total-balance');
    if (totalBalanceEl) totalBalanceEl.textContent = `${currency}${totalBalance.toLocaleString()}`;

    const monthlyIncomeEl = document.getElementById('monthly-income');
    if (monthlyIncomeEl) monthlyIncomeEl.textContent = `${currency}${monthIncome.toLocaleString()}`;

    const monthlyExpenseEl = document.getElementById('monthly-expense');
    if (monthlyExpenseEl) monthlyExpenseEl.textContent = `${currency}${monthExpense.toLocaleString()}`;

    const totalBalanceSub = document.getElementById('total-balance-sub');
    if (totalBalanceSub) {
        totalBalanceSub.textContent = transactions.length === 0 ? '尚無交易紀錄' : '即時累計淨值';
    }

    const incCountEl = document.getElementById('income-count');
    if (incCountEl) incCountEl.textContent = incomeCount === 0 ? '尚無收入紀錄' : `${incomeCount} 筆收入紀錄`;

    const expCountEl = document.getElementById('expense-count');
    if (expCountEl) expCountEl.textContent = expenseCount === 0 ? '尚無支出紀錄' : `${expenseCount} 筆支出紀錄`;

    const pct = budgetTarget > 0 ? Math.min(100, Math.round((monthExpense / budgetTarget) * 100)) : 0;
    const progressBar = document.getElementById('budget-progress-bar');
    if (progressBar) progressBar.style.width = `${pct}%`;

    const budgetSpentText = document.getElementById('budget-spent-text');
    if (budgetSpentText) budgetSpentText.textContent = `${currency}${monthExpense.toLocaleString()}`;

    const budgetTotalText = document.getElementById('budget-total-text');
    if (budgetTotalText) budgetTotalText.textContent = `/ ${currency}${budgetTarget.toLocaleString()}`;

    const budgetStatusText = document.getElementById('budget-status-text');
    if (budgetStatusText) budgetStatusText.textContent = `已使用 ${pct}%`;

    const alertTh = userPrefs.alertThreshold || 80;
    if (progressBar) {
        if (pct >= 90) {
            progressBar.className = "bg-rose-500 h-2.5 rounded-full transition-all duration-500";
        } else if (pct >= alertTh) {
            progressBar.className = "bg-amber-500 h-2.5 rounded-full transition-all duration-500";
        } else {
            progressBar.className = "bg-emerald-600 h-2.5 rounded-full transition-all duration-500";
        }
    }

    renderRecentTransactions();
    renderDashboardCategoryChart(currentMonth);
    lucide.createIcons();
}

function renderRecentTransactions() {
    const list = document.getElementById('recent-transactions-list');
    if (!list) return;

    const currency = userPrefs.currency || 'NT$';
    const recent = transactions.slice(0, 5);
    if (recent.length === 0) {
        list.innerHTML = `
            <div class="text-center py-8 text-slate-400 text-xs flex flex-col items-center justify-center gap-1.5">
                <i data-lucide="inbox" class="w-6 h-6 text-slate-300"></i>
                <span>尚無近期的交易紀錄</span>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    list.innerHTML = recent.map(t => {
        const meta = getCategoryMeta(t.category, t.type);
        const isExpense = t.type === 'expense';
        const amountClass = isExpense ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-semibold';
        const amountSign = isExpense ? '-' : '+';

        return `
            <div class="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-xl transition-all border border-slate-100">
                <div class="flex items-center space-x-3">
                    <div class="p-2 rounded-xl flex-shrink-0" style="background-color: ${meta.color}15; color: ${meta.color}">
                        <i data-lucide="${meta.icon}" class="w-4 h-4"></i>
                    </div>
                    <div>
                        <p class="text-xs font-semibold text-slate-800">${t.category}</p>
                        <p class="text-[11px] text-slate-400">${t.note || t.date}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-xs ${amountClass}">${amountSign}${currency}${t.amount.toLocaleString()}</p>
                    <p class="text-[10px] text-slate-400">${t.date}</p>
                </div>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

function renderTransactions() {
    const list = document.getElementById('full-transactions-list');
    if (!list) return;

    const currency = userPrefs.currency || 'NT$';
    const search = (document.getElementById('search-input')?.value || '').toLowerCase();
    const filterType = document.getElementById('filter-type')?.value || 'all';
    const filterCat = document.getElementById('filter-category')?.value || 'all';
    const filterMonth = document.getElementById('filter-month')?.value || '';

    let filtered = transactions.filter(t => {
        if (filterType !== 'all' && t.type !== filterType) return false;
        if (filterCat !== 'all' && t.category !== filterCat) return false;
        if (filterMonth && !t.date.startsWith(filterMonth)) return false;
        if (search) {
            const noteMatch = (t.note || '').toLowerCase().includes(search);
            const catMatch = (t.category || '').toLowerCase().includes(search);
            if (!noteMatch && !catMatch) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        list.innerHTML = `
            <tr>
                <td colspan="5" class="py-12 text-center text-slate-400 text-sm">
                    <div class="flex flex-col items-center justify-center gap-2">
                        <i data-lucide="search-x" class="w-8 h-8 text-slate-300"></i>
                        <span>沒有找到符合條件的交易紀錄</span>
                    </div>
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }

    list.innerHTML = filtered.map(t => {
        const meta = getCategoryMeta(t.category, t.type);
        const isExpense = t.type === 'expense';
        const amountClass = isExpense ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-semibold';
        const amountSign = isExpense ? '-' : '+';

        return `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">${t.date}</td>
                <td class="py-3 px-4">
                    <div class="flex items-center space-x-2.5">
                        <span class="p-1.5 rounded-lg flex-shrink-0" style="background-color: ${meta.color}15; color: ${meta.color}">
                            <i data-lucide="${meta.icon}" class="w-4 h-4"></i>
                        </span>
                        <div>
                            <p class="font-medium text-slate-800 text-sm">${t.category}</p>
                            ${t.note ? `<p class="text-xs text-slate-400">${t.note}</p>` : ''}
                        </div>
                    </div>
                </td>
                <td class="py-3 px-4 text-xs text-slate-500">
                    <span class="inline-block px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-medium">${t.paymentMethod || '現金'}</span>
                </td>
                <td class="py-3 px-4 text-right text-sm ${amountClass} whitespace-nowrap font-bold">
                    ${amountSign}${currency}${t.amount.toLocaleString()}
                </td>
                <td class="py-3 px-4 text-center whitespace-nowrap">
                    <div class="flex items-center justify-center space-x-1">
                        <button onclick="openModal('${t.id}')" class="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 transition-all" title="編輯">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                        <button onclick="triggerDelete('${t.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-all" title="刪除">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    lucide.createIcons();
}

function populateCategoryFilterOptions() {
    const select = document.getElementById('filter-category');
    if (!select) return;

    select.innerHTML = '<option value="all">所有分類</option>';
    const allCategories = [...(CATEGORIES.expense || []), ...(CATEGORIES.income || [])];
    const unique = [];
    allCategories.forEach(cat => {
        if (!unique.includes(cat.name)) {
            unique.push(cat.name);
            const opt = document.createElement('option');
            opt.value = cat.name;
            opt.textContent = cat.name;
            select.appendChild(opt);
        }
    });
}

function switchDashChartType(type) {
    dashChartType = type;
    const btnExpense = document.getElementById('btn-dash-chart-expense');
    const btnIncome = document.getElementById('btn-dash-chart-income');

    if (btnExpense && btnIncome) {
        if (type === 'expense') {
            btnExpense.className = "px-2.5 py-1 rounded-md bg-white text-rose-600 shadow-sm transition-all";
            btnIncome.className = "px-2.5 py-1 rounded-md text-slate-500 hover:text-slate-900 transition-all";
        } else {
            btnIncome.className = "px-2.5 py-1 rounded-md bg-white text-emerald-600 shadow-sm transition-all";
            btnExpense.className = "px-2.5 py-1 rounded-md text-slate-500 hover:text-slate-900 transition-all";
        }
    }

    const currentMonth = new Date().toISOString().slice(0, 7);
    renderDashboardCategoryChart(currentMonth);
}

function renderDashboardCategoryChart(monthStr) {
    const canvas = document.getElementById('dashboardCategoryChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const emptyOverlay = document.getElementById('dashboardCategoryEmpty');
    const emptyText = document.getElementById('dashboardCategoryEmptyText');
    const filtered = transactions.filter(t => t.type === dashChartType && t.date.startsWith(monthStr));

    const catTotals = {};
    filtered.forEach(t => {
        catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
    });

    const labels = Object.keys(catTotals);
    const data = Object.values(catTotals);
    const backgroundColors = labels.map(l => getCategoryMeta(l, dashChartType).color);

    if (dashCategoryChart) dashCategoryChart.destroy();

    if (labels.length === 0) {
        ctx.clearRect(0, 0, 200, 200);
        if (emptyOverlay) emptyOverlay.classList.remove('hidden');
        if (emptyText) emptyText.textContent = `本月尚無${dashChartType === 'expense' ? '支出' : '收入'}紀錄`;
        return;
    } else {
        if (emptyOverlay) emptyOverlay.classList.add('hidden');
    }

    dashCategoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: backgroundColors,
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, padding: 8 } }
            },
            cutout: '65%'
        }
    });
}

function renderAnalyticsCharts() {
    const trendCtx = document.getElementById('monthlyTrendChart')?.getContext('2d');
    if (!trendCtx) return;

    const months = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        months.push(d.toISOString().slice(0, 7));
    }

    const incomeData = months.map(m => {
        return transactions.filter(t => t.type === 'income' && t.date.startsWith(m)).reduce((acc, curr) => acc + curr.amount, 0);
    });

    const expenseData = months.map(m => {
        return transactions.filter(t => t.type === 'expense' && t.date.startsWith(m)).reduce((acc, curr) => acc + curr.amount, 0);
    });

    if (monthlyTrendChart) monthlyTrendChart.destroy();
    monthlyTrendChart = new Chart(trendCtx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                { label: '收入', data: incomeData, backgroundColor: '#10b981', borderRadius: 6 },
                { label: '支出', data: expenseData, backgroundColor: '#ef4444', borderRadius: 6 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                x: { grid: { display: false } }
            }
        }
    });

    const catCtx = document.getElementById('analyticsCategoryChart')?.getContext('2d');
    if (!catCtx) return;

    const catTotals = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
        catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
    });

    const labels = Object.keys(catTotals);
    const data = Object.values(catTotals);
    const colors = labels.map(l => getCategoryMeta(l, 'expense').color);

    if (analyticsCategoryChart) analyticsCategoryChart.destroy();
    analyticsCategoryChart = new Chart(catCtx, {
        type: 'pie',
        data: {
            labels,
            datasets: [{ data, backgroundColor: colors }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { font: { size: 12 } } }
            }
        }
    });
}

// ==========================================
// 刪除與對話框處理 (Delete & Modals)
// ==========================================
function triggerDelete(id) {
    deleteTargetId = id;
    document.getElementById('confirm-modal').classList.remove('hidden');
    document.getElementById('confirm-delete-btn').onclick = function () {
        if (deleteTargetId) {
            transactions = transactions.filter(t => t.id !== deleteTargetId);
            saveToLocalStorage();
            showToast('紀錄已刪除', 'info');
            closeConfirmModal();
            if (activeTab === 'dashboard') updateDashboard();
            else if (activeTab === 'transactions') renderTransactions();
            else if (activeTab === 'analytics') renderAnalyticsCharts();
        }
    };
}

function closeConfirmModal() {
    deleteTargetId = null;
    document.getElementById('confirm-modal').classList.add('hidden');
}

function openBudgetModal() {
    document.getElementById('budget-input').value = budgetTarget;
    document.getElementById('budget-modal').classList.remove('hidden');
}

function closeBudgetModal() {
    document.getElementById('budget-modal').classList.add('hidden');
}

function saveBudget() {
    const val = parseFloat(document.getElementById('budget-input').value);
    if (!isNaN(val) && val >= 0) {
        budgetTarget = val;
        saveToLocalStorage();
        updateDashboard();
        closeBudgetModal();
        showToast('預算設定已更新', 'success');
    }
}

// ==========================================
// 訊息提示 (Toast)
// ==========================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    let bgClass = 'bg-slate-800 text-white';
    if (type === 'success') bgClass = 'bg-emerald-600 text-white';
    if (type === 'error') bgClass = 'bg-rose-600 text-white';

    toast.className = `px-4 py-3 rounded-2xl shadow-xl ${bgClass} text-xs font-bold transition-all duration-300 flex items-center gap-2 transform translate-x-full border border-white/15`;
    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-x-full');
    }, 50);

    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==========================================
// Window 全域導出 (綁定至 HTML onclick)
// ==========================================
window.switchTab = switchTab;
window.setType = setType;
window.openModal = openModal;
window.openAddPage = openAddPage;
window.closeModal = closeModal;
window.closeAddPage = closeAddPage;
window.handleFormSubmit = handleFormSubmit;
window.selectCategory = selectCategory;
window.quickAddAmount = quickAddAmount;
window.clearAmount = clearAmount;
window.onAmountInputChanged = onAmountInputChanged;
window.setQuickDate = setQuickDate;
window.selectPaymentChip = selectPaymentChip;
window.appendNoteTag = appendNoteTag;

window.triggerDelete = triggerDelete;
window.closeConfirmModal = closeConfirmModal;
window.openBudgetModal = openBudgetModal;
window.closeBudgetModal = closeBudgetModal;
window.saveBudget = saveBudget;
window.exportData = exportData;
window.importData = importData;
window.exportCSV = exportCSV;
window.seedSampleData = seedSampleData;

window.renderSettings = renderSettings;
window.saveSettingsBudget = saveSettingsBudget;
window.setBudgetAlertThreshold = setBudgetAlertThreshold;
window.savePreferences = savePreferences;
window.switchSettingsCategoryTab = switchSettingsCategoryTab;
window.openCategoryModal = openCategoryModal;
window.closeCategoryModal = closeCategoryModal;
window.setModalCategoryType = setModalCategoryType;
window.selectModalIcon = selectModalIcon;
window.selectModalColor = selectModalColor;
window.handleCreateCategory = handleCreateCategory;
window.deleteCategory = deleteCategory;
window.resetToDefaultCategories = resetToDefaultCategories;

window.triggerClearAllData = triggerClearAllData;
window.closeClearAllModal = closeClearAllModal;
window.confirmClearAllData = confirmClearAllData;
window.switchDashChartType = switchDashChartType;
window.renderTransactions = renderTransactions;
