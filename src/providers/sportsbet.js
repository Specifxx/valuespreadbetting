// ---------------------------------------------------------------------------
// sportsbet.com.au scraper.
//
// sportsbet's website is a single-page app backed by a JSON API. This module
// hits those JSON endpoints and reshapes the response into our canonical event
// format:
//   { sport, league, homeTeam, awayTeam, commenceTime, markets: [...] }
//
// IMPORTANT (read me):
//   * Run this from a machine/network that can reach sportsbet.com.au
//     (an Australian residential/VPN IP works best; cloud IPs are often blocked).
//   * sportsbet changes their internal endpoints/ids periodically. The
//     COMPETITION_IDS map below is the thing most likely to need updating —
//     see findCompetitionIds() for how to discover current ids.
//   * If a sport can't be fetched it is skipped with a warning, never crashes.
// ---------------------------------------------------------------------------

import { getJson } from "./http.js";

const BASE = "https://www.sportsbet.com.au/apigw/sportsbook-sports/Sportsbook";

// Map our internal sport keys -> sportsbet competition id(s).
// These ids come from sportsbet's own URLs/network calls. Update as needed.
const COMPETITION_IDS = {
  afl: ["6004"], // Australian Rules > AFL  (verify on site)
  nrl: ["7720"], // Rugby League > NRL      (verify on site)
  soccer_epl: ["10942509"], // Soccer > England > Premier League (verify)
};

const HEADERS = {
  Origin: "https://www.sportsbet.com.au",
  Referer: "https://www.sportsbet.com.au/",
};

/**
 * Fetch all configured sports and return canonical events.
 * @param {string[]} sports
 */
export async function getSportsbetEvents(sports) {
  const events = [];
  for (const sport of sports) {
    const compIds = COMPETITION_IDS[sport];
    if (!compIds) {
      console.warn(`[sportsbet] no competition id mapped for "${sport}" — skipping`);
      continue;
    }
    for (const compId of compIds) {
      try {
        const fetched = await fetchCompetition(sport, compId);
        events.push(...fetched);
      } catch (err) {
        console.warn(`[sportsbet] failed ${sport}/${compId}: ${err.message}`);
      }
    }
  }
  return events;
}

async function fetchCompetition(sport, competitionId) {
  // The "Events" endpoint returns the fixtures + their head-to-head markets.
  const url =
    `${BASE}/Competitions/${competitionId}/Events` +
    `?displayType=mainMarket&includeBubbles=true`;
  const data = await getJson(url, { headers: HEADERS });
  return parseEvents(sport, data);
}

/**
 * Reshape sportsbet's JSON into canonical events.
 * The shape varies; this handles the common "events[] -> markets[] -> selections[]"
 * structure. Adjust field names here if sportsbet changes their payload.
 */
function parseEvents(sport, data) {
  const rawEvents = data?.events ?? data?.Events ?? [];
  const out = [];

  for (const ev of rawEvents) {
    const homeTeam = ev.homeTeamName ?? ev.competitor1Name ?? ev.participant1;
    const awayTeam = ev.awayTeamName ?? ev.competitor2Name ?? ev.participant2;
    const commenceTime = ev.startTime ?? ev.advertisedStartTime ?? ev.openDate;
    if (!homeTeam || !awayTeam) continue;

    const markets = [];
    const h2h = extractH2H(ev, homeTeam, awayTeam);
    if (h2h) markets.push(h2h);
    if (markets.length === 0) continue;

    out.push({
      sport,
      league: ev.competitionName ?? null,
      homeTeam,
      awayTeam,
      commenceTime,
      markets,
    });
  }
  return out;
}

function extractH2H(ev, homeTeam, awayTeam) {
  const rawMarkets = ev.markets ?? ev.mainMarkets ?? [];
  // find the head-to-head / match-result market
  const market =
    rawMarkets.find((m) =>
      /head to head|match result|h2h|win/i.test(m.name ?? m.marketName ?? ""),
    ) ?? rawMarkets[0];
  if (!market) return null;

  const selections = market.selections ?? market.outcomes ?? [];
  const outcomes = selections
    .map((s) => ({
      name: mapSelectionName(s.name ?? s.selectionName, homeTeam, awayTeam),
      odds: Number(
        s.price?.winPrice ?? s.odds ?? s.priceNum ?? s.returnWin,
      ),
    }))
    .filter((o) => o.name && Number.isFinite(o.odds) && o.odds > 1);

  if (outcomes.length < 2) return null;
  return { key: "h2h", name: "Head to Head", outcomes };
}

// sportsbet sometimes labels selections by team, sometimes "Home"/"Away".
function mapSelectionName(name, homeTeam, awayTeam) {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n === "home" || n === "1") return homeTeam;
  if (n === "away" || n === "2") return awayTeam;
  if (n === "draw" || n === "the draw" || n === "x") return "Draw";
  return name;
}
