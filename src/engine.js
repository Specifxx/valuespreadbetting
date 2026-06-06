// ---------------------------------------------------------------------------
// The engine: one scan = fetch odds -> find value -> remember -> alert Discord.
// Holds the latest results in memory for the web API to serve.
// ---------------------------------------------------------------------------

import { config } from "./config.js";
import { getSnapshot } from "./providers/index.js";
import { findOpportunities } from "./core/opportunities.js";
import { sendDiscordAlerts } from "./notify/discord.js";
import { selectNewOpportunities, markNotified, pruneOld } from "./notify/store.js";

// Shared, in-memory view of the most recent scan.
export const state = {
  opportunities: [],
  lastScan: null,
  lastError: null,
  source: config.oddsSource,
  eventsCompared: 0,
  meta: {},
  config: {
    referenceBook: config.referenceBooks?.[0] ?? null,
    targetBook: config.targetBook,
    markets: config.oddsApiMarkets,
    edgeThreshold: config.edgeThreshold,
    devigMethod: config.devigMethod,
    pollIntervalSeconds: config.pollIntervalSeconds,
    sports: config.sports,
    discordEnabled: Boolean(config.discordWebhookUrl),
  },
};

/** Run a single scan. Returns the opportunities found. */
export async function runScan() {
  try {
    const { bet365, sportsbet, source, meta } = await getSnapshot(config);
    const opportunities = findOpportunities(bet365, sportsbet, {
      edgeThreshold: config.edgeThreshold,
      devigMethod: config.devigMethod,
    });

    state.opportunities = opportunities;
    state.lastScan = new Date().toISOString();
    state.lastError = null;
    state.source = source;
    state.meta = meta ?? {};
    state.eventsCompared = Math.min(bet365.length, sportsbet.length);

    // Discord: only NEW opportunities.
    await pruneOld(48);
    const fresh = await selectNewOpportunities(opportunities);
    if (fresh.length > 0) {
      const result = await sendDiscordAlerts(config.discordWebhookUrl, fresh);
      if (result.sent > 0) await markNotified(fresh);
      console.log(
        `[scan] ${opportunities.length} value bet(s), ${fresh.length} new, ` +
          `${result.sent ?? 0} sent to Discord`,
      );
    } else {
      console.log(`[scan] ${opportunities.length} value bet(s), 0 new`);
    }

    return opportunities;
  } catch (err) {
    state.lastError = err.message;
    state.lastScan = new Date().toISOString();
    console.error(`[scan] failed: ${err.message}`);
    return [];
  }
}

/** Start the recurring poll loop. */
export function startPolling() {
  runScan(); // immediate first scan
  const ms = config.pollIntervalSeconds * 1000;
  return setInterval(runScan, ms);
}
