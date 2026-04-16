import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

// Fixed colors per stock — consistent regardless of up/down direction
const STOCK_COLORS = ['#818cf8', '#fb923c', '#34d399'] // indigo, orange, emerald

// Combined chart: normalizes each series to % change from its first value
// so three very different price-scale stocks can share one canvas
function MultiSparkLine({ stocks }) {
  const W = 320
  const H = 64

  const series = stocks
    .map((s, i) => {
      const prices = (s.chartPrices ?? []).filter((p) => p !== null && !isNaN(p))
      if (prices.length < 2) return null
      const base = prices[0]
      const pcts = prices.map((p) => ((p - base) / base) * 100)
      return { pcts, color: STOCK_COLORS[i], label: s.label }
    })
    .filter(Boolean)

  if (series.length === 0) return null

  // Scale across all series, always including 0 so baseline is meaningful
  const allPcts = series.flatMap((s) => s.pcts)
  const rawMin = Math.min(...allPcts)
  const rawMax = Math.max(...allPcts)
  const min = Math.min(rawMin, 0)
  const max = Math.max(rawMax, 0)
  const range = max - min || 0.01

  const toY = (pct) => H - ((pct - min) / range) * (H - 6) - 3
  const zeroY = toY(0).toFixed(1)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: '4rem' }}
      preserveAspectRatio="none"
    >
      {/* Zero baseline */}
      <line
        x1="0" y1={zeroY} x2={W} y2={zeroY}
        stroke="rgba(255,255,255,0.12)" strokeWidth="0.75" strokeDasharray="4,3"
      />
      {series.map(({ pcts, color, label }) => {
        const pts = pcts
          .map((p, i) => {
            const x = ((i / (pcts.length - 1)) * W).toFixed(1)
            const y = toY(p).toFixed(1)
            return `${x},${y}`
          })
          .join(' ')
        return (
          <polyline
            key={label}
            points={pts}
            fill="none"
            stroke={color}
            strokeWidth="1.75"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
}

function StockRow({ stock, color }) {
  if (!stock) return null
  const positive = (stock.changePercent ?? 0) >= 0
  const changeStr =
    stock.changePercent !== null
      ? `${positive ? '+' : ''}${stock.changePercent.toFixed(2)}%`
      : '—'
  const priceStr =
    stock.price !== null
      ? stock.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '—'

  return (
    <div className="flex items-center justify-between gap-3">
      {/* Colour swatch + label */}
      <div className="flex items-center gap-2 shrink-0">
        <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block', flexShrink: 0 }} />
        <span className="font-optima font-bold text-sm uppercase tracking-wide" style={{ color: 'rgba(200,200,230,0.75)' }}>
          {stock.label}
        </span>
      </div>
      {/* Price */}
      <span className="font-optima font-semibold text-base" style={{ color: 'rgba(235,235,255,0.92)' }}>
        {priceStr}
      </span>
      {/* Change */}
      <span className="font-optima text-sm font-medium" style={{ color: positive ? '#4ade80' : '#f87171', minWidth: '4.5rem', textAlign: 'right' }}>
        {changeStr}
      </span>
    </div>
  )
}

export function MarketCard({ date }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setData(null)
    api.market
      .get(date)
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [date])

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-5 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.07)', width: `${70 - i * 10}%` }} />
        ))}
        <div className="h-10 rounded animate-pulse mt-2" style={{ background: 'rgba(255,255,255,0.05)' }} />
      </div>
    )
  }

  const stocks = data?.stocks ?? []
  const hasAny = stocks.some((s) => s.price !== null)

  if (!hasAny) {
    return (
      <p className="text-sm italic" style={{ color: 'rgba(255,255,255,0.25)' }}>
        Market data unavailable
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="font-optima text-xs uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Markets
      </p>
      {stocks.map((s, i) => (
        <StockRow key={s.ticker} stock={s} color={STOCK_COLORS[i]} />
      ))}
      <div className="mt-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <MultiSparkLine stocks={stocks} />
        {/* Legend */}
        <div className="flex gap-3 mt-1 flex-wrap">
          {stocks.map((s, i) => (
            <span key={s.ticker} className="flex items-center gap-1 text-xs" style={{ color: 'rgba(160,160,200,0.5)' }}>
              <span style={{ width: 8, height: 2, background: STOCK_COLORS[i], display: 'inline-block', borderRadius: 1 }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
