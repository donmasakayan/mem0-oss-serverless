import OpenAI from "openai";
import { LLM, LLMResponse } from "./base";
import { LLMConfig, Message } from "../types";

export class LmStudioStructuredLLM implements LLM {
  private lmstudio: OpenAI;
  private model: string;

  constructor(config: LLMConfig) {
    this.lmstudio = new OpenAI({ 
      apiKey: config.apiKey, 
      baseURL: config.config?.url || "http://localhost:1234" 
    });
    this.model = config.model || "llama3.1:8b";
  }

  async generateResponse(
    messages: Message[],
    responseFormat?: { type: string, jsonSchema?: any } | null,
    tools?: any[],
  ): Promise<string | LLMResponse> {
    const completion = await this.lmstudio.beta.chat.completions.parse({
      messages: messages.map((msg) => ({
        role: msg.role as "system" | "user" | "assistant",
        content:
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content),
      })),
      model: this.model,
      ...(tools
        ? {
            tools: tools.map((tool) => ({
              type: "function",
              function: {
                name: tool.function.name,
                description: tool.function.description,
                parameters: tool.function.parameters,
                strict: true,
              },
            })),
            tool_choice: "auto" as const,
          }
        : responseFormat
          ? {
              response_format: {
                type: "json_schema" as "text" | "json_object",
                json_schema: responseFormat.jsonSchema,
              },
            }
          : {}),
    });

    const response = completion.choices[0].message;

    if (response.tool_calls) {
      return {
        content: response.content || "",
        role: response.role,
        toolCalls: response.tool_calls.map((call) => ({
          name: call.function.name,
          arguments: call.function.arguments,
        })),
      };
    }

    return response.content || "";
  }

  async generateChat(messages: Message[]): Promise<LLMResponse> {
    const completion = await this.lmstudio.beta.chat.completions.parse({
      messages: messages.map((msg) => ({
        role: msg.role as "system" | "user" | "assistant",
        content:
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content),
      })),
      model: this.model,
    });
    const response = completion.choices[0].message;
    return {
      content: response.parsed || "",
      role: response.role,
    };
  }
}
