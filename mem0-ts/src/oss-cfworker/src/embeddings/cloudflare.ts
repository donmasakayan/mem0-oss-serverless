import OpenAI from "openai";
import type { EmbeddingConfig } from "../types";
import type { Embedder } from "./base";

// =============================
// ☁️ CloudflareEmbedder Class
// =============================
// This class implements the Embedder interface for Cloudflare Workers AI, using the OpenAI SDK
// and targeting the Cloudflare Workers AI API endpoint. It supports both single and batch embedding.
// ---------------------------------------------------------
// ⚠️ Make sure to provide your Cloudflare API key and Account ID in the config fields.
// ---------------------------------------------------------
export class CloudflareEmbedder implements Embedder {
	private openai: OpenAI;
	private model: string;

	constructor(config: EmbeddingConfig) {
		console.log("EMBEDDINGS CONFIG", config);
		// =============================
		// 🛠️ Initialize OpenAI SDK for Cloudflare Workers AI
		// - baseURL is set to Cloudflare's endpoint (requires account ID)
		// - apiKey is your Cloudflare API token
		// =============================
		this.openai = new OpenAI({
			apiKey: config.apiKey,
			baseURL: `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/v1`,
		});
		// Default to Cloudflare's BAAI embedding model if not specified
		this.model = config.model || "@cf/baai/bge-large-en-v1.5";
	}

	// =============================
	// 🔹 Single Text Embedding
	// =============================
	async embed(text: string): Promise<number[]> {
		const response = await this.openai.embeddings.create({
			model: this.model,
			input: text,
		});
		return response.data[0].embedding;
	}

	// =============================
	// 🔹 Batch Text Embedding
	// =============================
	async embedBatch(texts: string[]): Promise<number[][]> {
		const response = await this.openai.embeddings.create({
			model: this.model,
			input: texts,
		});
		const embeddings: number[][] = [];
		for (const item of response.data) {
			embeddings.push(item.embedding);
		}
		return embeddings;
	}
}
