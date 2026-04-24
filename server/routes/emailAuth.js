import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { supabase } from '../lib/supabase.js'

const router = Router()

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

// POST /api/auth/register — create a new email/password account
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, displayName } = req.body

    if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email address' })
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

    const emailTrimmed = email.trim().toLowerCase()

    // Check if email already taken
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', emailTrimmed)
      .maybeSingle()

    if (existing) return res.status(409).json({ error: 'An account with this email already exists' })

    const password_hash = await bcrypt.hash(password, 12)

    const { data: user, error: insertError } = await supabase
      .from('users')
      .insert({
        email: emailTrimmed,
        display_name: displayName?.trim() || emailTrimmed.split('@')[0],
        password_hash,
        auth_provider: 'email',
      })
      .select('id')
      .single()

    if (insertError) return next(new Error(`Registration failed: ${insertError.message}`))

    req.session.userId = user.id
    return res.status(201).json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/login — sign in with email + password
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body

    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const emailTrimmed = email.trim().toLowerCase()

    const { data: user } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('email', emailTrimmed)
      .eq('auth_provider', 'email')
      .maybeSingle()

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const match = await bcrypt.compare(password, user.password_hash)
    if (!match) return res.status(401).json({ error: 'Invalid email or password' })

    req.session.userId = user.id
    return res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
