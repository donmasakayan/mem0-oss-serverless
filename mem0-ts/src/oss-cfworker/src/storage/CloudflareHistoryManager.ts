import {
	Agent,
	AgentContext,
	AgentNamespace,
	getAgentByName,
} from "agents";

import { HistoryManager } from "./base";
interface Env {

}

export class CloudflareHistoryManagerAgent extends Agent<Env> {
	constructor(ctx: AgentContext, env: Env) {
		super(ctx, env);
		this.init().catch(console.error);
	}

	private async init() {
		await this.run`
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
			const rows = await this.sql(sql as TemplateStringsArray, ...params);
			return rows;
		} catch (e) {
			throw this.onError(e);
		}
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
		await this.run`INSERT INTO memory_history 
		  (memory_id, previous_value, new_value, action, created_at, updated_at, is_deleted)
		  VALUES (${memoryId}, ${previousValue}, ${newValue}, ${action}, ${createdAt}, ${updatedAt}, ${isDeleted})`;
	}

	async getHistory(memoryId: string): Promise<any[]> {
		return await this.all`SELECT * FROM memory_history WHERE memory_id = ${memoryId}`;
	}

	async reset(): Promise<void> {
		await this.run`DROP TABLE IF EXISTS memory_history`;
		await this.init();
	}

	async close(): Promise<void> {
		// No need to close the database connection in Cloudflare Workers
	}
}

export interface CloudflareHistoryConfig {
	agentBinding: AgentNamespace<CloudflareHistoryManagerAgent>;
	agentHistoryName: string;
  }

export class CloudflareHistoryManager implements HistoryManager {
	private agent!: DurableObjectStub<CloudflareHistoryManagerAgent>;
	private agentBinding: AgentNamespace<CloudflareHistoryManagerAgent>;
	private agentHistoryName: string;

  constructor(config: CloudflareHistoryConfig) {
    this.agentBinding = config.agentBinding;
    this.agentHistoryName = config.agentHistoryName;
    this.init().catch(console.error);
  }

  private async init() {
	  this.agent = await getAgentByName(
		this.agentBinding,
		this.agentHistoryName
	  ) as unknown as DurableObjectStub<CloudflareHistoryManagerAgent>;
	}

  async addHistory(
    memoryId: string,
    previousValue: string | null,
    newValue: string | null,
    action: string,
    createdAt?: string,
    updatedAt?: string,
    isDeleted: number = 0,
  ): Promise<void> {
	await this.agent.addHistory(
		memoryId,
		previousValue,
		newValue,
		action,
		createdAt,
		updatedAt,
		isDeleted,
	);
  }

  async getHistory(memoryId: string): Promise<any[]> {
	return (this.agent as any).getHistory(memoryId) as Promise<any[]>;
  }

  async reset(): Promise<void> {
	await (this.agent as any).reset();
  }

  close(): void {
    this.agent.close();
  }
}
