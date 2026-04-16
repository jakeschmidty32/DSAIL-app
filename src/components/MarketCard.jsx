import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

function SparkLine({ prices, positive }) {
  if (!prices || prices.length < 2) return null
  const valid = prices.filter((p) => p !== null && !isNaN(p))
  if (valid.length < 2) return null
  const min = Math.min(...valid)
  const max = Math.max(...valid)
  const range = max - min || 1
  const W = 200
  const H = 36
  const pts = valid
    .map((p, i) => {
      const x = ((i / (valid.length - 1)) * W).toFixed(1)
      const y = (H - ((p - min) / range) * (H - 4) - 2).toFixed(1)
      return `${x},${y}`
    })
    .join(' ')
  const color = positive ? '#4ade80' : '#f87171'
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: '2.25rem' }}
      preserveAspectRatio="none"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
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
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [date])

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-3 rounded w-1/3 animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="h-6 rounded w-1/2 animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="h-9 rounded w-full animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
      </div>
    )
  }

  if (!data || data.price === null) {
    return (
      <p className="text-xs italic" style={{ color: 'rgba(255,255,255,0.25)' }}>
        Market data unavailable
      </p>
    )
  }

  const positive = (data.changePercent ?? 0) >= 0
  const changeStr =
    data.changePercent !== null
      ? `${positive ? '+' : ''}${data.changePercent.toFixed(2)}%`
      : '—'

  return (
    <div>
      <p className="font-optima text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
        S&P 500
      </p>
      <p className="font-optima text-2xl font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
        {data.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <p className="text-sm font-medium mt-0.5" style={{ color: positive ? '#4ade80' : '#f87171' }}>
        {changeStr}
      </p>
      <div className="mt-2 opacity-80">
        <SparkLine prices={data.chartPrices} positive={positive} />
      </div>
    </div>
  )
}
