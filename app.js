// ====== Configuration & State ======
const CATEGORIES = [
    { id: 'brunch', name: '早午餐', icon: '🍳', color: '#E9C46A' },
    { id: 'dinner', name: '晚餐宵夜', icon: '🍜', color: '#F4A261' },
    { id: 'drinks', name: '飲料甜點', icon: '🧋', color: '#2A9D8F' },
    { id: 'alcohol', name: '喝酒', icon: '🍻', color: '#E76F51' },
    { id: 'others', name: '其他', icon: '✨', color: '#9D8189' }
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
let selectedCategory = 'brunch';
let selectedPayer = 'A';

// ====== Core Methods ======
function init() {
    loadState();
    document.documentElement.setAttribute('data-theme', state.theme || 'light');
    setupNavigation();
    renderCategories();
    setupNumpad();
    setupSettings();
    updateDashboard();

    // Check if new week to wipe data? Let's just calculate based on current week for now.
}

function loadState() {
    const saved = localStorage.getItem('abangState');
    if (saved) {
        state = JSON.parse(saved);
    } else {
        saveState();
    }
}

function saveState() {
    localStorage.setItem('abangState', JSON.stringify(state));
}

// ====== View Navigation ======
function setupNavigation() {
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    const views = document.querySelectorAll('.view');
    const quote = document.getElementById('abang-quote');

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
                quote.innerText = "阿邦幫你看緊荷包 🐾";
            } else if (target === 'add') {
                quote.innerText = "這筆記在哪裡比較好呢？ ✏️";
                resetAddForm();
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
        if (amount > 0) {
            const dateInput = document.getElementById('expense-date').value;
            const detailInput = document.getElementById('expense-detail').value.trim();

            let expenseDate = new Date().toISOString();
            if (dateInput) {
                // Parse date string as local time and preserve it for storing
                const [y, m, d] = dateInput.split('-');
                const localDate = new Date(y, m - 1, d);
                expenseDate = localDate.toISOString();
            }

            if (window.editRecordId) {
                const index = state.expenses.findIndex(e => e.id === window.editRecordId);
                if (index !== -1) {
                    state.expenses[index] = {
                        ...state.expenses[index],
                        amount: amount,
                        category: selectedCategory,
                        payer: selectedPayer,
                        date: expenseDate,
                        detail: detailInput
                    };
                }
                window.editRecordId = null;
                document.querySelector('#view-add h2').innerText = '記一筆';
            } else {
                state.expenses.push({
                    id: Date.now(),
                    amount: amount,
                    category: selectedCategory,
                    payer: selectedPayer,
                    date: expenseDate,
                    detail: detailInput
                });
            }

            saveState();

            // Switch back to dashboard
            document.querySelector('[data-target="dashboard"]').click();
            document.getElementById('abang-quote').innerText = "記好囉！阿邦覺得你很棒 🎉";
        }
    });
}

window.editRecord = function (id) {
    const record = state.expenses.find(e => e.id === id);
    if (!record) return;

    window.editRecordId = id;

    // Switch to ADD view
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-add').classList.add('active');
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.nav-item[data-target="add"]').classList.add('active');

    document.querySelector('#view-add h2').innerText = '編輯紀錄';

    // Populate values
    currentInputAmount = record.amount.toString();
    const inputDisplay = document.getElementById('input-amount');
    inputDisplay.innerText = Number(currentInputAmount).toLocaleString();

    document.getElementById('expense-detail').value = record.detail || '';

    const d = new Date(record.date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    document.getElementById('expense-date').value = `${yyyy}-${mm}-${dd}`;

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
    document.querySelectorAll('.payer-btn').forEach(btn => {
        if (btn.getAttribute('data-payer') === selectedPayer) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
};

// Ensure delete property is accessible globally
window.deleteRecord = function (id) {
    state.expenses = state.expenses.filter(e => e.id !== id);
    saveState();
    renderRecords();
    updateDashboard();

    // If we are currently in stats view, refresh it too
    const selectedMonth = document.getElementById('stats-month-selector').value;
    if (selectedMonth) renderStatsForMonth(selectedMonth);
};

function resetAddForm() {
    window.editRecordId = null;
    document.querySelector('#view-add h2').innerText = '記一筆';

    currentInputAmount = '0';
    document.getElementById('input-amount').innerText = '0';
    document.getElementById('expense-detail').value = '';

    // Set default date to today
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    document.getElementById('expense-date').value = `${yyyy}-${mm}-${dd}`;
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

    // Update Today Card
    document.getElementById('today-spent').innerText = todaySpent.toLocaleString();
    document.getElementById('today-budget').innerText = state.dailyBudget.toLocaleString();
    const remainEl = document.getElementById('today-remaining');
    remainEl.innerText = `NT$ ${Math.max(todayRemaining, 0).toLocaleString()}`;
    if (todayRemaining < 0) remainEl.classList.add('danger');
    else remainEl.classList.remove('danger');

    const todayPct = Math.min((todaySpent / state.dailyBudget) * 100, 100);
    const todayBar = document.getElementById('today-progress');
    todayBar.style.width = `${todayPct}%`;
    if (todayPct >= 100) todayBar.classList.add('danger-fill');
    else todayBar.classList.remove('danger-fill');

    // Update Weekly Card
    const weekRemainEl = document.getElementById('weekly-remaining');
    weekRemainEl.innerText = `NT$ ${Math.max(weeklyRemaining, 0).toLocaleString()}`;
    if (weeklyRemaining < 0) weekRemainEl.classList.add('danger');
    else weekRemainEl.classList.remove('danger');

    const weekPct = Math.min((weeklySpent / weeklyBudget) * 100, 100);
    const weekBar = document.getElementById('weekly-progress');
    weekBar.style.width = `${weekPct}%`;
    if (weekPct >= 100) weekBar.classList.add('danger-fill');
    else weekBar.classList.remove('danger-fill');

    // Update Monthly Card
    const monthRemainEl = document.getElementById('monthly-remaining');
    monthRemainEl.innerText = `NT$ ${Math.max(monthlyRemaining, 0).toLocaleString()}`;
    if (monthlyRemaining < 0) monthRemainEl.classList.add('danger');
    else monthRemainEl.classList.remove('danger');

    const monthPct = Math.min((monthlySpent / monthlyBudget) * 100, 100);
    const monthBar = document.getElementById('monthly-progress');
    monthBar.style.width = `${monthPct}%`;
    if (monthPct >= 100) monthBar.classList.add('danger-fill');
    else monthBar.classList.remove('danger-fill');

    // Update Pie Chart
    updatePieChart(weeklyExpenses, weeklySpent, weeklyBudget);
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

    recordsList.innerHTML = sorted.map(exp => {
        const cat = CATEGORIES.find(c => c.id === exp.category) || { name: '未知', icon: '❓', color: '#888' };
        let payerText = exp.payer;
        if (exp.payer === 'A') payerText = state.payerAName || 'A';
        else if (exp.payer === 'B') payerText = state.payerBName || 'B';

        const d = new Date(exp.date);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

        return `
            <div class="record-item">
                <div class="record-left">
                    <div class="record-icon" style="background:${cat.color}20; color:${cat.color}">${cat.icon}</div>
                    <div class="record-details">
                        <span class="record-cat">${cat.name}${exp.detail ? ` - <span>${exp.detail}</span>` : ''}</span>
                        <span class="record-meta">${dateStr} · 由 ${payerText} 付款</span>
                    </div>
                </div>
                <div class="record-right">
                    <div class="record-amount">
                        NT$ ${exp.amount.toLocaleString()}
                    </div>
                    <div class="record-actions">
                        <button class="record-edit" onclick="editRecord(${exp.id})" title="編輯紀錄">✏️</button>
                        <button class="record-del" onclick="deleteRecord(${exp.id})" title="刪除紀錄">✕</button>
                    </div>
                </div>
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

    // Settlement Logic
    const totalA = monthExpenses.filter(e => e.payer === 'A').reduce((sum, e) => sum + e.amount, 0);
    const totalB = monthExpenses.filter(e => e.payer === 'B').reduce((sum, e) => sum + e.amount, 0);
    const nameA = state.payerAName || 'A';
    const nameB = state.payerBName || 'B';
    const halfDiff = Math.abs(totalA - totalB) / 2;

    let settlementHtml = `
        <h3>雙人結算</h3>
        <div class="settlement-breakdown">
            <div class="settlement-person">
                <span>${nameA} 總花費</span>
                <span class="settlement-amount">NT$ ${totalA.toLocaleString()}</span>
            </div>
            <div class="settlement-person">
                <span>${nameB} 總花費</span>
                <span class="settlement-amount">NT$ ${totalB.toLocaleString()}</span>
            </div>
        </div>
        <div class="settlement-result">
    `;

    if (totalA > totalB) {
        settlementHtml += `<span>💡 結算建議：<strong>${nameB}</strong> 應付給 <strong>${nameA}</strong> <span class="highlight">NT$ ${halfDiff.toLocaleString()}</span></span>`;
    } else if (totalB > totalA) {
        settlementHtml += `<span>💡 結算建議：<strong>${nameA}</strong> 應付給 <strong>${nameB}</strong> <span class="highlight">NT$ ${halfDiff.toLocaleString()}</span></span>`;
    } else {
        settlementHtml += `<span>💡 結算建議：目前帳目平衡，無須結算！</span>`;
    }
    settlementHtml += `</div>`;
    document.getElementById('stats-settlement-card').innerHTML = settlementHtml;

    updateStatsPieChart(monthExpenses, totalSpent);
    renderDailyStatsTable(year, month, monthExpenses);
}

function renderDailyStatsTable(yearStr, monthStr, expenses) {
    const container = document.getElementById('stats-daily-table');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const daysInMonth = getDaysInMonth(year, month - 1);

    let html = '<h3>每日結算</h3><div class="daily-list">';

    for (let i = 1; i <= daysInMonth; i++) {
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
            html += `
                <div class="daily-item expanded">
                    <div class="daily-item-header">
                        <span class="daily-date">${dayStr}</span>
                        <span class="daily-amount danger">NT$ ${dayTotal.toLocaleString()}</span>
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

    html += '</div>';
    container.innerHTML = html;
}

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
            state.expenses = [];
            saveState();
            document.querySelector('[data-target="dashboard"]').click();
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
