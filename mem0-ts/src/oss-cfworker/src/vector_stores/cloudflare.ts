import type { VectorizeIndex } from "@cloudflare/workers-types";
import type {
	SearchFilters,
	VectorStoreConfig,
	VectorStoreResult,
} from "../types";
import type { VectorStore } from "./base";

// Define the environment interface expected by the class constructor
export interface VectorizeEnv {
	VECTORIZE: VectorizeIndex;
}

/**
 * =======================================
 * === Vectorize Store Implementation ===
 * =======================================
 * Connects to Cloudflare Vectorize for vector storage and search.
 */
export class VectorizeStore implements VectorStore {
	// === Private Properties ===
	private VECTORIZE: VectorizeIndex;
	private dimension: number;
	// Note: userId management is not directly applicable to Vectorize in the same way
	// as the memory store's SQLite implementation. Filtering by user should be
	// handled via metadata in search queries.

	// === Constructor ===
	constructor(config: VectorStoreConfig) {
		// --- Input validation ---
		if (!config.env || !config.env.VECTORIZE) {
			console.error(
				"Cloudflare Vectorize binding missing and here's the config",
				config,
			);
			throw new Error(
				"Cloudflare Vectorize index binding (VECTORIZE) is required in env.",
			);
		}

		// --- Initialization ---
		this.VECTORIZE = config.env.VECTORIZE;
		// Default to OpenAI dimension if not provided, though Vectorize often infers this.
		// It might be useful for input validation.
		this.dimension = config.dimension || 1536;
	}

	// === Public Methods: VectorStore Interface Implementation ===

	/**
	 * ---------------------------------------
	 * Insert vectors into the index.
	 * ---------------------------------------
	 */
	async insert(
		vectors: number[][],
		ids: string[],
		payloads: Record<string, any>[],
	): Promise<void> {
		// --- Create Vector objects for insertion ---
		const vectorizeVectors = [];
		for (let i = 0; i < vectors.length; i++) {
			// --- Validate vector dimension ---
			if (vectors[i].length !== this.dimension) {
				console.warn(
					`Vector dimension mismatch for ID ${ids[i]}. Expected ${this.dimension}, got ${vectors[i].length}. Skipping insertion for this vector.`,
				);
				// Or throw error if strict validation is required:
				// throw new Error(`Vector dimension mismatch for ID ${ids[i]}. Expected ${this.dimension}, got ${vectors[i].length}`);
				continue; // Skip this vector
			}

			vectorizeVectors.push({
				id: ids[i],
				values: vectors[i],
				metadata: payloads[i],
			});
		}

		// --- Perform batch insertion if vectors are valid ---
		if (vectorizeVectors.length > 0) {
			await this.VECTORIZE.insert(vectorizeVectors);
		}
	}

	/**
	 * ---------------------------------------
	 * Search for similar vectors.
	 * ---------------------------------------
	 */
	async search(
		query: number[],
		limit: number = 10,
		filters?: SearchFilters,
	): Promise<VectorStoreResult[]> {
		// --- Validate query vector dimension ---
		if (query.length !== this.dimension) {
			throw new Error(
				`Query dimension mismatch. Expected ${this.dimension}, got ${query.length}`,
			);
		}

		// --- Perform vector search ---
		console.log("query", JSON.stringify(query));
		const results = await this.VECTORIZE.query(query, {
			topK: limit,
			filter: filters,
			// includeValues: false, // Don't need the vector values in search results
			// includeMetadata: true, // Metadata (payload) is needed
		});

		// --- Format results ---
		// Vectorize query returns matches with vectors; we need to map to VectorStoreResult
		return results.matches.map(match => ({
			id: match.id,
			payload: match.metadata ?? {},
			score: match.score, // Vectorize provides the score
		}));
	}

	/**
	 * ---------------------------------------
	 * Get a specific vector by its ID.
	 * ---------------------------------------
	 */
	async get(vectorId: string): Promise<VectorStoreResult | null> {
		// --- Retrieve vector by ID ---
		// Vectorize getByIds returns an array of vectors
		const vectors = await this.VECTORIZE.getByIds([vectorId]);

		// --- Process result ---
		if (vectors.length === 0) {
			return null;
		}

		// --- Return formatted result ---
		const vector = vectors[0];
		return {
			id: vector.id,
			payload: vector.metadata ?? {},
			// 'get' interface doesn't include score
		};
	}

	/**
	 * ---------------------------------------
	 * Update an existing vector (uses upsert).
	 * ---------------------------------------
	 */
	async update(
		vectorId: string,
		vector: number[],
		payload: Record<string, any>,
	): Promise<void> {
		// --- Validate vector dimension ---
		if (vector.length !== this.dimension) {
			throw new Error(
				`Vector dimension mismatch for update. Expected ${this.dimension}, got ${vector.length}`,
			);
		}

		// --- Perform upsert ---
		// Vectorize uses upsert for updates
		await this.VECTORIZE.upsert([
			{
				id: vectorId,
				values: vector,
				metadata: payload,
			},
		]);
	}

	/**
	 * ---------------------------------------
	 * Delete a vector by its ID.
	 * ---------------------------------------
	 */
	async delete(vectorId: string): Promise<void> {
		// --- Perform deletion by ID ---
		await this.VECTORIZE.deleteByIds([vectorId]);
	}

	/**
	 * ---------------------------------------
	 * Delete the entire collection (Not Supported).
	 * ---------------------------------------
	 * Deleting a Vectorize index is an infrastructure operation.
	 */
	async deleteCol(): Promise<void> {
		// --- Log warning ---
		console.warn(
			"deleteCol is not supported for VectorizeStore. Index deletion must be done via Cloudflare dashboard or Wrangler CLI.",
		);
		// --- Return promise ---
		return Promise.resolve();
	}

	/**
	 * ---------------------------------------
	 * List vectors, potentially filtered.
	 * ---------------------------------------
	 * NOTE: Vectorize is optimized for similarity search, not arbitrary listing.
	 * This implementation uses a query with a zero vector and filters.
	 * It may not be efficient for listing large numbers of vectors and
	 * the total count returned is the number of items found up to the limit,
	 * not the absolute total matching the filter in the index.
	 */
	async list(
		filters?: SearchFilters,
		limit: number = 100,
	): Promise<[VectorStoreResult[], number]> {
		// --- Create a zero vector for querying ---
		// Querying with a zero vector might return arbitrary vectors matching the filter,
		// but the order isn't guaranteed or necessarily meaningful for 'listing'.
		const zeroVector = new Array(this.dimension).fill(0);

		// --- Perform query ---
		const results = await this.VECTORIZE.query(zeroVector, {
			topK: limit,
			filter: filters,
			// includeValues: false,
			// includeMetadata: true,
		});

		// --- Format results ---
		const vectorStoreResults = results.matches.map(match => ({
			id: match.id,
			payload: match.metadata ?? {},
			// 'list' interface doesn't typically include score
		}));

		// --- Return results and count found ---
		// Vectorize query doesn't give total count matching filter, only count returned.
		return [vectorStoreResults, vectorStoreResults.length];
	}

	/**
	 * ---------------------------------------
	 * Get User ID (Not Applicable).
	 * ---------------------------------------
	 */
	async getUserId(): Promise<string> {
		// --- Throw error ---
		throw new Error("getUserId is not applicable for VectorizeStore.");
	}

	/**
	 * ---------------------------------------
	 * Set User ID (Not Applicable).
	 * ---------------------------------------
	 */
	async setUserId(userId: string): Promise<void> {
		// --- Throw error ---
		throw new Error("setUserId is not applicable for VectorizeStore.");
	}

	/**
	 * ---------------------------------------
	 * Initialize (No-op for Vectorize).
	 * ---------------------------------------
	 * Index initialization is handled externally.
	 */
	async initialize(): Promise<void> {
		// --- No operation needed ---
		return Promise.resolve();
	}
}
