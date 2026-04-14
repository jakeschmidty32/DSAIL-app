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

// GET /api/news?date=YYYY-MM-DD
router.get('/', async (req, res, next) => {
  try {
    const { date } = req.query
    const userId = req.session.userId

    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Missing or invalid date parameter' })
    }

    // Check cache — if 3 headlines already stored, return them
    const { data: cached, error: cacheError } = await supabase
      .from('news_headlines')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('position', { ascending: true })

    if (cacheError) return next(new Error(cacheError.message))

    if (cached && cached.length >= 3) {
      // Also fetch selected headline
      const { data: selected } = await supabase
        .from('selected_headlines')
        .select('headline_id')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle()

      return res.json({
        headlines: cached,
        selectedHeadlineId: selected?.headline_id || null,
      })
    }

    // Fetch from RSS feeds
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

    // Re-fetch the newly inserted rows so we return DB records with IDs
    const { data: inserted, error: fetchError } = await supabase
      .from('news_headlines')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('position', { ascending: true })

    if (fetchError) return next(new Error(fetchError.message))

    // Fetch selected headline
    const { data: selected } = await supabase
      .from('selected_headlines')
      .select('headline_id')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()

    return res.json({
      headlines: inserted || [],
      selectedHeadlineId: selected?.headline_id || null,
    })
  } catch (err) {
    next(err)
  }
})

export default router
