// ---------------------------------------------------------------------------
// Tiny JSON-file store remembering which opportunity ids we've already alerted
// on, so Discord only fires for NEW opportunities (and re-alerts if an old one
// reappears later with a materially better edge).
// ---------------------------------------------------------------------------

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const FILE = new URL("../../data/notified.json", import.meta.url).pathname;

let cache = null;

async function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(FILE, "utf8"));
  } catch {
    cache = {}; // id -> { edge, notifiedAt }
  }
  return cache;
}

async function persist() {
  await mkdir(dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(cache, null, 2));
}

/**
 * Filter a list of opportunities down to those we should alert on:
 * brand new ids, or previously-seen ids whose edge has grown by >2 points.
 */
export async function selectNewOpportunities(opportunities) {
  const seen = await load();
  const fresh = [];
  for (const opp of opportunities) {
    const prior = seen[opp.id];
    const isNew = !prior;
    const muchBetter = prior && opp.edge - prior.edge >= 0.02;
    if (isNew || muchBetter) fresh.push(opp);
  }
  return fresh;
}

/** Record that we've alerted on these opportunities. */
export async function markNotified(opportunities) {
  const seen = await load();
  const now = new Date().toISOString();
  for (const opp of opportunities) {
    seen[opp.id] = { edge: opp.edge, notifiedAt: now };
  }
  await persist();
}

/** Forget alerts older than `maxAgeHours` so reappearing value re-alerts. */
export async function pruneOld(maxAgeHours = 48) {
  const seen = await load();
  const cutoff = Date.now() - maxAgeHours * 3600_000;
  for (const [id, rec] of Object.entries(seen)) {
    if (new Date(rec.notifiedAt).getTime() < cutoff) delete seen[id];
  }
  await persist();
}
