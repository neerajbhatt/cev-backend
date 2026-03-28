require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')

// Ensure uploads directory exists
fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true })

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: '*' }))
app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Routes
app.use('/api/auth',          require('./routes/auth'))
app.use('/api/user',          require('./routes/user'))
app.use('/api/compliance',    require('./routes/compliance'))
app.use('/api/activities',    require('./routes/activities'))
app.use('/api/documents',     require('./routes/documents'))
app.use('/api/notifications', require('./routes/notifications'))
app.use('/api/delegates',     require('./routes/delegates'))

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.message)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => console.log(`CEV Backend running on port ${PORT}`))
