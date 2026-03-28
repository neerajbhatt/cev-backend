const router = require('express').Router()
const { db } = require('../db')
const auth = require('../middleware/auth')

// GET /api/notifications
router.get('/', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY date DESC, id DESC').all(req.user.id)
  res.json(rows.map(r => ({ ...r, read: !!r.read })))
})

// PUT /api/notifications/:id/read
router.put('/:id/read', auth, (req, res) => {
  db.prepare('UPDATE notifications SET read=1 WHERE id=? AND user_id=?').run(req.params.id, req.user.id)
  res.json({ ok: true })
})

// PUT /api/notifications/read-all
router.put('/read-all', auth, (req, res) => {
  db.prepare('UPDATE notifications SET read=1 WHERE user_id=?').run(req.user.id)
  res.json({ ok: true })
})

module.exports = router
