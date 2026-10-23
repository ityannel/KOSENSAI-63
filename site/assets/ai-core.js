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

const CTX_KEY = "kosen63-map-ctx", TOUR_KEY = "kosen63-tour";
const CTX_KEEP_MIN = 10, TOUR_KEEP_MIN = 90;
const fresh = (t, min) => Number.isFinite(t) && Date.now() - t < min * 60000;

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

const jstHour = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", hour12: false }).format(new Date())) % 24;
export const suggestNow = () => {
  const h = jstHour();
  if (h < 11) return ["今日のみどころは？", "トイレはどこ？", "いまから1時間のプランを作って", "体育館への行き方"];
  if (h < 14) return ["いま空いてる模擬店は？", "おすすめの食べ物は？", "いまやってるステージは？", "いまから1時間のプランを作って"];
  if (h < 17) return ["次のステージは？", "いま空いてる模擬店は？", "いまから1時間のプランを作って", "トイレはどこ？"];
  return ["今日の最後のステージは？", "帰る前に回るプランを作って", "体育館への行き方", "トイレはどこ？"];
};
export const SUGGEST = {
  common: ["いまやってるステージは？", "おすすめの食べ物は？"],
  get map() { return suggestNow(); },
  get full() { return suggestNow(); },
};
export function parseMarks(text, final) {
  const marks = [];
  let hq = false;
  const next = [];
  let out = text.replace(/\[\[(map|route|tour):([^\]]*)\]\]/g, (_, kind, arg) => {
    const ids = arg.split(">").map((x) => x.trim()).filter(Boolean);
    if (ids.length) marks.push({ kind, ids });
    return "";
  });
  out = out.replace(/\[\[next:([^\]]*)\]\]/g, (_, q) => { q = q.trim().slice(0, 40); if (q && next.length < 3) next.push(q); return ""; });
  out = out.replace(/\[\[hq(?::([a-z]+))?\]\]/g, (_, r) => { hq = r || true; return ""; });
  out = out.replace(/[(（]\s*[)）]/g, "");
  if (!final) out = out.replace(/\[\[[^\]]*$/, "");
  return { text: out.replace(/[ \t]+\n/g, "\n"), marks, hq, next };
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
  if (res.status === 503) {
    const j = await res.json().catch(() => ({}));
    if (j.error === "disabled") throw new Error("disabled");
  }
  if (!res.ok) throw new Error("fail");
  if ((res.headers.get("content-type") ?? "").includes("event-stream")) await readStream(res, onText, signal);
  else onText((await res.json()).text ?? "");
}

export function errorText(e) {
  if (e?.message === "disabled") return "AIくんは、いまお休み中だぜ。聞きたいことは、本部（学生会）に聞いてくれ。";
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

export const HQ_FLAG = "kosen63-hq-chat";

export function logQa(q, a) {
  if (isLocal || !q || !a) return;
  (async () => {
    try {
      const { signedInKit } = await import("./posts.js");
      const { fs, db } = await signedInKit();
      const sid = (clientId() || "anon").replace(/[^A-Za-z0-9]/g, "").slice(0, 8) || "anon000";
      await fs.addDoc(fs.collection(db, "ai_logs"), { q: String(q).slice(0, 200), a: String(a).slice(0, 1600), sid, at: fs.serverTimestamp() });
    } catch {  }
  })();
}

export const HQ_REASONS = ["missing", "sick", "lost", "other"];
export const hqHref = (reason) => `hq.html${HQ_REASONS.includes(reason) ? `?r=${reason}` : ""}`;
const HQ_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6l-4 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M8 10h8M8 13h5"/></svg>';
export const hqCtaHtml = (reason) => `<a class="ai-hq-cta" href="${hqHref(reason)}">${HQ_ICON}<span><b>本部に連絡する</b><small>AIで解決しないとき。スタッフ（人）にチャットで伝えられます</small></span><i aria-hidden="true">›</i></a>`;
export const noteHtml = () => 'AIはまちがうことがあります。<a href="terms.html">くわしく</a> <span class="ai-left"></span><a class="ai-hq-link" href="hq.html">本部に連絡する</a>';
export const nextHtml = (list) => (list?.length ? `<div class="ai-next">${list.map((q) => `<button type="button" data-ai-ask="${esc(q)}">${esc(q)}</button>`).join("")}</div>` : "");
