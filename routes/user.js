const router = require('express').Router()
const { db } = require('../db')
const auth = require('../middleware/auth')

// GET /api/user/profile
router.get('/profile', auth, (req, res) => {
  const user = db.prepare('SELECT id,name,email,phone,dob,member_id,programs,language FROM users WHERE id=?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ ...user, programs: JSON.parse(user.programs || '[]') })
})

// PUT /api/user/profile
router.put('/profile', auth, (req, res) => {
  const { name, phone, dob, language } = req.body
  db.prepare('UPDATE users SET name=COALESCE(?,name), phone=COALESCE(?,phone), dob=COALESCE(?,dob), language=COALESCE(?,language) WHERE id=?')
    .run(name, phone, dob, language, req.user.id)
  const user = db.prepare('SELECT id,name,email,phone,dob,member_id,programs,language FROM users WHERE id=?').get(req.user.id)
  res.json({ ...user, programs: JSON.parse(user.programs || '[]') })
})

module.exports = router
