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

test("findOpportunities filters by 5% threshold and sorts by edge", () => {
  const { bet365, sportsbet } = getDemoSnapshot();
  const opps = findOpportunities(bet365, sportsbet, {
    edgeThreshold: 0.05,
    devigMethod: "multiplicative",
  });

  // every returned opp clears the threshold
  for (const o of opps) assert.ok(o.edge >= 0.05);
  // sorted descending
  for (let i = 1; i < opps.length; i++) {
    assert.ok(opps[i - 1].edge >= opps[i].edge);
  }
  // the Collingwood 2.50 example must be the top opportunity
  assert.ok(opps.length >= 1);
  assert.equal(opps[0].selection, "Collingwood");
  assert.equal(opps[0].sportsbetOdds, 2.5);
});

test("the deliberately sub-threshold demo edge is excluded at 5%", () => {
  const { bet365, sportsbet } = getDemoSnapshot();
  const opps = findOpportunities(bet365, sportsbet, { edgeThreshold: 0.05 });
  // Sydney Swans was crafted to sit just under 5% -> should not appear
  assert.ok(!opps.some((o) => o.selection === "Sydney Swans"));
});

test("lowering the threshold surfaces more opportunities", () => {
  const { bet365, sportsbet } = getDemoSnapshot();
  const strict = findOpportunities(bet365, sportsbet, { edgeThreshold: 0.05 });
  const loose = findOpportunities(bet365, sportsbet, { edgeThreshold: 0.01 });
  assert.ok(loose.length >= strict.length);
});
