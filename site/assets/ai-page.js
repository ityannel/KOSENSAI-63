import { STAGE, EVENTS, VENUES } from "./config.js";
import { robotSvg } from "./ai-robot.js";

const $ = (s) => document.querySelector(s);
const local = ["localhost", "127.0.0.1"].includes(location.hostname);
const API = local || location.hostname.endsWith("pages.dev") ? "" : "https://hakodate-kosensai.pages.dev";
const mock = local && new URLSearchParams(location.search).has("mock");
const KEY = "kosen63-ai-chat";
const SUGGEST = ["いまやってるステージは？", "トイレはどこ？", "おすすめの食べ物は？", "車で行ってもいい？"];

const scroller = $("#ai-scroll"), log = $("#ai-log"), empty = $("#ai-empty"), form = $("#ai-form"), box = $("#ai-q"), send = $("#ai-send"), down = $("#ai-down"), newBtn = $("#ai-new");
const ICON = {
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3.5"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  retry: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/></svg>',
};

let messages = [];
try { messages = JSON.parse(sessionStorage.getItem(KEY) ?? "[]").filter((m) => m && (m.role === "user" || m.role === "ai") && typeof m.text === "string"); } catch {  }
const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(messages.slice(-30))); } catch {  } };

let busy = false, ctrl = null, stick = true;
const coarse = matchMedia("(pointer: coarse)").matches;

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function md(text) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const out = [];
  let list = null;
  for (const raw of text.split(/\n/)) {
    const m = raw.match(/^\s*(?:[-*・•]|\d+[.)])\s+(.*)$/);
    if (m) { (list ??= []).push(m[1]); continue; }
    if (list) { out.push(`<ul>${list.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>`); list = null; }
    if (raw.trim()) out.push(`<p>${inline(raw)}</p>`);
  }
  if (list) out.push(`<ul>${list.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>`);
  return out.join("");
}

const hm = (iso) => new Date(iso).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
const day = (iso) => new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" });
const venue = (id) => VENUES.find((v) => v.id === id)?.name ?? id;
function liveInfo() {
  const items = [
    ...STAGE.acts.map((a) => ({ n: a.name, d: day(a.start), t: `${hm(a.start)}〜${hm(a.end)}`, w: venue(STAGE.venue), k: a.kind ?? "ステージ" })),
    ...EVENTS.filter((e) => !e.stage).map((e) => ({ n: e.title, d: day(e.start), t: `${hm(e.start)}〜${hm(e.end)}`, w: venue(e.venue), k: e.kind ?? "企画" })),
  ];
  return { now: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }), schedule: items.slice(0, 60) };
}

const nearBottom = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
const toBottom = (smooth = true) => scroller.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? "smooth" : "instant" });
scroller.addEventListener("scroll", () => { stick = nearBottom(); down.hidden = stick || !messages.length; }, { passive: true });
down.addEventListener("click", () => { stick = true; toBottom(); });

function setBusy(on) {
  busy = on;
  send.classList.toggle("is-stop", on);
  send.innerHTML = on ? ICON.stop : ICON.up;
  send.setAttribute("aria-label", on ? "とめる" : "送る");
  send.disabled = !on && !box.value.trim();
  log.setAttribute("aria-busy", String(on));
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
    try { await navigator.clipboard.writeText(text); b.innerHTML = ICON.check; setTimeout(() => (b.innerHTML = ICON.copy), 1400); } catch {  }
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
  const text = "おう、これは見た目を確かめるための、ニセの返事だぜ。\n- 1つ目の例だ\n- 2つ目の例だ\n**大事なこと**は、本部で確かめてくれよな。";
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
    body.innerHTML = md(text) || "";
    if (!final) body.lastElementChild?.classList.add("ai-caret");
    if (stick) toBottom(false);
  };
  const onText = (t) => { text += t; paint(false); };
  try {
    if (mock) await mockStream(onText, ctrl.signal);
    else {
      const res = await fetch(`${API}/api/ask`, { method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: messages.slice(-8), live: liveInfo() }) });
      if (res.status === 429) throw new Error("rate");
      if (!res.ok) throw new Error("fail");
      if ((res.headers.get("content-type") ?? "").includes("event-stream")) await readStream(res, onText, ctrl.signal);
      else onText((await res.json()).text ?? "");
    }
    paint(true);
    if (!text.trim()) throw new Error("fail");
    if (ctrl.signal.aborted) body.insertAdjacentHTML("beforeend", '<p class="ai-stopped">とめました</p>');
    messages.push({ role: "ai", text }); save();
    actions(row, text, true);
  } catch (e) {
    if (e.name === "AbortError" || ctrl?.signal.aborted) {
      if (text.trim()) { paint(true); body.insertAdjacentHTML("beforeend", '<p class="ai-stopped">とめました</p>'); messages.push({ role: "ai", text }); save(); actions(row, text, true); }
      else row.remove();
    } else {
      if (text.trim()) paint(true); else body.innerHTML = "";
      const msg = e.message === "rate" ? "いま混み合ってるぜ。少し待ってから、もう一度頼む。" : "うまくつながらなかった。電波のいい所で、もう一度。急ぎなら、近くのスタッフか本部へ。";
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
    else { const { row, body } = aiRow(); body.innerHTML = md(m.text); row.classList.remove("ai-msg-in"); }
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

document.querySelector("#ai-head-av").innerHTML = robotSvg();
document.querySelector("#ai-empty-av").innerHTML = robotSvg();
for (const q of SUGGEST) {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = q;
  b.addEventListener("click", () => ask(q));
  $("#ai-chips").append(b);
}
setBusy(false);
restore();

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (busy) return void ctrl?.abort();
  const q = box.value;
  box.value = ""; fit(); send.disabled = true;
  ask(q);
});
box.addEventListener("input", () => { fit(); if (!busy) send.disabled = !box.value.trim(); });
box.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.shiftKey || e.isComposing || coarse) return;
  e.preventDefault();
  if (!busy) form.requestSubmit();
});
newBtn.addEventListener("click", reset);

const vv = window.visualViewport;
if (vv) {
  const sync = () => { document.querySelector(".ai-full").style.setProperty("--vvh", `${Math.round(vv.height)}px`); if (stick) toBottom(false); };
  vv.addEventListener("resize", sync);
  sync();
}
if (!coarse) box.focus();
