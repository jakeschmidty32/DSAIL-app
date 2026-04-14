import { useState, useRef, useEffect } from 'react'

export function useVoice(onResult) {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef(null)

  const supported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  function startListening() {
    if (!supported) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const r = new SR()
    r.continuous = false
    r.interimResults = true
    r.lang = 'en-US'

    r.onresult = (e) => {
      const t = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join('')
      setTranscript(t)
      if (e.results[0].isFinal) {
        onResult?.(t)
        setListening(false)
      }
    }
    r.onerror = () => setListening(false)
    r.onend = () => setListening(false)

    recognitionRef.current = r
    r.start()
    setListening(true)
    setTranscript('')
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  useEffect(() => () => recognitionRef.current?.stop(), [])

  return { listening, transcript, startListening, stopListening, supported }
}
