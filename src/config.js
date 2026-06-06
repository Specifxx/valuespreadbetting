import "dotenv/config";

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: num(process.env.PORT, 3000),
  pollIntervalSeconds: num(process.env.POLL_INTERVAL_SECONDS, 3600),
  edgeThreshold: num(process.env.EDGE_THRESHOLD, 0.03),
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
  // Books we look for value on (we bet at whichever offers the edge).
  // Adding more AU books costs NO extra API credits — one request returns all.
  targetBooks: (
    process.env.TARGET_BOOKS ||
    "sportsbet,tab,neds,ladbrokes_au,pointsbetau,unibet,betright,bluebet,tabtouch,topsport,playup"
  )
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  // Stop auto-scanning once this many API credits remain, to protect your
  // monthly free-tier quota. Manual "Refresh" can still override.
  minCreditsReserve: num(process.env.MIN_CREDITS_RESERVE, 20),
};

/** Credits one oddsapi scan costs: #sports x #markets x #regions. */
export function creditsPerScan(cfg = config) {
  const markets = cfg.oddsApiMarkets.split(",").filter(Boolean).length || 1;
  const regions = cfg.oddsApiRegions.split(",").filter(Boolean).length || 1;
  return cfg.sports.length * markets * regions;
}
