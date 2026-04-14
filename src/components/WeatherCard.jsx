import { getWeatherIcon, getWeatherCondition } from '../lib/weatherCodes.js'

export function WeatherCard({ weather, loading, locationSet }) {
  if (loading) {
    return (
      <div className="py-4 space-y-2">
        <div className="h-8 bg-stone-100 animate-pulse rounded w-1/2 mx-auto" />
        <div className="h-4 bg-stone-100 animate-pulse rounded w-1/3 mx-auto" />
      </div>
    )
  }

  if (!locationSet || !weather) {
    return (
      <p className="text-center font-journal text-sm text-stone-400 italic py-4">
        Set your location in{' '}
        <button className="text-indigo-500 hover:underline" onClick={() => {}}>Settings</button>{' '}
        to see weather.
      </p>
    )
  }

  const icon = getWeatherIcon(weather.weatherCode)
  const unit = weather.temperatureUnit === 'celsius' ? '°C' : '°F'

  return (
    <div className="text-center py-5 border-b border-stone-200 mb-2">
      <div className="text-5xl mb-1">{icon}</div>
      <p className="font-journal text-2xl text-stone-700 mb-1">{weather.condition}</p>
      <p className="font-journal text-3xl font-semibold text-stone-800">
        {Math.round(weather.temperatureMax)}{unit}
        <span className="text-stone-400 text-xl font-normal mx-2">/</span>
        <span className="text-stone-500 text-xl">{Math.round(weather.temperatureMin)}{unit}</span>
      </p>
      <div className="flex items-center justify-center gap-4 mt-2 text-sm text-stone-500 font-journal">
        {weather.precipitation > 0 && <span>💧 {weather.precipitation}&quot; rain</span>}
        {weather.windSpeed > 0 && <span>💨 {Math.round(weather.windSpeed)} mph</span>}
        {weather.uvIndex > 0 && <span>☀️ UV {Math.round(weather.uvIndex)}</span>}
      </div>
      {weather.locationName && (
        <p className="text-xs text-stone-400 font-journal mt-1">{weather.locationName}</p>
      )}
    </div>
  )
}
