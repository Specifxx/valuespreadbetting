// ---------------------------------------------------------------------------
// Provider selector. Returns a snapshot of { bet365, sportsbet } events
// depending on config.oddsSource.
// ---------------------------------------------------------------------------

import { getDemoSnapshot } from "./demo.js";
import { getSportsbetEvents } from "./sportsbet.js";
import { getBet365Events } from "./bet365.js";
import { getOddsApiSnapshot } from "./oddsapi.js";

/**
 * @param {object} config
 * @returns {Promise<{ bet365: Array, sportsbet: Array, source: string }>}
 */
export async function getSnapshot(config) {
  // Recommended real-data path: The Odds API (reliable, legal, thousands of
  // markets across many sports, includes in-play games).
  if (config.oddsSource === "oddsapi") {
    return getOddsApiSnapshot(config);
  }

  if (config.oddsSource === "live") {
    // Fetch both books in parallel; surface either failure clearly.
    const [bet365, sportsbet] = await Promise.all([
      getBet365Events(config.sports),
      getSportsbetEvents(config.sports),
    ]);
    return { bet365, sportsbet, source: "live" };
  }

  // default: demo
  const { bet365, sportsbet } = getDemoSnapshot();
  return { bet365, sportsbet, source: "demo" };
}
