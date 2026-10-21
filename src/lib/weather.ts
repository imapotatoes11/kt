import { formatInTimeZone } from "date-fns-tz";
import type { WeatherSnapshot } from "./types";

function weatherLabel(code: number) {
  if (code === 0) return "Clear";
  if (code <= 3) return "Cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if (code >= 51 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Mixed conditions";
}

interface OpenMeteoResponse {
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    weather_code: number[];
    wind_speed_10m: number[];
  };
}

export async function getWeather(latitude: number, longitude: number, instant: Date, timezone: string): Promise<WeatherSnapshot | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      hourly: "temperature_2m,precipitation_probability,weather_code,wind_speed_10m",
      timezone,
      forecast_days: "7",
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json() as OpenMeteoResponse;
    const target = formatInTimeZone(instant, timezone, "yyyy-MM-dd'T'HH:00");
    const index = data.hourly.time.indexOf(target);
    if (index < 0) return null;
    const code = data.hourly.weather_code[index];
    return {
      temperature: Math.round(data.hourly.temperature_2m[index]),
      precipitationProbability: data.hourly.precipitation_probability[index] ?? 0,
      weatherCode: code,
      windSpeed: Math.round(data.hourly.wind_speed_10m[index]),
      label: weatherLabel(code),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
