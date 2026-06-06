// ---------------------------------------------------------------------------
// Discord notifications via Incoming Webhook.
// Sends a rich embed per opportunity. No-ops if no webhook URL is configured.
// ---------------------------------------------------------------------------

/**
 * @param {string} webhookUrl
 * @param {Array} opportunities
 */
export async function sendDiscordAlerts(webhookUrl, opportunities) {
  if (!webhookUrl) return { sent: 0, skipped: "no webhook configured" };
  if (opportunities.length === 0) return { sent: 0 };

  let sent = 0;
  // Discord allows up to 10 embeds per message; chunk to be safe.
  for (const chunk of chunkArray(opportunities, 10)) {
    const payload = {
      username: "Value Spread Betting",
      content:
        chunk.length === 1
          ? "🟢 **New value bet found**"
          : `🟢 **${chunk.length} new value bets found**`,
      embeds: chunk.map(toEmbed),
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.status === 429) {
      // rate limited — back off and retry once
      const retryAfter = Number(res.headers.get("retry-after")) || 2;
      await sleep(retryAfter * 1000);
      const retry = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (retry.ok) sent += chunk.length;
    } else if (res.ok) {
      sent += chunk.length;
    } else {
      console.warn(`[discord] webhook responded ${res.status}`);
    }
    await sleep(400); // gentle pacing between messages
  }

  return { sent };
}

function toEmbed(opp) {
  const kickoff = opp.commenceTime
    ? `<t:${Math.floor(new Date(opp.commenceTime).getTime() / 1000)}:R>`
    : "n/a";
  return {
    title: `${opp.inPlay ? "🔴 LIVE · " : ""}${opp.event} — back ${opp.selection}`,
    description: `**${opp.sport.toUpperCase()}** · ${opp.market}`,
    color: 0x2ecc71,
    fields: [
      { name: "Edge", value: `**+${opp.edgePct}%**`, inline: true },
      { name: `Bet at ${opp.book}`, value: `@ ${opp.targetOdds}`, inline: true },
      {
        name: `${opp.referenceBook} (fair)`,
        value: `@ ${opp.referenceOdds}`,
        inline: true,
      },
      {
        name: "True win prob",
        value: `${(opp.trueProbability * 100).toFixed(1)}%`,
        inline: true,
      },
      {
        name: "Kelly stake",
        value: `${(opp.kelly * 100).toFixed(1)}% of bank`,
        inline: true,
      },
      { name: "Kickoff", value: kickoff, inline: true },
    ],
    footer: {
      text: `${opp.referenceBook} = gold standard · place bet at ${opp.book}`,
    },
    timestamp: opp.detectedAt,
  };
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
