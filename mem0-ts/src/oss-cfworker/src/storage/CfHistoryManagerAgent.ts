import {
	Agent,
	AgentContext,
} from "agents";

interface Env {

}

export class CfHistoryManagerAgent extends Agent<Env> {
	constructor(ctx: AgentContext, env: Env) {
		super(ctx, env);
	}

	private async init() {
		await this.run(`
		  CREATE TABLE IF NOT EXISTS memory_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			memory_id TEXT NOT NULL,
			previous_value TEXT,
			new_value TEXT,
			action TEXT NOT NULL,
			created_at TEXT,
			updated_at TEXT,
			is_deleted INTEGER DEFAULT 0
		  )
		`);
	  }

	private async run(sql: TemplateStringsArray | string, params: (string | number | boolean | null)[] = []): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				this.sql(sql as TemplateStringsArray, ...params);
				resolve();
			} catch (e) {
				reject(e);
			}
		});
	}

	private async all(sql: TemplateStringsArray | string, params: (string | number | boolean | null)[] = []): Promise<any[]> {
		return new Promise((resolve, reject) => {
			try {
				const rows = this.sql(sql as TemplateStringsArray, ...params);
				resolve(rows);
			} catch (e) {
				reject(e);
			}
		});
	}

	async addHistory(
		memoryId: string,
		previousValue: string | null,
		newValue: string | null,
		action: string,
		createdAt: string | null = null,
		updatedAt: string | null = null,
		isDeleted: number = 0,
	): Promise<void> {
		await this.run(
		  `INSERT INTO memory_history 
		  (memory_id, previous_value, new_value, action, created_at, updated_at, is_deleted)
		  VALUES (?, ?, ?, ?, ?, ?, ?)`,
		  [
			memoryId,
			previousValue,
			newValue,
			action,
			createdAt,
			updatedAt,
			isDeleted,
		  ],
		);
	}

	async getHistory(memoryId: string): Promise<any[]> {
		return this.all(
		  `SELECT * FROM memory_history WHERE memory_id = ?`,
		  [memoryId],
		);
	}

	async reset(): Promise<void> {
		await this.run(`DROP TABLE IF EXISTS memory_history`);
		await this.init();
	}

	async close(): Promise<void> {
		// No need to close the database connection in Cloudflare Workers
	}
}