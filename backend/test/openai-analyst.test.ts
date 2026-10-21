import type OpenAI from "openai";
import { describe, expect, it } from "vitest";
import { analystFromEnv } from "../src/app.js";
import { AnalystError, ClaudeAnalyst } from "../src/services/analyst.js";
import { DemoOddsProvider } from "../src/services/odds-provider.js";
import { OpenAIAnalyst } from "../src/services/openai-analyst.js";
import { findValueBets } from "../src/services/value-engine.js";

const NOW = new Date("2026-10-20T12:00:00Z");

function fakeClient(parseResult: unknown, createResult: unknown = {}) {
  const calls: { parse: unknown[]; create: unknown[] } = { parse: [], create: [] };
  const client = {
    responses: {
      parse: async (params: unknown) => (calls.parse.push(params), parseResult),
      create: async (params: unknown) => (calls.create.push(params), createResult),
    },
  } as unknown as OpenAI;
  return { client, calls };
}

async function candidates() {
  const events = await new DemoOddsProvider(() => NOW).getOdds("americanfootball_nfl");
  return findValueBets(events, { now: NOW }).slice(0, 2);
}

describe("OpenAIAnalyst", () => {
  it("researches with web search and maps the structured verdicts", async () => {
    const cands = await candidates();
    const { client, calls } = fakeClient({
      status: "completed",
      output_parsed: {
        analyses: cands.map((c) => ({
          candidateId: c.id,
          verdict: "lean",
          confidence: 61.6,
          headline: "Small edge at a slow book",
          reasoning: "Because.",
          keyFactors: [],
          risks: [],
          sources: [{ title: "News", url: "https://example.com" }],
        })),
      },
    });
    const result = await new OpenAIAnalyst(client).analyze(cands, NOW);
    expect(result.size).toBe(2);
    expect(result.get(cands[0]!.id)!.confidence).toBe(62);
    const params = calls.parse[0] as { tools: Array<{ type: string }>; text: { format: { type: string } } };
    expect(params.tools).toEqual([{ type: "web_search" }]);
    expect(params.text.format.type).toBe("json_schema");
  });

  it("errors when the output can't be parsed so the board falls back to rules", async () => {
    const { client } = fakeClient({ status: "completed", output_parsed: null });
    await expect(new OpenAIAnalyst(client).analyze(await candidates(), NOW)).rejects.toBeInstanceOf(AnalystError);
  });

  it("answers questions with cited sources", async () => {
    const { client } = fakeClient(null, {
      output_text: " Take the under. ",
      output: [
        { type: "web_search_call" },
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "Take the under.",
              annotations: [{ type: "url_citation", url: "https://example.com/wx", title: "Weather" }],
            },
          ],
        },
      ],
    });
    const answer = await new OpenAIAnalyst(client).ask("Over or under?", [], "", NOW);
    expect(answer).toEqual({ answer: "Take the under.", sources: [{ url: "https://example.com/wx", title: "Weather" }] });
  });
});

describe("analystFromEnv", () => {
  it("prefers OpenAI when its key is set, unless AI_PROVIDER says otherwise", () => {
    expect(analystFromEnv({ OPENAI_API_KEY: "x", ANTHROPIC_API_KEY: "y" })).toBeInstanceOf(OpenAIAnalyst);
    expect(analystFromEnv({ OPENAI_API_KEY: "x", ANTHROPIC_API_KEY: "y", AI_PROVIDER: "anthropic" })).toBeInstanceOf(ClaudeAnalyst);
    expect(analystFromEnv({ ANTHROPIC_API_KEY: "y" })).toBeInstanceOf(ClaudeAnalyst);
    expect(analystFromEnv({})).toBeNull();
  });
});
