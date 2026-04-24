import { useEffect, useState, useCallback } from 'react'
import { api } from '../lib/api.js'

const STOCK_COLORS = ['#818cf8', '#fb923c', '#34d399', '#e879f9', '#38bdf8', '#fbbf24', '#f87171', '#a3e635']
const WATCHLIST_KEY = 'market_watchlist'

function loadWatchlistFromStorage() {
  try { return JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]') } catch { return [] }
}

function saveWatchlistToStorage(list) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list))
}

function MultiSparkLine({ stocks }) {
  const W = 320, H = 64
  const series = stocks
    .map((s, i) => {
      const prices = (s.chartPrices ?? []).filter((p) => p !== null && !isNaN(p))
      if (prices.length < 2) return null
      const base = prices[0]
      const pcts = prices.map((p) => ((p - base) / base) * 100)
      return { pcts, color: STOCK_COLORS[i % STOCK_COLORS.length], label: s.label }
    })
    .filter(Boolean)

  if (series.length === 0) return null

  // Align all series to the same length so lines share the same time axis
  const minLen = Math.min(...series.map((s) => s.pcts.length))
  const aligned = series.map((s) => ({ ...s, pcts: s.pcts.slice(-minLen) }))

  const allPcts = aligned.flatMap((s) => s.pcts)
  const min = Math.min(...allPcts, 0)
  const max = Math.max(...allPcts, 0)
  const range = max - min || 0.01
  const toY = (pct) => H - ((pct - min) / range) * (H - 6) - 3
  const zeroY = toY(0).toFixed(1)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '4rem' }} preserveAspectRatio="none">
      <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="rgba(255,255,255,0.12)" strokeWidth="0.75" strokeDasharray="4,3" />
      {aligned.map(({ pcts, color, label }) => {
        const pts = pcts.map((p, i) => `${((i / (pcts.length - 1)) * W).toFixed(1)},${toY(p).toFixed(1)}`).join(' ')
        return <polyline key={label} points={pts} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      })}
    </svg>
  )
}

function splitAtDot(str) {
  const dot = str.lastIndexOf('.')
  if (dot === -1) return [str, '']
  return [str.slice(0, dot), str.slice(dot)]
}

export function MarketCard({ date }) {
  const [watchlist, setWatchlist] = useState(loadWatchlistFromStorage)
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [tickerInput, setTickerInput] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState(null)

  const loadMarket = useCallback((currentWatchlist) => {
    setLoading(true)
    const list = currentWatchlist ?? watchlist
    const tickersParam = list.map((t) => `${t.ticker}:${encodeURIComponent(t.label)}`).join(',')
    api.market.get(date, tickersParam)
      .then((d) => setStocks(d.stocks ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [date, watchlist])

  useEffect(() => { loadMarket() }, [date])

  async function handleAdd() {
    const ticker = tickerInput.trim().toUpperCase()
    if (!ticker) return
    setAddLoading(true)
    setAddError(null)
    try {
      const result = await api.watchlist.add(ticker)
      const newEntry = { ticker: result.ticker, label: result.label }
      const updated = [...watchlist, newEntry]
      setWatchlist(updated)
      saveWatchlistToStorage(updated)
      setTickerInput('')
      setAddOpen(false)
      loadMarket(updated)
    } catch (err) {
      setAddError(err.message || 'Ticker not found')
    } finally {
      setAddLoading(false)
    }
  }

  function handleRemove(ticker) {
    const updated = watchlist.filter((t) => t.ticker !== ticker)
    setWatchlist(updated)
    saveWatchlistToStorage(updated)
    loadMarket(updated)
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-5 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.07)', width: `${70 - i * 10}%` }} />
        ))}
        <div className="h-10 rounded animate-pulse mt-2" style={{ background: 'rgba(255,255,255,0.05)' }} />
      </div>
    )
  }

  const hasAny = stocks.some((s) => s.price !== null)

  return (
    <div className="space-y-2">
      <p className="font-optima text-xs uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Markets</p>

      {!hasAny && (
        <p className="text-sm italic" style={{ color: 'rgba(255,255,255,0.25)' }}>Market data unavailable</p>
      )}

      {/* Single shared grid so every column is pixel-identical across all rows */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '10px 1fr 4rem 1.6rem 2.6rem 1.8rem 1.25rem',
        alignItems: 'center',
        rowGap: '0.35rem',
        columnGap: '0',
      }}>
        {stocks.map((s, i) => {
          const positive = (s.changePercent ?? 0) >= 0
          const priceStr = s.price !== null
            ? s.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : null
          const [priceInt, priceDec] = priceStr ? splitAtDot(priceStr) : ['—', '']
          const changeStr = s.changePercent !== null
            ? `${positive ? '+' : '−'}${Math.abs(s.changePercent).toFixed(2)}`
            : null
          const [changeInt, changeDec] = changeStr ? splitAtDot(changeStr) : ['—', '']
          const numStyle = { fontVariantNumeric: 'tabular-nums', fontFamily: 'inherit' }
          const priceColor = 'rgba(235,235,255,0.92)'
          const changeColor = positive ? '#4ade80' : '#f87171'

          return [
            // Swatch
            <span key={`${s.ticker}-sw`} style={{ width: 10, height: 10, borderRadius: 2, background: STOCK_COLORS[i % STOCK_COLORS.length], display: 'inline-block' }} />,
            // Label
            <span key={`${s.ticker}-lb`} className="font-optima font-bold text-sm uppercase tracking-wide truncate pl-2" style={{ color: 'rgba(200,200,230,0.75)' }}>
              {s.label}
            </span>,
            // Price integer
            <span key={`${s.ticker}-pi`} className="font-optima font-semibold text-sm" style={{ ...numStyle, color: priceColor, textAlign: 'right' }}>
              {priceInt}
            </span>,
            // Price decimal
            <span key={`${s.ticker}-pd`} className="font-optima font-semibold text-sm" style={{ ...numStyle, color: priceColor, textAlign: 'left' }}>
              {priceDec}
            </span>,
            // Change integer
            <span key={`${s.ticker}-ci`} className="font-optima text-sm font-medium" style={{ ...numStyle, color: changeColor, textAlign: 'right', paddingLeft: '0.5rem' }}>
              {changeInt}
            </span>,
            // Change decimal
            <span key={`${s.ticker}-cd`} className="font-optima text-sm font-medium" style={{ ...numStyle, color: changeColor, textAlign: 'left' }}>
              {changeDec}{s.changePercent !== null ? '%' : ''}
            </span>,
            // Remove button
            <span key={`${s.ticker}-rm`} style={{ textAlign: 'center' }}>
              {s.ticker !== '^GSPC' && (
                <button
                  onClick={() => handleRemove(s.ticker)}
                  className="opacity-0 hover:opacity-100 text-xs transition-opacity"
                  style={{ color: 'rgba(150,150,180,0.5)' }}
                  title={`Remove ${s.ticker}`}
                >✕</button>
              )}
            </span>,
          ]
        })}
      </div>

      {/* Add stock */}
      <div className="pt-1">
        {addOpen ? (
          <div className="flex gap-2 items-center mt-1">
            <input
              autoFocus
              value={tickerInput}
              onChange={(e) => { setTickerInput(e.target.value.toUpperCase()); setAddError(null) }}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Ticker (e.g. AAPL)"
              className="flex-1 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(220,220,245,0.9)', border: '1px solid rgba(255,255,255,0.12)' }}
            />
            <button
              onClick={handleAdd}
              disabled={addLoading || !tickerInput.trim()}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              {addLoading ? '…' : 'Add'}
            </button>
            <button onClick={() => { setAddOpen(false); setAddError(null); setTickerInput('') }}
              className="text-xs" style={{ color: 'rgba(150,150,180,0.5)' }}>Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setAddOpen(true)}
            className="text-xs transition-colors"
            style={{ color: 'rgba(100,100,150,0.5)' }}
          >
            + Add stock
          </button>
        )}
        {addError && <p className="text-xs text-red-400 mt-1">{addError}</p>}
      </div>

      {/* Chart */}
      {stocks.length > 0 && (
        <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <MultiSparkLine stocks={stocks} />
          <div className="flex gap-3 mt-1 flex-wrap">
            {stocks.map((s, i) => (
              <span key={s.ticker} className="flex items-center gap-1 text-xs" style={{ color: 'rgba(160,160,200,0.5)' }}>
                <span style={{ width: 8, height: 2, background: STOCK_COLORS[i % STOCK_COLORS.length], display: 'inline-block', borderRadius: 1 }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
