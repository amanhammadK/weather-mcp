import { jest } from "@jest/globals";

const mockCreate = jest.fn();

jest.unstable_mockModule("../src/llm.js", () => {
    const mockClient = {
        chat: { completions: { create: mockCreate } }
    };
    return {
        getLLMClient: jest.fn(() => mockClient),
        getModel: jest.fn(() => "gpt-4o-mini")
    };
});

const { testToolCall, TOOL_DEFINITIONS } = await import("../src/mcpServer.js");

describe("Weather MCP Server", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("lists available tools", () => {
        expect(TOOL_DEFINITIONS).toHaveLength(3);
        expect(TOOL_DEFINITIONS[0].name).toBe("get_weather");
        expect(TOOL_DEFINITIONS[1].name).toBe("compare_weather");
        expect(TOOL_DEFINITIONS[2].name).toBe("weather_alert");
    });

    it("calls get_weather with valid args", async () => {
        mockCreate
            .mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            location: { name: "London", country: "GB", lat: 51.5, lon: -0.1 },
                            current: { temp: 15, feelsLike: 13, humidity: 72, windSpeed: 5, windDirection: "SW", condition: "Cloudy", description: "Overcast clouds", pressure: 1012, visibility: 10000, uvIndex: 2 },
                            sunrise: "2024-01-01T06:00:00Z",
                            sunset: "2024-01-01T18:00:00Z"
                        })
                    }
                }]
            });

        const response = await testToolCall("get_weather", {
            location: "London",
            units: "metric"
        });

        expect(response.content[0].type).toBe("text");
        const data = JSON.parse(response.content[0].text);
        expect(data.location).toBe("London");
    });

    it("calls compare_weather with valid args", async () => {
        mockCreate.mockResolvedValue({
            choices: [{
                message: {
                    content: JSON.stringify({
                        comparison: [{ aspect: "Temperature", data: { London: "15°C", Paris: "18°C" }, verdict: "Paris is warmer" }],
                        rankings: [{ location: "Paris", reasoning: "Warmer and sunnier" }],
                        recommendation: "Paris has the best weather today.",
                        highlights: ["Paris is 3°C warmer than London"]
                    })
                }
            }]
        });

        const response = await testToolCall("compare_weather", {
            locations: ["London", "Paris"],
            units: "metric"
        });

        expect(response.content[0].type).toBe("text");
        const data = JSON.parse(response.content[0].text);
        expect(data.result.recommendation).toContain("Paris");
    });

    it("calls weather_alert with valid args", async () => {
        mockCreate.mockResolvedValue({
            choices: [{
                message: {
                    content: JSON.stringify({
                        currentConditions: "Thunderstorms with heavy rain expected",
                        riskLevel: "high",
                        risks: [{ type: "lightning", severity: "severe", description: "Frequent lightning strikes", affectedGroups: "Outdoor workers" }],
                        safetyRecommendations: ["Seek shelter indoors", "Avoid using electronics"],
                        precautions: ["Unplug appliances", "Stay away from windows"],
                        verdict: "Stay indoors until the storm passes."
                    })
                }
            }]
        });

        const response = await testToolCall("weather_alert", {
            location: "Miami",
            conditions: "Thunderstorm, 32°C, high humidity",
            activity: "Sailing"
        });

        expect(response.content[0].type).toBe("text");
        const data = JSON.parse(response.content[0].text);
        expect(data.result.riskLevel).toBe("high");
    });

    it("rejects get_weather with short location", async () => {
        await expect(testToolCall("get_weather", {
            location: "A"
        })).rejects.toThrow(/too_small/);
    });

    it("rejects compare_weather with single location", async () => {
        await expect(testToolCall("compare_weather", {
            locations: ["London"]
        })).rejects.toThrow(/too_small/);
    });

    it("rejects weather_alert with short location", async () => {
        await expect(testToolCall("weather_alert", {
            location: "A"
        })).rejects.toThrow(/too_small/);
    });

    it("rejects unknown tool", async () => {
        await expect(testToolCall("unknown_tool", {}))
            .rejects.toThrow("Unknown tool");
    });

    it("handles empty LLM response", async () => {
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: "" } }]
        });

        await expect(testToolCall("get_weather", {
            location: "London"
        })).rejects.toThrow("empty response");
    });

    it("handles malformed LLM JSON", async () => {
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: "invalid json" } }]
        });

        await expect(testToolCall("get_weather", {
            location: "London"
        })).rejects.toThrow(SyntaxError);
    });
});
