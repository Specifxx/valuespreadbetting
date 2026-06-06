// ---------------------------------------------------------------------------
// Demo provider — realistic sample odds that run anywhere (no network needed).
//
// Used for ODDS_SOURCE=demo. It returns a bet365 ("gold") snapshot and a
// sportsbet snapshot for the same fixtures, deliberately containing a mix of:
//   - big mispricings (clear value on sportsbet)
//   - tiny edges below threshold (should be filtered out)
//   - sportsbet pricing the favourite SHORTER than bet365 (no value)
// so you can see the formula and the filtering behave correctly.
//
// Includes the exact example from the brief: bet365 1.50 vs sportsbet 2.50.
// ---------------------------------------------------------------------------

// Kickoffs are generated relative to "now" so the dashboard always looks live.
const inHours = (h) => new Date(Date.now() + h * 3600_000).toISOString();

function h2h(homeOdds, drawOdds, awayOdds, homeName, awayName) {
  const outcomes = [
    { name: homeName, odds: homeOdds },
    { name: awayName, odds: awayOdds },
  ];
  // insert draw in the middle for 3-way markets
  if (drawOdds != null) outcomes.splice(1, 0, { name: "Draw", odds: drawOdds });
  return { key: "h2h", name: "Head to Head", outcomes };
}

export function getDemoSnapshot() {
  // bet365 = gold standard.
  const bet365 = [
    {
      sport: "afl",
      league: "AFL",
      homeTeam: "Collingwood",
      awayTeam: "Carlton",
      commenceTime: inHours(6),
      markets: [h2h(1.5, null, 2.75, "Collingwood", "Carlton")],
    },
    {
      sport: "nrl",
      league: "NRL",
      homeTeam: "Penrith Panthers",
      awayTeam: "Brisbane Broncos",
      commenceTime: inHours(28),
      markets: [h2h(1.8, null, 2.05, "Penrith Panthers", "Brisbane Broncos")],
    },
    {
      sport: "soccer_epl",
      league: "EPL",
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      commenceTime: inHours(50),
      markets: [h2h(2.1, 3.4, 3.6, "Arsenal", "Chelsea")],
    },
    {
      sport: "afl",
      league: "AFL",
      homeTeam: "Geelong Cats",
      awayTeam: "Sydney Swans",
      commenceTime: inHours(72),
      markets: [h2h(1.65, null, 2.3, "Geelong Cats", "Sydney Swans")],
    },
  ];

  // sportsbet = where we place the bet.
  const sportsbet = [
    {
      // EXACT brief example: bet365 1.50, sportsbet 2.50 -> huge value.
      sport: "afl",
      league: "AFL",
      homeTeam: "Collingwood",
      awayTeam: "Carlton",
      commenceTime: inHours(6),
      markets: [h2h(2.5, null, 2.7, "Collingwood", "Carlton")],
    },
    {
      // Small but real edge on Brisbane: bet365 implies ~lower true prob,
      // sportsbet pays a bit more.
      sport: "nrl",
      league: "NRL",
      homeTeam: "Penrith Panthers",
      awayTeam: "Brisbane Broncos",
      commenceTime: inHours(28),
      markets: [h2h(1.82, null, 2.25, "Penrith Panthers", "Brisbane Broncos")],
    },
    {
      // No value: sportsbet prices everything at/under bet365 -> filtered out.
      sport: "soccer_epl",
      league: "EPL",
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      commenceTime: inHours(50),
      markets: [h2h(2.0, 3.3, 3.4, "Arsenal", "Chelsea")],
    },
    {
      // Sub-threshold edge (~2-3%) on Sydney -> should NOT appear at 5%.
      sport: "afl",
      league: "AFL",
      homeTeam: "Geelong Cats",
      awayTeam: "Sydney Swans",
      commenceTime: inHours(72),
      markets: [h2h(1.66, null, 2.38, "Geelong Cats", "Sydney Swans")],
    },
  ];

  // A second AU book (TAB) — demonstrates multi-book scanning. It prices
  // Geelong more generously than bet365's fair line, so at a 3% threshold a
  // value bet shows up on TAB that sportsbet didn't offer.
  const tab = [
    {
      sport: "afl",
      league: "AFL",
      homeTeam: "Geelong Cats",
      awayTeam: "Sydney Swans",
      commenceTime: inHours(72),
      markets: [h2h(1.78, null, 2.25, "Geelong Cats", "Sydney Swans")],
    },
    {
      sport: "nrl",
      league: "NRL",
      homeTeam: "Penrith Panthers",
      awayTeam: "Brisbane Broncos",
      commenceTime: inHours(28),
      markets: [h2h(1.8, null, 2.1, "Penrith Panthers", "Brisbane Broncos")],
    },
  ];

  return { bet365, sportsbet, tab };
}
