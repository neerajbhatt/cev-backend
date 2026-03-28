const router = require('express').Router()
const { db } = require('../db')
const auth = require('../middleware/auth')

const recalcCompliance = (userId, month) => {
  const row = db.prepare('SELECT * FROM compliance WHERE user_id=? AND month=?').get(userId, month)
  if (!row || row.locked) return
  const total = db.prepare('SELECT COALESCE(SUM(hours),0) AS t FROM activities WHERE user_id=? AND month=?').get(userId, month).t
  const status = total >= row.required ? 'Compliant (Verified)' : 'Pending Member Action'
  db.prepare('UPDATE compliance SET hours=?, status=? WHERE user_id=? AND month=?').run(total, status, userId, month)
}

// GET /api/activities?month=Mar+2026
router.get('/', auth, (req, res) => {
  const { month } = req.query
  const rows = month
    ? db.prepare('SELECT * FROM activities WHERE user_id=? AND month=? ORDER BY created_at DESC').all(req.user.id, month)
    : db.prepare('SELECT * FROM activities WHERE user_id=? ORDER BY month, created_at DESC').all(req.user.id)
  res.json(rows.map(r => ({ ...r, verified: !!r.verified })))
})

// POST /api/activities
router.post('/', auth, (req, res) => {
  const { month, type, employer, hours, startDate, endDate, notes } = req.body
  if (!month || !type || !hours) return res.status(400).json({ error: 'month, type, hours required' })
  if (Number(hours) > 744) return res.status(400).json({ error: 'Hours cannot exceed 744' })

  const compliance = db.prepare('SELECT locked FROM compliance WHERE user_id=? AND month=?').get(req.user.id, month)
  if (compliance?.locked) return res.status(400).json({ error: 'Reporting window is closed for this month' })

  const result = db.prepare(
    'INSERT INTO activities (user_id,month,type,employer,hours,start_date,end_date,notes) VALUES (?,?,?,?,?,?,?,?)'
  ).run(req.user.id, month, type, employer || null, Number(hours), startDate || null, endDate || null, notes || null)

  recalcCompliance(req.user.id, month)

  const activity = db.prepare('SELECT * FROM activities WHERE id=?').get(result.lastInsertRowid)
  res.status(201).json({ ...activity, verified: !!activity.verified })
})

// DELETE /api/activities/:id
router.delete('/:id', auth, (req, res) => {
  const activity = db.prepare('SELECT * FROM activities WHERE id=? AND user_id=?').get(req.params.id, req.user.id)
  if (!activity) return res.status(404).json({ error: 'Not found' })
  db.prepare('DELETE FROM activities WHERE id=?').run(req.params.id)
  recalcCompliance(req.user.id, activity.month)
  res.json({ ok: true })
})

module.exports = router
