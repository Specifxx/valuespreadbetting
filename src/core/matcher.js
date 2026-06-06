// ---------------------------------------------------------------------------
// Event & market matching.
//
// bet365 and sportsbet describe the "same" game differently (team name
// spelling, kickoff time rounding, market naming). To compare like-for-like
// we normalise both sides into a canonical key and pair them up.
// ---------------------------------------------------------------------------

/** Strip a team name down to a comparable token. */
export function normaliseTeam(name) {
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // drop accents
    .replace(/\b(fc|afc|cf|sc)\b/g, "") // drop common club suffixes
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Canonical key for an event: sport + sorted team names + kickoff hour bucket.
 * Using a sorted team set makes "A vs B" match "B vs A".
 */
export function eventKey(event) {
  const teams = [normaliseTeam(event.homeTeam), normaliseTeam(event.awayTeam)]
    .sort()
    .join(" | ");
  const hour = bucketTime(event.commenceTime);
  return `${event.sport}::${teams}::${hour}`;
}

/** Round an ISO timestamp to the hour so minor schedule differences still match. */
function bucketTime(commenceTime) {
  if (!commenceTime) return "";
  const d = new Date(commenceTime);
  if (Number.isNaN(d.getTime())) return "";
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

/**
 * Match events from two books.
 * @param {Array} goldEvents - bet365 events
 * @param {Array} betEvents  - sportsbet events
 * @returns {Array<{gold, bet}>} paired events present in BOTH books
 */
export function matchEvents(goldEvents, betEvents) {
  const betByKey = new Map();
  for (const e of betEvents) betByKey.set(eventKey(e), e);

  const pairs = [];
  for (const gold of goldEvents) {
    const bet = betByKey.get(eventKey(gold));
    if (bet) pairs.push({ gold, bet });
  }
  return pairs;
}

/**
 * Within a matched event, pair markets that exist in both books by market key.
 * @returns {Array<{marketKey, marketName, gold, bet}>}
 */
export function matchMarkets(goldEvent, betEvent) {
  const betByKey = new Map((betEvent.markets ?? []).map((m) => [m.key, m]));
  const pairs = [];
  for (const gm of goldEvent.markets ?? []) {
    const bm = betByKey.get(gm.key);
    if (bm) {
      pairs.push({
        marketKey: gm.key,
        marketName: gm.name ?? gm.key,
        gold: gm,
        bet: bm,
      });
    }
  }
  return pairs;
}
