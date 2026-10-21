import { serve } from "@hono/node-server";
import { createApp, depsFromEnv } from "./app.js";

const deps = depsFromEnv();
const port = Number(process.env.PORT ?? 8787);

serve({ fetch: createApp(deps).fetch, port }, () => {
  console.log(
    `Edge API listening on :${port} (odds: ${deps.odds.source}, analysis: ${deps.analyst ? `${deps.analyst.provider} (${deps.analyst.model})` : "rule-based"})`,
  );
});
