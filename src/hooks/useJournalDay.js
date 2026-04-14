import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api.js'

function initialState() {
  return {
    loading: true,
    error: null,
    dayMeta: null,
    events: [],
    eventsLoading: true,
    weather: null,
    weatherLoading: true,
    weatherError: null,
    headlines: [],
    headlinesLoading: true,
    selectedHeadlineId: null,
    notes: [],
    notesLoading: true,
    quote: null,
  }
}

export function useJournalDay(date) {
  const [state, setState] = useState(initialState)

  function patch(update) {
    setState((prev) => ({ ...prev, ...update }))
  }

  const load = useCallback(
    async (targetDate) => {
      if (!targetDate) return

      patch(initialState())

      // day meta + quote
      api.journal
        .day(targetDate)
        .then((data) => {
          patch({ dayMeta: data.day, quote: data.day?.quote ?? null, loading: false })
        })
        .catch((err) => {
          patch({ loading: false, error: err.message })
        })

      // notes
      api.journal
        .notes(targetDate)
        .then((data) => {
          patch({ notes: data.notes, notesLoading: false })
        })
        .catch(() => {
          patch({ notesLoading: false })
        })

      // weather
      api.weather
        .get(targetDate)
        .then((data) => {
          patch({
            weather: data.weather ?? null,
            weatherError: data.error ?? null,
            weatherLoading: false,
          })
        })
        .catch(() => {
          patch({ weatherLoading: false })
        })

      // news
      api.news
        .get(targetDate)
        .then((data) => {
          patch({
            headlines: data.headlines,
            selectedHeadlineId: data.selectedHeadlineId,
            headlinesLoading: false,
          })
        })
        .catch(() => {
          patch({ headlinesLoading: false })
        })

      // calendar
      api.calendar
        .events(targetDate)
        .then((data) => {
          patch({ events: data.events, eventsLoading: false })
        })
        .catch(() => {
          patch({ eventsLoading: false })
        })
    },
    [],
  )

  useEffect(() => {
    load(date)
  }, [date, load])

  // Mutators

  async function addNote(content, isVoice = false) {
    const tempId = `temp-${Date.now()}`
    const tempNote = {
      id: tempId,
      content,
      isVoice,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    patch({ notes: [tempNote, ...state.notes] })
    try {
      const data = await api.journal.addNote(date, { content, isVoice })
      setState((prev) => ({
        ...prev,
        notes: prev.notes.map((n) => (n.id === tempId ? data.note : n)),
      }))
    } catch {
      setState((prev) => ({
        ...prev,
        notes: prev.notes.filter((n) => n.id !== tempId),
      }))
    }
  }

  async function updateNote(id, body) {
    const prev = state.notes.find((n) => n.id === id)
    setState((s) => ({
      ...s,
      notes: s.notes.map((n) => (n.id === id ? { ...n, ...body } : n)),
    }))
    try {
      const data = await api.journal.updateNote(date, id, body)
      setState((s) => ({
        ...s,
        notes: s.notes.map((n) => (n.id === id ? data.note : n)),
      }))
    } catch {
      setState((s) => ({
        ...s,
        notes: s.notes.map((n) => (n.id === id ? prev : n)),
      }))
    }
  }

  async function deleteNote(id) {
    const prevNotes = state.notes
    setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }))
    try {
      await api.journal.deleteNote(date, id)
    } catch {
      setState((s) => ({ ...s, notes: prevNotes }))
    }
  }

  async function pinNote(id, isPinned) {
    return updateNote(id, { isPinned })
  }

  async function selectHeadline(headlineId) {
    const prevId = state.selectedHeadlineId
    const newId = state.selectedHeadlineId === headlineId ? null : headlineId
    patch({ selectedHeadlineId: newId })
    try {
      await api.journal.selectHeadline(date, newId)
    } catch {
      patch({ selectedHeadlineId: prevId })
    }
  }

  async function saveQuote(text, author) {
    const prevQuote = state.quote
    const newQuote = text ? { text, author: author || undefined } : null
    patch({ quote: newQuote })
    try {
      await api.journal.saveQuote(date, { text: text || null, author })
    } catch {
      patch({ quote: prevQuote })
    }
  }

  async function refreshCalendar() {
    patch({ eventsLoading: true })
    try {
      const data = await api.calendar.refresh(date)
      patch({ events: data.events, eventsLoading: false })
    } catch {
      // fall back to normal fetch
      api.calendar
        .events(date)
        .then((data) => patch({ events: data.events, eventsLoading: false }))
        .catch(() => patch({ eventsLoading: false }))
    }
  }

  function refresh() {
    load(date)
  }

  return {
    ...state,
    refresh,
    addNote,
    updateNote,
    deleteNote,
    pinNote,
    selectHeadline,
    saveQuote,
    refreshCalendar,
  }
}
