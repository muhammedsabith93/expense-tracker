# 🎓 Student Organization Finance & Ledger Tracker

A full-stack, responsive web application tailored for student clubs, councils, and organizations to record, calculate, and store organizational income and expenses with dedicated tracking for **Cash in Hand**, **Cash in GPay (UPI)**, and **Debts (Payables / Receivables)**.

---

## 🚀 Quick Start

The server is currently running locally at:
👉 **[http://localhost:3000](http://localhost:3000)**

### 🔐 Default Login Credentials
- **Username:** `admin`
- **Password:** `admin123`
*(You can also use the one-click "Fill Demo Credentials" button on the sign-in screen, or click "Register Coordinator" to create a new student account.)*

---

## 🌟 Key Features

### 1. Simple Storing & Real-Time Calculation
- **Total Income**: Automatically sums all grants, registrations, and ticket collections.
- **Total Expenses**: Tracks stage rentals, refreshment bills, decor, and reimbursement slips.
- **Net Balance**: Live calculation of current financial standing (Surplus / Deficit).
- **Persistent Storage**: All transactions and user credentials are saved safely to local JSON storage (`data/database.json`), surviving restarts without external database setup.

### 2. Categorization & Wallet Management
- 💵 **Cash in Hand**: Physical cash collected or held by the student treasurer/secretaries.
- 📱 **Cash in GPay**: Digital bank & UPI funds received via Google Pay / Paytm / PhonePe.
- ⚖️ **Debt Tracker**:
  - **Receivables**: Funds owed to the club (e.g. pending department reimbursements or sponsor grants).
  - **Payables**: Bills or reimbursements the club owes to vendors or students.
  - **One-Click Settle**: Settle pending debts directly via Cash in Hand or GPay with live ledger updates.

### 3. Authentication & Multi-Coordinator Support
- Secure login and registration with salted `bcryptjs` password hashing.
- Session cookie and Bearer token support.
- User tagging showing who added each financial entry.

### 4. Interactive Filters, Search & Reports
- **Real-time Search**: Search by title, coordinator name, or receipt note.
- **Filter Pills**: Switch between *All*, *Cash in Hand*, *Cash in GPay*, *Debt*, *Income*, and *Expense*.
- **Export to CSV**: Export the entire ledger to a spreadsheet format for faculty advisors, college auditor submission, or meetings.
- **Print / PDF Ready**: Dedicated print layout formatted cleanly for college administration reports.

---

## 🛠️ Project Structure

```text
student-org-finance/
├── server.js              # Express 5 backend with Auth & Financial APIs
├── data/
│   ├── store.js           # Atomic JSON persistence engine
│   └── database.json      # Database file storing accounts & transactions
├── public/
│   ├── index.html         # Responsive Tailwind CSS + Lucide UI layout
│   ├── app.js             # Client state, calculations, filters & modals
│   └── styles.css         # Custom typography and print report stylesheets
├── package.json           # Dependencies: express, bcryptjs, cookie-parser
└── README.md              # Documentation
```

---

## 💻 Manual Commands

If you ever need to restart the application manually:
```powershell
cd C:\Users\HP\.gemini\antigravity\scratch\student-org-finance
npm start
```
Then visit **http://localhost:3000** in your browser.
