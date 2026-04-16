import { Router } from 'express'
import requireAuth from '../middleware/requireAuth.js'

const router = Router()
router.use(requireAuth)

function isValidDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  return !isNaN(new Date(dateStr).getTime())
}

// GET /api/market?date=YYYY-MM-DD
router.get('/', async (req, res, next) => {
  try {
    const { date } = req.query
    if (!isValidDate(date)) return res.status(400).json({ error: 'Invalid date' })

    const todayStr = new Date().toISOString().slice(0, 10)
    const isToday = date === todayStr

    let chartPrices = []
    let price = null
    let prevClose = null
    let changePercent = null

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json',
    }

    if (isToday) {
      const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=1d&interval=5m&includePrePost=false'
      const resp = await fetch(url, { headers })
      if (resp.ok) {
        const data = await resp.json()
        const result = data.chart?.result?.[0]
        if (result) {
          price = result.meta.regularMarketPrice
          prevClose = result.meta.previousClose ?? result.meta.chartPreviousClose
          changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : null
          chartPrices = (result.indicators.quote[0]?.close ?? []).filter(Boolean)
        }
      }
    } else {
      // Historical: 7-day window ending on requested date
      const dateObj = new Date(date + 'T12:00:00Z')
      const start = Math.floor((dateObj.getTime() - 7 * 24 * 60 * 60 * 1000) / 1000)
      const end = Math.floor((dateObj.getTime() + 2 * 24 * 60 * 60 * 1000) / 1000)
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?period1=${start}&period2=${end}&interval=1d`
      const resp = await fetch(url, { headers })
      if (resp.ok) {
        const data = await resp.json()
        const result = data.chart?.result?.[0]
        if (result) {
          const closes = result.indicators.quote[0]?.close ?? []
          const timestamps = result.timestamp ?? []
          // Find entry for the requested date
          let targetIdx = -1
          timestamps.forEach((ts, i) => {
            const d = new Date(ts * 1000).toISOString().slice(0, 10)
            if (d === date) targetIdx = i
          })
          if (targetIdx >= 0) {
            price = closes[targetIdx]
            prevClose = targetIdx > 0 ? closes[targetIdx - 1] : null
            changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : null
            chartPrices = closes.slice(Math.max(0, targetIdx - 4), targetIdx + 1).filter(Boolean)
          } else if (closes.length > 0) {
            // Weekend / holiday — return last available
            price = closes[closes.length - 1]
            prevClose = closes.length > 1 ? closes[closes.length - 2] : null
            changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : null
            chartPrices = closes.slice(-5).filter(Boolean)
          }
        }
      }
    }

    return res.json({
      symbol: 'S&P 500',
      price: price != null ? Math.round(price * 100) / 100 : null,
      changePercent: changePercent != null ? Math.round(changePercent * 100) / 100 : null,
      chartPrices,
      isToday,
    })
  } catch (err) {
    next(err)
  }
})

export default router
