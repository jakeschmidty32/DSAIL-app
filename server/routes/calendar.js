import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { getCalendarEvents } from '../lib/graph.js'
import requireAuth from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

// Normalize DB row (snake_case) → frontend shape (camelCase)
function normalizeEvent(row) {
  return {
    id: row.id,
    msEventId: row.ms_event_id,
    title: row.title,
    startTime: row.start_time,
    endTime: row.end_time,
    isAllDay: row.is_all_day,
    location: row.location,
    notes: row.notes,
    isOnlineMeeting: row.is_online_meeting,
    meetingUrl: row.meeting_url,
  }
}

function isValidDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const d = new Date(dateStr)
  return !isNaN(d.getTime())
}

// GET /api/calendar/events?date=YYYY-MM-DD
router.get('/events', async (req, res, next) => {
  try {
    const { date } = req.query
    const userId = req.session.userId

    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Missing or invalid date parameter' })
    }

    // Check if user has a calendar connected
    const { data: calAccount } = await supabase
      .from('calendar_accounts')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!calAccount) {
      return res.json({ events: [], cached: false, error: 'no_calendar' })
    }

    // Check for existing journal_day
    const { data: journalDay } = await supabase
      .from('journal_days')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()

    // Check if events are already cached
    if (journalDay) {
      const { data: cachedEvents, error: cachedError } = await supabase
        .from('journal_events')
        .select('*')
        .eq('journal_day_id', journalDay.id)
        .order('start_time', { ascending: true })

      if (cachedError) return next(new Error(cachedError.message))

      if (cachedEvents && cachedEvents.length > 0) {
        return res.json({ events: cachedEvents.map(normalizeEvent), cached: true })
      }
    }

    // Fetch from Microsoft Graph
    const events = await getCalendarEvents(userId, date)

    // Ensure journal_day row exists
    const { data: upsertedDay, error: dayError } = await supabase
      .from('journal_days')
      .upsert(
        { user_id: userId, date },
        { onConflict: 'user_id,date', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (dayError) return next(new Error(`journal_days upsert failed: ${dayError.message}`))

    const journalDayId = upsertedDay.id

    // Insert events into DB (if any)
    if (events.length > 0) {
      const rows = events.map((e) => ({
        journal_day_id: journalDayId,
        ms_event_id: e.msEventId,
        title: e.title,
        start_time: e.startTime,
        end_time: e.endTime,
        is_all_day: e.isAllDay,
        location: e.location,
        notes: e.notes,
        is_online_meeting: e.isOnlineMeeting,
        meeting_url: e.meetingUrl,
      }))

      const { error: insertError } = await supabase
        .from('journal_events')
        .insert(rows)

      if (insertError) return next(new Error(`journal_events insert failed: ${insertError.message}`))
    }

    return res.json({ events, cached: false })
  } catch (err) {
    next(err)
  }
})

// POST /api/calendar/events/refresh?date=YYYY-MM-DD — force re-fetch
router.post('/events/refresh', async (req, res, next) => {
  try {
    const { date } = req.query
    const userId = req.session.userId

    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Missing or invalid date parameter' })
    }

    // Check if user has a calendar connected
    const { data: calAccount } = await supabase
      .from('calendar_accounts')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!calAccount) {
      return res.json({ events: [], cached: false, error: 'no_calendar' })
    }

    // Find journal_day
    const { data: journalDay } = await supabase
      .from('journal_days')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()

    // Delete cached events if they exist
    if (journalDay) {
      const { error: deleteError } = await supabase
        .from('journal_events')
        .delete()
        .eq('journal_day_id', journalDay.id)

      if (deleteError) return next(new Error(`Failed to delete cached events: ${deleteError.message}`))
    }

    // Fetch fresh from Graph
    const events = await getCalendarEvents(userId, date)

    // Ensure journal_day row exists
    const { data: upsertedDay, error: dayError } = await supabase
      .from('journal_days')
      .upsert(
        { user_id: userId, date },
        { onConflict: 'user_id,date', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (dayError) return next(new Error(`journal_days upsert failed: ${dayError.message}`))

    const journalDayId = upsertedDay.id

    if (events.length > 0) {
      const rows = events.map((e) => ({
        journal_day_id: journalDayId,
        ms_event_id: e.msEventId,
        title: e.title,
        start_time: e.startTime,
        end_time: e.endTime,
        is_all_day: e.isAllDay,
        location: e.location,
        notes: e.notes,
        is_online_meeting: e.isOnlineMeeting,
        meeting_url: e.meetingUrl,
      }))

      const { error: insertError } = await supabase
        .from('journal_events')
        .insert(rows)

      if (insertError) return next(new Error(`journal_events insert failed: ${insertError.message}`))
    }

    return res.json({ events, cached: false })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/calendar/events/:id — remove a cached event from the journal
router.delete('/events/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.session.userId

    // Verify ownership: the event's journal_day must belong to this user
    const { data: event } = await supabase
      .from('journal_events')
      .select('id, journal_day_id')
      .eq('id', id)
      .maybeSingle()

    if (!event) return res.status(404).json({ error: 'Event not found' })

    // Check the journal_day belongs to this user
    const { data: day } = await supabase
      .from('journal_days')
      .select('id')
      .eq('id', event.journal_day_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (!day) return res.status(403).json({ error: 'Forbidden' })

    const { error } = await supabase
      .from('journal_events')
      .delete()
      .eq('id', id)

    if (error) return next(new Error(`Failed to delete event: ${error.message}`))

    return res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
