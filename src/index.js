// Entry point: start the web server and the polling engine.

import { config } from "./config.js";
import { createServer } from "./server.js";
import { startPolling } from "./engine.js";

const app = createServer();

app.listen(config.port, () => {
  console.log(
    `\n  Value Spread Betting running at http://localhost:${config.port}\n` +
      `  Source: ${config.oddsSource} · edge threshold: ${(
        config.edgeThreshold * 100
      ).toFixed(1)}% · poll every ${config.pollIntervalSeconds}s\n` +
      `  Discord alerts: ${config.discordWebhookUrl ? "ON" : "OFF (set DISCORD_WEBHOOK_URL)"}\n`,
  );
});

startPolling();
