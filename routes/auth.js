const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuid } = require('uuid')
const { db } = require('../db')

const JWT_SECRET = process.env.JWT_SECRET || 'cev-secret-key-change-in-prod'
const sign = (user) => jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' })

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { firstName, lastName, email, password, phone, dob } = req.body
  if (!email || !password || !firstName || !lastName) return res.status(400).json({ error: 'Missing required fields' })
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) return res.status(409).json({ error: 'Email already registered' })
  const id = uuid()
  const memberId = 'M-' + Math.floor(100000 + Math.random() * 900000)
  db.prepare('INSERT INTO users (id,name,email,password_hash,phone,dob,member_id) VALUES (?,?,?,?,?,?,?)')
    .run(id, `${firstName} ${lastName}`, email, bcrypt.hashSync(password, 10), phone || null, dob || null, memberId)

  // Seed compliance months for new user
  const months = ['Oct 2025','Nov 2025','Dec 2025','Jan 2026','Feb 2026','Mar 2026']
  const ins = db.prepare('INSERT OR IGNORE INTO compliance (user_id,month,status,hours,required,locked) VALUES (?,?,?,0,80,0)')
  months.forEach(m => ins.run(id, m, 'Pending Member Action'))

  const user = db.prepare('SELECT id,name,email,phone,dob,member_id,programs,language FROM users WHERE id=?').get(id)
  res.status(201).json({ token: sign(user), user: { ...user, programs: JSON.parse(user.programs || '[]') } })
})

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' })
  const { password_hash, ...safe } = user
  res.json({ token: sign(user), user: { ...safe, programs: JSON.parse(safe.programs || '[]') } })
})

module.exports = router
