import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import requireAuth from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

function isValidDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const d = new Date(dateStr)
  return !isNaN(d.getTime())
}

// Normalize DB row (snake_case) → frontend shape (camelCase)
function normalizeNote(row) {
  return {
    id: row.id,
    content: row.content,
    isVoice: row.is_voice ?? false,
    isPinned: row.is_pinned ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    journalDayId: row.journal_day_id,
  }
}

/**
 * Ensure a journal_days row exists for this user+date, returning its id.
 */
async function ensureJournalDay(userId, date) {
  const { data, error } = await supabase
    .from('journal_days')
    .upsert(
      { user_id: userId, date },
      { onConflict: 'user_id,date', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (error) throw new Error(`journal_days upsert failed: ${error.message}`)
  return data.id
}

// ---------------------------------------------------------------------------
// GET /api/journal/list?start=YYYY-MM-DD&end=YYYY-MM-DD
// ---------------------------------------------------------------------------
router.get('/list', async (req, res, next) => {
  try {
    const { start, end } = req.query
    const userId = req.session.userId

    if (!isValidDate(start) || !isValidDate(end)) {
      return res.status(400).json({ error: 'Missing or invalid start/end date parameters' })
    }

    // Get all journal_days in range
    const { data: days, error: daysError } = await supabase
      .from('journal_days')
      .select('id, date')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })

    if (daysError) return next(new Error(daysError.message))

    if (!days || days.length === 0) {
      return res.json({ days: [] })
    }

    const dayIds = days.map((d) => d.id)
    const dateToId = Object.fromEntries(days.map((d) => [d.date, d.id]))

    // Fetch notes existence
    const { data: notesData } = await supabase
      .from('journal_notes')
      .select('journal_day_id')
      .in('journal_day_id', dayIds)

    // Fetch events existence
    const { data: eventsData } = await supabase
      .from('journal_events')
      .select('journal_day_id')
      .in('journal_day_id', dayIds)

    // Fetch weather existence
    const { data: weatherData } = await supabase
      .from('weather_snapshots')
      .select('date')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end)

    // Fetch news existence
    const { data: newsData } = await supabase
      .from('news_headlines')
      .select('date')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end)

    // Build lookup sets
    const daysWithNotes = new Set((notesData || []).map((n) => n.journal_day_id))
    const daysWithEvents = new Set((eventsData || []).map((e) => e.journal_day_id))
    const datesWithWeather = new Set((weatherData || []).map((w) => w.date))
    const datesWithNews = new Set((newsData || []).map((n) => n.date))

    const result = days.map((d) => ({
      date: d.date,
      hasNotes: daysWithNotes.has(d.id),
      hasEvents: daysWithEvents.has(d.id),
      hasWeather: datesWithWeather.has(d.date),
      hasNews: datesWithNews.has(d.date),
    }))

    return res.json({ days: result })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /api/journal/search?q=text&from=YYYY-MM-DD&to=YYYY-MM-DD
// ---------------------------------------------------------------------------
router.get('/search', async (req, res, next) => {
  try {
    const { q, from, to } = req.query
    const userId = req.session.userId

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' })
    }

    // Get journal_days in range for this user
    let daysQuery = supabase
      .from('journal_days')
      .select('id, date')
      .eq('user_id', userId)

    if (isValidDate(from)) daysQuery = daysQuery.gte('date', from)
    if (isValidDate(to)) daysQuery = daysQuery.lte('date', to)

    const { data: days, error: daysError } = await daysQuery
    if (daysError) return next(new Error(daysError.message))

    if (!days || days.length === 0) {
      return res.json({ results: [] })
    }

    const dayIds = days.map((d) => d.id)
    const idToDate = Object.fromEntries(days.map((d) => [d.id, d.date]))

    // Search notes using ILIKE
    const searchTerm = `%${q.trim()}%`
    const { data: notes, error: notesError } = await supabase
      .from('journal_notes')
      .select('id, journal_day_id, content')
      .in('journal_day_id', dayIds)
      .ilike('content', searchTerm)
      .order('created_at', { ascending: false })
      .limit(50)

    if (notesError) return next(new Error(notesError.message))

    const results = (notes || []).map((note) => {
      // Build a snippet around the match
      const contentLower = note.content.toLowerCase()
      const queryLower = q.trim().toLowerCase()
      const matchIdx = contentLower.indexOf(queryLower)
      let snippet = note.content
      if (matchIdx !== -1) {
        const start = Math.max(0, matchIdx - 60)
        const end = Math.min(note.content.length, matchIdx + queryLower.length + 60)
        snippet = (start > 0 ? '...' : '') + note.content.slice(start, end) + (end < note.content.length ? '...' : '')
      } else {
        snippet = note.content.slice(0, 150) + (note.content.length > 150 ? '...' : '')
      }

      return {
        date: idToDate[note.journal_day_id],
        snippet,
        noteId: note.id,
      }
    })

    return res.json({ results })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /api/journal/:date — get day page summary
// ---------------------------------------------------------------------------
router.get('/:date', async (req, res, next) => {
  try {
    const { date } = req.params
    const userId = req.session.userId

    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Invalid date' })
    }

    // Get journal_day
    const { data: journalDay } = await supabase
      .from('journal_days')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()

    let noteCount = 0
    let eventCount = 0
    let hasWeather = false

    if (journalDay) {
      // Note count
      const { count: nc } = await supabase
        .from('journal_notes')
        .select('id', { count: 'exact', head: true })
        .eq('journal_day_id', journalDay.id)
      noteCount = nc || 0

      // Event count
      const { count: ec } = await supabase
        .from('journal_events')
        .select('id', { count: 'exact', head: true })
        .eq('journal_day_id', journalDay.id)
      eventCount = ec || 0
    }

    // Weather
    const { data: weatherSnap } = await supabase
      .from('weather_snapshots')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()
    hasWeather = !!weatherSnap

    // Selected headline
    let selectedHeadline = null
    if (journalDay) {
      const { data: selRow } = await supabase
        .from('selected_headlines')
        .select('headline_id')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle()

      if (selRow?.headline_id) {
        const { data: headline } = await supabase
          .from('news_headlines')
          .select('title, source, url')
          .eq('id', selRow.headline_id)
          .maybeSingle()
        selectedHeadline = headline || null
      }
    }

    // Quote
    let quote = null
    const { data: quoteRow } = await supabase
      .from('quotes')
      .select('text, author')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()
    if (quoteRow) quote = { text: quoteRow.text, author: quoteRow.author || null }

    return res.json({
      day: {
        date,
        quote,
        selectedHeadline,
        noteCount,
        eventCount,
        hasWeather,
      },
    })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /api/journal/:date/notes
// ---------------------------------------------------------------------------
router.get('/:date/notes', async (req, res, next) => {
  try {
    const { date } = req.params
    const userId = req.session.userId

    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Invalid date' })
    }

    const { data: journalDay } = await supabase
      .from('journal_days')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()

    if (!journalDay) {
      return res.json({ notes: [] })
    }

    const { data: notes, error } = await supabase
      .from('journal_notes')
      .select('*')
      .eq('journal_day_id', journalDay.id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) return next(new Error(error.message))

    return res.json({ notes: (notes || []).map(normalizeNote) })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// POST /api/journal/:date/notes
// ---------------------------------------------------------------------------
router.post('/:date/notes', async (req, res, next) => {
  try {
    const { date } = req.params
    const userId = req.session.userId
    const { content, isVoice = false, createdAt } = req.body

    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Invalid date' })
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' })
    }

    const journalDayId = await ensureJournalDay(userId, date)

    const insertData = {
      journal_day_id: journalDayId,
      content: content.trim(),
      is_voice: isVoice,
      is_pinned: false,
    }
    // Allow client to specify a timestamp so notes appear in the correct hour row
    if (createdAt && typeof createdAt === 'string') {
      insertData.created_at = createdAt
    }

    const { data: note, error } = await supabase
      .from('journal_notes')
      .insert(insertData)
      .select('*')
      .single()

    if (error) return next(new Error(`Failed to create note: ${error.message}`))

    return res.status(201).json({ note: normalizeNote(note) })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// PUT /api/journal/:date/notes/:id
// ---------------------------------------------------------------------------
router.put('/:date/notes/:id', async (req, res, next) => {
  try {
    const { date, id } = req.params
    const userId = req.session.userId
    const { content, isPinned } = req.body

    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Invalid date' })
    }

    // Verify ownership by checking journal_day
    const { data: journalDay } = await supabase
      .from('journal_days')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()

    if (!journalDay) {
      return res.status(404).json({ error: 'Journal day not found' })
    }

    const updates = {}
    if (content !== undefined) {
      if (typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: 'Content must be a non-empty string' })
      }
      updates.content = content.trim()
    }
    if (isPinned !== undefined) {
      updates.is_pinned = Boolean(isPinned)
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const { data: note, error } = await supabase
      .from('journal_notes')
      .update(updates)
      .eq('id', id)
      .eq('journal_day_id', journalDay.id)
      .select('*')
      .single()

    if (error) return next(new Error(`Failed to update note: ${error.message}`))
    if (!note) return res.status(404).json({ error: 'Note not found' })

    return res.json({ note: normalizeNote(note) })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// DELETE /api/journal/:date/notes/:id
// ---------------------------------------------------------------------------
router.delete('/:date/notes/:id', async (req, res, next) => {
  try {
    const { date, id } = req.params
    const userId = req.session.userId

    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Invalid date' })
    }

    // Verify ownership
    const { data: journalDay } = await supabase
      .from('journal_days')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()

    if (!journalDay) {
      return res.status(404).json({ error: 'Journal day not found' })
    }

    const { error, count } = await supabase
      .from('journal_notes')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('journal_day_id', journalDay.id)

    if (error) return next(new Error(`Failed to delete note: ${error.message}`))
    if (count === 0) return res.status(404).json({ error: 'Note not found' })

    return res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// PUT /api/journal/:date/headline
// ---------------------------------------------------------------------------
router.put('/:date/headline', async (req, res, next) => {
  try {
    const { date } = req.params
    const userId = req.session.userId
    const { headlineId } = req.body

    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Invalid date' })
    }

    if (headlineId === null || headlineId === undefined) {
      // Remove selected headline
      const { error } = await supabase
        .from('selected_headlines')
        .delete()
        .eq('user_id', userId)
        .eq('date', date)

      if (error) return next(new Error(`Failed to remove selected headline: ${error.message}`))
      return res.json({ ok: true })
    }

    // Fetch headline details to satisfy NOT NULL constraints on selected_headlines
    const { data: hl, error: hlError } = await supabase
      .from('news_headlines')
      .select('title, source, url')
      .eq('id', headlineId)
      .single()

    if (hlError || !hl) return res.status(404).json({ error: 'Headline not found' })

    // Upsert selected headline
    const { error } = await supabase
      .from('selected_headlines')
      .upsert(
        { user_id: userId, date, headline_id: headlineId, title: hl.title, source: hl.source, url: hl.url },
        { onConflict: 'user_id,date', ignoreDuplicates: false }
      )

    if (error) return next(new Error(`Failed to set selected headline: ${error.message}`))

    return res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// PUT /api/journal/:date/quote
// ---------------------------------------------------------------------------
router.put('/:date/quote', async (req, res, next) => {
  try {
    const { date } = req.params
    const userId = req.session.userId
    const { text, author } = req.body

    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Invalid date' })
    }

    if (text === null || text === undefined || text === '') {
      // Delete the quote
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('user_id', userId)
        .eq('date', date)

      if (error) return next(new Error(`Failed to delete quote: ${error.message}`))
      return res.json({ ok: true })
    }

    if (typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Quote text must be a non-empty string' })
    }

    // Upsert quote
    const { error } = await supabase
      .from('quotes')
      .upsert(
        {
          user_id: userId,
          date,
          text: text.trim(),
          author: author?.trim() || null,
        },
        { onConflict: 'user_id,date', ignoreDuplicates: false }
      )

    if (error) return next(new Error(`Failed to save quote: ${error.message}`))

    return res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
