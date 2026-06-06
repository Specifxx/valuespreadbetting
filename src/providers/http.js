// Small fetch helper with browser-ish headers + timeout. Native fetch (Node 20+).

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-AU,en;q=0.9",
};

export async function getJson(url, opts = {}) {
  return (await getJsonMeta(url, opts)).body;
}

/**
 * Like getJson but also returns selected response headers — used to read
 * The Odds API quota headers (x-requests-remaining / x-requests-used).
 */
export async function getJsonMeta(url, { headers = {}, timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { ...DEFAULT_HEADERS, ...headers },
      signal: controller.signal,
    });
    if (!res.ok) {
      const snippet = (await res.text().catch(() => "")).slice(0, 200);
      throw new Error(`HTTP ${res.status} for ${url} ${snippet}`);
    }
    return {
      body: await res.json(),
      remaining: res.headers.get("x-requests-remaining"),
      used: res.headers.get("x-requests-used"),
    };
  } finally {
    clearTimeout(t);
  }
}
