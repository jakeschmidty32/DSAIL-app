import { Router } from 'express'
import requireAuth from '../middleware/requireAuth.js'

const router = Router()
router.use(requireAuth)

function isValidDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  return !isNaN(new Date(dateStr).getTime())
}

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'application/json',
}

async function fetchTicker(ticker, date, isToday) {
  const enc = encodeURIComponent(ticker)
  try {
    if (isToday) {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${enc}?range=1d&interval=5m&includePrePost=false`
      const resp = await fetch(url, { headers: YF_HEADERS })
      if (!resp.ok) return null
      const data = await resp.json()
      const result = data.chart?.result?.[0]
      if (!result) return null
      const price = result.meta.regularMarketPrice
      const prevClose = result.meta.previousClose ?? result.meta.chartPreviousClose
      const changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : null
      const chartPrices = (result.indicators.quote[0]?.close ?? []).filter(Boolean)
      return {
        price: Math.round(price * 100) / 100,
        changePercent: changePercent != null ? Math.round(changePercent * 100) / 100 : null,
        chartPrices,
      }
    } else {
      const dateObj = new Date(date + 'T12:00:00Z')
      const start = Math.floor((dateObj.getTime() - 7 * 24 * 60 * 60 * 1000) / 1000)
      const end = Math.floor((dateObj.getTime() + 2 * 24 * 60 * 60 * 1000) / 1000)
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${enc}?period1=${start}&period2=${end}&interval=1d`
      const resp = await fetch(url, { headers: YF_HEADERS })
      if (!resp.ok) return null
      const data = await resp.json()
      const result = data.chart?.result?.[0]
      if (!result) return null
      const closes = result.indicators.quote[0]?.close ?? []
      const timestamps = result.timestamp ?? []

      let targetIdx = -1
      timestamps.forEach((ts, i) => {
        if (new Date(ts * 1000).toISOString().slice(0, 10) === date) targetIdx = i
      })

      let price, prevClose, chartPrices
      if (targetIdx >= 0) {
        price = closes[targetIdx]
        prevClose = targetIdx > 0 ? closes[targetIdx - 1] : null
        chartPrices = closes.slice(Math.max(0, targetIdx - 4), targetIdx + 1).filter(Boolean)
      } else if (closes.length > 0) {
        price = closes[closes.length - 1]
        prevClose = closes.length > 1 ? closes[closes.length - 2] : null
        chartPrices = closes.slice(-5).filter(Boolean)
      } else {
        return null
      }

      const changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : null
      return {
        price: Math.round(price * 100) / 100,
        changePercent: changePercent != null ? Math.round(changePercent * 100) / 100 : null,
        chartPrices,
      }
    }
  } catch {
    return null
  }
}

// GET /api/market?date=YYYY-MM-DD&tickers=AAPL:Apple,TSLA:Tesla
router.get('/', async (req, res, next) => {
  try {
    const { date, tickers: tickersParam } = req.query
    if (!isValidDate(date)) return res.status(400).json({ error: 'Invalid date' })

    const todayStr = new Date().toISOString().slice(0, 10)
    const isToday = date === todayStr

    // Parse extra tickers from query param — format: "TICKER:Label,TICKER2:Label2"
    const extraTickers = (tickersParam || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => {
        const idx = t.indexOf(':')
        if (idx === -1) return { ticker: t.toUpperCase(), label: t.toUpperCase() }
        const ticker = t.slice(0, idx).toUpperCase()
        const label = decodeURIComponent(t.slice(idx + 1))
        return { ticker, label }
      })
      .filter((t) => /^[\^A-Z0-9.\-=]{1,10}$/.test(t.ticker))
      .slice(0, 10)

    const TICKERS = [
      { ticker: '^GSPC', label: 'S&P 500' },
      ...extraTickers,
    ]

    const results = await Promise.allSettled(
      TICKERS.map(({ ticker }) => fetchTicker(ticker, date, isToday))
    )

    const stocks = TICKERS.map(({ ticker, label }, i) => {
      const d = results[i].status === 'fulfilled' ? results[i].value : null
      return { ticker, label, price: d?.price ?? null, changePercent: d?.changePercent ?? null, chartPrices: d?.chartPrices ?? [] }
    })

    return res.json({ stocks, isToday })
  } catch (err) {
    next(err)
  }
})

export default router
