/**
 * Weather API Route (PLN-007)
 *
 * Proxy naar OpenWeatherMap API voor weergegevens per dag.
 * Cache resultaten voor 1 uur om API limiet te respecteren.
 * Standaard locatie: Veldhoven, NL (Top Tuinen regio).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// In-memory cache (per serverless instance)
const cache = new Map<string, { data: WeatherDay[]; expiry: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 uur

interface WeatherDay {
  datum: string; // YYYY-MM-DD
  temp: number; // Celsius
  tempMin: number;
  tempMax: number;
  beschrijving: string;
  icoon: string; // OpenWeather icon code
  windSnelheid: number; // m/s
  neerslag: number; // mm
  waarschuwing?: "vorst" | "storm" | "zware_regen" | null;
}

function getWaarschuwing(
  tempMin: number,
  windSnelheid: number,
  neerslag: number
): "vorst" | "storm" | "zware_regen" | null {
  if (tempMin <= 0) return "vorst";
  if (windSnelheid >= 20) return "storm"; // ~72 km/h
  if (neerslag >= 15) return "zware_regen";
  return null;
}

export async function GET(request: NextRequest) {
  // ── Authenticatie ─────────────────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Niet geautoriseerd. Log in om deze functie te gebruiken." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat") || "51.42"; // Veldhoven
  const lon = searchParams.get("lon") || "5.40";

  const cacheKey = `${lat},${lon}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json({ days: cached.data, cached: true });
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    // Return mock data if no API key configured
    const mockDays = generateMockWeather();
    return NextResponse.json({ days: mockDays, mock: true });
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&lang=nl&appid=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`OpenWeather API error: ${response.status}`);
    }

    const data = await response.json();

    // Groepeer 3-hourly forecasts per dag
    const dagMap = new Map<string, { temps: number[]; wind: number[]; rain: number[]; desc: string; icon: string }>();

    for (const item of data.list) {
      const datum = item.dt_txt.split(" ")[0];
      if (!dagMap.has(datum)) {
        dagMap.set(datum, { temps: [], wind: [], rain: [], desc: "", icon: "" });
      }
      const dag = dagMap.get(datum)!;
      dag.temps.push(item.main.temp);
      dag.wind.push(item.wind.speed);
      dag.rain.push(item.rain?.["3h"] ?? 0);
      // Gebruik 12:00 forecast voor beschrijving
      if (item.dt_txt.includes("12:00")) {
        dag.desc = item.weather[0].description;
        dag.icon = item.weather[0].icon;
      }
    }

    const days: WeatherDay[] = [];
    for (const [datum, dag] of dagMap) {
      const tempMin = Math.round(Math.min(...dag.temps));
      const tempMax = Math.round(Math.max(...dag.temps));
      const windMax = Math.max(...dag.wind);
      const totalRain = dag.rain.reduce((s, r) => s + r, 0);

      days.push({
        datum,
        temp: Math.round(dag.temps.reduce((s, t) => s + t, 0) / dag.temps.length),
        tempMin,
        tempMax,
        beschrijving: dag.desc || dag.icon || "onbekend",
        icoon: dag.icon || "02d",
        windSnelheid: Math.round(windMax * 10) / 10,
        neerslag: Math.round(totalRain * 10) / 10,
        waarschuwing: getWaarschuwing(tempMin, windMax, totalRain),
      });
    }

    // Cache result
    cache.set(cacheKey, { data: days, expiry: Date.now() + CACHE_TTL });

    return NextResponse.json({ days });
  } catch (error) {
    console.error("Weather API error:", error);
    return NextResponse.json(
      { error: "Weergegevens ophalen mislukt", days: generateMockWeather() },
      { status: 200 } // Still return mock so UI doesn't break
    );
  }
}

/**
 * Generate mock weather data when no API key is configured.
 */
function generateMockWeather(): WeatherDay[] {
  const days: WeatherDay[] = [];
  const today = new Date();

  for (let i = 0; i < 5; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const datum = d.toISOString().split("T")[0];

    // Realistic Dutch weather mock
    const temp = 10 + Math.floor(Math.random() * 10);
    const rain = Math.random() > 0.6 ? Math.round(Math.random() * 10) : 0;

    days.push({
      datum,
      temp,
      tempMin: temp - 3,
      tempMax: temp + 3,
      beschrijving: rain > 5 ? "regen" : rain > 0 ? "lichte regen" : "bewolkt",
      icoon: rain > 5 ? "10d" : rain > 0 ? "09d" : "03d",
      windSnelheid: 3 + Math.round(Math.random() * 8),
      neerslag: rain,
      waarschuwing: null,
    });
  }

  return days;
}
