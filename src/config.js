import "dotenv/config";

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: num(process.env.PORT, 3000),
  pollIntervalSeconds: num(process.env.POLL_INTERVAL_SECONDS, 120),
  edgeThreshold: num(process.env.EDGE_THRESHOLD, 0.05),
  oddsSource: (process.env.ODDS_SOURCE || "demo").toLowerCase(),
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
  devigMethod: (process.env.DEVIG_METHOD || "multiplicative").toLowerCase(),
  sports: (process.env.SPORTS || "afl,nrl,soccer_epl")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // The Odds API (ODDS_SOURCE=oddsapi)
  oddsApiKey: process.env.ODDS_API_KEY || "",
  oddsApiRegions: process.env.ODDS_API_REGIONS || "au",
  oddsApiMarkets: process.env.ODDS_API_MARKETS || "h2h,spreads,totals",
  // Reference ("gold standard") book, as a priority list — first one present in
  // the feed for a given game wins. bet365 first, Pinnacle as a sharp fallback.
  referenceBooks: (process.env.REFERENCE_BOOK || "bet365,pinnacle")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  // Book we actually place the bet on.
  targetBook: (process.env.TARGET_BOOK || "sportsbet").trim().toLowerCase(),
};
