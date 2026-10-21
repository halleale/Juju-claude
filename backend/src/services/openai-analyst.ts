// OpenAI version of the analyst. Same prompts and output shape as the Claude
// version; uses the Responses API with built-in web search and a JSON schema
// for the verdicts.

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { AIAnalysis, ValueCandidate } from "../lib/types.js";
import {
  ANALYST_SYSTEM,
  ASK_SYSTEM,
  AnalystError,
  analysisRequest,
  askRequest,
  SubmitInput,
  toAnalyses,
  type AIAnalyst,
  type Answer,
  type ChatHistory,
} from "./analyst.js";

export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5.5";

const OPENAI_ANALYST_SYSTEM = `${ANALYST_SYSTEM}
- When you have finished researching, reply with the analyses: one entry for every candidate id you were given.`;

export class OpenAIAnalyst implements AIAnalyst {
  readonly provider = "openai" as const;
  readonly model = OPENAI_MODEL;
  private readonly client: OpenAI;

  constructor(client?: OpenAI) {
    this.client = client ?? OpenAIAnalyst.client();
  }

  static client(apiKey?: string): OpenAI {
    // Researched boards can take several minutes.
    return new OpenAI({ apiKey, timeout: 10 * 60_000 });
  }

  async analyze(candidates: ValueCandidate[], now = new Date()): Promise<Map<string, AIAnalysis>> {
    if (candidates.length === 0) return new Map();
    const response = await this.client.responses.parse({
      model: this.model,
      instructions: OPENAI_ANALYST_SYSTEM,
      input: analysisRequest(candidates, now),
      tools: [{ type: "web_search" }],
      reasoning: { effort: "high" },
      text: { format: zodTextFormat(SubmitInput, "bet_analyses") },
    });
    if (response.status === "incomplete") {
      throw new AnalystError(`analysis incomplete: ${response.incomplete_details?.reason ?? "unknown"}`);
    }
    if (!response.output_parsed) {
      throw new AnalystError("analysis returned no parseable output (possibly a refusal)");
    }
    return toAnalyses(response.output_parsed.analyses, candidates);
  }

  async ask(question: string, history: ChatHistory, boardContext: string, now = new Date()): Promise<Answer> {
    const response = await this.client.responses.create({
      model: this.model,
      instructions: ASK_SYSTEM,
      input: [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: askRequest(question, boardContext, now) },
      ],
      tools: [{ type: "web_search" }],
      reasoning: { effort: "medium" },
    });

    const sources = new Map<string, string>();
    for (const item of response.output) {
      if (item.type !== "message") continue;
      for (const part of item.content) {
        if (part.type !== "output_text") continue;
        for (const a of part.annotations) {
          if (a.type === "url_citation") sources.set(a.url, a.title || a.url);
        }
      }
    }
    const answer = response.output_text.trim();
    return {
      answer: answer || "Sorry, I couldn't come up with an answer to that one.",
      sources: [...sources].map(([url, title]) => ({ url, title })),
    };
  }
}
