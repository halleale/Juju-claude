// Finds prices that beat the market's consensus "fair" probability.
//
// Approach (the standard one used by professional bettors):
//   1. For each book, strip the vig from its prices to get that book's
//      no-vig probabilities for the market.
//   2. Blend those probabilities into a consensus, weighting sharp books
//      (low-margin, high-limit books that move first) more heavily.
//   3. Compare every book's price with the consensus. Where the payout beats
//      the fair probability, the bet has positive expected value.
// The book offering the best price is left out of its own consensus so a
// single off-market book can't validate itself.

import {
  americanToDecimal,
  devigPower,
  expectedValue,
  kellyFraction,
  probabilityToAmerican,
  stdDev,
  weightedMean,
} from "../lib/odds-math.js";
import type { BookPrice, MarketKey, OddsEvent, ValueCandidate } from "../lib/types.js";

/** Books whose lines are treated as the sharpest signal, with blend weights. */
export const SHARP_BOOK_WEIGHTS: Record<string, number> = {
  pinnacle: 4,
  circasports: 3,
  betonlineag: 2,
  lowvig: 2,
  betfair_ex_eu: 2,
  betfair_ex_uk: 2,
  matchbook: 2,
};

/** Exchanges charge commission on winnings, so their quoted price isn't the payout. */
const EXCHANGES = new Set(["betfair_ex_eu", "betfair_ex_uk", "betfair_ex_au", "matchbook"]);

export interface ValueEngineOptions {
  now?: Date;
  /** Minimum EV to report, e.g. 0.01 for +1%. */
  minExpectedValue?: number;
  /** Books other than the best-priced one needed to form a consensus. */
  minConsensusBooks?: number;
  /** Only books the user can bet at may supply the best price. Empty = all. */
  allowedBooks?: string[];
  minAmericanOdds?: number;
  maxAmericanOdds?: number;
  /** Ignore events further out than this; their lines are still soft. */
  maxHoursAhead?: number;
  kellyMultiplier?: number;
  maxStakeFraction?: number;
}

const DEFAULTS = {
  minExpectedValue: 0.01,
  minConsensusBooks: 3,
  minAmericanOdds: -400,
  maxAmericanOdds: 500,
  maxHoursAhead: 24 * 7,
  kellyMultiplier: 0.25,
  maxStakeFraction: 0.03,
};

interface BookLine {
  book: string;
  bookTitle: string;
  /** outcome name -> American price */
  prices: Map<string, number>;
  /** outcome name -> no-vig probability */
  fair: Map<string, number>;
}

interface Line {
  market: MarketKey;
  /** outcome name -> point, for spreads/totals */
  points: Map<string, number>;
  books: BookLine[];
}

const SUPPORTED_MARKETS = new Set<MarketKey>(["h2h", "spreads", "totals"]);

function lineKey(market: MarketKey, event: OddsEvent, outcomes: Array<{ name: string; point?: number }>): string {
  if (market === "h2h") return "h2h";
  if (market === "totals") return `totals:${outcomes[0]?.point}`;
  const home = outcomes.find((o) => o.name === event.home_team);
  return `spreads:${home?.point}`;
}

/** Group every book's prices by identical line (same market and same points). */
export function groupLines(event: OddsEvent): Line[] {
  const lines = new Map<string, Line>();
  for (const bm of event.bookmakers) {
    for (const m of bm.markets) {
      const market = m.key as MarketKey;
      if (!SUPPORTED_MARKETS.has(market) || m.outcomes.length < 2) continue;
      if (market !== "h2h" && m.outcomes.some((o) => o.point === undefined)) continue;
      // Skip malformed or zero prices rather than letting one bad quote poison a line.
      if (m.outcomes.some((o) => !Number.isFinite(o.price) || o.price === 0 || Math.abs(o.price) < 100)) continue;

      const key = lineKey(market, event, m.outcomes);
      let line = lines.get(key);
      if (!line) {
        line = {
          market,
          points: new Map(m.outcomes.filter((o) => o.point !== undefined).map((o) => [o.name, o.point!])),
          books: [],
        };
        lines.set(key, line);
      }
      const names = m.outcomes.map((o) => o.name);
      if (line.books.length > 0) {
        const expected = [...line.books[0]!.prices.keys()].sort().join("|");
        if (names.slice().sort().join("|") !== expected) continue;
      }
      const fair = devigPower(m.outcomes.map((o) => americanToDecimal(o.price)));
      line.books.push({
        book: bm.key,
        bookTitle: bm.title,
        prices: new Map(m.outcomes.map((o) => [o.name, o.price])),
        fair: new Map(m.outcomes.map((o, i) => [o.name, fair[i]!])),
      });
    }
  }
  return [...lines.values()];
}

/**
 * 0-100 score for how much the numbers alone can be trusted. Deliberately
 * suspicious of very large edges: in efficient markets a 10%+ edge is far more
 * often a stale line or a pending news event than a gift.
 */
export function modelConfidence(input: {
  expectedValue: number;
  booksCompared: number;
  sharpBooksCompared: number;
  marketDisagreement: number;
  fairProbability: number;
}): number {
  const ev = input.expectedValue;
  let score = 40;
  // Rewards edges up to ~6%, then fades them as they get implausibly large.
  score += ev <= 0.06 ? (ev / 0.06) * 20 : Math.max(0, 20 - ((ev - 0.06) / 0.06) * 30);
  if (input.sharpBooksCompared >= 1) score += 12;
  if (input.sharpBooksCompared >= 2) score += 6;
  score += Math.min(Math.max(input.booksCompared - 3, 0), 7) * 1.5;
  score -= Math.min(input.marketDisagreement / 0.04, 1) * 20;
  if (input.fairProbability < 0.25) score -= 10;
  return Math.round(Math.min(95, Math.max(5, score)));
}

export function findValueBets(events: OddsEvent[], opts: ValueEngineOptions = {}): ValueCandidate[] {
  const o = { ...DEFAULTS, ...opts };
  const now = opts.now ?? new Date();
  const allowed = new Set(opts.allowedBooks ?? []);
  const candidates: ValueCandidate[] = [];

  for (const event of events) {
    const start = new Date(event.commence_time);
    const hoursAhead = (start.getTime() - now.getTime()) / 3_600_000;
    // Live betting needs a live feed; only pre-game lines are evaluated.
    if (hoursAhead <= 0 || hoursAhead > o.maxHoursAhead) continue;

    for (const line of groupLines(event)) {
      if (line.books.length < o.minConsensusBooks + 1) continue;
      const outcomeNames = [...line.books[0]!.prices.keys()];

      for (const selection of outcomeNames) {
        const eligible = line.books.filter(
          (b) => !EXCHANGES.has(b.book) && (allowed.size === 0 || allowed.has(b.book)),
        );
        if (eligible.length === 0) continue;
        const best = eligible.reduce((a, b) =>
          americanToDecimal(b.prices.get(selection)!) > americanToDecimal(a.prices.get(selection)!) ? b : a,
        );
        const bestAmerican = best.prices.get(selection)!;
        if (bestAmerican < o.minAmericanOdds || bestAmerican > o.maxAmericanOdds) continue;

        const others = line.books.filter((b) => b !== best);
        if (others.length < o.minConsensusBooks) continue;
        const probs = others.map((b) => b.fair.get(selection)!);
        const weights = others.map((b) => SHARP_BOOK_WEIGHTS[b.book] ?? 1);
        const fairProbability = weightedMean(probs, weights);
        const bestDecimal = americanToDecimal(bestAmerican);
        const ev = expectedValue(fairProbability, bestDecimal);
        if (ev < o.minExpectedValue) continue;

        const sharpBooksCompared = others.filter((b) => b.book in SHARP_BOOK_WEIGHTS).length;
        const marketDisagreement = stdDev(probs);
        const stake = Math.min(kellyFraction(fairProbability, bestDecimal) * o.kellyMultiplier, o.maxStakeFraction);
        const point = line.points.get(selection);
        const prices: BookPrice[] = line.books
          .map((b) => ({
            book: b.book,
            bookTitle: b.bookTitle,
            americanOdds: b.prices.get(selection)!,
            noVigProbability: b.fair.get(selection)!,
          }))
          .sort((a, b) => americanToDecimal(b.americanOdds) - americanToDecimal(a.americanOdds));

        candidates.push({
          id: [event.id, line.market, selection, point ?? ""].join(":"),
          eventId: event.id,
          sportKey: event.sport_key,
          sportTitle: event.sport_title,
          commenceTime: event.commence_time,
          homeTeam: event.home_team,
          awayTeam: event.away_team,
          market: line.market,
          selection,
          ...(point !== undefined ? { point } : {}),
          bestBook: best.book,
          bestBookTitle: best.bookTitle,
          bestAmericanOdds: bestAmerican,
          fairProbability,
          fairAmericanOdds: probabilityToAmerican(fairProbability),
          expectedValue: ev,
          suggestedStakeFraction: stake,
          booksCompared: others.length,
          sharpBooksCompared,
          marketDisagreement,
          modelConfidence: modelConfidence({
            expectedValue: ev,
            booksCompared: others.length,
            sharpBooksCompared,
            marketDisagreement,
            fairProbability,
          }),
          prices,
        });
      }
    }
  }

  // One bet per event and market: the strongest side/line wins.
  const bestPerMarket = new Map<string, ValueCandidate>();
  for (const c of candidates) {
    const key = `${c.eventId}:${c.market}`;
    const cur = bestPerMarket.get(key);
    if (!cur || rankScore(c) > rankScore(cur)) bestPerMarket.set(key, c);
  }
  return [...bestPerMarket.values()].sort((a, b) => rankScore(b) - rankScore(a));
}

/** Edge weighted by how much we trust it. */
export function rankScore(c: Pick<ValueCandidate, "expectedValue" | "modelConfidence">): number {
  return Math.min(c.expectedValue, 0.1) * c.modelConfidence;
}
