export function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };
  return conditions[code] || "Unknown";
}

function calculateDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function generateFallbackWeather(
  destination: string,
  startDate: string,
  endDate: string
) {
  const days = calculateDaysBetween(startDate, endDate);
  const forecast = [];

  // Generate reasonable fallback weather data
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    forecast.push({
      date: date.toISOString().split("T")[0],
      condition:
        i % 3 === 0
          ? "Partly cloudy"
          : i % 3 === 1
          ? "Mainly clear"
          : "Clear sky",
      maxTemp: 25 + Math.floor(Math.random() * 10), // 25-35°C
      minTemp: 18 + Math.floor(Math.random() * 7), // 18-25°C
      precipitationChance: Math.floor(Math.random() * 40), // 0-40%
      weatherCode: i % 3 === 0 ? 2 : i % 3 === 1 ? 1 : 0,
    });
  }

  return {
    destination: destination.split(",")[0].trim(),
    country: "Unknown",
    forecast,
    summary: `${days} day forecast for ${destination}: Mixed conditions expected. Plan for both indoor and outdoor activities.`,
  };
}
