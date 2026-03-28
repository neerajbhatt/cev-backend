const router = require('express').Router()
const multer = require('multer')
const path = require('path')
const { db } = require('../db')
const auth = require('../middleware/auth')

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
})

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|jpg|jpeg|png|heic|tiff/i
    allowed.test(path.extname(file.originalname)) ? cb(null, true) : cb(new Error('File type not allowed'))
  }
})

// GET /api/documents
router.get('/', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM documents WHERE user_id=? ORDER BY uploaded_at DESC').all(req.user.id)
  res.json(rows)
})

// POST /api/documents
router.post('/', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const { type, month } = req.body
  if (!type) return res.status(400).json({ error: 'Document type required' })

  const sizeKB = Math.round(req.file.size / 1024)
  const size = sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`

  const result = db.prepare(
    'INSERT INTO documents (user_id,name,type,month,status,size) VALUES (?,?,?,?,?,?)'
  ).run(req.user.id, req.file.originalname, type, month || null, 'Processing', size)

  // Add confirmation notification
  db.prepare('INSERT INTO notifications (user_id,type,title,body) VALUES (?,?,?,?)')
    .run(req.user.id, 'document', 'Document Received',
      `${req.file.originalname} has been received and is being processed and sent to the state DMS.`)

  res.status(201).json(db.prepare('SELECT * FROM documents WHERE id=?').get(result.lastInsertRowid))
})

module.exports = router
