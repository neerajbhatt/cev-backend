const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'cev-secret-key-change-in-prod'

module.exports = (req, res, next) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
