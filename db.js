const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')
const path = require('path')

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'cev.db')
const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    phone TEXT,
    dob TEXT,
    member_id TEXT UNIQUE,
    programs TEXT DEFAULT '["Medicaid","SNAP"]',
    language TEXT DEFAULT 'en',
    mfa_enabled INTEGER DEFAULT 0,
    mfa_phone TEXT,
    password_changed_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS login_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    status TEXT DEFAULT 'success',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    is_current INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    last_active TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS compliance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    month TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending Member Action',
    hours REAL DEFAULT 0,
    required INTEGER DEFAULT 80,
    locked INTEGER DEFAULT 0,
    exemption TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, month)
  );

  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    month TEXT NOT NULL,
    type TEXT NOT NULL,
    employer TEXT,
    hours REAL NOT NULL,
    start_date TEXT,
    end_date TEXT,
    notes TEXT,
    verified INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    month TEXT,
    status TEXT DEFAULT 'Processing',
    size TEXT,
    uploaded_at TEXT DEFAULT (date('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    title TEXT NOT NULL,
    body TEXT,
    date TEXT DEFAULT (date('now')),
    read INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS delegates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    relation TEXT,
    email TEXT,
    permissions TEXT DEFAULT '[]',
    added_on TEXT DEFAULT (date('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`)

// ── Seed demo user ────────────────────────────────────────────────────────────
function seedUser(userId) {
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
  if (existing) return

  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, phone, dob, member_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, 'Maria Johnson', 'demo@cev.gov', bcrypt.hashSync('demo1234', 10), '(555) 342-1890', '1988-04-12', 'M-100234')

  const complianceData = [
    { month: 'Oct 2025', status: 'Compliant (Verified)',  hours: 82, locked: 1 },
    { month: 'Nov 2025', status: 'Compliant (Exempt)',    hours: 0,  locked: 1, exemption: 'Medical' },
    { month: 'Dec 2025', status: 'Compliant (Verified)',  hours: 95, locked: 1 },
    { month: 'Jan 2026', status: 'Non-Compliant',         hours: 45, locked: 1 },
    { month: 'Feb 2026', status: 'Compliant (Verified)',  hours: 88, locked: 1 },
    { month: 'Mar 2026', status: 'Pending Member Action', hours: 20, locked: 0 },
  ]
  const insertCompliance = db.prepare('INSERT INTO compliance (user_id,month,status,hours,required,locked,exemption) VALUES (?,?,?,?,80,?,?)')
  complianceData.forEach(c => insertCompliance.run(userId, c.month, c.status, c.hours, c.locked, c.exemption || null))

  const insertActivity = db.prepare('INSERT INTO activities (user_id,month,type,employer,hours,start_date,end_date,verified) VALUES (?,?,?,?,?,?,?,?)')
  insertActivity.run(userId, 'Mar 2026', 'Employment', 'City Market', 12, '2026-03-03', '2026-03-07', 0)
  insertActivity.run(userId, 'Mar 2026', 'Vocational Training', 'Community College', 8, '2026-03-10', '2026-03-14', 1)

  const insertDoc = db.prepare('INSERT INTO documents (user_id,name,type,month,status,size) VALUES (?,?,?,?,?,?)')
  insertDoc.run(userId, 'Paystub_Feb2026.pdf', 'CE Activity Proof', 'Feb 2026', 'Accepted', '245 KB')
  insertDoc.run(userId, 'MedicalExemption_Nov.pdf', 'Exemption Documentation', 'Nov 2025', 'Accepted', '118 KB')
  insertDoc.run(userId, 'Paystub_Mar_Week1.jpg', 'CE Activity Proof', 'Mar 2026', 'Processing', '892 KB')

  const insertNotif = db.prepare('INSERT INTO notifications (user_id,type,title,body,date,read) VALUES (?,?,?,?,?,?)')
  insertNotif.run(userId, 'action', 'Action Required: March CE Reporting', 'Your March activity report is due by April 10, 2026. You have 20 hours — 60 more needed.', '2026-03-25', 0)
  insertNotif.run(userId, 'document', 'Document Received', 'Your paystub (Paystub_Mar_Week1.jpg) has been received and is being processed.', '2026-03-08', 0)
  insertNotif.run(userId, 'info', 'February CE Report: Compliant', 'Your February compliance has been verified. You reported 88 hours against a requirement of 80 hours.', '2026-03-02', 1)
  insertNotif.run(userId, 'warning', 'January Non-Compliance Notice', 'Your January report was marked Non-Compliant due to insufficient hours (45 of 80 required).', '2026-02-12', 1)

  db.prepare('INSERT INTO delegates (user_id,name,relation,email,permissions,added_on) VALUES (?,?,?,?,?,?)').run(
    userId, 'Robert Johnson', 'Caregiver', 'rjohnson@email.com', '["view","upload"]', '2026-01-15'
  )

  // Seed MFA
  db.prepare('UPDATE users SET mfa_enabled=1, mfa_phone=? WHERE id=?').run('(555) 342-1890', userId)

  // Seed login history
  const insertHistory = db.prepare('INSERT INTO login_history (user_id,ip,user_agent,status,created_at) VALUES (?,?,?,?,?)')
  insertHistory.run(userId, '192.168.1.42', 'Chrome 124 / Windows 11', 'success', '2026-03-28 09:42:00')
  insertHistory.run(userId, '192.168.1.42', 'Chrome 124 / Windows 11', 'success', '2026-03-25 14:15:00')
  insertHistory.run(userId, '10.0.0.5', 'Safari 17 / iPhone', 'success', '2026-03-22 08:30:00')
  insertHistory.run(userId, '10.0.0.5', 'Safari 17 / iPhone', 'failed', '2026-03-22 08:28:00')
  insertHistory.run(userId, '192.168.1.42', 'Chrome 124 / Windows 11', 'success', '2026-03-18 11:05:00')

  // Seed sessions
  const insertSession = db.prepare('INSERT INTO sessions (user_id,token_hash,ip,user_agent,is_current,created_at,last_active) VALUES (?,?,?,?,?,?,?)')
  insertSession.run(userId, 'seed-hash-1', '192.168.1.42', 'Chrome 124 / Windows 11', 1, '2026-03-28 09:42:00', '2026-03-28 10:15:00')
}

const DEMO_USER_ID = 'user-demo-001'
seedUser(DEMO_USER_ID)

module.exports = { db, DEMO_USER_ID }
