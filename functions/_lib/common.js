export const ORIGINS = ["https://hakodate-kosensai.pages.dev", "https://enishi-7f43f.web.app", "https://enishi-7f43f.firebaseapp.com", "http://localhost:5173"];

export const cors = (request) => {
  const o = request.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0],
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Id",
    "Access-Control-Max-Age": "86400",
  };
};

export const json = (request, status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors(request) } });

export const preflight = ({ request }) => new Response(null, { status: 204, headers: cors(request) });

export const originOk = (request) => {
  const o = request.headers.get("Origin");
  return !o || ORIGINS.includes(o);
};

export async function rateLimit(request, name, limit, windowSec, who) {
  const id = who ?? request.headers.get("CF-Connecting-IP") ?? "anon";
  const slot = Math.floor(Date.now() / (windowSec * 1000));
  const key = new Request(`https://rate.invalid/${name}/${encodeURIComponent(id)}/${slot}`);
  const cache = caches.default;
  const hit = await cache.match(key);
  const n = hit ? Number(await hit.text()) || 0 : 0;
  if (n >= limit) return false;
  const left = Math.max(1, windowSec - Math.floor((Date.now() / 1000) % windowSec));
  await cache.put(key, new Response(String(n + 1), { headers: { "Cache-Control": `max-age=${left}` } }));
  return true;
}

export const retryAfter = (windowSec) => Math.max(1, windowSec - Math.floor((Date.now() / 1000) % windowSec));

export const clientId = (request) => {
  const v = request.headers.get("X-Client-Id") ?? "";
  return /^[A-Za-z0-9-]{16,64}$/.test(v) ? v : "";
};

export const MODELS = { ask: "gemini-3.5-flash-lite", moderate: "gemini-3.8-flash" };

async function call(env, name, body) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${name}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });
}

export async function gemini(env, body, model, thinking) {
  const name = model ?? env.GEMINI_MODEL ?? MODELS.ask;
  const withThinking = thinking ? { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: { thinkingLevel: thinking } } } : body;
  let res = await call(env, name, withThinking);
  if (res.status === 400 && thinking) res = await call(env, name, body);
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
  if (!text) throw new Error("gemini empty");
  return text;
}

export async function geminiStream(env, body, model, thinking) {
  const name = model ?? env.GEMINI_MODEL ?? MODELS.ask;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${name}:streamGenerateContent?alt=sse`;
  const go = (b) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY }, body: JSON.stringify(b) });
  const withThinking = thinking ? { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: { thinkingLevel: thinking } } } : body;
  let res = await go(withThinking);
  if (res.status === 400 && thinking) res = await go(body);
  if (!res.ok || !res.body) throw new Error(`gemini ${res.status}`);
  return res.body;
}

export function sseTextStream(upstream, ctx, headers) {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter();
  const send = (obj) => w.write(enc.encode(`data: ${typeof obj === "string" ? obj : JSON.stringify(obj)}\n\n`));
  const textOf = (line) => {
    try {
      const j = JSON.parse(line.slice(5).trim());
      return (j?.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
    } catch { return ""; }
  };
  const pump = async () => {
    const reader = upstream.getReader();
    let buf = "", sent = false;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, i);
          buf = buf.slice(i + 2);
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const t = textOf(line);
            if (t) { await send({ t }); sent = true; }
          }
        }
      }
      if (!sent) await send({ error: "empty" });
    } catch {
      await send({ error: "upstream" });
    } finally {
      await send("[DONE]");
      await w.close();
    }
  };
  const p = pump();
  if (ctx?.waitUntil) ctx.waitUntil(p);
  return new Response(readable, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no", ...headers } });
}
