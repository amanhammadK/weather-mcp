import { z } from "zod";

export const getWeatherSchema = z.object({
    location: z.string().min(2, "Location must be at least 2 characters").describe("The city or location to get weather for"),
    units: z.enum(["metric", "imperial"]).optional().default("metric").describe("Units for temperature"),
    includeForecast: z.boolean().optional().default(false).describe("Include 5-day forecast if available")
});

export const compareWeatherSchema = z.object({
    locations: z.array(z.string()).min(2, "At least 2 locations required").max(5, "Maximum 5 locations").describe("Locations to compare weather between"),
    units: z.enum(["metric", "imperial"]).optional().default("metric").describe("Units for temperature"),
    aspects: z.array(z.string()).optional().describe("Specific aspects to compare (e.g. temperature, humidity, wind)")
});

export const weatherAlertSchema = z.object({
    location: z.string().min(2, "Location must be at least 2 characters").describe("The location to analyze weather conditions for"),
    conditions: z.string().optional().describe("Current weather conditions (if known, e.g. 'thunderstorm, 35°C, high humidity')"),
    activity: z.string().optional().describe("Planned activity to assess risk for (e.g. hiking, sailing, construction)")
});
