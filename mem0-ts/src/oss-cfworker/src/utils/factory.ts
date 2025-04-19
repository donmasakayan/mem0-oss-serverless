import { Embedder } from "../embeddings/base";
import { GoogleEmbedder } from "../embeddings/google";
import { OllamaEmbedder } from "../embeddings/ollama";
import { OpenAIEmbedder } from "../embeddings/openai";
import { CloudflareEmbedder } from "../embeddings/cloudflare";
import { TogetherEmbedder } from "../embeddings/together";
import { AnthropicLLM } from "../llms/anthropic";
import { LLM } from "../llms/base";
import { GoogleLLM } from "../llms/google";
import { GroqLLM } from "../llms/groq";
import { LmStudioLLM } from "../llms/lmstudio";
import { LmStudioStructuredLLM } from "../llms/lmstudio_structured";
import { OllamaLLM } from "../llms/ollama";
import { OpenAILLM } from "../llms/openai";
import { OpenAIStructuredLLM } from "../llms/openai_structured";
import { CloudflareHistoryConfig, CloudflareHistoryManager } from "../storage";
import { MemoryHistoryManager } from "../storage/MemoryHistoryManager";
import { SupabaseHistoryManager } from "../storage/SupabaseHistoryManager";
import { HistoryManager } from "../storage/base";
import {
	EmbeddingConfig,
	HistoryStoreConfig,
	LLMConfig,
	VectorStoreConfig,
} from "../types";
import { VectorStore } from "../vector_stores/base";
import { VectorizeStore } from "../vector_stores/cloudflare";
import { Qdrant } from "../vector_stores/qdrant";
import { RedisDB } from "../vector_stores/redis";
import { SupabaseDB } from "../vector_stores/supabase";

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
			case "cloudflare":
				return new CloudflareEmbedder(config as EmbeddingConfig & { accountId: string });
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
				return new VectorizeStore(config as any);
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
