// ====== Firebase Setup ======
const firebaseConfig = {
    apiKey: "AIzaSyBC-sb_fWclij6zjpLkrjrWxBOyi8YMY4s",
    authDomain: "rjmoney-75aa1.firebaseapp.com",
    projectId: "rjmoney-75aa1",
    storageBucket: "rjmoney-75aa1.firebasestorage.app",
    messagingSenderId: "486707027041",
    appId: "1:486707027041:web:ccf1c3875487e1f2bede20"
};

// 初始化 Firebase
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
// 連線到 Firestore 資料庫
const db = typeof firebase !== 'undefined' ? firebase.firestore() : null;
const docRef = db ? db.collection("abang_data").doc("sharedAccount") : null;
const expensesRef = docRef ? docRef.collection("expenses") : null;

// ====== Configuration & State ======
const CATEGORIES = [
    { id: 'breakfast', name: '早餐', icon: '🍳', color: '#E9C46A' },
    { id: 'lunch', name: '午餐', icon: '🍱', color: '#DDA15E' },
    { id: 'dinner', name: '晚餐宵夜', icon: '🍜', color: '#F4A261' },
    { id: 'drinks', name: '飲料/點心', icon: '🧋', color: '#2A9D8F' }
];

let state = {
    dailyBudget: 500,
    payerAName: 'A',
    payerBName: 'B',
    expenses: [], // { id, amount, category, payer, date }
    theme: 'light'
};

window.editRecordId = null;

let currentInputAmount = '0';
let selectedCategory = 'breakfast';
let selectedPayer = 'A';
let mealTrackerDate = new Date(); // 餐費紀錄目前顯示的日期

// ====== Core Methods ======
function init() {
    if (docRef && typeof firebase !== 'undefined' && firebase.auth) {
        // 匿名登入後再連線 Firebase（防護：規則要求 request.auth != null）
        let cloudStarted = false;
        const startCloud = () => {
            if (!cloudStarted) {
                cloudStarted = true;
                loadStateFromFirebase();
            }
        };
        firebase.auth().onAuthStateChanged((user) => {
            if (user) startCloud();
        });
        firebase.auth().signInAnonymously().catch((err) => {
            // 匿名登入若尚未啟用仍嘗試連線(規則若仍開放可運作)，啟用後即自動生效
            console.error("阿邦匿名登入失敗，仍嘗試連線雲端:", err);
            startCloud();
        });
    } else if (docRef) {
        loadStateFromFirebase();
    } else {
        loadState();
    }
    document.documentElement.setAttribute('data-theme', state.theme || 'light');
    setupNavigation();
    renderCategories();
    setupNumpad();
    setupSettings();
    updateDashboard();
}

function loadStateFromFirebase() {
    // 1. 監聽設定與遷移舊資料
    docRef.onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            // 更新設定
            state.dailyBudget = data.dailyBudget || 500;
            state.payerAName = data.payerAName || 'A';
            state.payerBName = data.payerBName || 'B';
            state.theme = data.theme || 'light';

            // 資料更新後即時刷新畫面
            document.documentElement.setAttribute('data-theme', state.theme || 'light');
            updateDashboard();
            renderCategories(); // 更新 A/B 付款按鈕名稱

            // 自動遷移舊資料邏輯
            if (data.expenses && Array.isArray(data.expenses) && data.expenses.length > 0) {
                console.log("阿邦發現舊格式資料，正在幫你搬家到安全的地方... 🐾");
                data.expenses.forEach(exp => {
                    const id = exp.id ? String(exp.id) : Date.now().toString() + Math.random().toString(36).substr(2, 5);
                    expensesRef.doc(id).set(exp).catch(e => console.error("遷移失敗:", e));
                });
                // 遷移完成後移除舊陣列，避免重複遷移
                docRef.update({
                    expenses: firebase.firestore.FieldValue.delete()
                }).then(() => console.log("搬家完成！以後記帳更安全囉 🐰✨"));
            }
        } else {
            // 第一天上線，初始化雲端資料
            docRef.set({
                dailyBudget: state.dailyBudget,
                payerAName: state.payerAName,
                payerBName: state.payerBName,
                theme: state.theme
            });
        }
    });

    // 2. 監聽支出紀錄子集合
    if (expensesRef) {
        expensesRef.orderBy('date', 'desc').onSnapshot((snapshot) => {
            console.log("阿邦收到雲端資料更新囉！🐾");
            const newExpenses = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                // 舊資料遷移：早午餐 (brunch) 歸到午餐 (lunch)
                if (data.category === 'brunch') {
                    data.category = 'lunch';
                    expensesRef.doc(doc.id).update({ category: 'lunch' })
                        .catch(e => console.error('分類遷移失敗:', e));
                }
                // 舊資料清除：「其他」(others) 分類已移除，刪除既有紀錄
                if (data.category === 'others') {
                    expensesRef.doc(doc.id).delete()
                        .catch(e => console.error('其他紀錄刪除失敗:', e));
                    return;
                }
                newExpenses.push({ ...data, id: doc.id });
            });
            
            // 按照日期排序
            state.expenses = newExpenses;
            
            updateDashboard();
            refreshActiveView();
        }, (error) => {
            console.error("監聽支出失敗 (可能是權限問題或離線):", error);
            // 監聽失敗時，確保至少有一份本地資料可用
            if (state.expenses.length === 0) {
                loadState();
                updateDashboard();
            }
        });
    }
}

function refreshActiveView() {
    const activeViewEl = document.querySelector('.view.active');
    if (!activeViewEl) return;
    
    const currentActiveView = activeViewEl.id;
    if (currentActiveView === 'view-records') renderRecords();
    if (currentActiveView === 'view-stats') {
        const selector = document.getElementById('stats-month-selector');
        if (selector && selector.value) {
            try { renderStatsForMonth(selector.value); } catch (e) { }
        } else {
            initStatsView();
        }
    }
}

function loadState() {
    const saved = localStorage.getItem('abangState');
    if (saved) {
        state = JSON.parse(saved);
    }
}

function saveState() {
    // 存到 Firebase 雲端 (只存設定，支出紀錄已經獨立儲存)
    if (docRef) {
        docRef.update({
            dailyBudget: state.dailyBudget,
            payerAName: state.payerAName,
            payerBName: state.payerBName,
            theme: state.theme
        }).catch(err => {
            console.error("Firebase 設定寫入失敗: ", err);
        });
    }
    // 本機也存一份當備份 (包含目前的 expenses 狀態)
    localStorage.setItem('abangState', JSON.stringify(state));
}

// ====== View Navigation ======
function setupNavigation() {
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    const views = document.querySelectorAll('.view');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Update nav active state
            navItems.forEach(nav => nav.classList.remove('active'));
            if (!item.classList.contains('add-btn')) {
                item.classList.add('active');
            }

            // Switch view
            const target = item.getAttribute('data-target');
            views.forEach(view => view.classList.remove('active'));
            document.getElementById(`view-${target}`).classList.add('active');

            // Refresh Dashboard on view
            if (target === 'dashboard') {
                updateDashboard();
                updateAbangGreeting(); // 換成動態問候
            } else if (target === 'records') {
                renderRecords();
            } else if (target === 'stats') {
                initStatsView();
            } else if (target === 'settings') {
                document.getElementById('setting-budget').value = state.dailyBudget;
                document.getElementById('setting-payer-a').value = state.payerAName || 'A';
                document.getElementById('setting-payer-b').value = state.payerBName || 'B';

                document.querySelectorAll('.theme-btn').forEach(btn => {
                    if (btn.getAttribute('data-theme-val') === (state.theme || 'light')) {
                        btn.classList.add('active');
                        btn.style.background = 'var(--primary)';
                        btn.style.color = 'white';
                        btn.style.borderColor = 'var(--primary)';
                    } else {
                        btn.classList.remove('active');
                        btn.style.background = 'var(--card-bg)';
                        btn.style.color = 'var(--text-main)';
                        btn.style.borderColor = 'var(--gray)';
                    }
                });
            }
        });
    });
}

// ====== Add Expense View ======
function renderCategories() {
    const container = document.querySelector('.categories');
    container.innerHTML = CATEGORIES.map(cat => `
        <div class="category-item ${selectedCategory === cat.id ? 'selected' : ''}" data-cat="${cat.id}">
            <div class="cat-icon">${cat.icon}</div>
            <span class="cat-label">${cat.name}</span>
        </div>
    `).join('');

    container.querySelectorAll('.category-item').forEach(el => {
        el.addEventListener('click', () => {
            container.querySelectorAll('.category-item').forEach(i => i.classList.remove('selected'));
            el.classList.add('selected');
            selectedCategory = el.getAttribute('data-cat');
        });
    });

    // Payer toggles
    const payerContainer = document.querySelector('.payer-toggle');
    payerContainer.innerHTML = `
        <button class="payer-btn ${selectedPayer === 'A' ? 'active' : ''}" data-payer="A">${state.payerAName || 'A'} 付款</button>
        <button class="payer-btn ${selectedPayer === 'B' ? 'active' : ''}" data-payer="B">${state.payerBName || 'B'} 付款</button>
    `;

    document.querySelectorAll('.payer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.payer-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            selectedPayer = e.target.getAttribute('data-payer');
        });
    });
}

function setupNumpad() {
    const inputDisplay = document.getElementById('input-amount');

    const formatDisplay = (expr) => {
        if (!isNaN(expr) && expr !== '') {
            return Number(expr).toLocaleString();
        }
        return expr;
    };

    document.querySelectorAll('.num-btn[data-num], .btn-calc[data-op]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const val = e.target.getAttribute('data-num') || e.target.getAttribute('data-op');
            if (val !== null) {
                if (currentInputAmount === '0' && !isNaN(val)) {
                    currentInputAmount = val;
                } else if (currentInputAmount === '0' && isNaN(val)) {
                    currentInputAmount += val;
                } else if (currentInputAmount.length < 15) {
                    currentInputAmount += val;
                }
                inputDisplay.innerText = formatDisplay(currentInputAmount);
            }
        });
    });

    const evaluateExpression = () => {
        try {
            const sanitized = currentInputAmount.replace(/[^-()\d/*+.]/g, '');
            const res = new Function('return ' + sanitized)();
            if (!isNaN(res) && isFinite(res)) {
                currentInputAmount = Math.max(0, Math.floor(res)).toString();
                inputDisplay.innerText = formatDisplay(currentInputAmount);
            }
        } catch (err) {
            // override or ignore invalid expression
        }
    };

    document.getElementById('btn-eq').addEventListener('click', evaluateExpression);

    document.getElementById('btn-clear').addEventListener('click', () => {
        currentInputAmount = '0';
        inputDisplay.innerText = '0';
    });

    document.getElementById('btn-save').addEventListener('click', () => {
        evaluateExpression();
        const amount = parseInt(currentInputAmount);
        console.log("嘗試儲存支出:", amount, selectedCategory, selectedPayer);

        if (amount > 0) {
            const dateInput = document.getElementById('expense-date').value;
            const detailInput = document.getElementById('expense-detail').value.trim();

            let expenseDate;
            const userChangedDate = dateInput && dateInput !== window.formOpenDateValue;
            if (window.editRecordId || userChangedDate) {
                const [datePart, timePart] = dateInput.split('T');
                const [year, month, day] = datePart.split('-').map(Number);
                const [hours, minutes] = (timePart || '00:00').split(':').map(Number);
                expenseDate = new Date(year, month - 1, day, hours, minutes).toISOString();
            } else {
                expenseDate = new Date().toISOString();
            }

            const expenseData = {
                amount: amount,
                category: selectedCategory,
                payer: selectedPayer,
                date: expenseDate,
                detail: detailInput
            };

            // 樂觀更新 local state，讓 UI 立即有反應
            const tempId = window.editRecordId || Date.now().toString();
            if (!window.editRecordId) {
                const newRecord = { ...expenseData, id: tempId };
                state.expenses.unshift(newRecord);
            } else {
                const index = state.expenses.findIndex(e => e.id === window.editRecordId);
                if (index !== -1) state.expenses[index] = { ...expenseData, id: window.editRecordId };
            }
            updateDashboard();
            saveState(); // 存到 localStorage 當備份

            if (expensesRef) {
                console.log("正在同步到 Firebase...");
                if (window.editRecordId) {
                    expensesRef.doc(String(window.editRecordId)).update(expenseData)
                        .then(() => console.log("Firebase 更新成功 ✨"))
                        .catch(err => console.error("Firebase 更新失敗:", err));
                    window.editRecordId = null;
                    document.getElementById('add-form-title').innerText = '記一筆';
                } else {
                    expensesRef.add(expenseData)
                        .then((doc) => console.log("Firebase 新增成功，ID:", doc.id))
                        .catch(err => {
                            console.error("Firebase 新增失敗:", err);
                            alert("雲端同步失敗，但已存在本地囉 🐾");
                        });
                }
            }

            // Switch back to dashboard
            const saveQuotes = [
                '記好囉！阿邦覺得你很棒 🎉',
                '記帳完成！阿邦幫你守好荷包 💪🐰',
                '存檔成功！每一筆都是理財的一步 ✨🐾',
                '記下來啦！阿邦替你鼓掌 👏🐰',
                '完美！繼續保持記帳的好習慣 🌟🐾'
            ];
            window.justSaved = true;
            document.querySelector('[data-target="dashboard"]').click();
            resetAddForm(); // 表單常駐首頁，存檔後清空供下一筆使用
            document.getElementById('abang-quote').innerText = saveQuotes[Math.floor(Math.random() * saveQuotes.length)];
        }
    });
}

window.editRecord = function (id) {
    const record = state.expenses.find(e => e.id === id);
    if (!record) return;

    window.editRecordId = id;

    // Go to dashboard where the form now lives, then scroll to it
    document.querySelector('[data-target="dashboard"]').click();
    document.querySelector('.add-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });

    document.getElementById('add-form-title').innerText = '編輯紀錄';

    // Populate values
    currentInputAmount = record.amount.toString();
    const inputDisplay = document.getElementById('input-amount');
    inputDisplay.innerText = Number(currentInputAmount).toLocaleString();

    document.getElementById('expense-detail').value = record.detail || '';

    const d = new Date(record.date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    document.getElementById('expense-date').value = `${yyyy}-${mm}-${dd}T${hh}:${min}`;

    selectedCategory = record.category;
    document.querySelectorAll('.cat-btn, .category-item').forEach(btn => {
        if (btn.getAttribute('data-cat') === selectedCategory || btn.getAttribute('data-id') === selectedCategory) {
            btn.classList.add('selected');
            btn.classList.add('active');
        } else {
            btn.classList.remove('selected');
            btn.classList.remove('active');
        }
    });

    selectedPayer = record.payer;
    const payerContainer = document.querySelector('.payer-toggle');
    if (payerContainer) {
        payerContainer.innerHTML = `
            <button class="payer-btn ${selectedPayer === 'A' ? 'active' : ''}" data-payer="A">${state.payerAName || 'A'} 付款</button>
            <button class="payer-btn ${selectedPayer === 'B' ? 'active' : ''}" data-payer="B">${state.payerBName || 'B'} 付款</button>
        `;
        document.querySelectorAll('.payer-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.payer-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                selectedPayer = e.target.getAttribute('data-payer');
            });
        });
    }
};

// Ensure delete property is accessible globally
window.deleteRecord = function (id) {
    if (confirm('確定要刪除這筆紀錄嗎？')) {
        if (expensesRef) {
            expensesRef.doc(String(id)).delete().catch(err => console.error("刪除失敗:", err));
        } else {
            state.expenses = state.expenses.filter(e => e.id !== id);
            saveState();
            renderRecords();
            updateDashboard();
        }
    }
};

// ====== Quick Add from Meal Tracker ======
window.quickAddMeal = function(category, payer) {
    // The form lives on the dashboard — just reset and scroll to it
    resetAddForm();
    document.querySelector('.add-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Pre-fill the date from the meal tracker's selected date
    const d = mealTrackerDate;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const dateValue = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    document.getElementById('expense-date').value = dateValue;
    window.formOpenDateValue = dateValue;

    // Pre-select payer (default to last used)
    if (payer) selectedPayer = payer;
    document.querySelectorAll('.payer-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-payer') === selectedPayer);
    });

    // Pre-select category
    selectedCategory = category;
    document.querySelectorAll('.cat-btn, .category-item').forEach(btn => {
        const catId = btn.getAttribute('data-cat') || btn.getAttribute('data-id');
        btn.classList.toggle('selected', catId === category);
        btn.classList.toggle('active', catId === category);
    });
};

// ====== Meal Tracker Date Navigation ======
window.changeMealDate = function(delta) {
    mealTrackerDate.setDate(mealTrackerDate.getDate() + delta);

    // Don't allow going into the future
    const today = new Date();
    if (mealTrackerDate > today) {
        mealTrackerDate = new Date(today);
    }

    updateMealTrackerFromDate();
};

function updateMealTrackerFromDate() {
    const target = mealTrackerDate;
    const dateExpenses = state.expenses.filter(e => isSameDay(new Date(e.date), target));
    renderMealTracker(dateExpenses);
}

function resetAddForm() {
    window.editRecordId = null;
    document.getElementById('add-form-title').innerText = '記一筆';

    currentInputAmount = '0';
    document.getElementById('input-amount').innerText = '0';
    document.getElementById('expense-detail').value = '';

    // Set default date and time to now
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const hh = String(today.getHours()).padStart(2, '0');
    const min = String(today.getMinutes()).padStart(2, '0');
    const defaultDateValue = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    document.getElementById('expense-date').value = defaultDateValue;
    window.formOpenDateValue = defaultDateValue;
}

// ====== Dashboard Logic ======
function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

function isSameWeek(d1, d2) {
    const oneJan = new Date(d1.getFullYear(), 0, 1);
    const w1 = Math.ceil((((d1.getTime() - oneJan.getTime()) / 86400000) + oneJan.getDay() + 1) / 7);
    const oneJan2 = new Date(d2.getFullYear(), 0, 1);
    const w2 = Math.ceil((((d2.getTime() - oneJan2.getTime()) / 86400000) + oneJan2.getDay() + 1) / 7);
    return w1 === w2 && d1.getFullYear() === d2.getFullYear();
}

function isSameMonth(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth();
}

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function updateAbangGreeting(todayOverBudget) {
    const hour = new Date().getHours();
    const titleEl = document.getElementById('greeting-title');
    const quoteEl = document.getElementById('abang-quote');

    // 不要覆蓋掉剛記完帳的儲存成功提示
    if (window.justSaved) {
        window.justSaved = false;
        return;
    }

    const pick = arr => arr[Math.floor(Math.random() * arr.length)];

    // 超支時，阿邦的話會改變
    if (todayOverBudget) {
        const overQuotes = [
            '今天花超啦！阿邦的荷包在淌血 🩸😱',
            '超支警報！錢包君正在哭泣 💸🩸',
            '花太多了啦！阿邦快暈倒了 🩸🐰💫',
            '預算爆炸！阿邦需要急救 🚨🩸',
            '荷包大出血！明天省著點吧 🩸😿',
            '超出預算了，不過沒關係，明天重新來過 💪🐰',
            '今天多花了點…阿邦不怪你，明天一起努力 🥲🐾',
            '超支了！要不要把非必要的消費備個備注？🤔🐰',
            '偶爾多花一點沒關係，阿邦陪你一起調整 💙🐾',
            '今天預算超跑，深呼吸，明天的你會更厲害的 🌟🐰'
        ];
        titleEl.innerText = '超支了！';
        quoteEl.innerText = pick(overQuotes);
        return;
    }

    if (hour >= 5 && hour < 11) {
        titleEl.innerText = '早安！';
        quoteEl.innerText = pick([
            '新的一天，阿邦陪你精打細算 ☀️🐰',
            '早安！記得把今天第一筆花費記好 🌅🐾',
            '早餐吃了嗎？把錢記下來，美好的一天開始！🥐🐰',
            '一早就看到你，阿邦超開心的 ☀️🐾',
            '今天也要精打細算，阿邦幫你一起盯 🌤️🐰'
        ]);
    } else if (hour >= 11 && hour < 14) {
        titleEl.innerText = '午安！';
        quoteEl.innerText = pick([
            '吃飽了嗎？記得把午餐錢記下來喔 🍱🐾',
            '午餐時間到！今天吃什麼呢？🍜🐰',
            '好好吃頓飯，上午辛苦了 🍱🐾',
            '中午好！花錢要記帳，吃飯要開心 🥢✨',
            '午休前把今天的花費記好，再去休息喔 😴🐰'
        ]);
    } else if (hour >= 14 && hour < 18) {
        titleEl.innerText = '下午好！';
        quoteEl.innerText = pick([
            '下午茶時間到了嗎？阿邦幫你看緊荷包 ☕️🐰',
            '下午好！撐過午後睡意，獎勵自己一下 ☕️🐾',
            '下午三點了，買杯飲料也要記帳喔 🧋🐰',
            '快下班啦！今天的帳都記好了嗎？💼🐾',
            '剩最後幾小時，今天的預算還剩多少？📊🐰'
        ]);
    } else if (hour >= 18 && hour < 22) {
        titleEl.innerText = '晚安！';
        quoteEl.innerText = pick([
            '辛苦了一天，今晚吃點好吃的吧 🌙🐾',
            '下班了！今天的花費有確實記帳嗎？🌙🐰',
            '晚餐吃什麼？阿邦建議記帳後再好好吃 🍜🐾',
            '一天快過去了，把花費整理好再放鬆 🌙✨',
            '辛苦了！犒賞自己也別忘了記帳 🌙🐰'
        ]);
    } else {
        titleEl.innerText = '夜深了！';
        quoteEl.innerText = pick([
            '還沒睡嗎？熬夜容易亂花錢喔 💤🐰',
            '這麼晚記帳很棒，不過也要早點睡喔 🌙💤',
            '深夜記帳勇士！阿邦都在陪著你 🌙🐰',
            '熬夜傷身，也容易手滑亂刷卡喔 💸💤',
            '帳記完了就快去睡覺吧！阿邦看著你 🌙🐾'
        ]);
    }
}

function updateDashboard() {
    const today = new Date();

    // Calculate dates for display
    const formatDateStr = (d) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    const todayStr = formatDateStr(today);

    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (6 - dayOfWeek));
    const weekStr = `${formatDateStr(startOfWeek)} - ${formatDateStr(endOfWeek)}`;

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth(), getDaysInMonth(today.getFullYear(), today.getMonth()));
    const monthStr = `${formatDateStr(startOfMonth)} - ${formatDateStr(endOfMonth)}`;

    document.getElementById('today-date-range').innerText = todayStr;
    document.getElementById('weekly-date-range').innerText = weekStr;
    document.getElementById('monthly-date-range').innerText = monthStr;

    // Calculate totals
    const todayExpenses = state.expenses.filter(e => isSameDay(new Date(e.date), today));
    const weeklyExpenses = state.expenses.filter(e => isSameWeek(new Date(e.date), today));
    const monthlyExpenses = state.expenses.filter(e => isSameMonth(new Date(e.date), today));

    const todaySpent = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
    const weeklySpent = weeklyExpenses.reduce((sum, e) => sum + e.amount, 0);
    const monthlySpent = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);

    const weeklyBudget = state.dailyBudget * 7;
    const daysInMonth = getDaysInMonth(today.getFullYear(), today.getMonth());
    const monthlyBudget = state.dailyBudget * daysInMonth;

    const todayRemaining = state.dailyBudget - todaySpent;
    const weeklyRemaining = weeklyBudget - weeklySpent;
    const monthlyRemaining = monthlyBudget - monthlySpent;

    const todayOver = todayRemaining < 0;
    const weeklyOver = weeklyRemaining < 0;
    const monthlyOver = monthlyRemaining < 0;

    // Update Abang greeting (pass over-budget state)
    updateAbangGreeting(todayOver);

    // Update Today Card
    document.getElementById('today-spent').innerText = todaySpent.toLocaleString();
    document.getElementById('today-budget').innerText = state.dailyBudget.toLocaleString();
    const remainEl = document.getElementById('today-remaining');
    if (todayOver) {
        remainEl.innerHTML = `🩸 -NT$ ${Math.abs(todayRemaining).toLocaleString()}`;
        remainEl.classList.add('blood-red');
        remainEl.classList.remove('danger');
    } else {
        remainEl.innerHTML = `NT$ ${todayRemaining.toLocaleString()}`;
        remainEl.classList.remove('blood-red', 'danger');
    }

    const todayPct = Math.min((todaySpent / state.dailyBudget) * 100, 100);
    const todayBar = document.getElementById('today-progress');
    todayBar.style.width = `${todayPct}%`;
    if (todayPct >= 100) todayBar.classList.add('danger-fill');
    else todayBar.classList.remove('danger-fill');

    // Update Weekly Card
    const weekRemainEl = document.getElementById('weekly-remaining');
    if (weeklyOver) {
        weekRemainEl.innerHTML = `🩸 -NT$ ${Math.abs(weeklyRemaining).toLocaleString()}`;
        weekRemainEl.classList.add('blood-red');
        weekRemainEl.classList.remove('danger');
    } else {
        weekRemainEl.innerHTML = `NT$ ${weeklyRemaining.toLocaleString()}`;
        weekRemainEl.classList.remove('blood-red', 'danger');
    }

    const weekPct = Math.min((weeklySpent / weeklyBudget) * 100, 100);
    const weekBar = document.getElementById('weekly-progress');
    weekBar.style.width = `${weekPct}%`;
    if (weekPct >= 100) weekBar.classList.add('danger-fill');
    else weekBar.classList.remove('danger-fill');

    // Update Monthly Card
    const monthRemainEl = document.getElementById('monthly-remaining');
    if (monthlyOver) {
        monthRemainEl.innerHTML = `🩸 -NT$ ${Math.abs(monthlyRemaining).toLocaleString()}`;
        monthRemainEl.classList.add('blood-red');
        monthRemainEl.classList.remove('danger');
    } else {
        monthRemainEl.innerHTML = `NT$ ${monthlyRemaining.toLocaleString()}`;
        monthRemainEl.classList.remove('blood-red', 'danger');
    }

    const monthPct = Math.min((monthlySpent / monthlyBudget) * 100, 100);
    const monthBar = document.getElementById('monthly-progress');
    monthBar.style.width = `${monthPct}%`;
    if (monthPct >= 100) monthBar.classList.add('danger-fill');
    else monthBar.classList.remove('danger-fill');

    // Update Pie Chart
    updatePieChart(weeklyExpenses, weeklySpent, weeklyBudget);

    // Update 7-Day Bar Chart
    update7DayBarChart();

    // Update Meal Tracker (use mealTrackerDate, not necessarily today)
    updateMealTrackerFromDate();
}

function update7DayBarChart() {
    const container = document.getElementById('bar-chart-7days');
    if (!container) return;

    const today = new Date();
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    const days = [];

    // Build 7-day data (from 6 days ago to today)
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dayExpenses = state.expenses.filter(e => isSameDay(new Date(e.date), d));
        const total = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
        days.push({
            date: d,
            dayName: dayNames[d.getDay()],
            dateLabel: `${d.getMonth() + 1}/${d.getDate()}`,
            total: total,
            isToday: i === 0
        });
    }

    const maxAmount = Math.max(...days.map(d => d.total), state.dailyBudget, 1);
    const maxBarHeight = 120; // px
    const budgetLineBottom = (state.dailyBudget / maxAmount) * maxBarHeight;

    let html = '';
    days.forEach((day, idx) => {
        const barHeight = (day.total / maxAmount) * maxBarHeight;
        const isOverBudget = day.total > state.dailyBudget;
        const barClass = day.isToday ? 'today' : (isOverBudget ? 'over-budget' : '');
        const amountStr = day.total > 0 ? `$${day.total.toLocaleString()}` : '';

        html += `
            <div class="bar-column">
                <span class="bar-amount">${amountStr}</span>
                <div class="bar-wrapper">
                    <div class="bar-fill ${barClass}" style="height: ${Math.max(barHeight, day.total > 0 ? 4 : 0)}px; animation: barGrow 0.6s ease ${idx * 0.08}s both;"></div>
                    ${idx === 6 ? `<div class="bar-budget-line" style="bottom: ${budgetLineBottom}px;"></div>` : ''}
                </div>
                <span class="bar-day ${day.isToday ? 'today' : ''}">${day.isToday ? '今天' : day.dayName}</span>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ====== Meal Tracker (Combined View) ======
function renderMealTracker(dayExpenses) {
    const container = document.getElementById('meal-tracker');
    if (!container) return;

    // Update date label
    const labelEl = document.getElementById('meal-date-label');
    const nextBtn = document.getElementById('meal-next-day');
    const today = new Date();
    const isToday = isSameDay(mealTrackerDate, today);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const isYesterday = isSameDay(mealTrackerDate, yesterday);

    if (isToday) {
        labelEl.innerText = '今天';
        labelEl.classList.add('is-today');
    } else if (isYesterday) {
        labelEl.innerText = '昨天';
        labelEl.classList.remove('is-today');
    } else {
        const m = mealTrackerDate.getMonth() + 1;
        const d = mealTrackerDate.getDate();
        const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
        const dayName = dayNames[mealTrackerDate.getDay()];
        labelEl.innerText = `${m}/${d} (${dayName})`;
        labelEl.classList.remove('is-today');
    }

    // Disable next button if already at today
    nextBtn.disabled = isToday;
    nextBtn.classList.toggle('disabled', isToday);

    // Meal categories to track
    const mealSlots = [
        { id: 'breakfast', label: '早餐', icon: '🍳' },
        { id: 'lunch', label: '午餐', icon: '🍱' },
        { id: 'dinner', label: '晚餐', icon: '🍜' },
        { id: 'drinks', label: '飲料/點心', icon: '🧋' }
    ];

    // Combine both payers — meals are tracked as one shared unit
    let slotsHtml = '';
    mealSlots.forEach(slot => {
        const records = dayExpenses.filter(e => e.category === slot.id);
        if (records.length > 0) {
            // Has records — show them
            const totalAmount = records.reduce((sum, e) => sum + e.amount, 0);
            const details = records.map(e => e.detail).filter(Boolean).join('、');
            slotsHtml += `
                <div class="meal-slot filled">
                    <span class="meal-slot-icon">${slot.icon}</span>
                    <div class="meal-slot-info">
                        <span class="meal-slot-label">${slot.label}</span>
                        <span class="meal-slot-detail">${details || ''}</span>
                    </div>
                    <span class="meal-slot-amount">$${totalAmount.toLocaleString()}</span>
                </div>
            `;
        } else {
            // Empty — clickable to add
            slotsHtml += `
                <div class="meal-slot empty" onclick="quickAddMeal('${slot.id}')">
                    <span class="meal-slot-icon faded">${slot.icon}</span>
                    <div class="meal-slot-info">
                        <span class="meal-slot-label faded">${slot.label}</span>
                        <span class="meal-slot-hint">點擊記帳</span>
                    </div>
                    <span class="meal-slot-add">+</span>
                </div>
            `;
        }
    });

    // Total for the day (meals only)
    const mealCatIds = mealSlots.map(s => s.id);
    const mealTotal = dayExpenses.filter(e => mealCatIds.includes(e.category)).reduce((sum, e) => sum + e.amount, 0);

    container.innerHTML = `
        <div class="meal-day-header">
            <span class="meal-day-title">三餐合計</span>
            <span class="meal-day-total">$${mealTotal.toLocaleString()}</span>
        </div>
        <div class="meal-slots">
            ${slotsHtml}
        </div>
    `;
}

function updatePieChart(expenses, total, budget) {
    const pieCenterValue = document.getElementById('pie-center-value');
    const remaining = budget - total;

    if (remaining < 0) {
        pieCenterValue.innerText = `-NT$ ${Math.abs(remaining).toLocaleString()}`;
        pieCenterValue.style.color = 'var(--danger)';
    } else {
        pieCenterValue.innerText = `NT$ ${remaining.toLocaleString()}`;
        pieCenterValue.style.color = 'var(--dark)';
    }

    const legendContainer = document.getElementById('chart-legend');
    const pie = document.getElementById('expense-pie');

    if (total === 0) {
        pie.style.background = 'conic-gradient(var(--gray) 0% 100%)';
        legendContainer.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">目前尚無花費</span>';
        return;
    }

    // Aggregate by category
    const catTotals = {};
    expenses.forEach(e => {
        catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
    });

    let currentAngle = 0;
    let gradients = [];
    let legendsHTML = [];

    const pieBase = total;

    CATEGORIES.forEach(cat => {
        if (catTotals[cat.id]) {
            const pct = (catTotals[cat.id] / pieBase) * 100;
            gradients.push(`${cat.color} ${currentAngle}% ${currentAngle + pct}%`);
            currentAngle += pct;

            legendsHTML.push(`
                <div class="legend-item">
                    <div class="legend-color" style="background:${cat.color}"></div>
                    <span>${cat.name} ${Math.round(pct)}%</span>
                </div>
            `);
        }
    });

    pie.style.background = `conic-gradient(${gradients.join(', ')})`;
    legendContainer.innerHTML = legendsHTML.join('');
}

function renderRecords() {
    const recordsList = document.getElementById('records-list');

    if (state.expenses.length === 0) {
        recordsList.innerHTML = '<p style="text-align:center;color:var(--text-muted);margin-top:20px;">尚無記帳紀錄</p>';
        return;
    }

    // Sort descending by date
    const sorted = [...state.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

    // 依日期分組（新到舊）
    const groups = [];
    const groupMap = {};
    sorted.forEach(exp => {
        const d = new Date(exp.date);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        if (!groupMap[key]) {
            groupMap[key] = { date: d, items: [] };
            groups.push(groupMap[key]);
        }
        groupMap[key].items.push(exp);
    });

    const today = new Date();
    const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

    recordsList.innerHTML = groups.map(group => {
        const d = group.date;
        let dateLabel;
        if (isSameDay(d, today)) dateLabel = '今天';
        else if (isSameDay(d, yesterday)) dateLabel = '昨天';
        else dateLabel = `${d.getMonth() + 1}月${d.getDate()}日 週${weekdays[d.getDay()]}`;

        const dayTotal = group.items.reduce((sum, e) => sum + e.amount, 0);

        const rows = group.items.map(exp => {
            const cat = CATEGORIES.find(c => c.id === exp.category) || { name: '未知', icon: '❓', color: '#888' };
            let payerText = exp.payer;
            if (exp.payer === 'A') payerText = state.payerAName || 'A';
            else if (exp.payer === 'B') payerText = state.payerBName || 'B';

            const t = new Date(exp.date);
            const timeStr = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;

            return `
                <div class="record-item">
                    <div class="record-icon" style="background:${cat.color}22; color:${cat.color}">${cat.icon}</div>
                    <div class="record-main">
                        <div class="record-title">${cat.name}${exp.detail ? `<span class="record-detail">${exp.detail}</span>` : ''}</div>
                        <div class="record-meta">${timeStr} · ${payerText}</div>
                    </div>
                    <div class="record-amount">NT$ ${exp.amount.toLocaleString()}</div>
                    <div class="record-actions">
                        <button class="record-edit" onclick="editRecord('${exp.id}')" title="編輯紀錄">✏️</button>
                        <button class="record-del" onclick="deleteRecord('${exp.id}')" title="刪除紀錄">✕</button>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="record-group">
                <div class="record-date-header">
                    <span class="record-date-label">${dateLabel}</span>
                    <span class="record-day-total">NT$ ${dayTotal.toLocaleString()}</span>
                </div>
                <div class="record-day-list">${rows}</div>
            </div>
        `;
    }).join('');
}

// ====== Statistics View ======
function initStatsView() {
    const selector = document.getElementById('stats-month-selector');

    // Find all distinct months in expenses
    const months = new Set();
    state.expenses.forEach(e => {
        const d = new Date(e.date);
        const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.add(mStr);
    });

    const monthList = Array.from(months).sort().reverse(); // Newest first

    if (monthList.length === 0) {
        selector.innerHTML = '<option value="">無資料</option>';
        selector.disabled = true;
        renderStatsForMonth('');
        return;
    }

    selector.disabled = false;
    selector.innerHTML = monthList.map(m => `<option value="${m}">${m}</option>`).join('');

    // Re-bind to prevent multiple listeners
    selector.onchange = (e) => renderStatsForMonth(e.target.value);

    // Render the initial selected month
    renderStatsForMonth(monthList[0]);
}

function renderStatsForMonth(monthStr) {
    if (!monthStr) {
        document.getElementById('stats-total-amount').innerText = 'NT$ 0';
        updateStatsPieChart([], 0);
        return;
    }

    const [year, month] = monthStr.split('-');
    const monthExpenses = state.expenses.filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === parseInt(year) && (d.getMonth() + 1) === parseInt(month);
    });

    const totalSpent = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    document.getElementById('stats-total-amount').innerText = `NT$ ${totalSpent.toLocaleString()}`;



    updateStatsPieChart(monthExpenses, totalSpent);
    renderStatsMonthlyBarChart(year, month, monthExpenses);
    renderStatsTopExpenses(monthExpenses);
    renderDailyStatsTable(year, month, monthExpenses);
}

function renderStatsMonthlyBarChart(yearStr, monthStr, expenses) {
    const container = document.getElementById('stats-monthly-bar-chart');
    const summaryEl = document.getElementById('stats-bar-summary');
    if (!container) return;

    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const daysInMonth = getDaysInMonth(year, month - 1);

    // Build daily totals
    const dailyTotals = [];
    for (let i = 1; i <= daysInMonth; i++) {
        const dayExp = expenses.filter(e => new Date(e.date).getDate() === i);
        dailyTotals.push({
            day: i,
            total: dayExp.reduce((sum, e) => sum + e.amount, 0)
        });
    }

    const maxAmount = Math.max(...dailyTotals.map(d => d.total), state.dailyBudget, 1);
    const maxBarHeight = 100; // px
    const budgetLineBottom = (state.dailyBudget / maxAmount) * maxBarHeight;

    // Calculate stats
    const daysWithSpending = dailyTotals.filter(d => d.total > 0);
    const avgSpending = daysWithSpending.length > 0
        ? Math.round(daysWithSpending.reduce((sum, d) => sum + d.total, 0) / daysWithSpending.length)
        : 0;
    const overBudgetDays = dailyTotals.filter(d => d.total > state.dailyBudget).length;
    const maxDay = dailyTotals.reduce((max, d) => d.total > max.total ? d : max, { day: 0, total: 0 });

    let html = '';
    dailyTotals.forEach((day, idx) => {
        const barHeight = (day.total / maxAmount) * maxBarHeight;
        const isOverBudget = day.total > state.dailyBudget;
        const barClass = isOverBudget ? 'over-budget' : '';

        html += `
            <div class="stats-bar-col">
                <div class="stats-bar-wrapper">
                    <div class="stats-bar-fill ${barClass}" style="height: ${Math.max(barHeight, day.total > 0 ? 3 : 0)}px; animation: barGrow 0.4s ease ${idx * 0.02}s both;"></div>
                </div>
                <span class="stats-bar-day">${day.day}</span>
            </div>
        `;
    });

    // Add budget line overlay
    container.innerHTML = html;
    container.style.setProperty('--budget-line-bottom', `${budgetLineBottom}px`);

    // Render summary
    summaryEl.innerHTML = `
        <div class="stats-bar-stat">
            <span class="stats-bar-stat-label">日均花費</span>
            <span class="stats-bar-stat-value">$${avgSpending.toLocaleString()}</span>
        </div>
        <div class="stats-bar-stat">
            <span class="stats-bar-stat-label">超支天數</span>
            <span class="stats-bar-stat-value ${overBudgetDays > 0 ? 'over' : ''}">${overBudgetDays} 天</span>
        </div>
        <div class="stats-bar-stat">
            <span class="stats-bar-stat-label">最高日</span>
            <span class="stats-bar-stat-value">${monthStr}/${String(maxDay.day).padStart(2, '0')} $${maxDay.total.toLocaleString()}</span>
        </div>
    `;
}

function renderStatsTopExpenses(expenses) {
    const container = document.getElementById('stats-top-expenses');
    if (!container) return;

    if (expenses.length === 0) {
        container.innerHTML = '<div class="text-muted" style="text-align: center; padding: 10px 0; font-size: 13px;">無支出紀錄</div>';
        return;
    }

    // Sort descending by amount and slice top 5
    const top5 = [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5);

    let html = '';
    top5.forEach((exp, index) => {
        const cat = CATEGORIES.find(c => c.id === exp.category) || { name: '未知', icon: '❓', color: '#888' };
        
        const d = new Date(exp.date);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
        
        let payerText = exp.payer;
        if (exp.payer === 'A') payerText = state.payerAName || 'A';
        else if (exp.payer === 'B') payerText = state.payerBName || 'B';

        html += `
            <div class="top-expense-item">
                <div class="top-expense-rank" style="color: ${index === 0 ? 'var(--primary)' : index === 1 ? '#D3B17D' : index === 2 ? '#C4A17B' : 'var(--text-muted)'};">${index + 1}</div>
                <div class="top-expense-icon" style="background:${cat.color}20; color:${cat.color}">${cat.icon}</div>
                <div class="top-expense-info">
                    <span class="top-expense-cat">${cat.name}${exp.detail ? ` - <span>${exp.detail}</span>` : ''}</span>
                    <span class="top-expense-meta">${dateStr} · 由 ${payerText} 付款</span>
                </div>
                <div class="top-expense-amount">NT$ ${exp.amount.toLocaleString()}</div>
            </div>
        `;
    });

    container.innerHTML = html;
}

const DAILY_PAGE_SIZE = 7;
let dailyStats = { monthStr: '', expenses: [], daysInMonth: 0, page: 0 };

function renderDailyStatsTable(yearStr, monthStr, expenses) {
    const container = document.getElementById('stats-daily-table');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const daysInMonth = getDaysInMonth(year, month - 1);
    const pageCount = Math.ceil(daysInMonth / DAILY_PAGE_SIZE);

    // 預設顯示包含「今天」的那一頁（若正在看當月），否則第一頁
    const today = new Date();
    let defaultPage = 0;
    if (today.getFullYear() === year && (today.getMonth() + 1) === month) {
        defaultPage = Math.floor((today.getDate() - 1) / DAILY_PAGE_SIZE);
    }

    dailyStats = { monthStr, expenses, daysInMonth, page: Math.min(defaultPage, pageCount - 1) };

    container.innerHTML = `
        <div class="daily-table-header">
            <h3>每日結算</h3>
            <div class="daily-page-nav">
                <button class="meal-nav-btn" id="daily-prev" onclick="changeDailyStatsPage(-1)">‹</button>
                <span class="meal-date-label" id="daily-page-label"></span>
                <button class="meal-nav-btn" id="daily-next" onclick="changeDailyStatsPage(1)">›</button>
            </div>
        </div>
        <div class="daily-list" id="daily-list"></div>
    `;

    renderDailyStatsPage();
}

function renderDailyStatsPage() {
    const { monthStr, expenses, daysInMonth, page } = dailyStats;
    const pageCount = Math.ceil(daysInMonth / DAILY_PAGE_SIZE);
    const startDay = page * DAILY_PAGE_SIZE + 1;
    const endDay = Math.min(startDay + DAILY_PAGE_SIZE - 1, daysInMonth);

    let html = '';
    for (let i = startDay; i <= endDay; i++) {
        const dayExp = expenses.filter(e => {
            const d = new Date(e.date);
            return d.getDate() === i;
        });

        const dayTotal = dayExp.reduce((sum, e) => sum + e.amount, 0);
        const dayStr = `${monthStr}/${String(i).padStart(2, '0')}`;

        // Generate category badges row
        let catsHtml = '<div class="daily-cats-row">';
        CATEGORIES.forEach(cat => {
            const hasCat = dayExp.some(e => e.category === cat.id);
            if (hasCat) {
                catsHtml += `<div class="daily-cat-badge active" style="background:${cat.color}20;" title="${cat.name}">${cat.icon}</div>`;
            } else {
                catsHtml += `<div class="daily-cat-badge inactive" title="未記帳: ${cat.name}">${cat.icon}</div>`;
            }
        });
        catsHtml += '</div>';

        if (dayTotal > 0) {
            const isOverBudget = dayTotal > state.dailyBudget;
            html += `
                <div class="daily-item expanded${isOverBudget ? ' over-budget' : ''}">
                    <div class="daily-item-header">
                        <span class="daily-date${isOverBudget ? ' over-budget' : ''}">${dayStr}</span>
                        <span class="daily-amount${isOverBudget ? ' over-budget' : ' danger'}">NT$ ${dayTotal.toLocaleString()}</span>
                    </div>
                    ${catsHtml}
                </div>
            `;
        } else {
            html += `
                <div class="daily-item missed expanded">
                    <div class="daily-item-header">
                        <span class="daily-date">${dayStr}</span>
                        <span class="daily-amount text-muted">尚未記帳</span>
                    </div>
                    ${catsHtml}
                </div>
            `;
        }
    }

    document.getElementById('daily-list').innerHTML = html;
    document.getElementById('daily-page-label').textContent =
        `${monthStr}/${String(startDay).padStart(2, '0')} – ${monthStr}/${String(endDay).padStart(2, '0')}`;
    document.getElementById('daily-prev').classList.toggle('disabled', page <= 0);
    document.getElementById('daily-next').classList.toggle('disabled', page >= pageCount - 1);
}

window.changeDailyStatsPage = function (delta) {
    const pageCount = Math.ceil(dailyStats.daysInMonth / DAILY_PAGE_SIZE);
    const next = dailyStats.page + delta;
    if (next < 0 || next >= pageCount) return;
    dailyStats.page = next;
    renderDailyStatsPage();
};

function updateStatsPieChart(expenses, total) {
    const pieCenterValue = document.getElementById('stats-pie-center-value');
    pieCenterValue.innerText = `NT$ ${total.toLocaleString()}`;
    pieCenterValue.style.color = 'var(--dark)';

    const legendContainer = document.getElementById('stats-legend');
    const pie = document.getElementById('stats-pie');

    if (total === 0) {
        pie.style.background = 'conic-gradient(var(--gray) 0% 100%)';
        legendContainer.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">此月份尚無花費</span>';
        return;
    }

    // Aggregate by category
    const catTotals = {};
    expenses.forEach(e => {
        catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
    });

    let currentAngle = 0;
    let gradients = [];
    let legendsHTML = [];

    CATEGORIES.forEach(cat => {
        if (catTotals[cat.id]) {
            const pct = (catTotals[cat.id] / total) * 100;
            gradients.push(`${cat.color} ${currentAngle}% ${currentAngle + pct}%`);
            currentAngle += pct;

            legendsHTML.push(`
                <div class="legend-item">
                    <div class="legend-color" style="background:${cat.color}"></div>
                    <span>${cat.name} ${Math.round(pct)}%</span>
                </div>
            `);
        }
    });

    pie.style.background = `conic-gradient(${gradients.join(', ')})`;
    legendContainer.innerHTML = legendsHTML.join('');
}

function setupSettings() {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.theme-btn').forEach(b => {
                b.classList.remove('active');
                b.style.background = 'var(--card-bg)';
                b.style.color = 'var(--text-main)';
                b.style.borderColor = 'var(--gray)';
            });
            const target = e.target;
            target.classList.add('active');
            target.style.background = 'var(--primary)';
            target.style.color = 'white';
            target.style.borderColor = 'var(--primary)';
        });
    });

    document.getElementById('btn-save-settings').addEventListener('click', () => {
        const newBudget = parseInt(document.getElementById('setting-budget').value);
        const payerA = document.getElementById('setting-payer-a').value.trim();
        const payerB = document.getElementById('setting-payer-b').value.trim();
        const activeThemeBtn = document.querySelector('.theme-btn.active');
        const theme = activeThemeBtn ? activeThemeBtn.getAttribute('data-theme-val') : 'light';

        if (newBudget > 0) {
            state.dailyBudget = newBudget;
            if (payerA) state.payerAName = payerA;
            if (payerB) state.payerBName = payerB;
            state.theme = theme;

            document.documentElement.setAttribute('data-theme', state.theme);
            saveState();
            renderCategories(); // update toggle names

            document.querySelector('[data-target="dashboard"]').click();
            document.getElementById('abang-quote').innerText = "預算設定更新成功！";
        }
    });

    document.getElementById('btn-clear-data').addEventListener('click', () => {
        if (confirm('確定要清除所有記帳紀錄嗎？阿邦會很傷心的 😿')) {
            if (expensesRef) {
                // Batch delete for Firestore
                expensesRef.get().then(snapshot => {
                    const batch = db.batch();
                    snapshot.forEach(doc => batch.delete(doc.ref));
                    return batch.commit();
                }).then(() => {
                    console.log("雲端資料已清空");
                    document.querySelector('[data-target="dashboard"]').click();
                });
            } else {
                state.expenses = [];
                saveState();
                document.querySelector('[data-target="dashboard"]').click();
            }
        }
    });

    document.getElementById('btn-export-data').addEventListener('click', () => {
        const dataStr = JSON.stringify(state, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        const d = new Date();
        const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

        a.href = url;
        a.download = `abang_backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    document.getElementById('input-import-data').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            try {
                const importedState = JSON.parse(event.target.result);
                if (importedState && typeof importedState === 'object' && Array.isArray(importedState.expenses)) {
                    state = importedState;
                    saveState();
                    document.documentElement.setAttribute('data-theme', state.theme || 'light');
                    document.querySelector('[data-target="dashboard"]').click();
                    alert('資料匯入成功！');
                } else {
                    alert('備份檔案格式不正確');
                }
            } catch (err) {
                alert('無法讀取備份檔案');
            }
        };
        reader.readAsText(file);

        // Clear input so same file can be imported again if needed
        e.target.value = '';
    });
}

// Boot up
document.addEventListener('DOMContentLoaded', init);
