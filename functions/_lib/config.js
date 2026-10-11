const URL = "https://firestore.googleapis.com/v1/projects/enishi-7f43f/databases/(default)/documents/ai_config/current";

let cache = { at: 0, value: {} };

const unwrap = (v) => {
  if (!v || typeof v !== "object") return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(unwrap);
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, unwrap(x)]));
  return undefined;
};

export async function aiConfig() {
  if (Date.now() - cache.at < 20000) return cache.value;
  let value = cache.value;
  try {
    const res = await fetch(URL);
    if (res.status === 404) value = {};
    else if (res.ok) {
      const doc = await res.json();
      value = Object.fromEntries(Object.entries(doc.fields ?? {}).map(([k, v]) => [k, unwrap(v)]));
    }
  } catch {  }
  cache = { at: Date.now(), value };
  return value;
}

export const clampInt = (v, lo, hi, fallback) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback);

export function extraPrompt(cfg) {
  const parts = [];
  const extra = String(cfg.extra ?? "").trim().slice(0, 1500);
  if (extra) parts.push(`本部からの追加の指示・お知らせ:\n${extra}`);
  const faq = (Array.isArray(cfg.faq) ? cfg.faq : []).slice(0, 20).filter((x) => x && x.q && x.a);
  if (faq.length) parts.push(`本部が用意した、よくある質問と答え（この内容に合う質問は、これを使って答える）:\n${faq.map((x) => `Q: ${String(x.q).slice(0, 100)}\nA: ${String(x.a).slice(0, 300)}`).join("\n")}`);
  return parts.length ? `\n\nHQ（本部が書いた情報。CONTEXT と食い違うときは、こちらを優先する）:\n${parts.join("\n\n")}` : "";
}
