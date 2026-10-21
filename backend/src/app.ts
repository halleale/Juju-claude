import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { logger } from "hono/logger";
import { z } from "zod";
import { boardSummary, ClaudeAnalyst, type AIAnalyst } from "./services/analyst.js";
import { OpenAIAnalyst } from "./services/openai-analyst.js";
import { DemoOddsProvider, FEATURED_SPORTS, TheOddsApiProvider, type OddsProvider } from "./services/odds-provider.js";
import { DISCLAIMER, PicksService } from "./services/picks-service.js";

export interface AppDeps {
  odds: OddsProvider;
  analyst: AIAnalyst | null;
  picks: PicksService;
  /** Shared secret the app sends as a bearer token. Unset = no auth (local dev). */
  appToken?: string;
}

export function depsFromEnv(env: NodeJS.ProcessEnv = process.env): AppDeps {
  const odds = env.ODDS_API_KEY ? new TheOddsApiProvider(env.ODDS_API_KEY, env.ODDS_REGIONS) : new DemoOddsProvider();
  const analyst = analystFromEnv(env);
  const picks = new PicksService(odds, analyst, {
    ttlMs: Number(env.PICKS_TTL_MINUTES ?? 20) * 60_000,
    maxAnalyzed: Number(env.MAX_ANALYZED_PER_SPORT ?? 6),
  });
  return { odds, analyst, picks, appToken: env.APP_TOKEN };
}

/**
 * AI_PROVIDER picks "openai" or "anthropic" explicitly. Otherwise whichever key
 * is set is used (OpenAI first); with neither, picks use rule-based analysis.
 */
export function analystFromEnv(env: NodeJS.ProcessEnv): AIAnalyst | null {
  const provider = env.AI_PROVIDER?.toLowerCase();
  const hasOpenAI = Boolean(env.OPENAI_API_KEY);
  const hasAnthropic = Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN);
  const openai = () => new OpenAIAnalyst(OpenAIAnalyst.client(env.OPENAI_API_KEY));
  if (provider === "openai") return hasOpenAI ? openai() : null;
  if (provider === "anthropic" || provider === "claude") return hasAnthropic ? new ClaudeAnalyst() : null;
  if (hasOpenAI) return openai();
  if (hasAnthropic) return new ClaudeAnalyst();
  return null;
}

const AskBody = z.object({
  question: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .max(20)
    .default([]),
});

export function createApp(deps: AppDeps) {
  const app = new Hono();
  app.use("*", logger());

  app.get("/health", (c) =>
    c.json({ ok: true, odds: deps.odds.source, ai: deps.analyst ? `${deps.analyst.provider}:${deps.analyst.model}` : "rules" }),
  );

  if (deps.appToken) app.use("/v1/*", bearerAuth({ token: deps.appToken }));

  app.get("/v1/sports", async (c) => {
    try {
      return c.json({ sports: await deps.odds.listSports() });
    } catch (err) {
      console.error("[sports]", err);
      return c.json({ sports: FEATURED_SPORTS });
    }
  });

  app.get("/v1/picks", async (c) => {
    const sport = c.req.query("sport");
    if (!sport || !FEATURED_SPORTS.some((s) => s.key === sport)) {
      return c.json({ error: "unknown or missing sport" }, 400);
    }
    const books = (c.req.query("books") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    try {
      return c.json(await deps.picks.getPicks(sport, books));
    } catch (err) {
      console.error("[picks]", err);
      return c.json({ error: "could not load picks right now" }, 502);
    }
  });

  app.post("/v1/ask", async (c) => {
    const body = AskBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid request" }, 400);
    if (!deps.analyst) {
      return c.json({
        answer:
          "The AI analyst isn't configured on this server yet (set OPENAI_API_KEY or ANTHROPIC_API_KEY), so I can't answer questions. The picks board still works using the odds model.",
        sources: [],
        disclaimer: DISCLAIMER,
      });
    }
    try {
      const { answer, sources } = await deps.analyst.ask(
        body.data.question,
        body.data.history,
        boardSummary(deps.picks.cachedPicks()),
      );
      return c.json({ answer, sources, disclaimer: DISCLAIMER });
    } catch (err) {
      console.error("[ask]", err);
      return c.json({ error: "the analyst is unavailable right now" }, 502);
    }
  });

  return app;
}
