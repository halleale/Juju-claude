// Builds the picks board for a sport: odds -> value engine -> analyst.
// Results are cached per sport and refreshed in the background, because a
// researched board takes a while to produce and costs API credits.

import type { AIAnalysis, Pick, PicksResponse, ValueCandidate } from "../lib/types.js";
import { Analyst, ruleBasedAnalysis } from "./analyst.js";
import type { OddsProvider } from "./odds-provider.js";
import { findValueBets, type ValueEngineOptions } from "./value-engine.js";

export const DISCLAIMER =
  "Recommendations are estimates, not guarantees. Every bet can lose. Only bet what you can afford to lose and only where it is legal for you. 21+. Gambling problem? Call 1-800-GAMBLER.";

export interface PicksServiceOptions {
  /** How long a board is served before a background refresh starts. */
  ttlMs?: number;
  /** How many candidates the analyst researches per board. */
  maxAnalyzed?: number;
  engine?: ValueEngineOptions;
}

interface CacheEntry {
  value: PicksResponse;
  expiresAt: number;
}

export class PicksService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<PicksResponse>>();
  private readonly ttlMs: number;
  private readonly maxAnalyzed: number;

  constructor(
    private readonly odds: OddsProvider,
    private readonly analyst: Analyst | null,
    private readonly opts: PicksServiceOptions = {},
  ) {
    this.ttlMs = opts.ttlMs ?? 20 * 60_000;
    this.maxAnalyzed = opts.maxAnalyzed ?? 6;
  }

  async getPicks(sportKey: string, books: string[] = []): Promise<PicksResponse> {
    const key = `${sportKey}|${[...books].sort().join(",")}`;
    const cached = this.cache.get(key);
    if (cached) {
      if (Date.now() > cached.expiresAt) void this.refresh(key, sportKey, books).catch(() => {});
      return cached.value;
    }
    return this.refresh(key, sportKey, books);
  }

  private refresh(key: string, sportKey: string, books: string[]): Promise<PicksResponse> {
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const job = this.build(sportKey, books)
      .then((value) => {
        this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, job);
    return job;
  }

  private async build(sportKey: string, books: string[]): Promise<PicksResponse> {
    const now = new Date();
    const events = await this.odds.getOdds(sportKey);
    const candidates = findValueBets(events, { ...this.opts.engine, now, allowedBooks: books });
    const toAnalyze = candidates.slice(0, this.maxAnalyzed);

    let analyses = new Map<string, AIAnalysis>();
    if (this.analyst && toAnalyze.length > 0) {
      try {
        analyses = await this.analyst.analyze(toAnalyze, now);
      } catch (err) {
        console.error(`[picks] analyst failed for ${sportKey}, using rule-based analysis:`, err);
      }
    }

    const graded: Pick[] = toAnalyze.map((c) => attach(c, analyses.get(c.id)));
    const verdictRank = { strong: 0, lean: 1, pass: 2 } as const;
    const byStrength = (a: Pick, b: Pick) =>
      verdictRank[a.analysis.verdict] - verdictRank[b.analysis.verdict] ||
      b.analysis.confidence * b.expectedValue - a.analysis.confidence * a.expectedValue;

    return {
      sportKey,
      generatedAt: now.toISOString(),
      dataSource: this.odds.source,
      picks: graded.filter((p) => p.analysis.verdict !== "pass").sort(byStrength),
      passes: graded.filter((p) => p.analysis.verdict === "pass").sort(byStrength),
      disclaimer: DISCLAIMER,
    };
  }

  /** The most recent picks across all cached sports, for grounding chat answers. */
  cachedPicks(): Pick[] {
    return [...this.cache.values()].flatMap((e) => e.value.picks);
  }
}

function attach(c: ValueCandidate, analysis: AIAnalysis | undefined): Pick {
  return analysis
    ? { ...c, analysis, analysisSource: "claude" }
    : { ...c, analysis: ruleBasedAnalysis(c), analysisSource: "rules" };
}
