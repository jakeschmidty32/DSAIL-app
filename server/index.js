import 'dotenv/config'
import express from 'express'
import session from 'express-session'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'

import authRouter from './routes/auth.js'
import calendarRouter from './routes/calendar.js'
import weatherRouter from './routes/weather.js'
import newsRouter from './routes/news.js'
import journalRouter from './routes/journal.js'
import settingsRouter from './routes/settings.js'
import marketRouter from './routes/market.js'
import emailAuthRouter from './routes/emailAuth.js'
import spotifyRouter from './routes/spotify.js'
import watchlistRouter from './routes/watchlist.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProd = process.env.NODE_ENV === 'production'

const app = express()
const PORT = process.env.PORT || 3001

// Trust Cloudflare / reverse-proxy headers so req.secure and req.ip are accurate
app.set('trust proxy', 1)

// CORS — in production the Pages frontend and Railway backend are different origins
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
    // Cross-origin cookies (Pages → Railway) require sameSite:'none' + secure:true
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
}))

// Body parsing
app.use(express.json())

// API Routes
app.use('/api/auth', authRouter)
app.use('/api/calendar', calendarRouter)
app.use('/api/weather', weatherRouter)
app.use('/api/news', newsRouter)
app.use('/api/journal', journalRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/market', marketRouter)
app.use('/api/auth', emailAuthRouter)   // register + login (additional auth routes)
app.use('/api/spotify', spotifyRouter)
app.use('/api/watchlist', watchlistRouter)

// In production: serve the Vite build and let the SPA handle all non-API routes
if (isProd) {
  const distDir = path.join(__dirname, '../dist')
  app.use(express.static(distDir))
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message })
})

app.listen(PORT, () => {
  console.log(`DSAIL server listening on port ${PORT}`)
})
