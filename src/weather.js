import axios from "axios";
import { getLLMClient, getModel } from "./llm.js";

let apiKey = "";

export function initWeather(key) {
  if (key) apiKey = key;
}

export async function getWeather({ location, units = "metric", includeForecast = false }) {
  const client = getLLMClient();
  const model = getModel();

  let weatherData = null;
  let usedModel = "openweathermap-api";

  if (apiKey) {
    try {
      const params = { q: location, units, appid: apiKey };
      const response = await axios.get("https://api.openweathermap.org/data/2.5/weather", { params });
      weatherData = response.data;

      if (includeForecast) {
        const forecastResponse = await axios.get("https://api.openweathermap.org/data/2.5/forecast", { params });
        weatherData.forecast = forecastResponse.data.list?.slice(0, 5) || [];
      }
    } catch (apiError) {
      weatherData = null;
    }
  }

  if (!weatherData) {
    const systemPrompt = `You are a weather data provider. Generate realistic current weather data for "${location}". Return a JSON object with:
1. "location": { "name": city name, "country": country code, "lat": number, "lon": number }
2. "current": { "temp": temperature in ${units === "metric" ? "°C" : "°F"}, "feelsLike": feels like temp, "humidity": %, "windSpeed": m/s or mph, "windDirection": string, "condition": string, "description": detailed description, "pressure": hPa, "visibility": meters, "uvIndex": 0-11 }
3. "forecast": array of 5 daily forecasts (if requested) with { "date", "tempHigh", "tempLow", "condition", "precipitation": "%" }
4. "sunrise": ISO time
5. "sunset": ISO time

Make the data realistic for the location's climate.`;

    const prompt = includeForecast
      ? `Generate current weather and 5-day forecast for "${location}" in ${units} units.`
      : `Generate current weather for "${location}" in ${units} units.`;

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
      max_tokens: 2000
    });
    usedModel = response?.model || model;

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("LLM returned empty response");
    weatherData = JSON.parse(content);
  }

  const trendAnalysis = analyzeWeatherTrends(weatherData);
  const alerts = detectExtremeConditions(weatherData, location);
  const travelRec = generateTravelRecommendation(weatherData);

  return {
    location,
    units,
    weather: weatherData,
    trendAnalysis,
    alerts,
    travelRecommendation: travelRec,
    model: usedModel,
    fetchedAt: new Date().toISOString()
  };
}

export async function compareWeather({ locations, units = "metric", aspects }) {
  const client = getLLMClient();
  const model = getModel();

  const compareAspects = aspects && aspects.length > 0
    ? aspects.join(", ")
    : "temperature, humidity, wind conditions, precipitation, overall comfort";

  const systemPrompt = `You are a weather comparison expert. Compare the weather across these locations: ${locations.join(", ")}. Return a JSON object with:

1. "comparison": array of objects with:
   - "aspect": the aspect being compared
   - "data": { location: value } for each location
   - "verdict": which location wins/is best for this aspect and why

2. "rankings": array of locations ranked by overall pleasantness (best first) with brief reasoning

3. "recommendation": which location has the best weather right now and why

4. "highlights": notable differences or similarities

Use ${units} units. Focus on these aspects: ${compareAspects}.`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Compare weather for: ${locations.join(", ")}` }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 3000
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty response");
  const result = JSON.parse(content);
  return {
    locations,
    units,
    result,
    model: response.model,
    comparedAt: new Date().toISOString()
  };
}

export async function weatherAlert({ location, conditions, activity }) {
  const client = getLLMClient();
  const model = getModel();

  const conditionsContext = conditions
    ? `Known conditions: ${conditions}`
    : "Weather conditions will be generated based on the location.";

  const activityContext = activity
    ? `\n\nPlanned activity to assess: ${activity}`
    : "\n\nGenerate general safety recommendations for the current conditions.";

  const systemPrompt = `You are a weather safety expert. Analyze weather conditions for ${location} and generate safety recommendations. Return a JSON object with:

1. "currentConditions": description of the current weather situation (generated or based on provided data)

2. "riskLevel": "none" | "low" | "moderate" | "high" | "extreme"

3. "risks": array of objects with:
   - "type": risk type (e.g. "heatstroke", "lightning", "flooding", "hypothermia", "wind damage")
   - "severity": "minor" | "moderate" | "severe" | "critical"
   - "description": explanation of the risk
   - "affectedGroups": who is most affected

4. "safetyRecommendations": array of actionable safety tips${activityContext}

5. "precautions": array of precautionary measures to take

6. "verdict": one-sentence overall safety assessment`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `${conditionsContext}${activityContext}` }
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 3000
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty response");
  const result = JSON.parse(content);
  return {
    location,
    activity: activity || null,
    result,
    model: response.model,
    generatedAt: new Date().toISOString()
  };
}

function analyzeWeatherTrends(weatherData) {
  if (!weatherData?.current) return { summary: "Insufficient data for trend analysis" };

  const current = weatherData.current;
  const forecast = weatherData.forecast || [];

  if (forecast.length === 0) {
    return {
      summary: "Current conditions stable",
      temperatureTrend: "stable",
      conditions: current.condition
    };
  }

  const temps = forecast.map(f => (f.tempHigh + f.tempLow) / 2);
  const currentTemp = current.temp;
  const avgForecast = temps.reduce((a, b) => a + b, 0) / temps.length;

  let tempTrend = "stable";
  if (currentTemp < avgForecast - 3) tempTrend = "warming";
  else if (currentTemp > avgForecast + 3) tempTrend = "cooling";

  const precipChance = forecast.reduce((max, f) => Math.max(max, f.precipitation || 0), 0);

  return {
    summary: `${tempTrend === "warming" ? "Temperatures expected to rise" : tempTrend === "cooling" ? "Temperatures expected to drop" : "Temperatures relatively stable"} over the next ${forecast.length} periods. ${precipChance > 50 ? "High chance of precipitation." : "Low precipitation expected."}`,
    temperatureTrend: tempTrend,
    currentTemp,
    forecastAvg: Math.round(avgForecast),
    precipitationRisk: precipChance > 70 ? "high" : precipChance > 40 ? "moderate" : "low",
    conditions: current.condition
  };
}

function detectExtremeConditions(weatherData, location) {
  const alerts = [];
  if (!weatherData?.current) return alerts;

  const { temp, feelsLike, humidity, windSpeed, uvIndex, visibility } = weatherData.current;

  if (feelsLike >= 40) {
    alerts.push({ type: "extreme_heat", severity: "critical", message: `Dangerous heat index of ${feelsLike}°C in ${location}. Risk of heatstroke.` });
  } else if (feelsLike >= 35) {
    alerts.push({ type: "heat_advisory", severity: "high", message: `High heat index of ${feelsLike}°C. Limit outdoor exposure.` });
  }

  if (feelsLike <= -20) {
    alerts.push({ type: "extreme_cold", severity: "critical", message: `Dangerous wind chill of ${feelsLike}°C in ${location}. Risk of frostbite.` });
  } else if (feelsLike <= -10) {
    alerts.push({ type: "cold_advisory", severity: "high", message: `Severe wind chill of ${feelsLike}°C. Dress warmly.` });
  }

  if (uvIndex >= 11) {
    alerts.push({ type: "extreme_uv", severity: "critical", message: `Extreme UV index of ${uvIndex}. Avoid sun exposure.` });
  } else if (uvIndex >= 8) {
    alerts.push({ type: "high_uv", severity: "high", message: `Very high UV index of ${uvIndex}. Use sunscreen.` });
  } else if (uvIndex >= 6) {
    alerts.push({ type: "moderate_uv", severity: "moderate", message: `High UV index of ${uvIndex}. Seek shade midday.` });
  }

  if (windSpeed >= 30) {
    alerts.push({ type: "high_wind", severity: "high", message: `Strong winds of ${windSpeed} m/s. Secure loose objects.` });
  }

  if (visibility < 1000) {
    alerts.push({ type: "low_visibility", severity: "high", message: `Poor visibility of ${visibility}m. Exercise caution.` });
  }

  if (humidity >= 95 && temp >= 30) {
    alerts.push({ type: "dangerous_humidity", severity: "moderate", message: `Very high humidity (${humidity}%) with high temperature. Heat stress risk.` });
  }

  return alerts;
}

function generateTravelRecommendation(weatherData) {
  if (!weatherData?.current) return { recommendation: "Insufficient data" };

  const { temp, humidity, windSpeed, condition, uvIndex } = weatherData.current;
  let score = 100;
  let factors = [];

  if (temp > 35) { score -= 30; factors.push("Very hot"); }
  else if (temp > 30) { score -= 15; factors.push("Hot"); }
  else if (temp < 0) { score -= 25; factors.push("Freezing"); }
  else if (temp < 5) { score -= 10; factors.push("Cold"); }
  else if (temp >= 18 && temp <= 26) { factors.push("Comfortable temperature"); }

  if (humidity > 80) { score -= 15; factors.push("High humidity"); }
  if (humidity < 30) { score -= 5; factors.push("Dry air"); }
  if (windSpeed > 20) { score -= 15; factors.push("Strong winds"); }
  if (condition?.toLowerCase().includes("rain")) { score -= 20; factors.push("Rainy"); }
  if (condition?.toLowerCase().includes("snow")) { score -= 15; factors.push("Snowy"); }
  if (uvIndex > 8) { score -= 10; factors.push("High UV"); }

  let rating, suggestion;
  if (score >= 80) { rating = "Excellent"; suggestion = "Perfect conditions for outdoor activities."; }
  else if (score >= 60) { rating = "Good"; suggestion = "Suitable for most outdoor activities with minor precautions."; }
  else if (score >= 40) { rating = "Fair"; suggestion = "Consider indoor alternatives or dress appropriately."; }
  else if (score >= 20) { rating = "Poor"; suggestion = "Outdoor activities not recommended. Plan indoor options."; }
  else { rating = "Very Poor"; suggestion = "Stay indoors if possible. Dangerous conditions for outdoor activity."; }

  return { score: Math.max(0, score), rating, suggestion, factors };
}
