const local = ["localhost", "127.0.0.1"].includes(location.hostname);
export const API = local || location.hostname.endsWith("pages.dev") ? "" : "https://hakodate-kosensai.pages.dev";
export const isLocal = local;
export const CHAT_KEY = "kosen63-ai-chat";
const ID_KEY = "kosen63-ai-id", USE_KEY = "kosen63-ai-use";
export const LIMIT_10M = 8, LIMIT_DAY = 30;

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const clientId = () => {
  try {
    let v = localStorage.getItem(ID_KEY);
    if (!v) { v = crypto.randomUUID(); localStorage.setItem(ID_KEY, v); }
    return v;
  } catch { return ""; }
};
const readUse = () => { try { return JSON.parse(localStorage.getItem(USE_KEY) ?? "[]").filter((t) => Date.now() - t < 86400000); } catch { return []; } };
const writeUse = (a) => { try { localStorage.setItem(USE_KEY, JSON.stringify(a)); } catch {  } };
export const recordUse = () => writeUse([...readUse(), Date.now()]);
export function leftNow() {
  const use = readUse(), recent = use.filter((t) => Date.now() - t < 600000);
  return { day: Math.max(0, LIMIT_DAY - use.length), tenMin: Math.max(0, LIMIT_10M - recent.length), wait: recent.length >= LIMIT_10M ? Math.ceil((recent[0] + 600000 - Date.now()) / 60000) : 0 };
}

export function loadChat() {
  try { return JSON.parse(sessionStorage.getItem(CHAT_KEY) ?? "[]").filter((m) => m && (m.role === "user" || m.role === "ai") && typeof m.text === "string"); } catch { return []; }
}
export function saveChat(messages) {
  try { sessionStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-30))); } catch {  }
}

export const HERE_KEY = "kosen63-here", HERE_SEC = 40;
const CTX_KEY = "kosen63-map-ctx", TOUR_KEY = "kosen63-tour";
const CTX_KEEP_MIN = 10, TOUR_KEEP_MIN = 90;
const fresh = (t, min) => Number.isFinite(t) && Date.now() - t < min * 60000;

export function readHere() {
  try {
    const s = JSON.parse(sessionStorage.getItem(HERE_KEY) ?? "null");
    const id = s?.id ?? s?.room;
    return id && Date.now() - s.t < HERE_SEC * 1000 ? id : null;
  } catch { return null; }
}
export function readCtx() {
  try {
    const c = JSON.parse(sessionStorage.getItem(CTX_KEY) ?? "null");
    return c && fresh(c.t, CTX_KEEP_MIN) ? c : null;
  } catch { return null; }
}
export function saveCtx(ctx) {
  try { sessionStorage.setItem(CTX_KEY, JSON.stringify({ ...ctx, t: Date.now() })); } catch {  }
}
export function readTour() {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOUR_KEY) ?? "null");
    return t && Array.isArray(t.ids) && t.ids.length && fresh(t.t, TOUR_KEEP_MIN) ? t.ids : null;
  } catch { return null; }
}
export function saveTour(ids) {
  try {
    if (ids?.length) sessionStorage.setItem(TOUR_KEY, JSON.stringify({ ids, t: Date.now() }));
    else sessionStorage.removeItem(TOUR_KEY);
  } catch {  }
}

export const SUGGEST = {
  common: ["いまやってるステージは？", "おすすめの食べ物は？"],
  map: ["ここから近いトイレは？", "いま空いてる模擬店は？", "1時間で回るルートを作って", "体育館への行き方"],
  full: ["いまやってるステージは？", "トイレはどこ？", "おすすめの食べ物は？", "体育館への行き方", "1時間で回るルートを作って"],
};

export function parseMarks(text, final) {
  const marks = [];
  let out = text.replace(/\[\[(map|route|tour):([^\]]*)\]\]/g, (_, kind, arg) => {
    const ids = arg.split(">").map((x) => x.trim()).filter(Boolean);
    if (ids.length) marks.push({ kind, ids });
    return "";
  });
  out = out.replace(/[(（]\s*[)）]/g, "");
  if (!final) out = out.replace(/\[\[[^\]]*$/, "");
  return { text: out.replace(/[ \t]+\n/g, "\n"), marks };
}

export function md(text) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const out = [];
  let list = null;
  const flush = () => { if (list) { out.push(`<ul>${list.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>`); list = null; } };
  for (const raw of text.split(/\n/)) {
    const li = raw.match(/^\s*(?:[-*・•]|\d+[.)])\s+(.*)$/);
    if (li) { (list ??= []).push(li[1]); continue; }
    flush();
    const h = raw.match(/^\s*#{1,4}\s+(.*)$/);
    if (h) out.push(`<h3>${inline(h[1])}</h3>`);
    else if (raw.trim()) out.push(`<p>${inline(raw)}</p>`);
  }
  flush();
  return out.join("");
}

async function readStream(res, onText, signal) {
  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        try { const j = JSON.parse(data); if (j.t) onText(j.t); if (j.error) throw new Error(j.error); } catch (e) { if (e.message && !(e instanceof SyntaxError)) throw e; }
      }
    }
    if (signal.aborted) return;
  }
}

export async function askStream({ messages, live, map, signal, onText }) {
  const res = await fetch(`${API}/api/ask`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "X-Client-Id": clientId() },
    body: JSON.stringify({ messages: messages.slice(-8).map((m) => ({ role: m.role, text: m.text })), live, ...(map ? { map } : {}) }),
  });
  if (res.status === 429) {
    const j = await res.json().catch(() => ({}));
    const e = new Error("rate"); e.scope = j.scope; e.retry = j.retry; throw e;
  }
  if (!res.ok) throw new Error("fail");
  if ((res.headers.get("content-type") ?? "").includes("event-stream")) await readStream(res, onText, signal);
  else onText((await res.json()).text ?? "");
}

export function errorText(e) {
  if (e?.message !== "rate") return "うまくつながらなかった。電波のいい所で、もう一度。急ぎなら、近くのスタッフか本部へ。";
  if (e.scope === "global") return "今日は、たくさん聞かれて、もう答えられねえ。続きは、本部（学生会）で聞いてくれ。";
  if (e.scope === "device-day") return "今日は、もうたくさん聞いてくれたな。続きは、本部（学生会）で聞いてくれ。";
  return `いま混み合ってるぜ。あと${Math.max(1, Math.ceil((e.retry ?? 600) / 60))}分ほど待ってから、もう一度頼む。`;
}

export function limitText(left) {
  if (left.day <= 0) return "今日は、もうたくさん聞いてくれたな。これ以上は、答えられねえ。続きは、本部（学生会）で聞いてくれ。";
  if (left.tenMin <= 0) return `ちょっと聞きすぎだぜ。あと${left.wait}分ほど待ってから、また聞いてくれ。`;
  return "";
}
