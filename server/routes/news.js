import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { fetchTopHeadlines } from '../lib/news.js'
import requireAuth from '../middleware/requireAuth.js'

const router = Router()
router.use(requireAuth)

function isValidDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const d = new Date(dateStr)
  return !isNaN(d.getTime())
}

// Deduplicate an array of headline rows by title (guards against double-insert races)
function dedupByTitle(rows) {
  const seen = new Set()
  return rows.filter((h) => {
    if (seen.has(h.title)) return false
    seen.add(h.title)
    return true
  })
}

// GET /api/news?date=YYYY-MM-DD
router.get('/', async (req, res, next) => {
  try {
    const { date } = req.query
    const userId = req.session.userId

    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Missing or invalid date parameter' })
    }

    // Load whatever is cached for this date
    const { data: cached, error: cacheError } = await supabase
      .from('news_headlines')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('position', { ascending: true })

    if (cacheError) return next(new Error(cacheError.message))

    // If we already have headlines, return them (deduplicated in case of race-condition double-insert)
    if (cached && cached.length > 0) {
      const unique = dedupByTitle(cached)

      const { data: selected } = await supabase
        .from('selected_headlines')
        .select('headline_id')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle()

      return res.json({
        headlines: unique,
        selectedHeadlineId: selected?.headline_id || null,
      })
    }

    // Nothing cached — fetch from RSS feeds (4 sources, one article each)
    const headlines = await fetchTopHeadlines()

    if (headlines.length > 0) {
      const rows = headlines.map((h, i) => ({
        user_id: userId,
        date,
        position: i + 1,
        title: h.title,
        source: h.source,
        url: h.url,
        published_at: h.publishedAt,
      }))

      const { error: insertError } = await supabase
        .from('news_headlines')
        .insert(rows)

      if (insertError) return next(new Error(`news_headlines insert failed: ${insertError.message}`))
    }

    // Re-fetch so we return DB records with their UUIDs
    const { data: inserted, error: fetchError } = await supabase
      .from('news_headlines')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('position', { ascending: true })

    if (fetchError) return next(new Error(fetchError.message))

    const { data: selected } = await supabase
      .from('selected_headlines')
      .select('headline_id')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()

    return res.json({
      headlines: dedupByTitle(inserted || []),
      selectedHeadlineId: selected?.headline_id || null,
    })
  } catch (err) {
    next(err)
  }
})

export default router
