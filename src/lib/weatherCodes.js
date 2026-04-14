const WMO = {
  0: { icon: '☀️', condition: 'Clear sky' },
  1: { icon: '🌤️', condition: 'Mainly clear' },
  2: { icon: '⛅', condition: 'Partly cloudy' },
  3: { icon: '☁️', condition: 'Overcast' },
  45: { icon: '🌫️', condition: 'Fog' },
  48: { icon: '🌫️', condition: 'Fog' },
  51: { icon: '🌦️', condition: 'Light drizzle' },
  53: { icon: '🌦️', condition: 'Drizzle' },
  55: { icon: '🌦️', condition: 'Dense drizzle' },
  61: { icon: '🌧️', condition: 'Slight rain' },
  63: { icon: '🌧️', condition: 'Rain' },
  65: { icon: '🌧️', condition: 'Heavy rain' },
  71: { icon: '🌨️', condition: 'Slight snow' },
  73: { icon: '🌨️', condition: 'Snow' },
  75: { icon: '🌨️', condition: 'Heavy snow' },
  80: { icon: '🌦️', condition: 'Light rain showers' },
  81: { icon: '🌦️', condition: 'Rain showers' },
  82: { icon: '🌦️', condition: 'Heavy rain showers' },
  85: { icon: '🌨️', condition: 'Snow showers' },
  86: { icon: '🌨️', condition: 'Heavy snow showers' },
  95: { icon: '⛈️', condition: 'Thunderstorm' },
  96: { icon: '⛈️', condition: 'Thunderstorm with hail' },
  99: { icon: '⛈️', condition: 'Thunderstorm with hail' },
}

const DEFAULT = { icon: '🌡️', condition: 'Unknown' }

export function getWeatherIcon(code) {
  return (WMO[code] ?? DEFAULT).icon
}

export function getWeatherCondition(code) {
  return (WMO[code] ?? DEFAULT).condition
}
