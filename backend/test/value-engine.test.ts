import { describe, expect, it } from "vitest";
import type { OddsEvent } from "../src/lib/types.js";
import { DemoOddsProvider } from "../src/services/odds-provider.js";
import { PicksService } from "../src/services/picks-service.js";
import { findValueBets, groupLines, modelConfidence } from "../src/services/value-engine.js";

const NOW = new Date("2026-10-20T12:00:00Z");

function event(books: Array<[key: string, home: number, away: number]>): OddsEvent {
  return {
    id: "evt1",
    sport_key: "basketball_nba",
    sport_title: "NBA",
    commence_time: "2026-10-21T00:00:00Z",
    home_team: "Boston Celtics",
    away_team: "New York Knicks",
    bookmakers: books.map(([key, home, away]) => ({
      key,
      title: key,
      last_update: NOW.toISOString(),
      markets: [
        {
          key: "h2h",
          outcomes: [
            { name: "Boston Celtics", price: home },
            { name: "New York Knicks", price: away },
          ],
        },
      ],
    })),
  };
}

describe("findValueBets", () => {
  it("flags a soft book that lags the sharp consensus", () => {
    const evt = event([
      ["pinnacle", -150, 135],
      ["draftkings", -155, 130],
      ["fanduel", -152, 128],
      ["betmgm", -150, 125],
      ["betrivers", -130, 155], // stale on the underdog
    ]);
    const bets = findValueBets([evt], { now: NOW });
    expect(bets).toHaveLength(1);
    const bet = bets[0]!;
    expect(bet.selection).toBe("New York Knicks");
    expect(bet.bestBook).toBe("betrivers");
    expect(bet.bestAmericanOdds).toBe(155);
    expect(bet.expectedValue).toBeGreaterThan(0.05);
    expect(bet.sharpBooksCompared).toBe(1);
    expect(bet.booksCompared).toBe(4);
    expect(bet.suggestedStakeFraction).toBeGreaterThan(0);
    expect(bet.suggestedStakeFraction).toBeLessThanOrEqual(0.03);
  });

  it("finds nothing in an efficient market", () => {
    const evt = event([
      ["pinnacle", -150, 135],
      ["draftkings", -155, 130],
      ["fanduel", -152, 128],
      ["betmgm", -150, 125],
    ]);
    expect(findValueBets([evt], { now: NOW })).toHaveLength(0);
  });

  it("needs enough books to form a consensus", () => {
    const evt = event([
      ["pinnacle", -150, 135],
      ["betrivers", -130, 155],
    ]);
    expect(findValueBets([evt], { now: NOW })).toHaveLength(0);
  });

  it("only lets the user's books supply the price", () => {
    const evt = event([
      ["pinnacle", -150, 135],
      ["draftkings", -155, 130],
      ["fanduel", -152, 128],
      ["betmgm", -150, 125],
      ["betrivers", -130, 155],
    ]);
    expect(findValueBets([evt], { now: NOW, allowedBooks: ["draftkings", "fanduel"] })).toHaveLength(0);
  });

  it("skips games that already started", () => {
    const evt = { ...event([["pinnacle", -150, 135], ["a", -150, 135], ["b", -150, 135], ["c", -130, 155]]), commence_time: "2026-10-20T11:00:00Z" };
    expect(findValueBets([evt], { now: NOW })).toHaveLength(0);
  });

  it("groups spreads by line so different points are never mixed", () => {
    const evt: OddsEvent = {
      ...event([]),
      bookmakers: [
        { key: "a", title: "A", last_update: "", markets: [{ key: "spreads", outcomes: [{ name: "Boston Celtics", price: -110, point: -4.5 }, { name: "New York Knicks", price: -110, point: 4.5 }] }] },
        { key: "b", title: "B", last_update: "", markets: [{ key: "spreads", outcomes: [{ name: "Boston Celtics", price: -110, point: -5 }, { name: "New York Knicks", price: -110, point: 5 }] }] },
      ],
    };
    expect(groupLines(evt)).toHaveLength(2);
  });
});

describe("modelConfidence", () => {
  const base = { booksCompared: 6, sharpBooksCompared: 1, marketDisagreement: 0.01, fairProbability: 0.45 };

  it("is suspicious of implausibly large edges", () => {
    const moderate = modelConfidence({ ...base, expectedValue: 0.05 });
    const huge = modelConfidence({ ...base, expectedValue: 0.2 });
    expect(huge).toBeLessThan(moderate);
  });

  it("rewards sharp-book coverage", () => {
    expect(modelConfidence({ ...base, expectedValue: 0.03, sharpBooksCompared: 2 })).toBeGreaterThan(
      modelConfidence({ ...base, expectedValue: 0.03, sharpBooksCompared: 0 }),
    );
  });
});

describe("PicksService (demo feed, rule-based analysis)", () => {
  it("produces a graded board for every featured sport", async () => {
    const service = new PicksService(new DemoOddsProvider(() => NOW), null);
    const board = await service.getPicks("basketball_nba");
    expect(board.dataSource).toBe("demo");
    expect(board.picks.length + board.passes.length).toBeGreaterThan(0);
    for (const p of [...board.picks, ...board.passes]) {
      expect(p.analysisSource).toBe("rules");
      expect(p.expectedValue).toBeGreaterThan(0);
      expect(p.analysis.reasoning.length).toBeGreaterThan(50);
    }
  });
});
