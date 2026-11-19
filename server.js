const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const store = require('./data/store');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const SESSION_LIFETIME = 1000 * 60 * 60 * 24 * 14; // 14 days

function createSession(user) {
  const token = crypto.randomUUID();
  const session = {
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    expiresAt: Date.now() + SESSION_LIFETIME
  };
  store.saveSession(token, session);
  return token;
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.auth_token) {
    token = req.cookies.auth_token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const session = store.getSession(token);
  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }

  req.user = session;
  req.token = token;
  next();
}

// ---------------- HEALTH CHECK ROUTE ---------------- //
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ---------------- AUTH ROUTES ---------------- //

// Current user check
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.auth_token) {
    token = req.cookies.auth_token;
  }

  if (!token) {
    return res.status(401).json({ user: null });
  }

  const session = store.getSession(token);
  if (!session) {
    return res.status(401).json({ user: null, message: 'Session expired' });
  }

  res.json({ user: { username: session.username, name: session.name, role: session.role } });
});

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = store.findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = bcrypt.compareSync(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = createSession(user);

    res.cookie('auth_token', token, {
      httpOnly: false,
      maxAge: SESSION_LIFETIME,
      sameSite: 'lax'
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login: ' + err.message });
  }
});

// Register new coordinator
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, password, name } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long' });
    }

    const newUser = store.createUser({ username, password, name });
    const token = createSession(newUser);

    res.cookie('auth_token', token, {
      httpOnly: false,
      maxAge: SESSION_LIFETIME,
      sameSite: 'lax'
    });

    res.json({
      success: true,
      token,
      user: newUser
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.auth_token || (req.headers.authorization && req.headers.authorization.substring(7));
  if (token) {
    store.deleteSession(token);
  }
  res.clearCookie('auth_token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// ---------------- TRANSACTION & SUMMARY ROUTES ---------------- //

function calculateTotals(transactions) {
  let totalIncome = 0;
  let totalExpense = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  let cashInHandIncome = 0;
  let cashInHandExpense = 0;

  let cashInGPayIncome = 0;
  let cashInGPayExpense = 0;

  let pendingReceivable = 0;
  let pendingPayable = 0;
  let settledDebt = 0;
  let pendingDebtCount = 0;

  for (const t of transactions) {
    const amount = parseFloat(t.amount) || 0;

    if (t.category === 'debt') {
      if (t.debtStatus === 'pending') {
        pendingDebtCount++;
        if (t.debtType === 'receivable' || t.type === 'income') {
          pendingReceivable += amount;
        } else {
          pendingPayable += amount;
        }
      } else if (t.debtStatus === 'settled') {
        settledDebt += amount;
      }

      if (t.type === 'income') {
        totalIncome += amount;
        incomeCount++;
      } else {
        totalExpense += amount;
        expenseCount++;
      }
    } else {
      if (t.type === 'income') {
        totalIncome += amount;
        incomeCount++;
        if (t.category === 'cash_in_hand') cashInHandIncome += amount;
        if (t.category === 'cash_in_gpay') cashInGPayIncome += amount;
      } else {
        totalExpense += amount;
        expenseCount++;
        if (t.category === 'cash_in_hand') cashInHandExpense += amount;
        if (t.category === 'cash_in_gpay') cashInGPayExpense += amount;
      }
    }
  }

  const netBalance = totalIncome - totalExpense;
  const cashInHandBalance = cashInHandIncome - cashInHandExpense;
  const cashInGPayBalance = cashInGPayIncome - cashInGPayExpense;
  const netDebtPosition = pendingReceivable - pendingPayable;

  return {
    totalIncome: Number(totalIncome.toFixed(2)),
    totalExpense: Number(totalExpense.toFixed(2)),
    netBalance: Number(netBalance.toFixed(2)),
    incomeCount,
    expenseCount,
    wallets: {
      cashInHand: {
        income: Number(cashInHandIncome.toFixed(2)),
        expense: Number(cashInHandExpense.toFixed(2)),
        balance: Number(cashInHandBalance.toFixed(2))
      },
      cashInGPay: {
        income: Number(cashInGPayIncome.toFixed(2)),
        expense: Number(cashInGPayExpense.toFixed(2)),
        balance: Number(cashInGPayBalance.toFixed(2))
      },
      debt: {
        pendingReceivable: Number(pendingReceivable.toFixed(2)),
        pendingPayable: Number(pendingPayable.toFixed(2)),
        netDebtPosition: Number(netDebtPosition.toFixed(2)),
        settledDebt: Number(settledDebt.toFixed(2)),
        pendingCount: pendingDebtCount
      }
    },
    totalTransactionsCount: transactions.length
  };
}

// Get Financial Summary Metrics
app.get('/api/summary', authMiddleware, (req, res) => {
  const transactions = store.getTransactions();
  const summary = calculateTotals(transactions);
  res.json(summary);
});

// Get Transactions (with filtering, search, sorting)
app.get('/api/transactions', authMiddleware, (req, res) => {
  let list = store.getTransactions();
  const { type, category, debtStatus, search } = req.query;

  if (type && type !== 'all') {
    list = list.filter(t => t.type === type);
  }

  if (category && category !== 'all') {
    list = list.filter(t => t.category === category);
  }

  if (debtStatus && debtStatus !== 'all') {
    list = list.filter(t => t.debtStatus === debtStatus);
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(t => 
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.person && t.person.toLowerCase().includes(q))
    );
  }

  const filteredSummary = calculateTotals(list);

  res.json({
    transactions: list,
    filteredSummary
  });
});

// Add new transaction
app.post('/api/transactions', authMiddleware, (req, res) => {
  try {
    const { type, category, amount, title, description, person, date, debtType, debtStatus } = req.body;

    if (!type || !['income', 'expense'].includes(type)) {
      return res.status(400).json({ error: 'Valid type (income or expense) is required' });
    }

    if (!category || !['cash_in_hand', 'cash_in_gpay', 'debt'].includes(category)) {
      return res.status(400).json({ error: 'Valid category (cash_in_hand, cash_in_gpay, debt) is required' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'A positive transaction amount is required' });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Transaction title/purpose is required' });
    }

    const newTx = store.addTransaction({
      type,
      category,
      amount: numAmount,
      title,
      description,
      person,
      date,
      debtType,
      debtStatus
    }, req.user);

    res.status(201).json({ success: true, transaction: newTx });
  } catch (err) {
    console.error('Error adding transaction:', err);
    res.status(500).json({ error: err.message || 'Error saving transaction' });
  }
});

// Update transaction
app.put('/api/transactions/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const updated = store.updateTransaction(id, req.body);
    res.json({ success: true, transaction: updated });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error updating transaction' });
  }
});

// Delete transaction
app.delete('/api/transactions/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const deleted = store.deleteTransaction(id);
    res.json({ success: true, transaction: deleted });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error deleting transaction' });
  }
});

// Settle Debt
app.post('/api/transactions/:id/settle', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { settlementCategory } = req.body;
    const settled = store.settleDebt(id, { settlementCategory });
    res.json({ success: true, transaction: settled });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error settling debt' });
  }
});

// Reset data to defaults
app.post('/api/reset-data', authMiddleware, (req, res) => {
  try {
    store.resetToDefault();
    res.json({ success: true, message: 'Database reset to default sample records' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset data' });
  }
});

// Export CSV
app.get('/api/export/csv', authMiddleware, (req, res) => {
  const transactions = store.getTransactions();
  
  const headers = ['Date', 'Type', 'Category / Mode', 'Title', 'Amount', 'Person / Vendor', 'Debt Details', 'Notes', 'Created By'];
  const rows = transactions.map(t => {
    let categoryLabel = 'Cash in Hand';
    if (t.category === 'cash_in_gpay') categoryLabel = 'Cash in GPay';
    if (t.category === 'debt') categoryLabel = 'Debt';

    let debtDetails = '-';
    if (t.category === 'debt') {
      debtDetails = `${t.debtType === 'receivable' ? 'Owed to Org' : 'Org Owes'} (${t.debtStatus || 'pending'})`;
    }

    const clean = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;

    return [
      clean(t.date),
      clean(t.type.toUpperCase()),
      clean(categoryLabel),
      clean(t.title),
      t.amount,
      clean(t.person || '-'),
      clean(debtDetails),
      clean(t.description || '-'),
      clean(t.createdBy || '-')
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="student_org_finance_report.csv"');
  res.send(csvContent);
});

// Fallback for SPA routing: serve index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Student Org Finance Tracker server running at http://localhost:${PORT}`);
});
