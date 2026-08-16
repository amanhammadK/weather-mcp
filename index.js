import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupServer } from "./src/mcpServer.js";
import { initWeather } from "./src/weather.js";

async function main() {
    initWeather(process.env.OPENWEATHERMAP_API_KEY);

    const server = setupServer();
    const transport = new StdioServerTransport();

    try {
        await server.connect(transport);
        console.error("Weather MCP Server running on stdio");
    } catch (err) {
        console.error("Fatal error starting server:", err);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error("Unhandled error:", err);
    process.exit(1);
});
