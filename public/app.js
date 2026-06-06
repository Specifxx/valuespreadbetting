// Dashboard logic: poll the API, render the opportunities table, refresh button.

const $ = (id) => document.getElementById(id);
let knownIds = new Set();

async function load() {
  try {
    const res = await fetch("/api/opportunities");
    const data = await res.json();
    render(data);
  } catch (err) {
    showError(`Could not reach the server: ${err.message}`);
  }
}

function render(data) {
  const opps = data.opportunities ?? [];

  // stats
  $("opp-count").textContent = opps.length;
  $("events-count").textContent = data.eventsCompared ?? "—";
  $("best-edge").textContent = opps.length ? `+${opps[0].edgePct}%` : "—";
  $("threshold").textContent = ((data.config?.edgeThreshold ?? 0.05) * 100).toFixed(0);
  $("discord-state").textContent = data.config?.discordEnabled ? "ON" : "OFF";
  $("last-scan").textContent = data.lastScan ? timeAgo(data.lastScan) : "—";

  const badge = $("source-badge");
  const isReal = data.source === "oddsapi" || data.source === "live";
  const label = data.source === "oddsapi" ? "LIVE · ODDS API" : (data.source ?? "—").toUpperCase();
  badge.textContent = isReal && data.meta?.creditsRemaining != null
    ? `${label} · ${data.meta.creditsRemaining} credits left`
    : label;
  badge.className = "badge " + (isReal ? "live" : "demo");

  // Demo-data warning banner.
  $("demo-banner").classList.toggle("hidden", data.source !== "demo");

  // error banner
  if (data.lastError) {
    showError(`Last scan error: ${data.lastError}`);
  } else {
    $("error-banner").classList.add("hidden");
  }

  // table
  const body = $("opps-body");
  if (opps.length === 0) {
    body.innerHTML = `<tr><td colspan="9" class="empty">No value bets at or above the edge threshold right now.</td></tr>`;
    return;
  }

  body.innerHTML = opps
    .map((o) => {
      const isNew = !knownIds.has(o.id);
      return `
      <tr class="${isNew ? "new-flash" : ""}">
        <td><span class="edge-pill">+${o.edgePct}%</span></td>
        <td>${o.inPlay ? '<span class="live-tag">● LIVE</span> ' : ""}${escapeHtml(o.event)}<div class="muted">${o.sport.toUpperCase()}${o.league ? " · " + escapeHtml(o.league) : ""}</div></td>
        <td>${escapeHtml(o.market)}</td>
        <td><strong>${escapeHtml(o.selection)}</strong></td>
        <td class="odds sb">${o.sportsbetOdds.toFixed(2)}</td>
        <td class="odds muted">${o.bet365Odds.toFixed(2)}</td>
        <td>${(o.trueProbability * 100).toFixed(1)}%</td>
        <td>${(o.kelly * 100).toFixed(1)}%</td>
        <td class="muted">${formatKickoff(o.commenceTime)}</td>
      </tr>`;
    })
    .join("");

  knownIds = new Set(opps.map((o) => o.id));
}

async function refresh() {
  const btn = $("refresh");
  btn.disabled = true;
  btn.textContent = "Scanning…";
  try {
    await fetch("/api/scan", { method: "POST" });
    await load();
  } finally {
    btn.disabled = false;
    btn.textContent = "↻ Refresh";
  }
}

function showError(msg) {
  const el = $("error-banner");
  el.textContent = msg;
  el.classList.remove("hidden");
}

function timeAgo(iso) {
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  return `${Math.round(secs / 3600)}h ago`;
}

function formatKickoff(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

$("refresh").addEventListener("click", refresh);
load();
setInterval(load, 15000); // refresh the view every 15s
