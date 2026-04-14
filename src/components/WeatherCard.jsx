import { Skeleton } from './ui/Skeleton.jsx'
import { EmptyState } from './ui/EmptyState.jsx'
import { getWeatherIcon, getWeatherCondition } from '../lib/weatherCodes.js'

const CLEAR_CODES = [0, 1]
const CLOUDY_CODES = [2, 3, 45, 48]

function cardBg(code) {
  if (code == null) return 'bg-gray-50'
  if (CLEAR_CODES.includes(code)) return 'bg-sky-50'
  if (CLOUDY_CODES.includes(code)) return 'bg-gray-100'
  if (code >= 61 && code <= 82) return 'bg-blue-50'
  if (code >= 71 && code <= 86) return 'bg-slate-100'
  if (code >= 95) return 'bg-yellow-50'
  return 'bg-gray-50'
}

export function WeatherCard({ weather, loading, locationSet }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4 space-y-2">
        <Skeleton className="w-1/3 h-8" />
        <Skeleton className="w-1/2" />
        <Skeleton className="w-2/3" />
      </div>
    )
  }

  if (!locationSet) {
    return (
      <EmptyState
        icon="📍"
        title="Location not set"
        description="Set your location in Settings to see weather."
      />
    )
  }

  if (!weather) {
    return (
      <EmptyState
        icon="🌡️"
        title="Weather unavailable"
        description="No weather data available for this day."
      />
    )
  }

  const icon = getWeatherIcon(weather.weatherCode)
  const condition = getWeatherCondition(weather.weatherCode)
  const unit = weather.temperatureUnit === 'fahrenheit' ? '°F' : '°C'
  const bg = cardBg(weather.weatherCode)

  return (
    <div
      className={`rounded-xl border border-gray-100 shadow-sm p-4 ${bg} flex flex-col md:flex-row md:items-center md:gap-6 gap-3`}
    >
      {/* Icon + condition */}
      <div className="flex items-center gap-3 md:gap-4">
        <span className="text-5xl leading-none">{icon}</span>
        <div>
          <p className="text-lg font-semibold text-gray-900">{condition}</p>
          <p className="text-sm text-gray-500">{weather.locationName}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-700 md:ml-auto">
        <div className="flex gap-2 items-baseline">
          <span className="font-semibold text-base text-gray-900">
            {weather.temperatureMax}
            {unit}
          </span>
          <span className="text-gray-400">
            / {weather.temperatureMin}
            {unit}
          </span>
        </div>

        {weather.precipitation > 0 && (
          <div className="flex items-center gap-1">
            <span>💧</span>
            <span>{weather.precipitation} in</span>
          </div>
        )}

        {weather.windSpeed != null && (
          <div className="flex items-center gap-1">
            <span>💨</span>
            <span>{weather.windSpeed} mph</span>
          </div>
        )}

        {weather.uvIndex != null && (
          <div className="flex items-center gap-1">
            <span>🔆</span>
            <span>UV {weather.uvIndex}</span>
          </div>
        )}
      </div>
    </div>
  )
}
