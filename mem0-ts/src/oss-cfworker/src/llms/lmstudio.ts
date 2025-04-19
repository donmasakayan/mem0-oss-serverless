import OpenAI from "openai";
import { LLMConfig, Message } from "../types";
import { LLM, LLMResponse } from "./base";

export class LmStudioLLM implements LLM {
	private lmstudio: OpenAI;
	private model: string;

	constructor(config: LLMConfig) {
		this.lmstudio = new OpenAI({
			apiKey: config.apiKey,
			baseURL: config.baseUrl || "http://localhost:1234",
		});
		this.model = config.model || "llama3.1:8b";
	}

	async generateResponse(
		messages: Message[],
		responseFormat?: { type: string },
		tools?: any[],
	): Promise<string | LLMResponse> {
		const completion = await this.lmstudio.chat.completions.create({
			messages: messages.map(msg => {
				const role = msg.role as "system" | "user" | "assistant";
				return {
					role,
					content:
						typeof msg.content === "string"
							? msg.content
							: JSON.stringify(msg.content),
				};
			}),
			model: this.model,
			response_format: responseFormat as { type: "text" | "json_object" },
			...(tools && { tools, tool_choice: "auto" }),
		});

		const response = completion.choices[0].message;

		if (response.tool_calls) {
			return {
				content: response.content || "",
				role: response.role,
				toolCalls: response.tool_calls.map(call => ({
					name: call.function.name,
					arguments: call.function.arguments,
				})),
			};
		}

		return response.content || "";
	}

	async generateChat(messages: Message[]): Promise<LLMResponse> {
		const completion = await this.lmstudio.chat.completions.create({
			messages: messages.map(msg => {
				const role = msg.role as "system" | "user" | "assistant";
				return {
					role,
					content:
						typeof msg.content === "string"
							? msg.content
							: JSON.stringify(msg.content),
				};
			}),
			model: this.model,
		});
		const response = completion.choices[0].message;
		return {
			content: response.content || "",
			role: response.role,
		};
	}
}
