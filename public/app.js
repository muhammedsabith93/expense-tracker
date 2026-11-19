// Student Organization Finance Tracker - Frontend Engine
let currentUser = null;
let currentPage = 'home'; // 'home' | 'ledger'
let currentFilters = {
  category: 'all',
  type: 'all',
  debtStatus: 'all',
  search: ''
};
let allTransactions = [];
let searchDebounceTimeout = null;

// Currency formatter
function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Date formatter
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return dateStr;
}

// Token helper
function getToken() {
  return localStorage.getItem('auth_token') || getCookie('auth_token');
}

function setToken(token) {
  localStorage.setItem('auth_token', token);
  document.cookie = `auth_token=${token}; path=/; max-age=1209600; SameSite=Lax`;
}

function clearToken() {
  localStorage.removeItem('auth_token');
  document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax';
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

// ================= PAGE NAVIGATION ================= //
function navigateToPage(page) {
  currentPage = page;
  const homeView = document.getElementById('view-home');
  const ledgerView = document.getElementById('view-ledger');
  
  const navBtnHome = document.getElementById('nav-btn-home');
  const navBtnLedger = document.getElementById('nav-btn-ledger');
  const mobNavHome = document.getElementById('mob-nav-home');
  const mobNavLedger = document.getElementById('mob-nav-ledger');

  if (page === 'home') {
    homeView.classList.remove('hidden');
    ledgerView.classList.add('hidden');

    if (navBtnHome) {
      navBtnHome.className = 'px-3 py-1.5 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 bg-indigo-50 text-indigo-700';
      navBtnLedger.className = 'px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50';
    }
    if (mobNavHome) {
      mobNavHome.className = 'flex-1 py-1.5 text-center font-semibold rounded-lg bg-indigo-100 text-indigo-700';
      mobNavLedger.className = 'flex-1 py-1.5 text-center font-medium rounded-lg text-slate-600 hover:bg-slate-200';
    }
  } else {
    homeView.classList.add('hidden');
    ledgerView.classList.remove('hidden');

    if (navBtnLedger) {
      navBtnLedger.className = 'px-3 py-1.5 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 bg-indigo-50 text-indigo-700';
      navBtnHome.className = 'px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50';
    }
    if (mobNavLedger) {
      mobNavLedger.className = 'flex-1 py-1.5 text-center font-semibold rounded-lg bg-indigo-100 text-indigo-700';
      mobNavHome.className = 'flex-1 py-1.5 text-center font-medium rounded-lg text-slate-600 hover:bg-slate-200';
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  lucide.createIcons();
}

// API fetch wrapper with Connection Recovery
async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, { ...options, credentials: 'include', headers });
    
    // Hide offline warning if previously shown
    const warn = document.getElementById('connection-warning');
    if (warn) warn.classList.add('hidden');

    if (res.status === 401) {
      if (currentUser) {
        showToast('Session expired. Please log in again.', 'error');
      }
      currentUser = null;
      clearToken();
      showAuthScreen();
      throw new Error('Authentication required');
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Server request failed');
    }
    return data;
  } catch (err) {
    if (err.name === 'TypeError' || err.message.toLowerCase().includes('failed to fetch')) {
      const warn = document.getElementById('connection-warning');
      if (warn) warn.classList.remove('hidden');
      throw new Error('Server unreachable. Please verify server is running on http://localhost:3000');
    }
    throw err;
  }
}

async function retryConnection() {
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      document.getElementById('connection-warning').classList.add('hidden');
      showToast('Reconnected to server!');
      await loadDashboardData();
    } else {
      showToast('Server still not responding', 'error');
    }
  } catch (e) {
    showToast('Cannot reach server yet. Please check terminal.', 'error');
  }
}

// Toast Notifications
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-slate-900 border-emerald-500/50 text-white' : 'bg-rose-900 border-rose-500/50 text-white';
  const icon = type === 'success' ? 'check-circle' : 'alert-circle';
  const iconColor = type === 'success' ? 'text-emerald-400' : 'text-rose-300';

  toast.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border ${bg} text-sm transition-all transform duration-300 translate-y-4 opacity-0`;
  toast.innerHTML = `
    <i data-lucide="${icon}" class="w-4 h-4 ${iconColor}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ================= AUTHENTICATION FLOW ================= //

function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('dashboard-screen').classList.add('hidden');
  document.getElementById('dashboard-screen').classList.remove('flex');
}

function showDashboardScreen() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('dashboard-screen').classList.remove('hidden');
  document.getElementById('dashboard-screen').classList.add('flex');

  if (currentUser) {
    document.getElementById('nav-user-name').textContent = currentUser.name || currentUser.username;
    document.getElementById('nav-user-role').textContent = currentUser.role || 'Member';
  }
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const tabLoginBtn = document.getElementById('tab-login-btn');
  const tabRegBtn = document.getElementById('tab-register-btn');
  const alertBox = document.getElementById('auth-alert');
  alertBox.classList.add('hidden');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    tabLoginBtn.className = 'flex-1 pb-3 text-sm font-semibold text-indigo-400 border-b-2 border-indigo-400 transition';
    tabRegBtn.className = 'flex-1 pb-3 text-sm font-semibold text-slate-400 hover:text-slate-200 transition';
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    tabRegBtn.className = 'flex-1 pb-3 text-sm font-semibold text-indigo-400 border-b-2 border-indigo-400 transition';
    tabLoginBtn.className = 'flex-1 pb-3 text-sm font-semibold text-slate-400 hover:text-slate-200 transition';
  }
  lucide.createIcons();
}

function fillDemoCredentials() {
  document.getElementById('login-username').value = 'admin';
  document.getElementById('login-password').value = 'admin123';
  showAuthAlert('Admin credentials populated! Click "Login to Dashboard" below.', 'info');
}

function showAuthAlert(msg, type = 'error') {
  const el = document.getElementById('auth-alert');
  el.classList.remove('hidden', 'bg-rose-500/20', 'text-rose-200', 'border-rose-500/40', 'bg-indigo-500/20', 'text-indigo-200', 'border-indigo-500/40');
  
  if (type === 'error') {
    el.classList.add('bg-rose-500/20', 'text-rose-200', 'border', 'border-rose-500/40');
    el.innerHTML = `<i data-lucide="alert-triangle" class="w-4 h-4 text-rose-400 shrink-0 mt-0.5"></i> <span>${msg}</span>`;
  } else {
    el.classList.add('bg-indigo-500/20', 'text-indigo-200', 'border', 'border-indigo-500/40');
    el.innerHTML = `<i data-lucide="info" class="w-4 h-4 text-indigo-400 shrink-0 mt-0.5"></i> <span>${msg}</span>`;
  }
  lucide.createIcons();
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-submit-btn');

  btn.disabled = true;
  btn.innerHTML = `<span>Signing in...</span>`;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    setToken(data.token);
    currentUser = data.user;
    showToast(`Welcome back, ${currentUser.name || currentUser.username}!`);
    showDashboardScreen();
    await loadDashboardData();
  } catch (err) {
    showAuthAlert(err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>Login to Dashboard</span><i data-lucide="arrow-right" class="w-4 h-4"></i>`;
    lucide.createIcons();
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const btn = document.getElementById('reg-submit-btn');

  btn.disabled = true;
  btn.innerHTML = `<span>Creating account...</span>`;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, password })
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    setToken(data.token);
    currentUser = data.user;
    showToast(`Account created! Welcome, ${currentUser.name}!`);
    showDashboardScreen();
    await loadDashboardData();
  } catch (err) {
    showAuthAlert(err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>Create Account & Enter</span><i data-lucide="check" class="w-4 h-4"></i>`;
    lucide.createIcons();
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {
    // ignore
  }
  clearToken();
  currentUser = null;
  showToast('Logged out successfully');
  showAuthScreen();
}

async function checkAuthStatus() {
  try {
    const token = getToken();
    if (!token) {
      showAuthScreen();
      return;
    }
    const data = await apiFetch('/api/auth/me');
    if (data.user) {
      currentUser = data.user;
      showDashboardScreen();
      await loadDashboardData();
    } else {
      showAuthScreen();
    }
  } catch (err) {
    showAuthScreen();
  }
}

// ================= DASHBOARD DATA & CALCULATIONS ================= //

async function loadDashboardData() {
  try {
    const summary = await apiFetch('/api/summary');
    updateSummaryUI(summary);
    await fetchTransactions();

    const now = new Date();
    document.querySelectorAll('.last-updated-text').forEach(el => {
      el.textContent = 'Updated at ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });
  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

function updateSummaryUI(summary) {
  // 1. Update HOME PAGE Totals (Income & Expense Only + Net Balance)
  document.getElementById('home-total-income').textContent = formatCurrency(summary.totalIncome);
  document.getElementById('home-total-expense').textContent = formatCurrency(summary.totalExpense);
  document.getElementById('home-net-balance').textContent = formatCurrency(summary.netBalance);
  
  document.getElementById('home-income-count').textContent = `${summary.incomeCount || 0} records`;
  document.getElementById('home-expense-count').textContent = `${summary.expenseCount || 0} records`;

  const homeNetBadge = document.getElementById('home-net-badge');
  if (summary.netBalance >= 0) {
    homeNetBadge.textContent = 'Surplus';
    homeNetBadge.className = 'px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold';
  } else {
    homeNetBadge.textContent = 'Deficit';
    homeNetBadge.className = 'px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold';
  }

  // 2. Update LEDGER PAGE Categories
  // Cash in Hand
  const cashHand = summary.wallets.cashInHand;
  document.getElementById('cat-cash-hand-balance').textContent = formatCurrency(cashHand.balance);
  document.getElementById('cat-cash-hand-in').textContent = formatCurrency(cashHand.income);
  document.getElementById('cat-cash-hand-out').textContent = formatCurrency(cashHand.expense);

  // Cash in GPay
  const gpay = summary.wallets.cashInGPay;
  document.getElementById('cat-gpay-balance').textContent = formatCurrency(gpay.balance);
  document.getElementById('cat-gpay-in').textContent = formatCurrency(gpay.income);
  document.getElementById('cat-gpay-out').textContent = formatCurrency(gpay.expense);

  // Debt Tracker
  const debt = summary.wallets.debt;
  document.getElementById('cat-debt-net').textContent = formatCurrency(Math.abs(debt.netDebtPosition));
  document.getElementById('cat-debt-net-label').textContent = debt.netDebtPosition >= 0 ? 'net receivable' : 'net payable';
  document.getElementById('cat-debt-receivable').textContent = formatCurrency(debt.pendingReceivable);
  document.getElementById('cat-debt-payable').textContent = formatCurrency(debt.pendingPayable);
  document.getElementById('cat-debt-count').textContent = `${debt.pendingCount} Pending`;

  // Visual Allocation Progress Bar
  const valCash = Math.max(0, cashHand.balance);
  const valGpay = Math.max(0, gpay.balance);
  const valDebt = Math.max(0, debt.pendingReceivable);
  const totalAssets = valCash + valGpay + valDebt;

  if (totalAssets > 0) {
    const pctCash = Math.round((valCash / totalAssets) * 100);
    const pctGpay = Math.round((valGpay / totalAssets) * 100);
    const pctDebt = Math.max(0, 100 - pctCash - pctGpay);

    document.getElementById('bar-cash-hand').style.width = pctCash + '%';
    document.getElementById('bar-cash-gpay').style.width = pctGpay + '%';
    document.getElementById('bar-debt').style.width = pctDebt + '%';

    document.getElementById('pct-cash-hand').textContent = pctCash + '%';
    document.getElementById('pct-cash-gpay').textContent = pctGpay + '%';
    document.getElementById('pct-debt').textContent = pctDebt + '%';
    document.getElementById('distribution-stats').textContent = `Total Asset Pool: ${formatCurrency(totalAssets)}`;
  } else {
    document.getElementById('bar-cash-hand').style.width = '33%';
    document.getElementById('bar-cash-gpay').style.width = '33%';
    document.getElementById('bar-debt').style.width = '34%';
    document.getElementById('distribution-stats').textContent = 'No positive balances yet';
  }
}

// Fetch transactions with query parameters
async function fetchTransactions() {
  const query = new URLSearchParams();
  if (currentFilters.category !== 'all') query.append('category', currentFilters.category);
  if (currentFilters.type !== 'all') query.append('type', currentFilters.type);
  if (currentFilters.debtStatus !== 'all') query.append('debtStatus', currentFilters.debtStatus);
  if (currentFilters.search) query.append('search', currentFilters.search);

  const res = await apiFetch(`/api/transactions?${query.toString()}`);
  allTransactions = res.transactions;
  renderTransactionsTable(allTransactions);

  const totalCount = allTransactions.length;
  document.getElementById('footer-count-text').textContent = `Showing ${totalCount} transaction${totalCount === 1 ? '' : 's'}`;
}

// Render Transactions Table
function renderTransactionsTable(transactions) {
  const tbody = document.getElementById('transactions-tbody');
  const emptyState = document.getElementById('empty-state');

  if (!transactions || transactions.length === 0) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  tbody.innerHTML = transactions.map(tx => {
    let catBadge = '';
    if (tx.category === 'cash_in_hand') {
      catBadge = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <i data-lucide="banknote" class="w-3.5 h-3.5 text-emerald-600"></i>
          Cash in Hand
        </span>
      `;
    } else if (tx.category === 'cash_in_gpay') {
      catBadge = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
          <i data-lucide="smartphone" class="w-3.5 h-3.5 text-blue-600"></i>
          Cash in GPay
        </span>
      `;
    } else if (tx.category === 'debt') {
      const isPending = tx.debtStatus === 'pending';
      const statusBadge = isPending 
        ? `<span class="bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded text-[10px] font-bold">Pending</span>` 
        : `<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded text-[10px] font-bold">Settled</span>`;
      
      const directionLabel = tx.debtType === 'receivable' ? 'Owed to Org' : 'Org Owes';
      
      catBadge = `
        <div class="inline-flex flex-col gap-1 items-start">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200">
            <i data-lucide="handshake" class="w-3.5 h-3.5 text-amber-600"></i>
            Debt: ${directionLabel}
          </span>
          <div class="pl-1">${statusBadge}</div>
        </div>
      `;
    }

    const isIncome = tx.type === 'income';
    const amountClass = isIncome ? 'text-emerald-700' : 'text-rose-700';
    const amountPrefix = isIncome ? '+' : '-';
    const typeIndicator = isIncome 
      ? `<span class="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1.5"></span>` 
      : `<span class="w-2 h-2 rounded-full bg-rose-500 inline-block mr-1.5"></span>`;

    let settleBtn = '';
    if (tx.category === 'debt' && tx.debtStatus === 'pending') {
      settleBtn = `
        <button onclick="openSettleModal('${tx.id}')" title="Settle this debt" class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold transition flex items-center gap-1">
          <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-amber-600"></i>
          <span>Settle</span>
        </button>
      `;
    }

    return `
      <tr class="hover:bg-slate-50/80 transition group">
        <td class="py-3.5 px-4 whitespace-nowrap">
          <div class="font-medium text-slate-800 text-xs">${formatDate(tx.date)}</div>
          <div class="text-[10px] text-slate-400">By @${escapeHtml(tx.createdBy || 'admin')}</div>
        </td>

        <td class="py-3.5 px-4">
          <div class="font-semibold text-slate-900 flex items-center">
            ${typeIndicator}
            <span>${escapeHtml(tx.title)}</span>
          </div>
          ${tx.description ? `<p class="text-xs text-slate-500 mt-0.5 max-w-md line-clamp-1">${escapeHtml(tx.description)}</p>` : ''}
        </td>

        <td class="py-3.5 px-4 whitespace-nowrap">
          ${catBadge}
        </td>

        <td class="py-3.5 px-4 whitespace-nowrap text-xs text-slate-700">
          ${tx.person ? `<div class="font-medium text-slate-800 flex items-center gap-1"><i data-lucide="user" class="w-3.5 h-3.5 text-slate-400"></i>${escapeHtml(tx.person)}</div>` : '<span class="text-slate-400">-</span>'}
        </td>

        <td class="py-3.5 px-4 whitespace-nowrap text-right">
          <span class="font-mono-amount font-bold text-sm ${amountClass}">
            ${amountPrefix}${formatCurrency(tx.amount)}
          </span>
        </td>

        <td class="py-3.5 px-4 whitespace-nowrap text-center action-col">
          <div class="flex items-center justify-center gap-1.5">
            ${settleBtn}
            <button onclick="editTransaction('${tx.id}')" title="Edit Transaction" class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            <button onclick="deleteTransaction('${tx.id}')" title="Delete Transaction" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ================= FILTER & SEARCH HANDLING ================= //

function setFilter(key, value) {
  currentFilters[key] = value;

  if (key === 'category') {
    document.querySelectorAll('.filter-pill-cat').forEach(btn => {
      if (btn.dataset.catPill === value) {
        btn.className = 'filter-pill-cat px-3 py-1 rounded-full border border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold transition';
      } else {
        btn.className = 'filter-pill-cat px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium transition';
      }
    });
  }

  if (key === 'type') {
    document.querySelectorAll('.filter-pill-type').forEach(btn => {
      if (btn.dataset.typePill === value) {
        btn.className = 'filter-pill-type px-3 py-1 rounded-full border border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold transition';
      } else {
        btn.className = 'filter-pill-type px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium transition';
      }
    });
  }

  checkResetButtonVisibility();
  fetchTransactions();
}

function filterByCategory(cat) {
  setFilter('category', cat);
  navigateToPage('ledger');
  setTimeout(() => {
    const el = document.getElementById('filters-container');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

function debounceSearch() {
  clearTimeout(searchDebounceTimeout);
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('clear-search-btn');

  if (input.value.trim()) {
    clearBtn.classList.remove('hidden');
  } else {
    clearBtn.classList.add('hidden');
  }

  searchDebounceTimeout = setTimeout(() => {
    currentFilters.search = input.value.trim();
    checkResetButtonVisibility();
    fetchTransactions();
  }, 250);
}

function clearSearch() {
  const input = document.getElementById('search-input');
  input.value = '';
  document.getElementById('clear-search-btn').classList.add('hidden');
  currentFilters.search = '';
  checkResetButtonVisibility();
  fetchTransactions();
}

function resetAllFilters() {
  currentFilters = {
    category: 'all',
    type: 'all',
    debtStatus: 'all',
    search: ''
  };
  document.getElementById('search-input').value = '';
  document.getElementById('clear-search-btn').classList.add('hidden');

  document.querySelectorAll('.filter-pill-cat').forEach(btn => {
    btn.className = btn.dataset.catPill === 'all' 
      ? 'filter-pill-cat px-3 py-1 rounded-full border border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold transition'
      : 'filter-pill-cat px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium transition';
  });

  document.querySelectorAll('.filter-pill-type').forEach(btn => {
    btn.className = btn.dataset.typePill === 'all' 
      ? 'filter-pill-type px-3 py-1 rounded-full border border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold transition'
      : 'filter-pill-type px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium transition';
  });

  checkResetButtonVisibility();
  fetchTransactions();
}

function checkResetButtonVisibility() {
  const isFiltered = currentFilters.category !== 'all' || currentFilters.type !== 'all' || currentFilters.debtStatus !== 'all' || !!currentFilters.search;
  const resetBtn = document.getElementById('reset-filters-btn');
  if (isFiltered) {
    resetBtn.classList.remove('hidden');
  } else {
    resetBtn.classList.add('hidden');
  }
}

// ================= ADD / EDIT TRANSACTION MODAL ================= //

function openTransactionModal(editTx = null) {
  const modal = document.getElementById('tx-modal');
  const form = document.getElementById('tx-form');
  form.reset();

  const todayStr = new Date().toISOString().split('T')[0];
  document.getElementById('form-date').value = todayStr;

  if (editTx) {
    document.getElementById('modal-title').textContent = 'Edit Transaction';
    document.getElementById('modal-subtitle').textContent = `Updating record #${editTx.id}`;
    document.getElementById('edit-tx-id').value = editTx.id;
    document.getElementById('form-submit-btn-text').textContent = 'Update Transaction';

    setFormType(editTx.type);
    onCategoryChange(editTx.category);

    const radio = document.querySelector(`input[name="form_category"][value="${editTx.category}"]`);
    if (radio) radio.checked = true;

    document.getElementById('form-amount').value = editTx.amount;
    document.getElementById('form-date').value = editTx.date;
    document.getElementById('form-title').value = editTx.title;
    document.getElementById('form-person').value = editTx.person || '';
    document.getElementById('form-description').value = editTx.description || '';

    if (editTx.category === 'debt') {
      document.getElementById('form-debt-type').value = editTx.debtType || 'payable';
      document.getElementById('form-debt-status').value = editTx.debtStatus || 'pending';
    }
  } else {
    document.getElementById('modal-title').textContent = 'Add New Transaction';
    document.getElementById('modal-subtitle').textContent = 'Record student club income or expense';
    document.getElementById('edit-tx-id').value = '';
    document.getElementById('form-submit-btn-text').textContent = 'Save Transaction';

    setFormType('expense'); // Default to expense as per typical usage, easily toggled
    onCategoryChange('cash_in_hand');
    const radio = document.querySelector('input[name="form_category"][value="cash_in_hand"]');
    if (radio) radio.checked = true;
  }

  modal.classList.remove('hidden');
  document.getElementById('form-amount').focus();
  lucide.createIcons();
}

function quickAddWithCategory(category) {
  openTransactionModal();
  onCategoryChange(category);
  const radio = document.querySelector(`input[name="form_category"][value="${category}"]`);
  if (radio) radio.checked = true;
}

function closeTransactionModal() {
  document.getElementById('tx-modal').classList.add('hidden');
}

function setFormType(type) {
  document.getElementById('form-type').value = type;
  const btnIncome = document.getElementById('btn-type-income');
  const btnExpense = document.getElementById('btn-type-expense');

  if (type === 'income') {
    btnIncome.className = 'py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-1.5 bg-emerald-600 text-white shadow-sm';
    btnExpense.className = 'py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1.5 text-slate-600 hover:bg-white/60';
  } else {
    btnExpense.className = 'py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-1.5 bg-rose-600 text-white shadow-sm';
    btnIncome.className = 'py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1.5 text-slate-600 hover:bg-white/60';
  }
}

function onCategoryChange(category) {
  const cards = {
    cash_in_hand: document.getElementById('cat-card-cash_in_hand'),
    cash_in_gpay: document.getElementById('cat-card-cash_in_gpay'),
    debt: document.getElementById('cat-card-debt')
  };

  const debtBox = document.getElementById('debt-conditional-box');

  Object.keys(cards).forEach(key => {
    if (key === category) {
      if (key === 'cash_in_hand') {
        cards[key].className = 'cursor-pointer border-2 rounded-xl p-3 text-center transition flex flex-col items-center gap-1 border-emerald-500 bg-emerald-50/40 text-emerald-900';
      } else if (key === 'cash_in_gpay') {
        cards[key].className = 'cursor-pointer border-2 rounded-xl p-3 text-center transition flex flex-col items-center gap-1 border-blue-500 bg-blue-50/40 text-blue-900';
      } else if (key === 'debt') {
        cards[key].className = 'cursor-pointer border-2 rounded-xl p-3 text-center transition flex flex-col items-center gap-1 border-amber-500 bg-amber-50/40 text-amber-900';
      }
    } else {
      cards[key].className = 'cursor-pointer border-2 rounded-xl p-3 text-center transition flex flex-col items-center gap-1 border-slate-200 hover:border-slate-300 text-slate-700';
    }
  });

  if (category === 'debt') {
    debtBox.classList.remove('hidden');
  } else {
    debtBox.classList.add('hidden');
  }
  lucide.createIcons();
}

function setFormTitle(title) {
  document.getElementById('form-title').value = title;
}

async function handleSaveTransaction(e) {
  e.preventDefault();
  const editId = document.getElementById('edit-tx-id').value;
  const type = document.getElementById('form-type').value;
  const categoryRadio = document.querySelector('input[name="form_category"]:checked');
  const category = categoryRadio ? categoryRadio.value : 'cash_in_hand';
  const amountVal = document.getElementById('form-amount').value;
  const amount = parseFloat(amountVal);
  const date = document.getElementById('form-date').value;
  const title = document.getElementById('form-title').value.trim();
  const person = document.getElementById('form-person').value.trim();
  const description = document.getElementById('form-description').value.trim();

  let debtType = null;
  let debtStatus = null;
  if (category === 'debt') {
    debtType = document.getElementById('form-debt-type').value;
    debtStatus = document.getElementById('form-debt-status').value;
  }

  if (isNaN(amount) || amount <= 0) {
    showToast('Please enter a valid positive amount', 'error');
    return;
  }

  if (!title) {
    showToast('Please enter a purpose/title for this transaction', 'error');
    return;
  }

  const payload = {
    type,
    category,
    amount,
    date,
    title,
    person,
    description,
    debtType,
    debtStatus
  };

  const btn = document.getElementById('form-submit-btn');
  btn.disabled = true;
  btn.innerHTML = `<span>Saving...</span>`;

  try {
    if (editId) {
      await apiFetch(`/api/transactions/${editId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      showToast('Transaction updated successfully!');
    } else {
      await apiFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast('New transaction added successfully!');
    }

    closeTransactionModal();
    await loadDashboardData();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span id="form-submit-btn-text">Save Transaction</span>`;
    lucide.createIcons();
  }
}

function editTransaction(id) {
  const tx = allTransactions.find(t => t.id === id);
  if (tx) {
    openTransactionModal(tx);
  }
}

async function deleteTransaction(id) {
  const tx = allTransactions.find(t => t.id === id);
  const title = tx ? `"${tx.title}"` : 'this transaction';

  if (!confirm(`Are you sure you want to delete ${title}? This action cannot be undone.`)) {
    return;
  }

  try {
    await apiFetch(`/api/transactions/${id}`, { method: 'DELETE' });
    showToast('Transaction deleted successfully');
    await loadDashboardData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ================= DEBT SETTLEMENT MODAL ================= //

function openSettleModal(id) {
  const tx = allTransactions.find(t => t.id === id);
  if (!tx) return;

  document.getElementById('settle-tx-id').value = tx.id;
  document.getElementById('settle-tx-title').textContent = tx.title;
  
  const directionText = tx.debtType === 'receivable' ? 'Money owed to Club' : 'Club owes to person/vendor';
  document.getElementById('settle-tx-details').textContent = `${directionText} • ${tx.person || 'General Entity'}`;
  document.getElementById('settle-tx-amount').textContent = formatCurrency(tx.amount);

  document.getElementById('settle-modal').classList.remove('hidden');
  lucide.createIcons();
}

function closeSettleModal() {
  document.getElementById('settle-modal').classList.add('hidden');
}

async function submitSettleDebt() {
  const id = document.getElementById('settle-tx-id').value;
  const modeRadio = document.querySelector('input[name="settlement_mode"]:checked');
  const settlementCategory = modeRadio ? modeRadio.value : 'cash_in_gpay';

  try {
    await apiFetch(`/api/transactions/${id}/settle`, {
      method: 'POST',
      body: JSON.stringify({ settlementCategory })
    });

    closeSettleModal();
    showToast('Debt marked as Settled successfully!');
    await loadDashboardData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ================= CSV EXPORT & DEMO DATA RESET ================= //

function exportToCSV() {
  const token = getToken();
  const url = `/api/export/csv`;

  fetch(url, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  })
  .then(res => {
    if (!res.ok) throw new Error('Export failed');
    return res.blob();
  })
  .then(blob => {
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `student_org_financial_ledger_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Financial CSV Report downloaded successfully!');
  })
  .catch(err => {
    showToast('Failed to export CSV: ' + err.message, 'error');
  });
}

async function confirmResetDemoData() {
  if (!confirm('Would you like to reload the default sample college fest transactions? Current custom entries will be reset.')) {
    return;
  }

  try {
    await apiFetch('/api/reset-data', { method: 'POST' });
    showToast('Sample student org data reloaded!');
    await loadDashboardData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Close modals when clicking backdrop
window.addEventListener('click', (e) => {
  const txModal = document.getElementById('tx-modal');
  const settleModal = document.getElementById('settle-modal');

  if (e.target === txModal) closeTransactionModal();
  if (e.target === settleModal) closeSettleModal();
});

// ESC key closes modal
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeTransactionModal();
    closeSettleModal();
  }
});

// App Startup
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  checkAuthStatus();
});
