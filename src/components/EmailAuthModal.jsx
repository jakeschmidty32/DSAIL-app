import { useState } from 'react'
import { api } from '../lib/api.js'

const C = {
  bg: '#1a1a2a',
  border: 'rgba(255,255,255,0.1)',
  inputBg: 'rgba(255,255,255,0.07)',
  textPrimary: 'rgba(230,230,255,0.92)',
  textMuted: 'rgba(140,140,180,0.7)',
}

export function EmailAuthModal({ onSuccess, onClose }) {
  const [tab, setTab] = useState('signin') // 'signin' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (tab === 'register') {
      if (password !== confirmPassword) { setError('Passwords do not match'); return }
      if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    }

    setLoading(true)
    try {
      if (tab === 'signin') {
        await api.auth.login({ email, password })
      } else {
        await api.auth.register({ email, password, displayName })
      }
      onSuccess()
    } catch (err) {
      setError(err.message || 'Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: C.inputBg,
    color: C.textPrimary,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '0.625rem 0.875rem',
    width: '100%',
    fontSize: '0.95rem',
    outline: 'none',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: C.bg, border: `1px solid ${C.border}` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-optima font-bold text-lg" style={{ color: C.textPrimary }}>
            {tab === 'signin' ? 'Sign In' : 'Create Account'}
          </h2>
          <button onClick={onClose} style={{ color: C.textMuted }} className="text-xl leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg mb-5 p-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {['signin', 'register'].map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null) }}
              className="flex-1 py-1.5 text-sm font-medium rounded-md transition-all"
              style={tab === t
                ? { background: '#4f46e5', color: '#fff' }
                : { color: C.textMuted }}
            >
              {t === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {tab === 'register' && (
            <input
              type="text"
              placeholder="Your name (optional)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={inputStyle}
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
          {tab === 'register' && (
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={inputStyle}
            />
          )}

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ background: '#4f46e5', color: '#fff', marginTop: '0.5rem' }}
          >
            {loading ? '…' : tab === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
