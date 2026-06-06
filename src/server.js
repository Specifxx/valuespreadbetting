// ---------------------------------------------------------------------------
// Express web server: serves the dashboard + a JSON API.
// ---------------------------------------------------------------------------

import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { state, runScan } from "./engine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createServer() {
  const app = express();

  // API: latest opportunities + scan metadata.
  app.get("/api/opportunities", (_req, res) => {
    res.json({
      opportunities: state.opportunities,
      lastScan: state.lastScan,
      lastError: state.lastError,
      source: state.source,
      eventsCompared: state.eventsCompared,
      config: state.config,
    });
  });

  // API: trigger an immediate rescan (e.g. the "Refresh" button).
  app.post("/api/scan", async (_req, res) => {
    const opps = await runScan();
    res.json({ ok: true, found: opps.length, lastError: state.lastError });
  });

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // Static frontend.
  app.use(express.static(join(__dirname, "..", "public")));

  return app;
}
