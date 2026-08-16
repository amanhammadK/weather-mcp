# Weather MCP Server

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-Free--Use-orange)
![MCP](https://img.shields.io/badge/MCP-Server-orange)

An AI-powered MCP server that fetches current weather and forecasts with human-readable analysis, compares weather conditions across multiple locations, and generates safety recommendations based on weather conditions and planned activities using LLMs.

## Features

- **get_weather** -- Get current weather and 5-day forecast for a location with human-readable analysis and activity recommendations.
- **compare_weather** -- Compare weather conditions between 2-5 locations, rank them by pleasantness, and recommend the best destination.
- **weather_alert** -- Analyze weather conditions and generate safety recommendations with risk levels, precautions, and tailored advice for planned activities.

## Architecture

The server follows the Model Context Protocol (MCP) specification and communicates over stdio transport:

1. An MCP client sends a tool call request with tool name and arguments.
2. `mcpServer.js` receives the request, validates arguments with **Zod schemas**, and dispatches to the appropriate handler.
3. The handler calls OpenAI (or any OpenAI-compatible API via LiteLLM proxy) with a structured system prompt that enforces JSON output format.
4. The LLM response is parsed, enriched with metadata (location, model name, timestamps), and returned to the client as MCP content.

Key architectural components:

- **Zod validation** -- All tool inputs are validated against Zod schemas defined in `schemas.js` before reaching the LLM.
- **LLM abstraction** -- `llm.js` provides a singleton OpenAI client that supports both direct OpenAI and LiteLLM proxy configurations.
- **JSON structured output** -- Every LLM call uses `response_format: { type: "json_object" }` to ensure parseable, predictable responses.
- **OpenWeatherMap integration** -- When an `OPENWEATHERMAP_API_KEY` is provided, real weather data is fetched and then analyzed by the LLM. Without the key, the LLM generates realistic simulated weather data.
- **Dual-mode fetching** -- Supports both real API fetching (via `axios` to OpenWeatherMap) and LLM-generated weather simulation, ensuring the server works without external dependencies.

## Prerequisites

- Node.js 18+
- An OpenAI API key (or a LiteLLM proxy endpoint)
- (Optional) An OpenWeatherMap API key for real weather data

## Quick Start

```bash
git clone https://github.com/amanhammadK/weather-mcp.git
cd weather-mcp
npm install
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:

```
OPENAI_API_KEY=sk-your-key-here
```

Optionally add an OpenWeatherMap key for real weather data:

```
OPENWEATHERMAP_API_KEY=your-openweathermap-api-key
```

Start the server:

```bash
npm start
```

The server starts on stdio and waits for MCP client connections.

## Configuration

All configuration is done through environment variables in `.env`:

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | -- | OpenAI API key (required if not using LiteLLM) |
| `LLM_API_KEY` | -- | API key for LiteLLM proxy (overrides `OPENAI_API_KEY`) |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | Base URL for the OpenAI-compatible API |
| `LLM_MODEL` | `gpt-4o-mini` | Model name to use for all LLM calls |
| `OPENWEATHERMAP_API_KEY` | -- | OpenWeatherMap API key (optional; without it, weather is simulated) |

To use a LiteLLM proxy, set:

```
LLM_BASE_URL=http://localhost:4000/v1
LLM_API_KEY=sk-your-litellm-key
LLM_MODEL=gpt-4o-mini
```

## Usage

### get_weather

Get current weather with optional forecast and human-readable analysis.

**Input Parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `location` | string | yes | -- | The city or location to get weather for |
| `units` | string | no | `metric` | Temperature units: `metric` or `imperial` |
| `includeForecast` | boolean | no | `false` | Include 5-day forecast |

**Example (MCP call)**

```json
{
  "name": "get_weather",
  "arguments": {
    "location": "Tokyo",
    "units": "metric",
    "includeForecast": true
  }
}
```

**Sample Output**

```json
{
  "location": "Tokyo",
  "units": "metric",
  "weather": {
    "location": { "name": "Tokyo", "country": "JP", "lat": 35.68, "lon": 139.69 },
    "current": {
      "temp": 22,
      "feelsLike": 24,
      "humidity": 75,
      "windSpeed": 3.5,
      "windDirection": "SSE",
      "condition": "Partly Cloudy",
      "description": "Mild with partial cloud cover and moderate humidity.",
      "pressure": 1013,
      "visibility": 10000,
      "uvIndex": 5
    },
    "forecast": [
      { "date": "2025-06-16", "tempHigh": 24, "tempLow": 19, "condition": "Cloudy", "precipitation": "30%" },
      { "date": "2025-06-17", "tempHigh": 26, "tempLow": 20, "condition": "Sunny", "precipitation": "10%" }
    ],
    "sunrise": "2025-06-15T04:25:00Z",
    "sunset": "2025-06-15T19:00:00Z"
  },
  "analysis": {
    "summary": "Tokyo is experiencing mild, partly cloudy weather with moderate humidity.",
    "highlights": ["Humidity makes it feel slightly warmer than the actual temperature"],
    "recommendations": ["Good day for outdoor activities", "Light clothing recommended"],
    "alerts": []
  },
  "model": "gpt-4o-mini-2024-07-18",
  "fetchedAt": "2025-06-15T10:30:00.000Z"
}
```

### compare_weather

Compare weather conditions between 2-5 locations and find the best destination.

**Input Parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `locations` | string[] | yes | -- | Locations to compare (2-5 required) |
| `units` | string | no | `metric` | Temperature units: `metric` or `imperial` |
| `aspects` | string[] | no | -- | Specific aspects to compare (e.g. temperature, humidity, wind) |

**Example (MCP call)**

```json
{
  "name": "compare_weather",
  "arguments": {
    "locations": ["London", "Paris", "Rome"],
    "units": "metric",
    "aspects": ["temperature", "humidity", "precipitation"]
  }
}
```

**Sample Output**

```json
{
  "locations": ["London", "Paris", "Rome"],
  "units": "metric",
  "result": {
    "comparison": [
      {
        "aspect": "Temperature",
        "data": { "London": "18C", "Paris": "22C", "Rome": "28C" },
        "verdict": "Rome is the warmest, ideal for sun-seekers."
      }
    ],
    "rankings": [
      { "location": "Rome", "reasoning": "Warmest with lowest precipitation chance" },
      { "location": "Paris", "reasoning": "Mild and comfortable" },
      { "location": "London", "reasoning": "Cooler with higher humidity" }
    ],
    "recommendation": "Rome has the best weather right now with warm temperatures and clear skies.",
    "highlights": ["15C temperature spread across locations", "London has significantly higher humidity"]
  },
  "model": "gpt-4o-mini-2024-07-18",
  "comparedAt": "2025-06-15T10:31:00.000Z"
}
```

### weather_alert

Analyze weather conditions and generate safety recommendations.

**Input Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `location` | string | yes | The location to analyze weather conditions for |
| `conditions` | string | no | Current weather conditions if known (e.g. "thunderstorm, 35C, high humidity") |
| `activity` | string | no | Planned activity to assess risk for (e.g. hiking, sailing, construction) |

**Example (MCP call)**

```json
{
  "name": "weather_alert",
  "arguments": {
    "location": "Miami",
    "conditions": "thunderstorm, 32C, high humidity",
    "activity": "sailing"
  }
}
```

**Sample Output**

```json
{
  "location": "Miami",
  "activity": "sailing",
  "result": {
    "currentConditions": "Thunderstorm activity with high temperature and humidity in Miami.",
    "riskLevel": "high",
    "risks": [
      {
        "type": "lightning",
        "severity": "severe",
        "description": "Active thunderstorm increases lightning strike risk on open water.",
        "affectedGroups": "Boaters, swimmers"
      },
      {
        "type": "heatstroke",
        "severity": "moderate",
        "description": "High temperature and humidity create heat stress conditions.",
        "affectedGroups": "Everyone"
      }
    ],
    "safetyRecommendations": [
      "Postpone sailing until the thunderstorm passes.",
      "If already on water, return to shore immediately."
    ],
    "precautions": ["Monitor weather radar", "Wear life jackets", "Stay hydrated"],
    "verdict": "Sailing is not recommended due to active thunderstorm and lightning risk."
  },
  "model": "gpt-4o-mini-2024-07-18",
  "generatedAt": "2025-06-15T10:32:00.000Z"
}
```

## Docker Usage

```bash
docker build -t weather-mcp .
docker run -e OPENAI_API_KEY=sk-your-key-here weather-mcp
```

Or using Docker Compose:

```bash
docker-compose up
```

## Development

Run tests:

```bash
npm test
```

Lint the code:

```bash
npm run lint
```

Format the code:

```bash
npm run format
```

The test suite validates Zod schemas, tool handler dispatching, and error handling for all three tools.

## Project Structure

```
weather-mcp/
  index.js              # Entry point -- initializes weather API key, connects to stdio
  src/
    mcpServer.js        # MCP server setup, tool definitions, request handlers
    schemas.js          # Zod validation schemas for all tool inputs
    weather.js          # Core logic: get weather, compare, alert using LLM
    llm.js              # OpenAI/LiteLLM client singleton
  tests/
    mcp.test.js         # Jest tests for schema validation and tool handlers
  package.json
  Dockerfile
  docker-compose.yml
  .env.example          # Environment variable template
```

## License

MIT