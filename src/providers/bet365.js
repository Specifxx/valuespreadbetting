// ---------------------------------------------------------------------------
// bet365 scraper (gold standard).
//
// bet365 is the HARDEST mainstream book to scrape:
//   * It pushes odds over an obfuscated WebSocket, not plain JSON REST.
//   * It fingerprints/blocks headless browsers and datacentre IPs.
//   * It geo-restricts by region.
//
// Because of that, a reliable bet365 scraper needs a real, non-headless browser
// session (e.g. Playwright with stealth) reading the rendered DOM. That browser
// dependency is intentionally NOT bundled here (heavy, and pointless on a
// network that can't reach bet365). This module gives you a clean seam to plug
// it in, plus a working DOM-parse helper you can drive from Playwright.
//
// To enable live bet365:
//   1) npm i playwright   &&   npx playwright install chromium
//   2) implement fetchPageHtml() below using a Playwright page.content()
//      after navigating to the competition page and waiting for odds to render.
//   3) point parseBet365Html() at the rendered markup.
//
// Until then, getBet365Events() throws a clear, actionable error so the app
// falls back / reports the reason instead of silently returning nothing.
// ---------------------------------------------------------------------------

/**
 * @param {string[]} sports
 * @returns {Promise<Array>} canonical events
 */
export async function getBet365Events(sports) {
  throw new Error(
    "bet365 live scraping is not enabled. bet365 requires a real (non-headless) " +
      "browser session via Playwright — see src/providers/bet365.js for the seam " +
      "to implement, or run with ODDS_SOURCE=demo. (sports requested: " +
      sports.join(", ") +
      ")",
  );
}

/**
 * Parse rendered bet365 HTML for a competition into canonical events.
 * Exposed + exported so it can be unit-tested and reused once you wire up
 * Playwright. Selectors are bet365's class-name conventions and DO drift —
 * update them against the live DOM if parsing returns nothing.
 *
 * @param {string} html - fully-rendered competition page HTML
 * @param {string} sport
 * @returns {Array} canonical events
 */
export function parseBet365Html(html, sport) {
  // Intentionally minimal: bet365's DOM is column-based (one column of fixture
  // names, parallel columns of odds) which needs positional pairing. This is a
  // skeleton showing the shape — flesh out with the live markup.
  void html;
  void sport;
  return [];
}
