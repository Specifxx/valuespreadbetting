// ---------------------------------------------------------------------------
// Turn a reference book + one or more target books into a ranked list of
// value opportunities. The reference book (bet365 = gold standard) gives the
// "true" odds; every target book is checked for a price generous enough to
// clear the edge threshold. Each opportunity records WHICH book to bet at.
// ---------------------------------------------------------------------------

import { matchEvents, matchMarkets, eventKey } from "./matcher.js";
import { evaluateMarket } from "./odds.js";

/**
 * Find value across many target books at once.
 *
 * @param {Array} referenceEvents - gold-standard events (bet365/pinnacle)
 * @param {Array<{key, title, events}>} targets - target books to check
 * @param {object} opts
 * @param {number} opts.edgeThreshold
 * @param {string} opts.devigMethod
 * @param {string} opts.referenceTitle - e.g. "Bet365"
 * @returns {Array} opportunities sorted by edge descending
 */
export function findOpportunities(referenceEvents, targets, opts = {}) {
  const opportunities = [];
  for (const target of targets) {
    opportunities.push(
      ...findInBook(referenceEvents, target.events, {
        ...opts,
        targetKey: target.key,
        targetTitle: target.title,
      }),
    );
  }
  opportunities.sort((a, b) => b.edge - a.edge);
  return opportunities;
}

/** Compare the reference against a single target book. */
export function findInBook(referenceEvents, bookEvents, opts = {}) {
  const edgeThreshold = opts.edgeThreshold ?? 0.03;
  const devigMethod = opts.devigMethod ?? "multiplicative";
  const referenceTitle = opts.referenceTitle ?? "Reference";
  const targetTitle = opts.targetTitle ?? opts.targetKey ?? "Book";
  const targetKey = opts.targetKey ?? "book";

  const opportunities = [];
  const eventPairs = matchEvents(referenceEvents, bookEvents);

  for (const { gold, bet } of eventPairs) {
    const marketPairs = matchMarkets(gold, bet);
    for (const mp of marketPairs) {
      const evals = evaluateMarket(mp.gold.outcomes, mp.bet.outcomes, {
        devigMethod,
      });
      for (const ev of evals) {
        if (ev.edge >= edgeThreshold) {
          const selection =
            ev.point == null ? ev.name : `${ev.name} ${formatPoint(ev.point)}`;
          opportunities.push({
            id: opportunityId(gold, mp.marketKey, selection, targetKey),
            sport: gold.sport,
            league: gold.league ?? null,
            event: `${gold.homeTeam} v ${gold.awayTeam}`,
            homeTeam: gold.homeTeam,
            awayTeam: gold.awayTeam,
            commenceTime: gold.commenceTime,
            inPlay: Boolean(gold.inPlay),
            market: mp.marketName,
            marketKey: mp.marketKey,
            selection,
            point: ev.point,
            book: targetTitle, // where you place the bet
            bookKey: targetKey,
            referenceBook: referenceTitle,
            referenceOdds: round(ev.goldOdds, 3),
            targetOdds: round(ev.betOdds, 3),
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
  return opportunities;
}

/** Stable identifier for an opportunity, used for Discord de-duplication. */
export function opportunityId(event, marketKey, selection, bookKey = "") {
  return `${eventKey(event)}::${marketKey}::${selection}::${bookKey}`
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function round(n, dp) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** "+4.5" / "-6.5" for handicaps, plain number for totals lines. */
function formatPoint(point) {
  return point > 0 ? `+${point}` : `${point}`;
}
