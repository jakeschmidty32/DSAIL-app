import { Router } from 'express'
import requireAuth from '../middleware/requireAuth.js'

const router = Router()
router.use(requireAuth)

// POST /api/watchlist — validate a ticker against Yahoo Finance, return its label
router.post('/', async (req, res, next) => {
  try {
    const { ticker } = req.body
    if (!ticker || typeof ticker !== 'string') return res.status(400).json({ error: 'Ticker is required' })

    const clean = ticker.trim().toUpperCase()
    if (!/^[\^A-Z0-9.\-=]{1,10}$/.test(clean)) return res.status(400).json({ error: 'Invalid ticker format' })

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(clean)}?range=1d&interval=1d`
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    })
    const data = resp.ok ? await resp.json() : null
    const result = data?.chart?.result?.[0]
    if (!result) return res.status(404).json({ error: `Ticker "${clean}" not found` })

    const label = (result.meta.shortName || result.meta.symbol || clean).slice(0, 40)
    return res.json({ ok: true, ticker: clean, label })
  } catch (err) {
    next(err)
  }
})

export default router
