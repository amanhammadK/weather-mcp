import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getWeatherSchema, compareWeatherSchema, weatherAlertSchema } from "./schemas.js";
import { getWeather, compareWeather, weatherAlert } from "./weather.js";

export const SERVER_NAME = "weather-mcp";
export const SERVER_VERSION = "2.0.0";

export function createServer() {
    return new Server(
        { name: SERVER_NAME, version: SERVER_VERSION },
        { capabilities: { tools: {} } }
    );
}

export const TOOL_DEFINITIONS = [
    {
        name: "get_weather",
        description: "Get current weather and 5-day forecast for a location using AI — provides human-readable analysis with trend prediction, extreme condition alerts, and travel recommendations.",
        inputSchema: {
            type: "object",
            properties: {
                location: { type: "string", description: "The city or location to get weather for" },
                units: { type: "string", enum: ["metric", "imperial"], description: "Units for temperature" },
                includeForecast: { type: "boolean", description: "Include 5-day forecast" }
            },
            required: ["location"]
        }
    },
    {
        name: "compare_weather",
        description: "Compare weather conditions between 2-5 locations using AI — ranks locations and recommends the best destination.",
        inputSchema: {
            type: "object",
            properties: {
                locations: { type: "array", items: { type: "string" }, description: "Locations to compare (2-5)" },
                units: { type: "string", enum: ["metric", "imperial"], description: "Units for temperature" },
                aspects: { type: "array", items: { type: "string" }, description: "Specific aspects to compare" }
            },
            required: ["locations"]
        }
    },
    {
        name: "weather_alert",
        description: "Analyze weather conditions and generate safety recommendations for a location and planned activity using AI.",
        inputSchema: {
            type: "object",
            properties: {
                location: { type: "string", description: "The location to analyze" },
                conditions: { type: "string", description: "Current weather conditions if known" },
                activity: { type: "string", description: "Planned activity to assess risk for" }
            },
            required: ["location"]
        }
    }
];

export async function handleToolCall(name, args) {
    if (name === "get_weather") {
        const parsed = getWeatherSchema.parse(args);
        return await getWeather({
            location: parsed.location,
            units: parsed.units,
            includeForecast: parsed.includeForecast
        });
    }

    if (name === "compare_weather") {
        const parsed = compareWeatherSchema.parse(args);
        return await compareWeather({
            locations: parsed.locations,
            units: parsed.units,
            aspects: parsed.aspects
        });
    }

    if (name === "weather_alert") {
        const parsed = weatherAlertSchema.parse(args);
        return await weatherAlert({
            location: parsed.location,
            conditions: parsed.conditions,
            activity: parsed.activity
        });
    }

    throw new Error(`Unknown tool: ${name}`);
}

export function setupServer() {
    const server = createServer();

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: TOOL_DEFINITIONS
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        try {
            const { name, arguments: args } = request.params;
            const result = await handleToolCall(name, args);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (error) {
            if (error.name === "ZodError") {
                throw new Error(`Validation Error: ${error.message}`, { cause: error });
            }
            throw error;
        }
    });

    return server;
}

export async function testToolCall(name, args) {
    const result = await handleToolCall(name, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}
