const router = require('express').Router()
const { db } = require('../db')
const auth = require('../middleware/auth')

// GET /api/delegates
router.get('/', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM delegates WHERE user_id=? ORDER BY added_on DESC').all(req.user.id)
  res.json(rows.map(r => ({ ...r, permissions: JSON.parse(r.permissions || '[]') })))
})

// POST /api/delegates
router.post('/', auth, (req, res) => {
  const { name, relation, email, permissions = [] } = req.body
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' })
  const result = db.prepare('INSERT INTO delegates (user_id,name,relation,email,permissions) VALUES (?,?,?,?,?)')
    .run(req.user.id, name, relation || null, email, JSON.stringify(permissions))
  const row = db.prepare('SELECT * FROM delegates WHERE id=?').get(result.lastInsertRowid)
  res.status(201).json({ ...row, permissions: JSON.parse(row.permissions) })
})

// DELETE /api/delegates/:id
router.delete('/:id', auth, (req, res) => {
  const delegate = db.prepare('SELECT * FROM delegates WHERE id=? AND user_id=?').get(req.params.id, req.user.id)
  if (!delegate) return res.status(404).json({ error: 'Not found' })
  db.prepare('DELETE FROM delegates WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
