import dotenv from "dotenv";
import { createOllama } from "ollama-ai-provider";
import { openai } from "@ai-sdk/openai";

dotenv.config();

const llmProvider = process.env.LLM_PROVIDER ?? "ollama";

export const openaiApiKey = process.env.OPENAI_API_KEY;
export const openaiModel = process.env.OPENAI_MODEL ?? "gpt-4o";

// Ollama Configuration (for local development)
export const ollamaModelName = process.env.OLLAMA_MODEL ?? "qwen2.5:1.5b";
export const ollamaBaseURL =
  process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/api";

export const model = (() => {
  if (llmProvider === "openai") {
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY is required when using OpenAI provider");
    }
    console.log(`🤖 Using OpenAI Model: ${openaiModel}`);
    return openai(openaiModel);
  } else {
    console.log(
      `🦙 Using Ollama Model: ${ollamaModelName} at ${ollamaBaseURL}`
    );
    return createOllama({ baseURL: ollamaBaseURL }).chat(ollamaModelName, {
      simulateStreaming: true,
    });
  }
})();

export const config = {
  llmProvider,
  openai: {
    apiKey: openaiApiKey,
    model: openaiModel,
  },
  ollama: {
    model: ollamaModelName,
    baseURL: ollamaBaseURL,
  },
  apis: {
    weatherBaseUrl: "https://api.open-meteo.com/v1",
    geocodingBaseUrl: "https://geocoding-api.open-meteo.com/v1",
  },
  server: {
    port: parseInt(process.env.PORT ?? "8080"),
    timeout: parseInt(process.env.REQUEST_TIMEOUT ?? "30000"),
  },
};

console.log(`🚀 Travel Planner Config - Provider: ${llmProvider}`);
