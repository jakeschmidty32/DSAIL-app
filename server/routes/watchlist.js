import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import requireAuth from '../middleware/requireAuth.js'

const router = Router()
router.use(requireAuth)

// GET /api/watchlist — get user's custom tickers
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('user_watchlist')
      .select('ticker, label, position')
      .eq('user_id', req.session.userId)
      .order('position', { ascending: true })

    if (error) return next(new Error(error.message))
    return res.json({ tickers: data || [] })
  } catch (err) {
    next(err)
  }
})

// POST /api/watchlist — add a ticker (validates it against Yahoo Finance first)
router.post('/', async (req, res, next) => {
  try {
    const { ticker } = req.body
    if (!ticker || typeof ticker !== 'string') return res.status(400).json({ error: 'Ticker is required' })

    const clean = ticker.trim().toUpperCase()
    if (!/^[\^A-Z0-9.\-=]{1,10}$/.test(clean)) return res.status(400).json({ error: 'Invalid ticker format' })

    // Validate by trying to fetch from Yahoo Finance
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(clean)}?range=1d&interval=1d`
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    })
    const data = resp.ok ? await resp.json() : null
    const result = data?.chart?.result?.[0]
    if (!result) return res.status(404).json({ error: `Ticker "${clean}" not found` })

    const label = result.meta.shortName || result.meta.symbol || clean

    // Get current position count
    const { count } = await supabase
      .from('user_watchlist')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.session.userId)

    const { error: insertError } = await supabase
      .from('user_watchlist')
      .upsert(
        { user_id: req.session.userId, ticker: clean, label: label.slice(0, 40), position: count || 0 },
        { onConflict: 'user_id,ticker' }
      )

    if (insertError) return next(new Error(insertError.message))
    return res.json({ ok: true, ticker: clean, label: label.slice(0, 40) })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/watchlist/:ticker — remove a ticker
router.delete('/:ticker', async (req, res, next) => {
  try {
    const ticker = req.params.ticker.toUpperCase()
    const { error } = await supabase
      .from('user_watchlist')
      .delete()
      .eq('user_id', req.session.userId)
      .eq('ticker', ticker)

    if (error) return next(new Error(error.message))
    return res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
