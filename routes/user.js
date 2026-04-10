const router = require('express').Router()
const bcrypt = require('bcryptjs')
const { db } = require('../db')
const auth = require('../middleware/auth')

// GET /api/user/profile
router.get('/profile', auth, (req, res) => {
  const user = db.prepare('SELECT id,name,email,phone,dob,member_id,programs,language,mfa_enabled,mfa_phone,password_changed_at FROM users WHERE id=?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ ...user, programs: JSON.parse(user.programs || '[]') })
})

// PUT /api/user/profile
router.put('/profile', auth, (req, res) => {
  const { name, phone, dob, language } = req.body
  db.prepare('UPDATE users SET name=COALESCE(?,name), phone=COALESCE(?,phone), dob=COALESCE(?,dob), language=COALESCE(?,language) WHERE id=?')
    .run(name, phone, dob, language, req.user.id)
  const user = db.prepare('SELECT id,name,email,phone,dob,member_id,programs,language,mfa_enabled,mfa_phone,password_changed_at FROM users WHERE id=?').get(req.user.id)
  res.json({ ...user, programs: JSON.parse(user.programs || '[]') })
})

// PUT /api/user/change-password
router.put('/change-password', auth, (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' })
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' })
  const user = db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'User not found' })
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) return res.status(401).json({ error: 'Current password is incorrect' })
  db.prepare("UPDATE users SET password_hash=?, password_changed_at=datetime('now') WHERE id=?")
    .run(bcrypt.hashSync(newPassword, 10), req.user.id)
  res.json({ message: 'Password changed successfully' })
})

// GET /api/user/mfa
router.get('/mfa', auth, (req, res) => {
  const user = db.prepare('SELECT mfa_enabled, mfa_phone FROM users WHERE id=?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json(user)
})

// PUT /api/user/mfa
router.put('/mfa', auth, (req, res) => {
  const { enabled, phone } = req.body
  db.prepare('UPDATE users SET mfa_enabled=?, mfa_phone=COALESCE(?,mfa_phone) WHERE id=?')
    .run(enabled ? 1 : 0, phone || null, req.user.id)
  const user = db.prepare('SELECT mfa_enabled, mfa_phone FROM users WHERE id=?').get(req.user.id)
  res.json(user)
})

// GET /api/user/login-history
router.get('/login-history', auth, (req, res) => {
  const history = db.prepare('SELECT id, ip, user_agent, status, created_at FROM login_history WHERE user_id=? ORDER BY created_at DESC LIMIT 20').all(req.user.id)
  res.json(history)
})

// GET /api/user/sessions
router.get('/sessions', auth, (req, res) => {
  const sessions = db.prepare('SELECT id, ip, user_agent, is_current, created_at, last_active FROM sessions WHERE user_id=? ORDER BY last_active DESC').all(req.user.id)
  res.json(sessions)
})

// DELETE /api/user/sessions/:id  (revoke a session)
router.delete('/sessions/:id', auth, (req, res) => {
  const session = db.prepare('SELECT id, is_current FROM sessions WHERE id=? AND user_id=?').get(req.params.id, req.user.id)
  if (!session) return res.status(404).json({ error: 'Session not found' })
  if (session.is_current) return res.status(400).json({ error: 'Cannot revoke current session' })
  db.prepare('DELETE FROM sessions WHERE id=?').run(req.params.id)
  res.json({ message: 'Session revoked' })
})

module.exports = router
