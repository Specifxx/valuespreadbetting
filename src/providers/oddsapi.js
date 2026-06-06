// ---------------------------------------------------------------------------
// The Odds API provider (https://the-odds-api.com) — the RELIABLE real-data
// source. One JSON request per sport returns every bookmaker's odds for every
// upcoming + in-play fixture, with consistent team/outcome naming across books
// (so matching is exact). We pull the reference book (bet365, gold standard)
// and the target book (sportsbet) out of each event and hand them to the same
// edge engine used everywhere else.
//
// Why this and not scraping: bet365/sportsbet block scrapers, throttle, and
// change their markup constantly. The Odds API gives a stable, legal feed with
// h2h + line/handicap + totals across 70+ competitions = thousands of markets,
// including games already in play.
//
// Get a free key at https://the-odds-api.com (free tier = 500 credits/month).
// Cost per scan = (#sports) x (#markets) x (#regions) credits. See README for
// the quota maths and recommended poll interval.
// ---------------------------------------------------------------------------

import { getJsonMeta } from "./http.js";

const BASE = "https://api.the-odds-api.com/v4";

// Map friendly sport keys -> The Odds API sport keys. Unknown keys are passed
// through unchanged, so you can also use raw Odds API keys in SPORTS directly.
const SPORT_KEYS = {
  afl: "aussierules_afl",
  nrl: "rugbyleague_nrl",
  nba: "basketball_nba",
  nfl: "americanfootball_nfl",
  nhl: "icehockey_nhl",
  mlb: "baseball_mlb",
  soccer_epl: "soccer_epl",
  soccer_aleague: "soccer_australia_aleague",
  cricket: "cricket_icc_world_cup",
  ufc: "mma_mixed_martial_arts",
};

const MARKET_NAMES = {
  h2h: "Head to Head",
  spreads: "Line / Handicap",
  totals: "Total (Over/Under)",
};

/**
 * @param {object} config
 * @returns {Promise<{reference: Array, targets: Array, source: string, meta: object}>}
 */
export async function getOddsApiSnapshot(config) {
  if (!config.oddsApiKey) {
    throw new Error(
      "ODDS_API_KEY is not set. Get a free key at https://the-odds-api.com " +
        "and put it in your .env",
    );
  }

  const refEvents = [];
  const targetMap = new Map(); // bookKey -> { key, title, events: [] }
  let remaining = null;
  let inPlayCount = 0;
  let referenceTitle = config.referenceBooks?.[0] ?? "Reference";

  for (const sport of config.sports) {
    const sportKey = SPORT_KEYS[sport] ?? sport;
    const url =
      `${BASE}/sports/${sportKey}/odds/` +
      `?apiKey=${encodeURIComponent(config.oddsApiKey)}` +
      `&regions=${encodeURIComponent(config.oddsApiRegions)}` +
      `&markets=${encodeURIComponent(config.oddsApiMarkets)}` +
      `&oddsFormat=decimal&dateFormat=iso`;

    let events;
    try {
      const res = await getJsonMeta(url, { timeoutMs: 15000 });
      events = res.body;
      if (res.remaining != null) remaining = res.remaining;
    } catch (err) {
      console.warn(`[oddsapi] ${sport} (${sportKey}): ${err.message}`);
      continue;
    }

    const now = Date.now();
    for (const ev of events) {
      const ref = pickBook(ev.bookmakers, config.referenceBooks);
      if (!ref) continue; // need the gold standard quoting this game
      referenceTitle = ref.title;

      const isLive = new Date(ev.commence_time).getTime() <= now;
      if (isLive) inPlayCount++;
      refEvents.push(toCanonical(sport, ev, ref, isLive));

      // Add a canonical event for every configured target book that's present
      // (skip the reference book itself — never bet against yourself).
      for (const book of ev.bookmakers ?? []) {
        if (book.key === ref.key) continue;
        if (!config.targetBooks.includes(book.key)) continue;
        if (!targetMap.has(book.key)) {
          targetMap.set(book.key, { key: book.key, title: book.title, events: [] });
        }
        targetMap.get(book.key).events.push(toCanonical(sport, ev, book, isLive));
      }
    }
  }

  const targets = [...targetMap.values()];
  if (remaining != null) {
    console.log(
      `[oddsapi] ${refEvents.length} ref events · ${targets.length} books ` +
        `(${inPlayCount} in-play) · credits remaining: ${remaining}`,
    );
  }

  return {
    reference: refEvents,
    referenceTitle,
    targets,
    source: "oddsapi",
    meta: { creditsRemaining: remaining, inPlayCount, booksCompared: targets.length },
  };
}

/** Pick the first available book from a priority list (e.g. bet365 then pinnacle). */
function pickBook(bookmakers, priority) {
  const list = bookmakers ?? [];
  for (const key of priority) {
    const found = list.find((b) => b.key === key);
    if (found) return found;
  }
  return null;
}

/** Reshape one Odds API bookmaker block into our canonical event format. */
function toCanonical(sport, ev, book, isLive) {
  const markets = (book.markets ?? [])
    .map((m) => ({
      key: m.key,
      name: MARKET_NAMES[m.key] ?? m.key,
      outcomes: (m.outcomes ?? [])
        .map((o) => ({
          name: o.name,
          odds: Number(o.price),
          point: o.point ?? null,
        }))
        .filter((o) => Number.isFinite(o.odds) && o.odds > 1),
    }))
    .filter((m) => m.outcomes.length >= 2);

  return {
    sport,
    league: ev.sport_title ?? null,
    homeTeam: ev.home_team,
    awayTeam: ev.away_team,
    commenceTime: ev.commence_time,
    inPlay: isLive,
    bookTitle: book.title,
    markets,
  };
}
