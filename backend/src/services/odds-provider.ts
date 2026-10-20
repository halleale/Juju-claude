// Odds data: The Odds API (https://the-odds-api.com) when a key is configured,
// otherwise a deterministic demo feed so the app works end to end without keys.

import { decimalToAmerican } from "../lib/odds-math.js";
import type { OddsEvent, Sport } from "../lib/types.js";

export interface OddsProvider {
  readonly source: "live" | "demo";
  listSports(): Promise<Sport[]>;
  getOdds(sportKey: string): Promise<OddsEvent[]>;
}

/** Sports the app features; The Odds API keys. */
export const FEATURED_SPORTS: Sport[] = [
  { key: "americanfootball_nfl", title: "NFL", group: "American Football", active: true },
  { key: "americanfootball_ncaaf", title: "NCAAF", group: "American Football", active: true },
  { key: "basketball_nba", title: "NBA", group: "Basketball", active: true },
  { key: "basketball_ncaab", title: "NCAAB", group: "Basketball", active: true },
  { key: "baseball_mlb", title: "MLB", group: "Baseball", active: true },
  { key: "icehockey_nhl", title: "NHL", group: "Ice Hockey", active: true },
  { key: "soccer_epl", title: "EPL", group: "Soccer", active: true },
  { key: "soccer_uefa_champs_league", title: "Champions League", group: "Soccer", active: true },
  { key: "mma_mixed_martial_arts", title: "MMA", group: "Mixed Martial Arts", active: true },
];

export class TheOddsApiProvider implements OddsProvider {
  readonly source = "live" as const;

  constructor(
    private readonly apiKey: string,
    private readonly regions = "us,us2,eu",
    private readonly baseUrl = "https://api.the-odds-api.com/v4",
  ) {}

  async listSports(): Promise<Sport[]> {
    const res = await fetch(`${this.baseUrl}/sports?apiKey=${encodeURIComponent(this.apiKey)}`);
    if (!res.ok) throw new Error(`odds api /sports failed: ${res.status}`);
    const all = (await res.json()) as Array<{ key: string; title: string; group: string; active: boolean }>;
    const active = new Set(all.filter((s) => s.active).map((s) => s.key));
    return FEATURED_SPORTS.map((s) => ({ ...s, active: active.has(s.key) }));
  }

  async getOdds(sportKey: string): Promise<OddsEvent[]> {
    // Head-to-head-only sports reject spread/total requests.
    const markets = sportKey.startsWith("mma_") ? "h2h" : "h2h,spreads,totals";
    const url =
      `${this.baseUrl}/sports/${encodeURIComponent(sportKey)}/odds` +
      `?apiKey=${encodeURIComponent(this.apiKey)}&regions=${this.regions}` +
      `&markets=${markets}&oddsFormat=american&dateFormat=iso`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`odds api /odds failed for ${sportKey}: ${res.status} ${await res.text()}`);
    return (await res.json()) as OddsEvent[];
  }
}

// ---------------------------------------------------------------------------
// Demo feed

const DEMO_TEAMS: Record<string, string[]> = {
  americanfootball_nfl: ["Kansas City Chiefs", "Buffalo Bills", "Philadelphia Eagles", "San Francisco 49ers", "Detroit Lions", "Baltimore Ravens", "Green Bay Packers", "Houston Texans", "Cincinnati Bengals", "Dallas Cowboys"],
  americanfootball_ncaaf: ["Georgia Bulldogs", "Ohio State Buckeyes", "Texas Longhorns", "Oregon Ducks", "Alabama Crimson Tide", "Michigan Wolverines", "Penn State Nittany Lions", "Notre Dame Fighting Irish"],
  basketball_nba: ["Boston Celtics", "Denver Nuggets", "Oklahoma City Thunder", "New York Knicks", "Minnesota Timberwolves", "Milwaukee Bucks", "Dallas Mavericks", "Cleveland Cavaliers", "Phoenix Suns", "Los Angeles Lakers"],
  basketball_ncaab: ["Duke Blue Devils", "Houston Cougars", "Kansas Jayhawks", "UConn Huskies", "Purdue Boilermakers", "Auburn Tigers", "Arizona Wildcats", "Gonzaga Bulldogs"],
  baseball_mlb: ["Los Angeles Dodgers", "New York Yankees", "Atlanta Braves", "Philadelphia Phillies", "Houston Astros", "Baltimore Orioles", "Seattle Mariners", "San Diego Padres"],
  icehockey_nhl: ["Florida Panthers", "Edmonton Oilers", "Dallas Stars", "New York Rangers", "Colorado Avalanche", "Vegas Golden Knights", "Carolina Hurricanes", "Winnipeg Jets"],
  soccer_epl: ["Arsenal", "Manchester City", "Liverpool", "Chelsea", "Tottenham Hotspur", "Aston Villa", "Newcastle United", "Manchester United"],
  soccer_uefa_champs_league: ["Real Madrid", "Bayern Munich", "Inter Milan", "Paris Saint Germain", "Barcelona", "Arsenal", "Borussia Dortmund", "Atletico Madrid"],
  mma_mixed_martial_arts: ["Islam Makhachev", "Alex Pereira", "Ilia Topuria", "Tom Aspinall", "Dricus Du Plessis", "Belal Muhammad", "Merab Dvalishvili", "Alexandre Pantoja"],
};

const DEMO_BOOKS: Array<{ key: string; title: string; margin: number; noise: number }> = [
  { key: "pinnacle", title: "Pinnacle", margin: 0.025, noise: 0.004 },
  { key: "draftkings", title: "DraftKings", margin: 0.045, noise: 0.006 },
  { key: "fanduel", title: "FanDuel", margin: 0.044, noise: 0.006 },
  { key: "betmgm", title: "BetMGM", margin: 0.05, noise: 0.007 },
  { key: "williamhill_us", title: "Caesars", margin: 0.05, noise: 0.007 },
  { key: "betrivers", title: "BetRivers", margin: 0.05, noise: 0.008 },
  { key: "espnbet", title: "ESPN BET", margin: 0.048, noise: 0.007 },
  { key: "betonlineag", title: "BetOnline.ag", margin: 0.035, noise: 0.008 },
];

/** Small seeded PRNG (mulberry32) so the demo feed is stable between refreshes. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Price a two-way (or three-way) market for one book around the true probabilities. */
function priceMarket(trueProbs: number[], margin: number, noise: number, rand: () => number): number[] {
  const jittered = trueProbs.map((p) => Math.min(0.97, Math.max(0.03, p + (rand() - 0.5) * 2 * noise)));
  const total = jittered.reduce((a, b) => a + b, 0);
  return jittered.map((p) => decimalToAmerican(1 / ((p / total) * (1 + margin))));
}

export class DemoOddsProvider implements OddsProvider {
  readonly source = "demo" as const;

  constructor(private readonly now: () => Date = () => new Date()) {}

  async listSports(): Promise<Sport[]> {
    return FEATURED_SPORTS;
  }

  async getOdds(sportKey: string): Promise<OddsEvent[]> {
    const teams = DEMO_TEAMS[sportKey];
    if (!teams) return [];
    const sport = FEATURED_SPORTS.find((s) => s.key === sportKey)!;
    const now = this.now();
    // Re-seed every 6 hours so the board changes over time but not on every pull-to-refresh.
    const epoch = Math.floor(now.getTime() / (6 * 3_600_000));
    const rand = rng(hash(`${sportKey}:${epoch}`));
    const isSoccer = sportKey.startsWith("soccer_");
    const isMma = sportKey.startsWith("mma_");
    const events: OddsEvent[] = [];

    for (let i = 0; i + 1 < teams.length; i += 2) {
      const home = teams[i]!;
      const away = teams[i + 1]!;
      const start = new Date(now.getTime() + (2 + Math.floor(rand() * 70)) * 3_600_000);
      const homeWin = 0.3 + rand() * 0.45;
      const draw = isSoccer ? 0.22 + rand() * 0.08 : 0;
      const h2hTrue = isSoccer
        ? [homeWin * (1 - draw), (1 - homeWin) * (1 - draw), draw]
        : [homeWin, 1 - homeWin];
      const h2hNames = isSoccer ? [home, away, "Draw"] : [home, away];
      const rawSpread = (0.5 - homeWin) * (isSoccer ? 4 : 28);
      const usesRunLine = sportKey === "baseball_mlb" || sportKey === "icehockey_nhl";
      const spread = usesRunLine
        ? (homeWin > 0.5 ? -1.5 : 1.5)
        : Math.sign(rawSpread || -1) * (Math.max(isSoccer ? 0 : 1, Math.floor(Math.abs(rawSpread))) + 0.5);
      const total = sportKey.includes("basketball") ? 220.5 + Math.round(rand() * 20)
        : sportKey.includes("football") ? 44.5 + Math.round(rand() * 8)
        : sportKey === "baseball_mlb" ? 8.5
        : sportKey === "icehockey_nhl" ? 6.5
        : 2.5;
      const overTrue = 0.44 + rand() * 0.12;
      // One soft book per event lags the market, which is what creates real-world value.
      const staleBook = Math.floor(rand() * DEMO_BOOKS.length);

      const bookmakers = DEMO_BOOKS.map((b, bi) => {
        const lag = bi === staleBook && b.key !== "pinnacle" ? 0.02 + rand() * 0.015 : 0;
        const brand = rng(hash(`${sportKey}:${epoch}:${i}:${b.key}`));
        const shift = (probs: number[]) => {
          if (lag === 0) return probs;
          const out = probs.slice();
          out[0] = out[0]! - lag;
          out[1] = out[1]! + lag;
          return out;
        };
        const h2h = priceMarket(shift(h2hTrue), b.margin, b.noise, brand);
        const markets: OddsEvent["bookmakers"][number]["markets"] = [
          { key: "h2h", outcomes: h2hNames.map((name, k) => ({ name, price: h2h[k]! })) },
        ];
        if (!isMma) {
          const sp = priceMarket(shift([0.5, 0.5]), b.margin, b.noise, brand);
          markets.push({
            key: "spreads",
            outcomes: [
              { name: home, price: sp[0]!, point: spread },
              { name: away, price: sp[1]!, point: -spread },
            ],
          });
          const tot = priceMarket(shift([overTrue, 1 - overTrue]), b.margin, b.noise, brand);
          markets.push({
            key: "totals",
            outcomes: [
              { name: "Over", price: tot[0]!, point: total },
              { name: "Under", price: tot[1]!, point: total },
            ],
          });
        }
        return { key: b.key, title: b.title, last_update: now.toISOString(), markets };
      });

      events.push({
        id: `demo-${sportKey}-${epoch}-${i}`,
        sport_key: sportKey,
        sport_title: sport.title,
        commence_time: start.toISOString(),
        home_team: home,
        away_team: away,
        bookmakers,
      });
    }
    return events;
  }
}
