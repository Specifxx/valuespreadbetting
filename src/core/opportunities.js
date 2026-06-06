// ---------------------------------------------------------------------------
// Turn two books' worth of events into a ranked list of value opportunities.
// ---------------------------------------------------------------------------

import { matchEvents, matchMarkets, eventKey } from "./matcher.js";
import { evaluateMarket } from "./odds.js";

/**
 * @param {Array} goldEvents - bet365 events (gold standard)
 * @param {Array} betEvents  - sportsbet events (where we'd place the bet)
 * @param {object} opts
 * @param {number} opts.edgeThreshold - minimum edge (e.g. 0.05)
 * @param {string} opts.devigMethod
 * @returns {Array} opportunities sorted by edge descending
 */
export function findOpportunities(goldEvents, betEvents, opts = {}) {
  const edgeThreshold = opts.edgeThreshold ?? 0.05;
  const devigMethod = opts.devigMethod ?? "multiplicative";

  const opportunities = [];
  const eventPairs = matchEvents(goldEvents, betEvents);

  for (const { gold, bet } of eventPairs) {
    const marketPairs = matchMarkets(gold, bet);
    for (const mp of marketPairs) {
      const evals = evaluateMarket(mp.gold.outcomes, mp.bet.outcomes, {
        devigMethod,
      });
      for (const ev of evals) {
        if (ev.edge >= edgeThreshold) {
          opportunities.push({
            id: opportunityId(gold, mp.marketKey, ev.name),
            sport: gold.sport,
            league: gold.league ?? null,
            event: `${gold.homeTeam} v ${gold.awayTeam}`,
            homeTeam: gold.homeTeam,
            awayTeam: gold.awayTeam,
            commenceTime: gold.commenceTime,
            market: mp.marketName,
            marketKey: mp.marketKey,
            selection: ev.name,
            bet365Odds: round(ev.goldOdds, 3),
            sportsbetOdds: round(ev.betOdds, 3),
            trueProbability: round(ev.trueProb, 4),
            fairOdds: round(ev.fairOdds, 3),
            edge: round(ev.edge, 4),
            edgePct: round(ev.edge * 100, 2),
            kelly: round(ev.kelly, 4),
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  opportunities.sort((a, b) => b.edge - a.edge);
  return opportunities;
}

/** Stable identifier for an opportunity, used for Discord de-duplication. */
export function opportunityId(event, marketKey, selection) {
  return `${eventKey(event)}::${marketKey}::${selection}`
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function round(n, dp) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
