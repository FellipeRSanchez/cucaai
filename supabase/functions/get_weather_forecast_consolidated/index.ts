import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ForecastInput {
  lat?: number;
  lon?: number;
  city?: string;
  days?: number;
}

interface NormalizedDailyWeather {
  date: string;
  rain_mm?: number;
  rain_probability?: number;
  temp_min?: number;
  temp_max?: number;
}

// ---------------------------------------------------------
// Providers implementations
// ---------------------------------------------------------
async function getOpenMeteo(lat: number, lon: number): Promise<NormalizedDailyWeather[] | null> {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min&timezone=America%2FSao_Paulo`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.daily.time.map((t: string, i: number) => ({
      date: t,
      rain_mm: data.daily.precipitation_sum[i],
      rain_probability: data.daily.precipitation_probability_max[i],
      temp_max: data.daily.temperature_2m_max[i],
      temp_min: data.daily.temperature_2m_min[i],
    }));
  } catch (e) {
    return null;
  }
}

async function getOpenWeather(lat: number, lon: number): Promise<NormalizedDailyWeather[] | null> {
  try {
    const key = Deno.env.get('OPENWEATHER_API_KEY');
    if (!key) return null; // Ignora se não configurada
    const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${key}&units=metric`);
    if (!res.ok) return null;
    const data = await res.json();
    const dailyMap = new Map<string, any>();
    
    // Aggregation of 3h windows
    for (const item of data.list) {
      const date = item.dt_txt.split(' ')[0];
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          rain: 0, pop: [], temp_min: item.main.temp_min, temp_max: item.main.temp_max
        });
      }
      const dayData = dailyMap.get(date);
      dayData.rain += item.rain ? (item.rain['3h'] || 0) : 0;
      dayData.pop.push(item.pop * 100);
      dayData.temp_min = Math.min(dayData.temp_min, item.main.temp_min);
      dayData.temp_max = Math.max(dayData.temp_max, item.main.temp_max);
    }

    const result: NormalizedDailyWeather[] = [];
    for (const [date, val] of dailyMap.entries()) {
      const avgPop = val.pop.length > 0 ? (val.pop.reduce((a:number,b:number)=>a+b,0) / val.pop.length) : 0;
      result.push({
        date,
        rain_mm: val.rain,
        rain_probability: Math.round(avgPop),
        temp_min: val.temp_min,
        temp_max: val.temp_max
      });
    }
    return result;
  } catch (e) {
    return null;
  }
}

async function getWeatherAPI(lat: number, lon: number, days: number): Promise<NormalizedDailyWeather[] | null> {
  try {
    const key = Deno.env.get('WEATHERAPI_KEY');
    if (!key) return null; // Ignora se não configurada
    const res = await fetch(`http://api.weatherapi.com/v1/forecast.json?key=${key}&q=${lat},${lon}&days=${days}`);
    if (!res.ok) return null;
    const data = await res.json();
    
    return data.forecast.forecastday.map((day: any) => ({
      date: day.date,
      rain_mm: day.day.totalprecip_mm,
      rain_probability: day.day.daily_chance_of_rain,
      temp_min: day.day.mintemp_c,
      temp_max: day.day.maxtemp_c,
    }));
  } catch(e) {
    return null;
  }
}

// ---------------------------------------------------------
// Core logic
// ---------------------------------------------------------
async function reverseGeocodeOrCity(input: string): Promise<{name: string, lat: number, lon: number} | null> {
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(input)}&count=1&language=pt`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const best = data.results[0];
      return {
        name: `${best.name}, ${best.admin1 || best.country}`,
        lat: best.latitude,
        lon: best.longitude
      };
    }
  } catch (e) {}
  return null;
}

// Helper: Median
function getMedian(arr: number[]): number {
  if (arr.length === 0) return 0;
  arr.sort((a, b) => a - b);
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}
function getAvg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: ForecastInput = await req.json();
    let lat = body.lat;
    let lon = body.lon;
    let city = body.city;
    let days = body.days || 7;

    let fallback_used = false;
    let fallback_city = null;
    let resolved_name = "Coordinate";

    if (lat === undefined && lon === undefined && !city) {
      throw new Error("É necessário prover lat/lon ou city");
    }

    if (city && (lat === undefined || lon === undefined)) {
      const geo = await reverseGeocodeOrCity(city);
      if (geo) {
        lat = geo.lat;
        lon = geo.lon;
        resolved_name = geo.name;
      } else {
        throw new Error("Cidade não encontrada");
      }
    }

    const providersPromises = [
      getOpenMeteo(lat!, lon!),
      getOpenWeather(lat!, lon!),
      getWeatherAPI(lat!, lon!, days)
    ];

    const results = await Promise.all(providersPromises);
    const validSources = results.filter(r => r !== null) as NormalizedDailyWeather[][];
    let sourceNames = [];
    if (results[0]) sourceNames.push('Open-Meteo');
    if (results[1]) sourceNames.push('OpenWeather');
    if (results[2]) sourceNames.push('WeatherAPI');

    if (validSources.length < 2 && city === undefined) {
      const geoResp = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`).then(r => r.json()).catch(() => null);
      if (geoResp && (geoResp.address?.city || geoResp.address?.town || geoResp.address?.village)) {
        fallback_used = true;
        fallback_city = geoResp.address.city || geoResp.address.town || geoResp.address.village;
        resolved_name = fallback_city;
        city = fallback_city; 
        
        const retryGeo = await reverseGeocodeOrCity(fallback_city!);
        if (retryGeo) {
           lat = retryGeo.lat; lon = retryGeo.lon;
           const newResults = await Promise.all([
              getOpenMeteo(lat, lon), getOpenWeather(lat, lon), getWeatherAPI(lat, lon, days)
           ]);
           const newValid = newResults.filter(r => r !== null) as NormalizedDailyWeather[][];
           if (newValid.length >= validSources.length) {
              validSources.length = 0;
              validSources.push(...newValid);
              sourceNames = [];
              if (newResults[0]) sourceNames.push('Open-Meteo');
              if (newResults[1]) sourceNames.push('OpenWeather');
              if (newResults[2]) sourceNames.push('WeatherAPI');
           }
        }
      }
    }

    if (validSources.length === 0) {
      throw new Error("Nenhum serviço meteorológico retornou dados válidos para esta localização.");
    }

    const datesSet = new Set<string>();
    validSources.forEach(source => source.forEach(d => datesSet.add(d.date)));
    const sortedDates = Array.from(datesSet).sort().slice(0, days);

    const dailyOutput = sortedDates.map(date => {
      const dataForDate = validSources.map(source => source.find(d => d.date === date)).filter(Boolean) as NormalizedDailyWeather[];
      
      const rains = dataForDate.map(d => d.rain_mm).filter(v => v !== undefined) as number[];
      const pops = dataForDate.map(d => d.rain_probability).filter(v => v !== undefined) as number[];
      const tmaxs = dataForDate.map(d => d.temp_max).filter(v => v !== undefined) as number[];
      const tmins = dataForDate.map(d => d.temp_min).filter(v => v !== undefined) as number[];

      return {
        date,
        rain_mm_median: Number(getMedian(rains).toFixed(1)),
        rain_probability_avg: Number(getAvg(pops).toFixed(0)),
        temp_min_avg: Number(getAvg(tmins).toFixed(1)),
        temp_max_avg: Number(getAvg(tmaxs).toFixed(1))
      };
    });

    let confidence = 'baixa';
    if (validSources.length === 3 && !fallback_used) confidence = 'alta';
    else if (validSources.length >= 2) confidence = 'media';

    const total_rain = dailyOutput.reduce((acc, curr) => acc + curr.rain_mm_median, 0);
    const rainiest_day = dailyOutput.reduce((prev, current) => (prev.rain_mm_median > current.rain_mm_median) ? prev : current);

    const finalResponse = {
      resolved_location: {
        name: resolved_name,
        lat, lon
      },
      fallback_used,
      fallback_city,
      confidence,
      sources_used: sourceNames,
      daily: dailyOutput,
      summary: {
        total_rain_accumulated: Number(total_rain.toFixed(1)),
        rainiest_day: rainiest_day.date
      }
    };

    return new Response(JSON.stringify(finalResponse), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
