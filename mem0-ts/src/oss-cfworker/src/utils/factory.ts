import { OpenAIEmbedder } from "../embeddings/openai";
import { OllamaEmbedder } from "../embeddings/ollama";
import { TogetherEmbedder } from "../embeddings/together";
import { OpenAILLM } from "../llms/openai";
import { OpenAIStructuredLLM } from "../llms/openai_structured";
import { AnthropicLLM } from "../llms/anthropic";
import { GroqLLM } from "../llms/groq";
import {
  EmbeddingConfig,
  HistoryStoreConfig,
  LLMConfig,
  VectorStoreConfig,
} from "../types";
import { Embedder } from "../embeddings/base";
import { LLM } from "../llms/base";
import { VectorStore } from "../vector_stores/base";
import { Qdrant } from "../vector_stores/qdrant";
import { RedisDB } from "../vector_stores/redis";
import { CloudflareMemory } from "../vector_stores/cloudflare";
import { OllamaLLM } from "../llms/ollama";
import { SupabaseDB } from "../vector_stores/supabase";
import { MemoryHistoryManager } from "../storage/MemoryHistoryManager";
import { SupabaseHistoryManager } from "../storage/SupabaseHistoryManager";
import { HistoryManager } from "../storage/base";
import { GoogleEmbedder } from "../embeddings/google";
import { GoogleLLM } from "../llms/google";
import { LmStudioLLM } from "../llms/lmstudio";
import { LmStudioStructuredLLM } from "../llms/lmstudio_structured";
import { CloudflareHistoryConfig, CloudflareHistoryManager } from "../storage";

export class EmbedderFactory {
  static create(provider: string, config: EmbeddingConfig): Embedder {
    switch (provider.toLowerCase()) {
      case "openai":
        return new OpenAIEmbedder(config);
      case "ollama":
        return new OllamaEmbedder(config);
      case "google":
        return new GoogleEmbedder(config);
      case "together":
        return new TogetherEmbedder(config);
      default:
        throw new Error(`Unsupported embedder provider: ${provider}`);
    }
  }
}

export class LLMFactory {
  static create(provider: string, config: LLMConfig): LLM {
    switch (provider) {
      case "openai":
        return new OpenAILLM(config);
      case "openai_structured":
        return new OpenAIStructuredLLM(config);
      case "anthropic":
        return new AnthropicLLM(config);
      case "groq":
        return new GroqLLM(config);
      case "ollama":
        return new OllamaLLM(config);
      case "google":
        return new GoogleLLM(config);
      case "lmstudio":
        return new LmStudioLLM(config);
      case "lmstudio_structured":
        return new LmStudioStructuredLLM(config);
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }
}

export class VectorStoreFactory {
  static create(provider: string, config: VectorStoreConfig): VectorStore {
    switch (provider.toLowerCase()) {
      case "cloudflare":
        return new CloudflareMemory(config as any);
      case "qdrant":
        return new Qdrant(config as any); // Type assertion needed as config is extended
      case "redis":
        return new RedisDB(config as any); // Type assertion needed as config is extended
      case "supabase":
        return new SupabaseDB(config as any); // Type assertion needed as config is extended
      default:
        throw new Error(`Unsupported vector store provider: ${provider}`);
    }
  }
}

export class HistoryManagerFactory {
  static create(provider: string, config: HistoryStoreConfig): HistoryManager {
    switch (provider.toLowerCase()) {
      case "cloudflare":
        return new CloudflareHistoryManager({
          agentBinding: config.config.agentBinding,
          agentHistoryName: config.config.agentHistoryName,
        } as CloudflareHistoryConfig);
      case "supabase":
        return new SupabaseHistoryManager({
          supabaseUrl: config.config.supabaseUrl || "",
          supabaseKey: config.config.supabaseKey || "",
          tableName: config.config.tableName || "memory_history",
        });
      case "memory":
        return new MemoryHistoryManager();
      default:
        throw new Error(`Unsupported history store provider: ${provider}`);
    }
  }
}
