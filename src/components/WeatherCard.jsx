import { getWeatherIcon, getWeatherCondition } from '../lib/weatherCodes.js'

export function WeatherCard({ weather, loading, locationSet, dark }) {
  const textPrimary = dark ? 'rgba(220,220,245,0.9)' : undefined
  const textMuted = dark ? 'rgba(130,130,170,0.7)' : undefined
  const skeletonBg = dark ? 'rgba(255,255,255,0.08)' : undefined

  if (loading) {
    return (
      <div className="py-4 space-y-2">
        <div
          className="h-8 animate-pulse rounded w-1/2 mx-auto"
          style={dark ? { background: skeletonBg } : { background: '#e7e5e4' }}
        />
        <div
          className="h-4 animate-pulse rounded w-1/3 mx-auto"
          style={dark ? { background: skeletonBg } : { background: '#e7e5e4' }}
        />
      </div>
    )
  }

  if (!locationSet || !weather) {
    return (
      <p
        className="text-center font-journal text-sm italic py-4"
        style={{ color: textMuted ?? '#a8a29e' }}
      >
        Set your location in{' '}
        <button className="text-indigo-500 hover:underline" onClick={() => {}}>Settings</button>{' '}
        to see weather.
      </p>
    )
  }

  const icon = getWeatherIcon(weather.weatherCode)
  const unit = weather.temperatureUnit === 'celsius' ? '°C' : '°F'

  const outerClass = dark ? 'text-center py-2' : 'text-center py-5 border-b border-stone-200 mb-2'

  return (
    <div className={outerClass}>
      <div className="text-5xl mb-1">{icon}</div>
      <p
        className="font-journal text-2xl mb-1"
        style={{ color: textPrimary ?? '#44403c' }}
      >
        {weather.condition}
      </p>
      <p
        className="font-journal text-3xl font-semibold"
        style={{ color: textPrimary ?? '#1c1917' }}
      >
        {Math.round(weather.temperatureMax)}{unit}
        <span
          className="text-xl font-normal mx-2"
          style={{ color: textMuted ?? '#a8a29e' }}
        >
          /
        </span>
        <span
          className="text-xl"
          style={{ color: textMuted ?? '#78716c' }}
        >
          {Math.round(weather.temperatureMin)}{unit}
        </span>
      </p>
      <div
        className="flex items-center justify-center gap-4 mt-2 text-sm font-journal"
        style={{ color: textMuted ?? '#78716c' }}
      >
        {weather.precipitation > 0 && <span>💧 {weather.precipitation}&quot; rain</span>}
        {weather.windSpeed > 0 && <span>💨 {Math.round(weather.windSpeed)} mph</span>}
        {weather.uvIndex > 0 && <span>☀️ UV {Math.round(weather.uvIndex)}</span>}
      </div>
      {weather.locationName && (
        <p
          className="text-xs font-journal mt-1"
          style={{ color: textMuted ?? '#a8a29e' }}
        >
          {weather.locationName}
        </p>
      )}
    </div>
  )
}
