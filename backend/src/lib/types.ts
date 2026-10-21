// Shapes shared between the services and the HTTP API. The iOS app decodes
// these exact JSON shapes (see ios/Edge/Models), so change both together.

export type MarketKey = "h2h" | "spreads" | "totals";

/** Raw odds as returned by The Odds API v4 (/v4/sports/{sport}/odds). */
export interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    last_update: string;
    markets: Array<{
      key: string;
      last_update?: string;
      outcomes: Array<{ name: string; price: number; point?: number }>;
    }>;
  }>;
}

export interface Sport {
  key: string;
  title: string;
  group: string;
  active: boolean;
}

export interface BookPrice {
  book: string;
  bookTitle: string;
  americanOdds: number;
  /** This book's own no-vig probability for the outcome. */
  noVigProbability: number;
}

/** A price that beats the market consensus, before the AI review. */
export interface ValueCandidate {
  id: string;
  eventId: string;
  sportKey: string;
  sportTitle: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  market: MarketKey;
  /** Team name, "Over"/"Under", or "Draw". */
  selection: string;
  point?: number;
  bestBook: string;
  bestBookTitle: string;
  bestAmericanOdds: number;
  fairProbability: number;
  fairAmericanOdds: number;
  /** Edge per unit staked, e.g. 0.034 = +3.4% EV. */
  expectedValue: number;
  /** Quarter-Kelly stake as a fraction of bankroll, capped. */
  suggestedStakeFraction: number;
  booksCompared: number;
  sharpBooksCompared: number;
  /** Std. dev. of the books' no-vig probabilities: lower = stronger agreement. */
  marketDisagreement: number;
  /** 0-100 score for how trustworthy the numbers alone look. */
  modelConfidence: number;
  prices: BookPrice[];
}

export type Verdict = "strong" | "lean" | "pass";

export interface KeyFactor {
  label: string;
  impact: "positive" | "negative" | "neutral";
  detail: string;
}

export interface AIAnalysis {
  verdict: Verdict;
  /** Final 0-100 confidence after weighing news and context. */
  confidence: number;
  headline: string;
  reasoning: string;
  keyFactors: KeyFactor[];
  risks: string[];
  sources: Array<{ title: string; url: string }>;
}

export interface Pick extends ValueCandidate {
  analysis: AIAnalysis;
  /** "ai" when researched by the AI analyst, "rules" when produced offline. */
  analysisSource: "ai" | "rules";
}

export interface PicksResponse {
  sportKey: string;
  generatedAt: string;
  dataSource: "live" | "demo";
  picks: Pick[];
  /** Candidates the analyst reviewed and rejected, with reasons. */
  passes: Pick[];
  disclaimer: string;
}
