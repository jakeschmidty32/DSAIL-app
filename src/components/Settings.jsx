import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'

export function Settings({ user, calendarConnected, onClose, onSaved }) {
  const [settings, setSettings] = useState(null)
  const [loadingSettings, setLoadingSettings] = useState(true)

  // Location search
  const [cityInput, setCityInput] = useState('')
  const [geocodeResults, setGeocodeResults] = useState([])
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState(null)
  const [savingLocation, setSavingLocation] = useState(false)
  const [locationSaved, setLocationSaved] = useState(false)

  // Preferences
  const [tempUnit, setTempUnit] = useState('fahrenheit')
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [prefsSaved, setPrefsSaved] = useState(false)

  // Auth disconnect
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    api.settings
      .get()
      .then((data) => {
        setSettings(data.settings)
        setTempUnit(data.settings.temperatureUnit || 'fahrenheit')
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false))
  }, [])

  async function handleGeocode() {
    if (!cityInput.trim()) return
    setGeocoding(true)
    setGeocodeError(null)
    setGeocodeResults([])
    try {
      const data = await api.settings.geocode(cityInput.trim())
      setGeocodeResults(data.results)
      if (data.results.length === 0) setGeocodeError('No locations found.')
    } catch (err) {
      setGeocodeError(err.message)
    } finally {
      setGeocoding(false)
    }
  }

  async function handleSelectLocation(loc) {
    setSavingLocation(true)
    try {
      await api.settings.saveLocation({
        name: `${loc.name}${loc.admin1 ? `, ${loc.admin1}` : ''}${loc.country ? `, ${loc.country}` : ''}`,
        lat: loc.lat,
        lng: loc.lng,
        timezone: loc.timezone,
      })
      setLocationSaved(true)
      setGeocodeResults([])
      setCityInput('')
      // refresh settings
      const data = await api.settings.get()
      setSettings(data.settings)
      onSaved?.()
      setTimeout(() => setLocationSaved(false), 2000)
    } catch {
    } finally {
      setSavingLocation(false)
    }
  }

  async function handleSavePrefs() {
    setSavingPrefs(true)
    try {
      await api.settings.update({ temperatureUnit: tempUnit })
      setPrefsSaved(true)
      onSaved?.()
      setTimeout(() => setPrefsSaved(false), 2000)
    } catch {
    } finally {
      setSavingPrefs(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      await fetch('/api/auth/disconnect', {
        method: 'POST',
        credentials: 'include',
      })
      onSaved?.()
    } catch {
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm z-10">
        <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 transition-colors duration-150 text-xl leading-none p-1"
          aria-label="Close settings"
        >
          ✕
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-8">
        {/* Account section */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Account
          </h2>
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4 space-y-3">
            {user ? (
              <>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {user.displayName || user.email}
                  </p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                {calendarConnected ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 flex items-center gap-1.5">
                      <span className="text-green-500">●</span> Google Calendar connected
                    </span>
                    <button
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 disabled:opacity-40 transition-colors duration-150"
                    >
                      {disconnecting ? 'Disconnecting…' : 'Disconnect Google Calendar'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">No calendar connected</span>
                    <a
                      href="/api/auth/connect"
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors duration-150"
                    >
                      Connect Google Calendar
                    </a>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">Not signed in</p>
            )}
          </div>
        </section>

        {/* Location section */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Location
          </h2>
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4 space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Current location</p>
              <p className="text-sm font-medium text-gray-900">
                {loadingSettings
                  ? 'Loading…'
                  : settings?.locationName || 'Not set'}
              </p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGeocode()}
                placeholder="Search city…"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleGeocode}
                disabled={geocoding || !cityInput.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
              >
                {geocoding ? '…' : 'Search'}
              </button>
            </div>
            {geocodeError && (
              <p className="text-xs text-red-500">{geocodeError}</p>
            )}
            {locationSaved && (
              <p className="text-xs text-green-600 font-medium">Location saved!</p>
            )}
            {geocodeResults.length > 0 && (
              <div className="space-y-1.5">
                {geocodeResults.map((loc, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectLocation(loc)}
                    disabled={savingLocation}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg border border-gray-100 hover:bg-indigo-50 hover:border-indigo-100 transition-colors duration-150 disabled:opacity-50"
                  >
                    <span className="font-medium text-gray-900">{loc.name}</span>
                    {loc.admin1 && (
                      <span className="text-gray-500">, {loc.admin1}</span>
                    )}
                    {loc.country && (
                      <span className="text-gray-400">, {loc.country}</span>
                    )}
                    {loc.timezone && (
                      <span className="text-xs text-gray-400 block">
                        {loc.timezone}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Preferences section */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Preferences
          </h2>
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">
                Temperature unit
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setTempUnit('fahrenheit')}
                  className={[
                    'px-4 py-2 rounded-lg text-sm font-medium border transition-colors duration-150',
                    tempUnit === 'fahrenheit'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50',
                  ].join(' ')}
                >
                  °F Fahrenheit
                </button>
                <button
                  onClick={() => setTempUnit('celsius')}
                  className={[
                    'px-4 py-2 rounded-lg text-sm font-medium border transition-colors duration-150',
                    tempUnit === 'celsius'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50',
                  ].join(' ')}
                >
                  °C Celsius
                </button>
              </div>
            </div>

            {settings?.timezone && (
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">Timezone</p>
                <p className="text-sm text-gray-500">{settings.timezone}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Timezone is set automatically when you update your location.
                </p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleSavePrefs}
                disabled={savingPrefs}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors duration-150"
              >
                {savingPrefs ? 'Saving…' : 'Save preferences'}
              </button>
              {prefsSaved && (
                <span className="text-xs text-green-600 font-medium">Saved!</span>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
