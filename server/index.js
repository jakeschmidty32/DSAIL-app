import 'dotenv/config'
import express from 'express'
import session from 'express-session'
import cors from 'cors'

import authRouter from './routes/auth.js'
import calendarRouter from './routes/calendar.js'
import weatherRouter from './routes/weather.js'
import newsRouter from './routes/news.js'
import journalRouter from './routes/journal.js'
import settingsRouter from './routes/settings.js'
import marketRouter from './routes/market.js'

const app = express()
const PORT = process.env.PORT || 3001

// CORS — allow the Vite frontend with credentials
app.use(cors({
  origin: process.env.APP_URL,
  credentials: true,
}))

// Session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
}))

// Body parsing
app.use(express.json())

// Routes
app.use('/api/auth', authRouter)
app.use('/api/calendar', calendarRouter)
app.use('/api/weather', weatherRouter)
app.use('/api/news', newsRouter)
app.use('/api/journal', journalRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/market', marketRouter)

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message })
})

app.listen(PORT, () => {
  console.log(`DSAIL server listening on port ${PORT}`)
})
