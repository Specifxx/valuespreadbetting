// ---------------------------------------------------------------------------
// Core odds math.
//
// The whole strategy: bet365 is treated as the "true" market. We convert its
// decimal odds into real probabilities (after removing the bookmaker margin),
// then ask: given that true probability, is sportsbet's price generous enough
// that betting it has positive expected value above our threshold?
// ---------------------------------------------------------------------------

/**
 * Implied probability from a single decimal odd, BEFORE margin removal.
 * Decimal odds of 1.50 imply 1/1.50 = 66.67%.
 */
export function impliedProbability(decimalOdds) {
  if (!(decimalOdds > 1)) {
    throw new Error(`Decimal odds must be > 1, got ${decimalOdds}`);
  }
  return 1 / decimalOdds;
}

/**
 * Remove the bookmaker margin ("vig"/"overround") from a set of decimal odds
 * for the mutually-exclusive outcomes of ONE market, returning normalised
 * "true" probabilities that sum to 1.
 *
 * Bookmakers price every outcome a little short so the implied probabilities
 * sum to >1 (the overround). Proportional / multiplicative de-vigging scales
 * each implied probability down by the overround.
 *
 * @param {number[]} decimalOddsList - odds for each outcome of one market
 * @param {string} method - "multiplicative" (default) or "none"
 * @returns {number[]} probabilities summing to ~1 (or raw 1/odds if "none")
 */
export function devig(decimalOddsList, method = "multiplicative") {
  const implied = decimalOddsList.map(impliedProbability);
  if (method === "none") return implied;

  const overround = implied.reduce((a, b) => a + b, 0);
  if (overround <= 0) throw new Error("Invalid overround");
  return implied.map((p) => p / overround);
}

/**
 * The bookmaker margin (overround) as a fraction. e.g. 0.05 = 5% margin.
 */
export function overround(decimalOddsList) {
  const implied = decimalOddsList.map(impliedProbability);
  return implied.reduce((a, b) => a + b, 0) - 1;
}

/**
 * Edge (expected value per $1 staked) of backing an outcome at `betOdds`
 * when the true probability of that outcome is `trueProb`.
 *
 *   EV per $1 = trueProb * betOdds - 1
 *
 * A positive number is a +EV bet. 0.05 means +5% expected return.
 */
export function edge(trueProb, betOdds) {
  return trueProb * betOdds - 1;
}

/**
 * Fair odds for a given true probability (what a 0-margin book would offer).
 */
export function fairOdds(trueProb) {
  return 1 / trueProb;
}

/**
 * Kelly-criterion optimal stake fraction of bankroll for a +EV bet.
 * f* = (b*p - q) / b, where b = betOdds - 1, p = trueProb, q = 1 - p.
 * Clamped at 0 (never returns a negative/"lay" stake).
 */
export function kellyFraction(trueProb, betOdds) {
  const b = betOdds - 1;
  const q = 1 - trueProb;
  const f = (b * trueProb - q) / b;
  return Math.max(0, f);
}

/**
 * A market outcome's identity for cross-book matching. For Head-to-Head this
 * is just the (normalised) name. For Line/Handicap and Totals markets the
 * handicap/total point is part of the identity — "Broncos +4.5" must only be
 * compared with "Broncos +4.5", never "+6.5".
 */
export function outcomeKey(o) {
  const base = normaliseOutcomeName(o.name);
  return o.point == null || o.point === "" ? base : `${base}@${o.point}`;
}

/**
 * Given the full bet365 market (gold standard) and the matching sportsbet
 * market, compute the edge for backing EACH outcome on sportsbet.
 *
 * Outcomes are grouped by their line (`point`) before de-vigging, so each
 * coherent two-way market (e.g. Over/Under 52.5) is normalised on its own and
 * alternate lines are never blended together. Works for h2h, spreads, totals.
 *
 * @param {Array<{name:string, odds:number, point?:number}>} goldOutcomes
 * @param {Array<{name:string, odds:number, point?:number}>} betOutcomes
 * @param {object} opts
 * @param {string} opts.devigMethod
 * @returns {Array<{name, point, goldOdds, betOdds, trueProb, fairOdds, edge, kelly}>}
 */
export function evaluateMarket(goldOutcomes, betOutcomes, opts = {}) {
  const devigMethod = opts.devigMethod ?? "multiplicative";

  // group gold outcomes by line so we de-vig within one coherent market
  const groups = new Map();
  for (const o of goldOutcomes) {
    const k = o.point == null ? "__none__" : String(o.point);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(o);
  }

  const betByKey = new Map(betOutcomes.map((o) => [outcomeKey(o), o.odds]));

  const results = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue; // need the full market to remove the vig
    const trueProbs = devig(
      group.map((o) => o.odds),
      devigMethod,
    );
    group.forEach((gold, i) => {
      const betOdds = betByKey.get(outcomeKey(gold));
      if (betOdds == null) return; // outcome/line not offered by sportsbet
      const trueProb = trueProbs[i];
      results.push({
        name: gold.name,
        point: gold.point ?? null,
        goldOdds: gold.odds,
        betOdds,
        trueProb,
        fairOdds: fairOdds(trueProb),
        edge: edge(trueProb, betOdds),
        kelly: kellyFraction(trueProb, betOdds),
      });
    });
  }
  return results;
}

/** Normalise an outcome label so "Draw" == "draw" == "The Draw". */
export function normaliseOutcomeName(name) {
  return String(name)
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}
