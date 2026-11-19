const fs = require('fs');
const path = require('path');
const os = require('os');
const bcrypt = require('bcryptjs');

// Determine database path with Serverless / Vercel (/var/task) read-only support
function resolveDatabasePaths() {
  const localDataDir = path.join(__dirname);
  const localDbFile = path.join(localDataDir, 'database.json');
  const localTempFile = path.join(localDataDir, 'database.tmp.json');

  const isServerless = !!(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    __dirname.startsWith('/var/task') ||
    __dirname.includes('/var/task')
  );

  if (isServerless) {
    const tmpDir = path.join(os.tmpdir(), 'student-org-data');
    try {
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
    } catch (e) {
      console.warn('Could not create tmp directory:', e.message);
    }
    return {
      dir: tmpDir,
      file: path.join(tmpDir, 'database.json'),
      temp: path.join(tmpDir, 'database.tmp.json'),
      seedFile: localDbFile,
      isServerless: true
    };
  }

  // Ensure local directory exists
  try {
    if (!fs.existsSync(localDataDir)) {
      fs.mkdirSync(localDataDir, { recursive: true });
    }
  } catch (e) {
    // If local dir fails (read only), fallback to tmp
    const tmpDir = path.join(os.tmpdir(), 'student-org-data');
    return {
      dir: tmpDir,
      file: path.join(tmpDir, 'database.json'),
      temp: path.join(tmpDir, 'database.tmp.json'),
      seedFile: localDbFile,
      isServerless: true
    };
  }

  return {
    dir: localDataDir,
    file: localDbFile,
    temp: localTempFile,
    seedFile: null,
    isServerless: false
  };
}

// Default initial state
function getDefaultData() {
  const salt = bcrypt.genSaltSync(10);
  const adminPasswordHash = bcrypt.hashSync('admin123', salt);
  const now = new Date();
  
  const todayStr = now.toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const threeDaysAgoStr = new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0];
  const weekAgoStr = new Date(Date.now() - 86400000 * 7).toISOString().split('T')[0];

  return {
    sessions: {},
    users: [
      {
        id: 'usr_admin',
        username: 'admin',
        passwordHash: adminPasswordHash,
        name: 'Club Treasurer',
        role: 'admin',
        createdAt: now.toISOString()
      }
    ],
    transactions: [
      {
        id: 'tx_1',
        type: 'income',
        category: 'cash_in_gpay',
        amount: 25000,
        title: 'College Annual Tech Fest Grant',
        description: 'Sanctioned fund transferred by Student Affairs Council',
        person: 'Student Affairs Office',
        date: weekAgoStr,
        debtType: null,
        debtStatus: null,
        createdBy: 'admin',
        createdAt: new Date(Date.now() - 86400000 * 7).toISOString()
      },
      {
        id: 'tx_2',
        type: 'income',
        category: 'cash_in_gpay',
        amount: 8000,
        title: 'Title Sponsorship - Local Cafe',
        description: 'Sponsorship amount received via GPay UPI for fest poster branding',
        person: 'The Campus Brew Cafe',
        date: threeDaysAgoStr,
        debtType: null,
        debtStatus: null,
        createdBy: 'admin',
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
      },
      {
        id: 'tx_3',
        type: 'income',
        category: 'cash_in_hand',
        amount: 4500,
        title: 'Member Annual Dues (Cash Collection)',
        description: 'Collected ₹150 each from 30 general council members',
        person: 'Rahul (Joint Secretary)',
        date: yesterdayStr,
        debtType: null,
        debtStatus: null,
        createdBy: 'admin',
        createdAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 'tx_4',
        type: 'expense',
        category: 'cash_in_gpay',
        amount: 4200,
        title: 'Auditorium Audio & Mic Rental',
        description: 'Advance payment for speakers and wireless mics',
        person: 'Sound Wave Rentals',
        date: yesterdayStr,
        debtType: null,
        debtStatus: null,
        createdBy: 'admin',
        createdAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 'tx_5',
        type: 'expense',
        category: 'cash_in_hand',
        amount: 1250,
        title: 'Orientation Snacks & Juice',
        description: 'Samosas and tea for faculty advisors and guest speakers',
        person: 'Priya (Logistics Lead)',
        date: todayStr,
        debtType: null,
        debtStatus: null,
        createdBy: 'admin',
        createdAt: now.toISOString()
      },
      {
        id: 'tx_6',
        type: 'expense',
        category: 'debt',
        amount: 3500,
        title: 'Fest Flex Banners & Standees',
        description: 'Printed 3 main gate flex banners. Bill due on Saturday',
        person: 'Apex Digital Print Shop',
        date: todayStr,
        debtType: 'payable',
        debtStatus: 'pending',
        createdBy: 'admin',
        createdAt: now.toISOString()
      },
      {
        id: 'tx_7',
        type: 'income',
        category: 'debt',
        amount: 2000,
        title: 'Workshop Registration Fee (Dept A)',
        description: 'Pending reimbursement voucher from Robotics Dept students',
        person: 'Vikas (Robotics Head)',
        date: yesterdayStr,
        debtType: 'receivable',
        debtStatus: 'pending',
        createdBy: 'admin',
        createdAt: new Date(Date.now() - 86400000).toISOString()
      }
    ]
  };
}

class Store {
  constructor() {
    this.memoryCache = null;
    this.paths = resolveDatabasePaths();
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(this.paths.file)) {
        // If there is a bundled seed file at /var/task/data/database.json, try copying it to /tmp
        if (this.paths.seedFile && fs.existsSync(this.paths.seedFile)) {
          try {
            const seedContent = fs.readFileSync(this.paths.seedFile, 'utf8');
            this.memoryCache = JSON.parse(seedContent);
            fs.writeFileSync(this.paths.file, seedContent, 'utf8');
            return;
          } catch (copyErr) {
            console.warn('Could not copy seed to tmp, initializing default:', copyErr.message);
          }
        }

        const initialData = getDefaultData();
        this.writeSync(initialData);
      }
    } catch (err) {
      console.warn('Store init error, falling back to memory state:', err.message);
      this.memoryCache = getDefaultData();
    }
  }

  readSync() {
    if (this.memoryCache) {
      return this.memoryCache;
    }

    try {
      if (fs.existsSync(this.paths.file)) {
        const raw = fs.readFileSync(this.paths.file, 'utf8');
        const data = JSON.parse(raw);
        if (!data.sessions) data.sessions = {};
        if (!data.users) data.users = [];
        if (!data.transactions) data.transactions = [];
        this.memoryCache = data;
        return data;
      }
    } catch (err) {
      console.warn('Error reading from disk file:', err.message);
    }

    // Check seed file
    if (this.paths.seedFile && fs.existsSync(this.paths.seedFile)) {
      try {
        const raw = fs.readFileSync(this.paths.seedFile, 'utf8');
        const data = JSON.parse(raw);
        if (!data.sessions) data.sessions = {};
        if (!data.users) data.users = [];
        if (!data.transactions) data.transactions = [];
        this.memoryCache = data;
        return data;
      } catch (e) {}
    }

    const defaultData = getDefaultData();
    this.writeSync(defaultData);
    return defaultData;
  }

  writeSync(data) {
    this.memoryCache = data;

    // Attempt to write to file
    try {
      fs.writeFileSync(this.paths.temp, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(this.paths.temp, this.paths.file);
    } catch (err) {
      // If error is Read-Only File System (EROFS), redirect to os.tmpdir()
      if (err.code === 'EROFS' || (err.message && err.message.includes('read-only'))) {
        try {
          const fallbackDir = path.join(os.tmpdir(), 'student-org-data');
          if (!fs.existsSync(fallbackDir)) {
            fs.mkdirSync(fallbackDir, { recursive: true });
          }
          this.paths.file = path.join(fallbackDir, 'database.json');
          this.paths.temp = path.join(fallbackDir, 'database.tmp.json');
          fs.writeFileSync(this.paths.file, JSON.stringify(data, null, 2), 'utf8');
          return;
        } catch (tmpErr) {
          console.warn('Tmp write also failed, retaining memory state:', tmpErr.message);
        }
      } else {
        // Fallback direct write
        try {
          fs.writeFileSync(this.paths.file, JSON.stringify(data, null, 2), 'utf8');
        } catch (e) {
          console.warn('Disk write warning (in-memory state preserved):', e.message);
        }
      }
    }
  }

  // Persistent Sessions
  saveSession(token, session) {
    const data = this.readSync();
    data.sessions[token] = session;
    this.writeSync(data);
  }

  getSession(token) {
    if (!token) return null;
    const data = this.readSync();
    const session = data.sessions[token];
    if (session && session.expiresAt > Date.now()) {
      return session;
    }
    if (session) {
      delete data.sessions[token];
      this.writeSync(data);
    }
    return null;
  }

  deleteSession(token) {
    if (!token) return;
    const data = this.readSync();
    if (data.sessions[token]) {
      delete data.sessions[token];
      this.writeSync(data);
    }
  }

  // User management
  findUserByUsername(username) {
    const data = this.readSync();
    return data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  }

  findUserById(id) {
    const data = this.readSync();
    return data.users.find(u => u.id === id);
  }

  createUser({ username, password, name = '', role = 'member' }) {
    const data = this.readSync();
    const existing = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existing) {
      throw new Error('Username already exists');
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const newUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      username: username.trim(),
      passwordHash,
      name: name.trim() || username.trim(),
      role,
      createdAt: new Date().toISOString()
    };

    data.users.push(newUser);
    this.writeSync(data);
    return { id: newUser.id, username: newUser.username, name: newUser.name, role: newUser.role };
  }

  // Transactions management
  getTransactions() {
    const data = this.readSync();
    return [...data.transactions].sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt);
      const dateB = new Date(b.date || b.createdAt);
      return dateB - dateA;
    });
  }

  addTransaction(txData, user) {
    const data = this.readSync();
    const newTx = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      type: txData.type,
      category: txData.category,
      amount: parseFloat(txData.amount) || 0,
      title: txData.title.trim(),
      description: (txData.description || '').trim(),
      person: (txData.person || '').trim(),
      date: txData.date || new Date().toISOString().split('T')[0],
      debtType: txData.category === 'debt' ? (txData.debtType || (txData.type === 'income' ? 'receivable' : 'payable')) : null,
      debtStatus: txData.category === 'debt' ? (txData.debtStatus || 'pending') : null,
      createdBy: user ? user.username : 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    data.transactions.unshift(newTx);
    this.writeSync(data);
    return newTx;
  }

  updateTransaction(id, updates) {
    const data = this.readSync();
    const index = data.transactions.findIndex(t => t.id === id);
    if (index === -1) {
      throw new Error('Transaction not found');
    }

    const current = data.transactions[index];
    const category = updates.category !== undefined ? updates.category : current.category;
    const type = updates.type !== undefined ? updates.type : current.type;

    const updated = {
      ...current,
      type,
      category,
      amount: updates.amount !== undefined ? parseFloat(updates.amount) : current.amount,
      title: updates.title !== undefined ? updates.title.trim() : current.title,
      description: updates.description !== undefined ? updates.description.trim() : current.description,
      person: updates.person !== undefined ? updates.person.trim() : current.person,
      date: updates.date !== undefined ? updates.date : current.date,
      debtType: category === 'debt' ? (updates.debtType || current.debtType || (type === 'income' ? 'receivable' : 'payable')) : null,
      debtStatus: category === 'debt' ? (updates.debtStatus || current.debtStatus || 'pending') : null,
      updatedAt: new Date().toISOString()
    };

    data.transactions[index] = updated;
    this.writeSync(data);
    return updated;
  }

  deleteTransaction(id) {
    const data = this.readSync();
    const index = data.transactions.findIndex(t => t.id === id);
    if (index === -1) {
      throw new Error('Transaction not found');
    }
    const deleted = data.transactions.splice(index, 1)[0];
    this.writeSync(data);
    return deleted;
  }

  settleDebt(id, settlementDetails = {}) {
    const data = this.readSync();
    const tx = data.transactions.find(t => t.id === id);
    if (!tx) {
      throw new Error('Transaction not found');
    }
    if (tx.category !== 'debt') {
      throw new Error('Transaction is not a debt');
    }

    tx.debtStatus = 'settled';
    tx.settledAt = new Date().toISOString();
    if (settlementDetails.settlementCategory) {
      tx.settlementCategory = settlementDetails.settlementCategory;
    }
    tx.updatedAt = new Date().toISOString();

    this.writeSync(data);
    return tx;
  }

  resetToDefault() {
    const defaultData = getDefaultData();
    this.writeSync(defaultData);
    return defaultData;
  }
}

module.exports = new Store();
