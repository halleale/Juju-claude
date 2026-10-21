import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { AnalystError, ClaudeAnalyst } from "../src/services/analyst.js";
import { DemoOddsProvider } from "../src/services/odds-provider.js";
import { findValueBets } from "../src/services/value-engine.js";

const NOW = new Date("2026-10-20T12:00:00Z");

/** Fake client that replays canned responses and records each request. */
function fakeClient(responses: Array<Partial<Anthropic.Beta.BetaMessage>>) {
  const requests: Anthropic.Beta.MessageCreateParams[] = [];
  const client = {
    beta: {
      messages: {
        stream(params: Anthropic.Beta.MessageCreateParams) {
          // Snapshot: the analyst keeps appending to the same messages array.
          requests.push(structuredClone(params));
          const next = responses.shift();
          if (!next) throw new Error("no more canned responses");
          return { finalMessage: async () => ({ content: [], stop_details: null, ...next }) };
        },
      },
    },
  } as unknown as Anthropic;
  return { client, requests };
}

async function candidates() {
  const events = await new DemoOddsProvider(() => NOW).getOdds("americanfootball_nfl");
  return findValueBets(events, { now: NOW }).slice(0, 2);
}

function submission(ids: string[], verdict = "strong") {
  return {
    type: "tool_use",
    id: "toolu_1",
    name: "submit_analysis",
    input: {
      analyses: ids.map((candidateId) => ({
        candidateId,
        verdict,
        confidence: 140,
        headline: "Soft book is behind the market",
        reasoning: "Para one.\n\nPara two.",
        keyFactors: [{ label: "Sharp consensus", impact: "positive", detail: "Pinnacle agrees" }],
        risks: ["Line may move"],
        sources: [
          { title: "Report", url: "https://example.com/injuries" },
          { title: "Bad", url: "javascript:alert(1)" },
        ],
      })),
    },
  };
}

describe("ClaudeAnalyst.analyze", () => {
  it("continues paused turns, then returns validated analyses", async () => {
    const cands = await candidates();
    const ids = cands.map((c) => c.id);
    const { client, requests } = fakeClient([
      { stop_reason: "pause_turn", content: [{ type: "text", text: "Searching…", citations: null }] as never },
      { stop_reason: "tool_use", content: [submission(ids)] as never },
    ]);
    const result = await new ClaudeAnalyst(client).analyze(cands, NOW);

    expect(requests).toHaveLength(2);
    // A paused turn is resumed by resending, with no extra user message.
    expect(requests[1]!.messages.at(-1)!.role).toBe("assistant");
    expect(requests[0]!.model).toBe("claude-opus-5-5");
    expect(requests[0]!.tools!.map((t) => ("name" in t ? t.name : ""))).toEqual(["web_search", "submit_analysis"]);

    expect(result.size).toBe(2);
    const first = result.get(ids[0]!)!;
    expect(first.confidence).toBe(100); // clamped
    expect(first.sources).toEqual([{ title: "Report", url: "https://example.com/injuries" }]);
  });

  it("returns a tool error and retries when the submission is malformed", async () => {
    const cands = await candidates();
    const bad = { type: "tool_use", id: "toolu_bad", name: "submit_analysis", input: { analyses: [{ candidateId: "x" }] } };
    const { client, requests } = fakeClient([
      { stop_reason: "tool_use", content: [bad] as never },
      { stop_reason: "tool_use", content: [submission(cands.map((c) => c.id), "pass")] as never },
    ]);
    const result = await new ClaudeAnalyst(client).analyze(cands, NOW);
    const retryTurn = requests[1]!.messages.at(-1)!;
    expect(retryTurn.role).toBe("user");
    expect(JSON.stringify(retryTurn.content)).toContain("toolu_bad");
    expect([...result.values()].every((a) => a.verdict === "pass")).toBe(true);
  });

  it("surfaces refusals as errors so the board falls back to rule-based analysis", async () => {
    const cands = await candidates();
    const { client } = fakeClient([{ stop_reason: "refusal", content: [] as never }]);
    await expect(new ClaudeAnalyst(client).analyze(cands, NOW)).rejects.toBeInstanceOf(AnalystError);
  });
});
