import {
	Agent,
	AgentContext,
	AgentNamespace,
} from "agents";

import { VectorStore } from "./base";
import { SearchFilters, VectorStoreConfig, VectorStoreResult } from "../types";
import path from "path";
import { getAgentByName } from "agents";

interface MemoryVector {
	id: string;
	vector: number[];
	payload: Record<string, any>;
  }

interface Env {

}
  
export class CloudflareMemoryAgent extends Agent<Env> {
	private dimension: number;

	constructor(ctx: AgentContext, env: Env) {
		super(ctx, env);
		this.dimension = 768;
	}

	private async init() {
	  // Create a table if it doesn't exist
	  await this.sql`
		CREATE TABLE IF NOT EXISTS vectors (
			id TEXT PRIMARY KEY,
			vector BLOB NOT NULL,
			payload TEXT NOT NULL
		)
	  `;

	  await this.sql`
		CREATE TABLE IF NOT EXISTS memory_migrations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id TEXT NOT NULL UNIQUE
		)
	  `;
	}

	private async run(sql: TemplateStringsArray | string, ...params: (string | number | boolean | null)[]): Promise<void> {
		try {
			await this.sql(sql as TemplateStringsArray, ...params);
		} catch (e) {
			throw this.onError(e);
		}
	}

	private async all(sql: TemplateStringsArray | string, ...params: (string | number | boolean | null)[]): Promise<any[]> {
		try {
			return await this.sql(sql as TemplateStringsArray, ...params);
		} catch (e) {
			throw this.onError(e);
		}
	}

	private async getOne(sql: TemplateStringsArray | string, ...params: (string | number | boolean | null)[]): Promise<any> {
		try {
			return await this.sql(sql as TemplateStringsArray, ...params)[0];
		} catch (e) {
			throw this.onError(e);
		}
	}

	 private cosineSimilarity(a: number[], b: number[]): number {
		let dotProduct = 0;
		let normA = 0;
		let normB = 0;
		for (let i = 0; i < a.length; i++) {
		  dotProduct += a[i] * b[i];
		  normA += a[i] * a[i];
		  normB += b[i] * b[i];
		}
		return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
	  }
	
	  private filterVector(vector: MemoryVector, filters?: SearchFilters): boolean {
		if (!filters) return true;
		return Object.entries(filters).every(
		  ([key, value]) => vector.payload[key] === value,
		);
	  }

	async insert(
		vectors: number[][],
		ids: string[],
		payloads: Record<string, any>[],
	): Promise<void> {
		for (let i = 0; i < vectors.length; i++) {
			if (vectors[i].length !== this.dimension) {
				throw new Error(
					`Vector dimension mismatch. Expected ${this.dimension}, got ${vectors[i].length}`,
				);
			}
			const vectorText = JSON.stringify(vectors[i]);
			await this.run`INSERT OR REPLACE INTO vectors (id, vector, payload) VALUES (${ids[i]}, ${vectorText}, ${JSON.stringify(payloads[i])})`;
		}
	}

	async search(
		query: number[],
		limit: number = 10,
		filters?: SearchFilters,
	): Promise<VectorStoreResult[]> {
		if (query.length !== this.dimension) {
			throw new Error(
				`Query dimension mismatch. Expected ${this.dimension}, got ${query.length}`,
			);
		}

		const rows = await this.all`SELECT * FROM vectors`;
		const results: VectorStoreResult[] = [];

		for (const row of rows) {
			const vector = JSON.parse(row.vector);
			const payload = JSON.parse(row.payload);
			const memoryVector: MemoryVector = {
				id: row.id,
				vector,
				payload,
			};

			if (this.filterVector(memoryVector, filters)) {
				const score = this.cosineSimilarity(query, vector);
				results.push({
					id: memoryVector.id,
					payload: memoryVector.payload,
					score,
				});
			}
		}

		results.sort((a, b) => (b.score || 0) - (a.score || 0));
    	return results.slice(0, limit);
	}

	async get(vectorId: string): Promise<VectorStoreResult | null> {
		const row = await this.getOne`SELECT * FROM vectors WHERE id = ${vectorId}`;
		if (!row) return null;

		const payload = JSON.parse(row.payload);
		return {
			id: row.id,
			payload,
		};
	}

	async update(
		vectorId: string,
		vector: number[],
		payload: Record<string, any>,
	): Promise<void> {
		if (vector.length !== this.dimension) {
			throw new Error(
				`Vector dimension mismatch. Expected ${this.dimension}, got ${vector.length}`,
			);
		}
		const vectorText = JSON.stringify(vector);
		await this.run`UPDATE vectors SET vector = ${vectorText}, payload = ${JSON.stringify(payload)} WHERE id = ${vectorId}`;
	}

	async delete(vectorId: string): Promise<void> {
		await this.run`DELETE FROM vectors WHERE id = ${vectorId}`;
	}

	async deleteCol(): Promise<void> {
		await this.run`DROP TABLE IF EXISTS vectors`;
		await this.init();
	}

	async list(
		filters?: SearchFilters,
		limit: number = 100,
	): Promise<[VectorStoreResult[], number]> {
		const rows = await this.all`SELECT * FROM vectors`;
		const results: VectorStoreResult[] = [];

		for (const row of rows) {
			const payload = JSON.parse(row.payload);
			const memoryVector: MemoryVector = {
				id: row.id,
				vector: JSON.parse(row.vector),
				payload,
			};

			if (this.filterVector(memoryVector, filters)) {
				results.push({
					id: memoryVector.id,
					payload: memoryVector.payload,
				});
			}
		}

		return [results.slice(0, limit), results.length];
	}

	async getUserId(): Promise<string> {
		const row = await this.getOne`SELECT user_id FROM memory_migrations LIMIT 1`;
		if (row) {
			return row.user_id;
		}

		// Generate a random user_id if none exists
		const randomUserId =
			Math.random().toString(36).substring(2, 15) +
			Math.random().toString(36).substring(2, 15);
		await this.run`INSERT INTO memory_migrations (user_id) VALUES (${randomUserId})`;
		return randomUserId;
	}

	async setUserId(userId: string): Promise<void> {
		await this.run`DELETE FROM memory_migrations`;
		await this.run`INSERT INTO memory_migrations (user_id) VALUES (${userId})`;
	}

	async initialize(config: VectorStoreConfig): Promise<void> {
		this.dimension = config.dimension || 768;
		await this.init();
	}
  }

 
  
  interface MemoryVector {
	id: string;
	vector: number[];
	payload: Record<string, any>;
  }
  
  
  export class CloudflareMemory implements VectorStore {
	private agent!: DurableObjectStub<CloudflareMemoryAgent>;
	private agentBinding: AgentNamespace<CloudflareMemoryAgent>;
	private collectionName: string;
	private dimension: number;

	constructor(private config: VectorStoreConfig) {
		if (!config.agentBinding || !config.collectionName) {
			throw new Error("Agent binding and collection name are required");
		}
		this.agentBinding = config.agentBinding;
		this.collectionName = config.collectionName;
		this.dimension = config.dimension || 768;
		this.initialize().catch(console.error);
	}

	async insert(
	  vectors: number[][],
	  ids: string[],
	  payloads: Record<string, any>[],
	): Promise<void> {
	  await (this.agent as any).insert(vectors, ids, payloads);
	}
  
	async search(
	  query: number[],
	  limit: number = 10,
	  filters?: SearchFilters,
	): Promise<VectorStoreResult[]> {
	  return (this.agent as any).search(query, limit, filters) as Promise<VectorStoreResult[]>;
	}
  
	async get(vectorId: string): Promise<VectorStoreResult | null> {
	  return (this.agent as any).get(vectorId) as Promise<VectorStoreResult | null>;
	}
  
	async update(
	  vectorId: string,
	  vector: number[],
	  payload: Record<string, any>,
	): Promise<void> {
	  await (this.agent as any).update(vectorId, vector, payload);
	}
  
	async delete(vectorId: string): Promise<void> {
	  await (this.agent as any).delete(vectorId);
	}
  
	async deleteCol(): Promise<void> {
	  await (this.agent as any).deleteCol();
	}
  
	async list(
	  filters?: SearchFilters,
	  limit: number = 100,
	): Promise<[VectorStoreResult[], number]> {
	  return (this.agent as any).list(filters, limit) as Promise<[VectorStoreResult[], number]>;
	}
  
	async getUserId(): Promise<string> {
	  return (this.agent as any).getUserId() as Promise<string>;
	}
  
	async setUserId(userId: string): Promise<void> {
	  await (this.agent as any).setUserId(userId);
	}
  
	async initialize(): Promise<void> {
		this.agent = await getAgentByName(this.agentBinding, this.collectionName);
		(this.agent as any).initialize({
			dimension: this.dimension,
		});
	}
  }
  