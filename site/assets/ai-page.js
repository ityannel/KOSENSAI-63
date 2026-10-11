import { STAGE, EVENTS, VENUES, MAP, SHOPS, HOMEROOMS, DEPT_EXHIBITS } from "./config.js";
import { robotSvg } from "./ai-robot.js";
import { startLive, liveSnapshot } from "./ai-live.js";

const $ = (s) => document.querySelector(s);
const local = ["localhost", "127.0.0.1"].includes(location.hostname);
const API = local || location.hostname.endsWith("pages.dev") ? "" : "https://hakodate-kosensai.pages.dev";
const mock = local && new URLSearchParams(location.search).has("mock");
const KEY = "kosen63-ai-chat";
const ID_KEY = "kosen63-ai-id", USE_KEY = "kosen63-ai-use";
const LIMIT_10M = 8, LIMIT_DAY = 30;
const clientId = () => {
  try {
    let v = localStorage.getItem(ID_KEY);
    if (!v) { v = crypto.randomUUID(); localStorage.setItem(ID_KEY, v); }
    return v;
  } catch { return ""; }
};
const readUse = () => { try { return JSON.parse(localStorage.getItem(USE_KEY) ?? "[]").filter((t) => Date.now() - t < 86400000); } catch { return []; } };
const writeUse = (a) => { try { localStorage.setItem(USE_KEY, JSON.stringify(a)); } catch {  } };
function leftNow() {
  const use = readUse(), recent = use.filter((t) => Date.now() - t < 600000);
  return { day: Math.max(0, LIMIT_DAY - use.length), tenMin: Math.max(0, LIMIT_10M - recent.length), wait: recent.length >= LIMIT_10M ? Math.ceil((recent[0] + 600000 - Date.now()) / 60000) : 0 };
}
const SUGGEST = ["いまやってるステージは？", "トイレはどこ？", "おすすめの食べ物は？", "体育館への行き方"];

const scroller = $("#ai-scroll"), log = $("#ai-log"), empty = $("#ai-empty"), form = $("#ai-form"), box = $("#ai-q"), send = $("#ai-send"), down = $("#ai-down"), newBtn = $("#ai-new");
const ICON = {
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3.5"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  retry: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8"/></svg>',
};

let messages = [];
try { messages = JSON.parse(sessionStorage.getItem(KEY) ?? "[]").filter((m) => m && (m.role === "user" || m.role === "ai") && typeof m.text === "string"); } catch {  }
const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(messages.slice(-30))); } catch {  } };

let busy = false, ctrl = null, stick = true;
const coarse = matchMedia("(pointer: coarse)").matches;

const places = new Map();
for (const p of MAP.places) if (p.id && p.name) places.set(p.id, p.sub ? `${p.name}（${p.sub}）` : p.name);
for (const d of DEPT_EXHIBITS) if (d.place && !places.has(d.place)) places.set(d.place, `${d.dept}の展示`);
for (const v of VENUES) if (!places.has(v.id)) places.set(v.id, v.alias ?? v.name);
for (const s of SHOPS) {
  const id = s.room ?? (s.place || HOMEROOMS[s.cls]) ?? `shops-${s.bldg}${s.floor}`;
  if (id && !places.has(id)) places.set(id, s.name.replace(/\s+/g, " "));
}

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function pull(text, final) {
  const links = [];
  let out = text.replace(/\[\[(map|route):([^\]]*)\]\]/g, (_, kind, arg) => {
    if (kind === "map") {
      const id = arg.trim();
      if (places.has(id) && !links.some((l) => l.href === `map.html#${encodeURIComponent(id)}`)) links.push({ href: `map.html#${encodeURIComponent(id)}`, icon: ICON.pin, label: places.get(id), hint: "地図で見る" });
    } else {
      const [a, b] = arg.split(">").map((x) => x.trim());
      if (places.has(a) && places.has(b)) links.push({ href: `map.html?from=${encodeURIComponent(a)}&to=${encodeURIComponent(b)}`, icon: ICON.route, label: `${places.get(a)} → ${places.get(b)}`, hint: "道案内" });
    }
    return "";
  });
  if (!final) out = out.replace(/\[\[[^\]]*$/, "");
  return { text: out.replace(/[ \t]+\n/g, "\n"), links };
}

function md(text) {
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

function render(body, text, final) {
  const { text: clean, links } = pull(text, final);
  body.innerHTML = md(clean) + (links.length ? `<div class="ai-links">${links.map((l) => `<a class="ai-link" href="${l.href}">${l.icon}<span>${esc(l.label)}</span><small>${l.hint}</small></a>`).join("")}</div>` : "");
  return clean;
}

const hm = (iso) => new Date(iso).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
const day = (iso) => new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" });
const venue = (id) => VENUES.find((v) => v.id === id)?.name ?? id;
function liveInfo() {
  const items = [
    ...STAGE.acts.map((a) => ({ n: a.name, d: day(a.start), t: `${hm(a.start)}〜${hm(a.end)}`, w: venue(STAGE.venue), k: a.kind ?? "ステージ" })),
    ...EVENTS.filter((e) => !e.stage).map((e) => ({ n: e.title, d: day(e.start), t: `${hm(e.start)}〜${hm(e.end)}`, w: venue(e.venue), k: e.kind ?? "企画" })),
  ];
  return { now: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }), schedule: items.slice(0, 60), ...liveSnapshot() };
}

const nearBottom = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
const toBottom = (smooth = true) => scroller.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? "smooth" : "instant" });
scroller.addEventListener("scroll", () => { stick = nearBottom(); down.hidden = stick || !messages.length; }, { passive: true });
down.addEventListener("click", () => { stick = true; toBottom(); });

const canSend = () => !!box.value.trim();
function setBusy(on) {
  busy = on;
  send.classList.toggle("is-stop", on);
  send.innerHTML = on ? ICON.stop : ICON.up;
  send.setAttribute("aria-label", on ? "とめる" : "送る");
  send.disabled = !on && !canSend();
  log.setAttribute("aria-busy", String(on));
}

function paintLeft() {
  const l = leftNow();
  const note = document.querySelector(".ai-left");
  if (!note) return;
  note.textContent = l.day <= 5 ? `今日は、あと${l.day}回まで聞けます。` : "";
}

function showEmpty(on) { empty.hidden = !on; newBtn.hidden = on; }

function userRow(text) {
  const el = document.createElement("div");
  el.className = "ai-user ai-msg-in";
  el.textContent = text;
  log.append(el);
  return el;
}
function aiRow() {
  const row = document.createElement("div");
  row.className = "ai-row ai-msg-in";
  row.innerHTML = `<i class="ai-av" aria-hidden="true">${robotSvg()}</i><div class="ai-body"></div>`;
  log.append(row);
  return { row, body: row.querySelector(".ai-body") };
}
function actions(row, text, last) {
  row.querySelector(".ai-acts")?.remove();
  const bar = document.createElement("div");
  bar.className = "ai-acts";
  bar.innerHTML = `<button type="button" data-copy aria-label="コピー" title="コピー">${ICON.copy}</button>${last ? `<button type="button" data-retry aria-label="もう一度答えてもらう" title="もう一度">${ICON.retry}</button>` : ""}`;
  bar.querySelector("[data-copy]").addEventListener("click", async (e) => {
    const b = e.currentTarget;
    try { await navigator.clipboard.writeText(pull(text, true).text); b.innerHTML = ICON.check; setTimeout(() => (b.innerHTML = ICON.copy), 1400); } catch {  }
  });
  bar.querySelector("[data-retry]")?.addEventListener("click", () => regenerate());
  row.querySelector(".ai-body").append(bar);
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

async function mockStream(onText, signal) {
  const snap = liveSnapshot();
  const text = `（ニセの返事：いまの状況 混雑${snap.crowd?.length ?? "-"}件・待ち時間${snap.shops?.length ?? "-"}件・お知らせ${snap.notice ? "あり" : "なし"}・天気${snap.weather?.text ?? "-"}）
` + "おう、聞いてくれてありがとな。**体育館**はこっちだぜ。[[map:gym2]]\n\n## ステージ\n- 太平洋セメントアリーナで、ライブをやってるぜ。[[map:gym2]]\n## 食べ物\n- 模擬店は、校舎のほうに並んでるぜ。\n\nここからの行き方は、これだ。[[route:entrance>gym2]]";
  await new Promise((r) => setTimeout(r, 900));
  for (const ch of text.match(/[\s\S]{1,4}/g)) { if (signal.aborted) return; onText(ch); await new Promise((r) => setTimeout(r, 40)); }
}

async function generate() {
  const { row, body } = aiRow();
  body.innerHTML = '<span class="ai-typing" aria-label="考え中"><i></i><i></i><i></i></span>';
  if (stick) toBottom();
  ctrl = new AbortController();
  setBusy(true);
  let text = "";
  const paint = (final) => {
    render(body, text, final);
    if (!final) body.lastElementChild?.classList.add("ai-caret");
    if (stick) toBottom(false);
  };
  const onText = (t) => { text += t; paint(false); };
  try {
    if (mock) await mockStream(onText, ctrl.signal);
    else {
      const res = await fetch(`${API}/api/ask`, { method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json", "X-Client-Id": clientId() }, body: JSON.stringify({ messages: messages.slice(-8).map((m) => ({ role: m.role, text: m.text })), live: liveInfo() }) });
      if (res.status === 429) {
        const j = await res.json().catch(() => ({}));
        const e = new Error("rate"); e.scope = j.scope; e.retry = j.retry; throw e;
      }
      if (!res.ok) throw new Error("fail");
      if ((res.headers.get("content-type") ?? "").includes("event-stream")) await readStream(res, onText, ctrl.signal);
      else onText((await res.json()).text ?? "");
    }
    paint(true);
    if (!text.trim()) throw new Error("fail");
    writeUse([...readUse(), Date.now()]);
    paintLeft();
    if (ctrl.signal.aborted) body.insertAdjacentHTML("beforeend", '<p class="ai-stopped">とめました</p>');
    messages.push({ role: "ai", text }); save();
    actions(row, text, true);
  } catch (e) {
    if (e.name === "AbortError" || ctrl?.signal.aborted) {
      if (text.trim()) { paint(true); body.insertAdjacentHTML("beforeend", '<p class="ai-stopped">とめました</p>'); messages.push({ role: "ai", text }); save(); actions(row, text, true); }
      else row.remove();
    } else {
      if (text.trim()) paint(true); else body.innerHTML = "";
      const wait = Math.max(1, Math.ceil((e.retry ?? 600) / 60));
      const msg = e.message === "rate"
        ? (e.scope === "global" ? "今日は、たくさん聞かれて、もう答えられねえ。続きは、本部（学生会）で聞いてくれ。" : e.scope === "device-day" ? "今日は、もうたくさん聞いてくれたな。続きは、本部（学生会）で聞いてくれ。" : `いま混み合ってるぜ。あと${wait}分ほど待ってから、もう一度頼む。`)
        : "うまくつながらなかった。電波のいい所で、もう一度。急ぎなら、近くのスタッフか本部へ。";
      body.insertAdjacentHTML("beforeend", `<p class="ai-err">${msg}<button type="button" data-retry>もう一度</button></p>`);
      body.querySelector("[data-retry]").addEventListener("click", () => { row.remove(); generate(); });
    }
  } finally {
    ctrl = null; setBusy(false);
    if (!coarse) box.focus();
  }
}

function ask(q) {
  q = q.trim();
  if (busy || !q) return;
  const left = leftNow();
  if (left.day <= 0 || left.tenMin <= 0) {
    showEmpty(false);
    userRow(q);
    const { body } = aiRow();
    body.innerHTML = `<p>${left.day <= 0 ? "今日は、もうたくさん聞いてくれたな。これ以上は、答えられねえ。続きは、本部（学生会）で聞いてくれ。" : `ちょっと聞きすぎだぜ。あと${left.wait}分ほど待ってから、また聞いてくれ。`}</p>`;
    stick = true; toBottom(false);
    return;
  }
  showEmpty(false);
  messages.push({ role: "user", text: q }); save();
  userRow(q);
  stick = true;
  generate();
}
function regenerate() {
  if (busy) return;
  while (messages.length && messages.at(-1).role === "ai") messages.pop();
  if (!messages.length) return;
  save();
  const rows = [...log.children];
  while (rows.length && !rows.at(-1).classList.contains("ai-user")) rows.pop().remove();
  stick = true;
  generate();
}

function restore() {
  for (const m of messages) {
    if (m.role === "user") userRow(m.text);
    else { const { row, body } = aiRow(); render(body, m.text, true); row.classList.remove("ai-msg-in"); }
  }
  const last = [...log.querySelectorAll(".ai-row")].at(-1);
  if (last && messages.at(-1)?.role === "ai") actions(last, messages.at(-1).text, true);
  log.querySelectorAll(".ai-msg-in").forEach((e) => e.classList.remove("ai-msg-in"));
  showEmpty(!messages.length);
  if (messages.length) toBottom(false);
}

function reset() {
  if (busy) ctrl?.abort();
  messages = []; save();
  log.innerHTML = "";
  showEmpty(true);
  box.value = ""; fit(); send.disabled = true;
  scroller.scrollTo({ top: 0 });
}

function fit() { box.style.height = "auto"; box.style.height = `${Math.min(box.scrollHeight, 132)}px`; }

document.querySelector("#ai-empty-av").innerHTML = robotSvg();
for (const q of SUGGEST) {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = q;
  b.addEventListener("click", () => ask(q));
  $("#ai-chips").append(b);
}
setBusy(false);
restore();
startLive();
paintLeft();

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (busy) return void ctrl?.abort();
  const q = box.value;
  box.value = ""; fit();
  ask(q);
  send.disabled = true;
});
box.addEventListener("input", () => { fit(); if (!busy) send.disabled = !canSend(); });
box.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.shiftKey || e.isComposing || coarse) return;
  e.preventDefault();
  if (!busy) form.requestSubmit();
});
newBtn.addEventListener("click", reset);

const vv = window.visualViewport;
if (vv) {
  const sync = () => { document.querySelector(".ai-full").style.setProperty("--kb", `${Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop))}px`); if (stick) toBottom(false); };
  vv.addEventListener("resize", sync);
  vv.addEventListener("scroll", sync);
  sync();
}
if (!coarse) box.focus();
