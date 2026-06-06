// ---------------------------------------------------------------------------
// Provider selector. Returns a unified snapshot:
//   { reference: Event[], referenceTitle, targets: [{key,title,events}], source, meta }
// where `reference` is the gold-standard book and `targets` is every book we
// want to find value on.
// ---------------------------------------------------------------------------

import { getDemoSnapshot } from "./demo.js";
import { getSportsbetEvents } from "./sportsbet.js";
import { getBet365Events } from "./bet365.js";
import { getOddsApiSnapshot } from "./oddsapi.js";

export async function getSnapshot(config) {
  // Recommended real-data path: The Odds API (reliable, legal, many books and
  // markets across many sports, includes in-play games).
  if (config.oddsSource === "oddsapi") {
    return getOddsApiSnapshot(config);
  }

  if (config.oddsSource === "live") {
    // Experimental scrapers. Reference = bet365, single target = sportsbet.
    const [bet365, sportsbet] = await Promise.all([
      getBet365Events(config.sports),
      getSportsbetEvents(config.sports),
    ]);
    return {
      reference: bet365,
      referenceTitle: "Bet365",
      targets: [{ key: "sportsbet", title: "Sportsbet", events: sportsbet }],
      source: "live",
      meta: {},
    };
  }

  // default: demo (two target books so multi-book scanning is visible offline)
  const { bet365, sportsbet, tab } = getDemoSnapshot();
  return {
    reference: bet365,
    referenceTitle: "Bet365 (demo)",
    targets: [
      { key: "sportsbet", title: "Sportsbet", events: sportsbet },
      { key: "tab", title: "TAB", events: tab },
    ],
    source: "demo",
    meta: { booksCompared: 2 },
  };
}
