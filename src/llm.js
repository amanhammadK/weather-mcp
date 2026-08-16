import OpenAI from "openai";

let client = null;

export function getLLMClient() {
    if (client) return client;

    const baseURL = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
    const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error(
            "LLM_API_KEY or OPENAI_API_KEY must be set. " +
            "For LiteLLM proxy, set LLM_BASE_URL to your proxy endpoint (e.g. http://localhost:4000/v1)"
        );
    }

    client = new OpenAI({ baseURL, apiKey });
    return client;
}

export function getModel() {
    return process.env.LLM_MODEL || "gpt-4o-mini";
}
