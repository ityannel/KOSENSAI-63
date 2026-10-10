export const ORIGINS = ["https://hakodate-kosensai.pages.dev", "https://enishi-7f43f.web.app", "https://enishi-7f43f.firebaseapp.com", "http://localhost:5173"];

export const cors = (request) => {
  const o = request.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0],
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

export async function rateLimit(request, name, limit, windowSec) {
  const ip = request.headers.get("CF-Connecting-IP") ?? "anon";
  const slot = Math.floor(Date.now() / (windowSec * 1000));
  const key = new Request(`https://rate.invalid/${name}/${encodeURIComponent(ip)}/${slot}`);
  const cache = caches.default;
  const hit = await cache.match(key);
  const n = hit ? Number(await hit.text()) || 0 : 0;
  if (n >= limit) return false;
  await cache.put(key, new Response(String(n + 1), { headers: { "Cache-Control": `max-age=${windowSec}` } }));
  return true;
}

export async function gemini(env, body, model) {
  const name = model ?? env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${name}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("gemini empty");
  return text;
}
