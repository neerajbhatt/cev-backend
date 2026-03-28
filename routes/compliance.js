const router = require('express').Router()
const { db } = require('../db')
const auth = require('../middleware/auth')

// GET /api/compliance
router.get('/', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM compliance WHERE user_id=? ORDER BY month').all(req.user.id)
  res.json(rows.map(r => ({ ...r, locked: !!r.locked })))
})

// PUT /api/compliance/:month  — recalculate from activities
router.put('/:month', auth, (req, res) => {
  const { month } = req.params
  const row = db.prepare('SELECT * FROM compliance WHERE user_id=? AND month=?').get(req.user.id, month)
  if (!row || row.locked) return res.status(400).json({ error: 'Month is locked or not found' })

  const totalHours = db.prepare('SELECT COALESCE(SUM(hours),0) AS total FROM activities WHERE user_id=? AND month=?')
    .get(req.user.id, month).total

  const status = totalHours >= row.required ? 'Compliant (Verified)' : 'Pending Member Action'
  db.prepare('UPDATE compliance SET hours=?, status=? WHERE user_id=? AND month=?')
    .run(totalHours, status, req.user.id, month)

  res.json(db.prepare('SELECT * FROM compliance WHERE user_id=? AND month=?').get(req.user.id, month))
})

// POST /api/compliance/:month/exemption
router.post('/:month/exemption', auth, (req, res) => {
  const { month } = req.params
  const { exemption } = req.body
  db.prepare('UPDATE compliance SET status=?, exemption=? WHERE user_id=? AND month=?')
    .run('Compliant (Exempt)', exemption, req.user.id, month)
  res.json({ ok: true })
})

module.exports = router
