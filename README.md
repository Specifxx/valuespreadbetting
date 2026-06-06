# Value Spread Betting

Find **+EV betting opportunities** by treating **bet365** as the "true" market
(the gold standard) and comparing it against **sportsbet.com.au**. When
sportsbet's odds are generous enough that betting them has a positive expected
value above your threshold, the opportunity shows on the dashboard and gets
pushed to **Discord**.

> ⚠️ This is an analysis tool, not financial advice. Bookmakers move odds fast
> and routinely limit or void winning value bettors. Bet responsibly.

---

## The formula (and why it works)

bet365 is treated as the true market. The steps:

1. **Implied probability** from bet365 decimal odds: `1 / odds`.
   bet365 @ `1.50` → `66.7%`.
2. **Remove the margin (de-vig).** Bookmaker odds are shaded so the implied
   probabilities of all outcomes sum to **more than 100%** (the "overround").
   We scale each outcome down by that overround to get an honest probability:
   `p = (1 / bet365_odds) ÷ overround`. This stops the edge from being inflated.
3. **Edge (expected value) of betting sportsbet:**
   ```
   edge = p × sportsbet_odds − 1
   ```
   An opportunity is shown only when `edge ≥ EDGE_THRESHOLD` (default **5%**).

### Your example
bet365 `1.50` vs sportsbet `2.50` for the same outcome:
- de-vigged true probability ≈ `0.647`
- edge ≈ `0.647 × 2.50 − 1 = +61.8%`

So yes — if bet365 says `1.50` and sportsbet says `2.50`, sportsbet has badly
mispriced it and you're betting with a large edge. The tool surfaces exactly
these, down to your 5% cutoff. (See `src/test/odds.test.js` — this case is a
test.)

The dashboard also shows the **Kelly stake** (optimal % of bankroll) for each
opportunity.

---

## Quick start

```bash
npm install
cp .env.example .env       # then edit .env
npm start                  # dashboard at http://localhost:3000
```

Out of the box it runs in **demo mode** with realistic sample odds (works
offline) so you can see the dashboard, the formula, and Discord alerts working
immediately.

Run the tests (proves the math):
```bash
npm test
```

Do a single scan from the terminal (handy for cron):
```bash
npm run scan
```

---

## Configuration (`.env`)

| Variable | Meaning | Default |
| --- | --- | --- |
| `PORT` | Web server port | `3000` |
| `POLL_INTERVAL_SECONDS` | How often to rescan odds | `120` |
| `EDGE_THRESHOLD` | Minimum edge to count (`0.05` = 5%) | `0.05` |
| `ODDS_SOURCE` | `demo` or `live` | `demo` |
| `DISCORD_WEBHOOK_URL` | Discord Incoming Webhook (blank = off) | — |
| `SPORTS` | Comma list, e.g. `afl,nrl,soccer_epl` | `afl,nrl,soccer_epl` |
| `DEVIG_METHOD` | `multiplicative` or `none` | `multiplicative` |

### Discord alerts
1. Discord → **Server Settings → Integrations → Webhooks → New Webhook**.
2. Copy the URL into `DISCORD_WEBHOOK_URL` in `.env`.
3. You'll get a rich embed for each **new** opportunity (the tool de-dupes, so
   you aren't spammed with the same bet every scan — it only re-alerts if an
   existing edge grows by 2+ points).

---

## Going live (real odds)

Set `ODDS_SOURCE=live`. Two scrapers are involved:

### sportsbet (`src/providers/sportsbet.js`)
Hits sportsbet's internal JSON API and reshapes it to the canonical format.
- Run it from a network that can reach `sportsbet.com.au` (an Australian IP
  works best; many cloud/datacentre IPs are blocked).
- The thing most likely to need updating over time is `COMPETITION_IDS` and the
  JSON field names in `parseEvents()` — sportsbet changes these periodically.
  Open the sportsbet site with your browser dev-tools Network tab, find the
  competition/events request, and copy the current ids/fields.

### bet365 (`src/providers/bet365.js`)
bet365 is the hardest mainstream book to scrape: odds stream over an obfuscated
WebSocket, it fingerprints/blocks headless browsers, and it geo-restricts. A
reliable scraper needs a **real (non-headless) browser** via Playwright. The
module documents the exact seam to implement (`fetchPageHtml` + `parseBet365Html`).
That heavy browser dependency is intentionally not bundled.

> Because this environment couldn't reach the betting sites, the live scrapers
> are written and structured but were verified only against their documented
> response shapes — expect to tune selectors/ids on first real run. The core
> math, matching, dashboard, and Discord flow are fully tested.

If scraping bet365 proves too brittle, the cleanest alternative is to swap the
data layer for an aggregator like **the-odds-api.com** (it returns bet365 and
sportsbet for the same fixtures as JSON). Everything downstream of
`getSnapshot()` stays the same.

---

## How it's wired

```
providers/  -> fetch bet365 + sportsbet odds  (demo | live scrapers)
core/odds   -> de-vig + edge + Kelly math      (unit tested)
core/matcher-> pair the same game/market across both books
core/opportunities -> build & rank the value bets
engine      -> scan loop: fetch → find → store → Discord
notify/     -> Discord webhook + de-dup store
server      -> Express API + static dashboard
public/     -> the dashboard (HTML/CSS/JS)
```

## API

| Endpoint | Description |
| --- | --- |
| `GET /api/opportunities` | Latest opportunities + scan metadata |
| `POST /api/scan` | Trigger an immediate rescan |
| `GET /api/health` | Health check |
