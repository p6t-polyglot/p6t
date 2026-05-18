import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { createOllama } from "ai-sdk-ollama";
import type { Provider } from "../config/schema.ts";

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

/** Instantiate an AI SDK LanguageModel from the p6t provider config. */
export function createModel(provider: Provider): LanguageModel {
  switch (provider.id) {
    case "openai": {
      const apiKey = process.env["OPENAI_API_KEY"];
      if (!apiKey) throw new ProviderError("OPENAI_API_KEY env var is not set");
      return createOpenAI({
        apiKey,
        ...(provider.baseUrl !== undefined
          ? { baseURL: provider.baseUrl }
          : {}),
      })(provider.model);
    }
    case "anthropic": {
      const apiKey = process.env["ANTHROPIC_API_KEY"];
      if (!apiKey)
        throw new ProviderError("ANTHROPIC_API_KEY env var is not set");
      return createAnthropic({
        apiKey,
        ...(provider.baseUrl !== undefined
          ? { baseURL: provider.baseUrl }
          : {}),
      })(provider.model);
    }
    case "google": {
      const apiKey =
        process.env["GOOGLE_GENERATIVE_AI_API_KEY"] ??
        process.env["GOOGLE_API_KEY"];
      if (!apiKey)
        throw new ProviderError(
          "GOOGLE_GENERATIVE_AI_API_KEY (or GOOGLE_API_KEY) env var is not set",
        );
      return createGoogleGenerativeAI({
        apiKey,
        ...(provider.baseUrl !== undefined
          ? { baseURL: provider.baseUrl }
          : {}),
      })(provider.model);
    }
    case "mistral": {
      const apiKey = process.env["MISTRAL_API_KEY"];
      if (!apiKey)
        throw new ProviderError("MISTRAL_API_KEY env var is not set");
      return createMistral({
        apiKey,
        ...(provider.baseUrl !== undefined
          ? { baseURL: provider.baseUrl }
          : {}),
      })(provider.model);
    }
    case "ollama": {
      return createOllama({
        ...(provider.baseUrl !== undefined
          ? { baseURL: provider.baseUrl }
          : {}),
      })(provider.model);
    }
    case "openrouter": {
      const apiKey = process.env["OPENROUTER_API_KEY"];
      if (!apiKey)
        throw new ProviderError("OPENROUTER_API_KEY env var is not set");
      return createOpenRouter({ apiKey })(provider.model);
    }
  }
}
