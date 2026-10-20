# Edge: an AI sports betting analyst for iPhone

Edge recommends sports bets that are **priced better than their true odds**, and explains each one in plain language: why the price is good, what the research found, and what could go wrong.

```
┌──────────────┐   HTTPS   ┌──────────────────────────── backend/ ───────────────────────────┐
│  iOS app     │ ────────▶ │  Odds feed ──▶ Value engine ──▶ Claude analyst ──▶ Picks board  │
│  (SwiftUI)   │ ◀──────── │  (The Odds API)  (no-vig math,   (web research,    (cached per   │
└──────────────┘           │                   +EV, Kelly)     verdicts)          sport)      │
                           └─────────────────────────────────────────────────────────────────┘
```

## How it picks bets

Being "intelligent" about betting mostly means being honest about prices. Edge doesn't guess winners; it looks for mispriced lines, which is the approach professional bettors use.

1. **Line shopping.** It pulls moneyline, spread and total prices for every game from many sportsbooks (US books plus Pinnacle, the sharpest reference book).
2. **Fair probability.** For each book it removes the margin (vig) with the *power method*, which handles the favourite-longshot bias better than simple normalisation. It then blends books into a consensus, weighting sharp books (Pinnacle, Circa, BetOnline, exchanges) most. The book offering the best price is left out of its own consensus so a single off-market book can't validate itself.
3. **Expected value.** A price that pays more than the fair probability implies is +EV. Example: fair odds of -104 while FanDuel offers +105 gives about +4.5% EV.
4. **Stake sizing.** Quarter-Kelly on the fair probability, capped at 3% of bankroll. In the app the user picks a risk level that scales this.
5. **Model confidence.** Each candidate gets a 0-100 score from book count, sharp coverage and agreement between books. It is deliberately *suspicious of huge edges*: a 10%+ edge is usually a stale line, not a gift.
6. **AI research (Claude).** The top candidates go to Claude with web search. It checks injuries, lineups, starting pitchers and goalies, weather, rest and news. It then decides whether each edge is real or explained away (for example, a book hasn't moved after a star was ruled out), and returns a verdict (**strong / lean / pass**), a calibrated confidence, reasoning, key factors, risks and sources.

Bets the analyst rejects stay visible under "Reviewed and passed", with the reason.

## Repository layout

```
backend/          TypeScript API (Node 20+, Hono)
  src/lib/odds-math.ts          odds conversion, vig removal, EV, Kelly
  src/services/value-engine.ts  finds +EV prices against the market consensus
  src/services/analyst.ts       Claude research and grading loop, plus "Ask Edge" chat
  src/services/picks-service.ts board building and caching
  src/services/odds-provider.ts The Odds API client and a demo feed
  test/                         vitest unit tests
ios/              SwiftUI app (iOS 17+, SwiftData)
  project.yml                   XcodeGen spec that generates Edge.xcodeproj
  Edge/                         app sources
  EdgeTests/                    unit tests
```

## Running it

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # add keys (both optional for a first run)
npm run dev               # http://localhost:8787
npm test
```

- **No keys:** a demo odds feed and rule-based explanations, so you can build and run the app immediately.
- `ODDS_API_KEY` from [the-odds-api.com](https://the-odds-api.com) turns on live odds. The free tier is enough to try it; a paid plan is needed for production refresh rates.
- `ANTHROPIC_API_KEY` from [platform.claude.com](https://platform.claude.com) turns on AI research and the Ask Edge chat. The analyst uses `claude-opus-5-5` (override with `CLAUDE_MODEL`). It runs at high effort with web search, so a fresh board takes a minute or two and costs API credits. Boards are cached per sport (`PICKS_TTL_MINUTES`) and refreshed in the background.

`npm run dev` and `npm start` load `backend/.env` automatically.

API:

| Endpoint | Purpose |
|---|---|
| `GET /health` | Shows which odds source and analysis mode are active |
| `GET /v1/sports` | Featured sports and whether each is in season |
| `GET /v1/picks?sport=basketball_nba&books=draftkings,fanduel` | Graded picks board. `books` limits where the best price may come from |
| `POST /v1/ask` `{question, history}` | Chat with the analyst, grounded in the current boards |

### 2. iOS app

On a Mac with Xcode 15 or later:

```bash
brew install xcodegen
cd ios
xcodegen            # generates Edge.xcodeproj from project.yml
open Edge.xcodeproj
```

Run on the iPhone simulator with the backend on `localhost:8787`. To use a physical device, enter your Mac's LAN address (for example `http://192.168.1.20:8787`) under **Settings → Server** in the app.

The app has four tabs:
- **Picks.** Sport chips and a ranked board. Each pick shows bet, best odds and book, edge, true win %, a stake sized to your bankroll, a confidence ring and the verdict. Tap a pick for the full reasoning, key factors, risks, prices at every book and sources.
- **Ask Edge.** Chat with the analyst about games, injuries, odds or bankroll strategy.
- **My Bets.** Track bets (stored on-device with SwiftData). Shows record, profit, ROI and *expected* profit, so users judge the process rather than short-term luck.
- **Settings.** Bankroll, risk level, the books you bet at, odds format, and responsible-gambling resources.

First launch shows a 21+ and terms gate.

## Shipping to the App Store

Done already:
- API keys stay on the server, never in the app binary.
- Age gate, "estimates not guarantees" language throughout, and 1-800-GAMBLER / NCPG links.
- `PrivacyInfo.xcprivacy` privacy manifest (UserDefaults reason declared; no tracking or data collection).
- `ITSAppUsesNonExemptEncryption = false` (only standard HTTPS).
- A placeholder 1024×1024 app icon, portrait iPhone layout, light and dark mode.

Still to do:
1. **Deploy the backend** over HTTPS (the Dockerfile works on Fly.io, Render, Railway, Cloud Run and similar). Set the Release `EDGE_API_BASE_URL` in `ios/project.yml`.
2. **Protect the API.** Set `APP_TOKEN` on the server and add an `EdgeAPIToken` key to `Info.plist`. A shipped token can be extracted, so for production add rate limiting and ideally App Attest or a sign-in, because each board refresh spends Claude and odds-API credits.
3. **Apple Developer account:** set `DEVELOPMENT_TEAM` and your bundle id in `project.yml`, then create the app in App Store Connect.
4. **Gambling rules (App Review Guideline 5.3).** Edge gives information only and takes no wagers, so it doesn't need a gambling licence. Still:
   - Answer the age-rating questionnaire honestly about gambling content; expect the top age rating.
   - Consider limiting availability to countries where sports betting is legal.
   - If you later add sportsbook links or affiliate deals, check the guidelines first. Apps that *facilitate* real-money wagering face stricter rules and must be submitted by the licensed operator.
5. **Privacy policy URL** and support URL (required in App Store Connect), plus the App Privacy "nutrition label". The app collects nothing, but chat questions are sent to your server and to Anthropic, so disclose that.
6. **Screenshots** for 6.9" and 6.5" iPhones, a real app icon, and a description that doesn't promise winnings.
7. Test with **TestFlight** before submitting.

## Honest limitations

- No model guarantees profit. Positive-EV betting wins over hundreds of bets, and losing weeks are normal. Sportsbooks may also limit accounts that win consistently.
- Edges are only as good as the odds feed's freshness. Always confirm the price at the book before betting.
- Only pre-game lines are evaluated. Player props and live betting would need additional feeds.
- Next improvements worth building: closing line value (CLV) tracking to measure pick quality, push notifications when a strong edge appears, player props, and a persistent cache (Redis) so multiple server instances share boards.
