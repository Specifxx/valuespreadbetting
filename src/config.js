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
};
