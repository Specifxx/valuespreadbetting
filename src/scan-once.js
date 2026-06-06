// One-shot scan for cron jobs / debugging: scans once, prints results, exits.

import { runScan, state } from "./engine.js";

const opps = await runScan();
console.log(JSON.stringify({ found: opps.length, lastError: state.lastError, opportunities: opps }, null, 2));
process.exit(0);
