import { test } from "node:test";
import assert from "node:assert/strict";
import {
  impliedProbability,
  devig,
  overround,
  edge,
  fairOdds,
  kellyFraction,
  evaluateMarket,
} from "../core/odds.js";
import { findOpportunities } from "../core/opportunities.js";
import { getDemoSnapshot } from "../providers/demo.js";

const approx = (a, b, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("impliedProbability: 1.50 -> 66.67%", () => {
  approx(impliedProbability(1.5), 1 / 1.5);
  approx(impliedProbability(2.0), 0.5);
});

test("impliedProbability rejects odds <= 1", () => {
  assert.throws(() => impliedProbability(1));
  assert.throws(() => impliedProbability(0.9));
});

test("overround of a fair two-way market is ~0", () => {
  approx(overround([2.0, 2.0]), 0);
});

test("overround detects the bookmaker margin", () => {
  // 1.5 & 2.75 -> 0.6667 + 0.3636 = 1.0303 -> ~3.03% margin
  approx(overround([1.5, 2.75]), 1 / 1.5 + 1 / 2.75 - 1);
});

test("devig multiplicative sums to 1", () => {
  const probs = devig([1.5, 2.75], "multiplicative");
  approx(probs.reduce((a, b) => a + b, 0), 1);
});

test("devig none returns raw implied probs", () => {
  const probs = devig([1.5, 2.75], "none");
  approx(probs[0], 1 / 1.5);
  approx(probs[1], 1 / 2.75);
});

test("edge formula: trueProb 0.5 @ 2.5 odds = +25%", () => {
  approx(edge(0.5, 2.5), 0.25);
});

test("fairOdds is the inverse of probability", () => {
  approx(fairOdds(0.25), 4);
});

test("kelly fraction for a +EV bet is positive, -EV is clamped to 0", () => {
  assert.ok(kellyFraction(0.5, 2.5) > 0);
  assert.equal(kellyFraction(0.3, 1.5), 0); // 0.3*1.5-1 = -0.55 EV
});

test("BRIEF EXAMPLE: bet365 1.50 vs sportsbet 2.50 is a big value bet", () => {
  // bet365 market: home 1.50, away 2.75 (gold standard)
  // sportsbet: home 2.50
  const gold = [
    { name: "Home", odds: 1.5 },
    { name: "Away", odds: 2.75 },
  ];
  const bet = [
    { name: "Home", odds: 2.5 },
    { name: "Away", odds: 2.7 },
  ];
  const results = evaluateMarket(gold, bet, { devigMethod: "multiplicative" });
  const home = results.find((r) => r.name === "Home");

  // de-vigged true prob for home ~ 0.6667 / 1.0303 = 0.6471
  approx(home.trueProb, (1 / 1.5) / (1 / 1.5 + 1 / 2.75), 1e-4);
  // edge = trueProb * 2.5 - 1 ~ +61.8%
  assert.ok(home.edge > 0.5, `expected big edge, got ${home.edge}`);
});

test("a favourite priced SHORTER on sportsbet yields no positive edge", () => {
  const gold = [
    { name: "Home", odds: 1.8 },
    { name: "Away", odds: 2.05 },
  ];
  const bet = [
    { name: "Home", odds: 1.7 }, // shorter than bet365 -> no value
    { name: "Away", odds: 1.95 },
  ];
  const results = evaluateMarket(gold, bet);
  for (const r of results) assert.ok(r.edge < 0.05);
});

// Build the standard demo targets list used by the multi-book tests.
function demoTargets() {
  const { sportsbet, tab } = getDemoSnapshot();
  return [
    { key: "sportsbet", title: "Sportsbet", events: sportsbet },
    { key: "tab", title: "TAB", events: tab },
  ];
}

test("findOpportunities filters by threshold and sorts by edge", () => {
  const { bet365 } = getDemoSnapshot();
  const opps = findOpportunities(bet365, demoTargets(), {
    edgeThreshold: 0.05,
    devigMethod: "multiplicative",
  });

  // every returned opp clears the threshold
  for (const o of opps) assert.ok(o.edge >= 0.05);
  // sorted descending
  for (let i = 1; i < opps.length; i++) {
    assert.ok(opps[i - 1].edge >= opps[i].edge);
  }
  // the Collingwood 2.50 example must be the top opportunity, betting Sportsbet
  assert.ok(opps.length >= 1);
  assert.equal(opps[0].selection, "Collingwood");
  assert.equal(opps[0].targetOdds, 2.5);
  assert.equal(opps[0].book, "Sportsbet");
});

test("multi-book: TAB-only value appears at 3% but not at 5%", () => {
  const { bet365 } = getDemoSnapshot();
  const at3 = findOpportunities(bet365, demoTargets(), { edgeThreshold: 0.03 });
  const at5 = findOpportunities(bet365, demoTargets(), { edgeThreshold: 0.05 });

  // Geelong @1.78 on TAB is ~+3.6% value — present at 3%, gone at 5%
  const geeAt3 = at3.find((o) => o.selection === "Geelong Cats");
  assert.ok(geeAt3, "expected Geelong value on TAB at 3%");
  assert.equal(geeAt3.book, "TAB");
  assert.ok(!at5.some((o) => o.selection === "Geelong Cats"));
});

test("totals market: de-vigs per line and matches Over/Under by point", () => {
  // bet365 totals @ 52.5: Over 1.90 / Under 1.95
  const gold = [
    { name: "Over", odds: 1.9, point: 52.5 },
    { name: "Under", odds: 1.95, point: 52.5 },
  ];
  // sportsbet pays Over generously
  const bet = [
    { name: "Over", odds: 2.15, point: 52.5 },
    { name: "Under", odds: 1.85, point: 52.5 },
  ];
  const results = evaluateMarket(gold, bet);
  const over = results.find((r) => r.name === "Over");
  assert.equal(over.point, 52.5);
  assert.ok(over.edge > 0.05, `expected value on Over, got ${over.edge}`);
});

test("line market: never compares mismatched handicaps", () => {
  // gold has the main line -4.5; sportsbet only offers -6.5 -> no comparison
  const gold = [
    { name: "Penrith", odds: 1.91, point: -4.5 },
    { name: "Wests", odds: 1.91, point: 4.5 },
  ];
  const bet = [
    { name: "Penrith", odds: 2.5, point: -6.5 },
    { name: "Wests", odds: 1.5, point: 6.5 },
  ];
  const results = evaluateMarket(gold, bet);
  assert.equal(results.length, 0, "different lines must not be matched");
});

test("alternate lines in one market are de-vigged independently", () => {
  // two coherent two-way totals (50.5 and 55.5) bundled together
  const gold = [
    { name: "Over", odds: 1.8, point: 50.5 },
    { name: "Under", odds: 2.0, point: 50.5 },
    { name: "Over", odds: 2.4, point: 55.5 },
    { name: "Under", odds: 1.55, point: 55.5 },
  ];
  const bet = [
    { name: "Over", odds: 1.85, point: 50.5 },
    { name: "Under", odds: 2.05, point: 50.5 },
    { name: "Over", odds: 2.5, point: 55.5 },
    { name: "Under", odds: 1.6, point: 55.5 },
  ];
  const results = evaluateMarket(gold, bet);
  // each line's two true-probs should sum to ~1 independently
  const byLine = (p) => results.filter((r) => r.point === p);
  for (const p of [50.5, 55.5]) {
    const probs = byLine(p);
    // recompute via trueProb fields present on results
    const sum = probs.reduce((a, r) => a + r.trueProb, 0);
    approx(sum, 1, 1e-9);
  }
});

test("lowering the threshold surfaces more opportunities", () => {
  const { bet365 } = getDemoSnapshot();
  const strict = findOpportunities(bet365, demoTargets(), { edgeThreshold: 0.05 });
  const loose = findOpportunities(bet365, demoTargets(), { edgeThreshold: 0.01 });
  assert.ok(loose.length >= strict.length);
});
