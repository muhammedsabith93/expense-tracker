const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname);
const DB_FILE = path.join(DATA_DIR, 'database.json');
const TEMP_FILE = path.join(DATA_DIR, 'database.tmp.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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
        debtType: 'payable', // Org owes vendor
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
        debtType: 'receivable', // Dept owes Org
        debtStatus: 'pending',
        createdBy: 'admin',
        createdAt: new Date(Date.now() - 86400000).toISOString()
      }
    ]
  };
}

class Store {
  constructor() {
    this.init();
  }

  init() {
    if (!fs.existsSync(DB_FILE)) {
      const initialData = getDefaultData();
      this.writeSync(initialData);
    }
  }

  readSync() {
    try {
      if (!fs.existsSync(DB_FILE)) {
        this.init();
      }
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (!data.sessions) data.sessions = {};
      if (!data.users) data.users = [];
      if (!data.transactions) data.transactions = [];
      return data;
    } catch (err) {
      console.error('Error reading database, recreating default:', err);
      const defaultData = getDefaultData();
      this.writeSync(defaultData);
      return defaultData;
    }
  }

  writeSync(data) {
    try {
      fs.writeFileSync(TEMP_FILE, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(TEMP_FILE, DB_FILE);
    } catch (err) {
      console.error('Failed to write database file:', err);
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
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
      type: txData.type, // 'income' | 'expense'
      category: txData.category, // 'cash_in_hand' | 'cash_in_gpay' | 'debt'
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
