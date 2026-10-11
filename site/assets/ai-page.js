import { STAGE, EVENTS, VENUES, MAP, SHOPS, HOMEROOMS, DEPT_EXHIBITS } from "./config.js";
import { robotSvg } from "./ai-robot.js";

const $ = (s) => document.querySelector(s);
const local = ["localhost", "127.0.0.1"].includes(location.hostname);
const API = local || location.hostname.endsWith("pages.dev") ? "" : "https://hakodate-kosensai.pages.dev";
const mock = local && new URLSearchParams(location.search).has("mock");
const KEY = "kosen63-ai-chat";
const SUGGEST = ["いまやってるステージは？", "トイレはどこ？", "おすすめの食べ物は？", "体育館への行き方"];

const scroller = $("#ai-scroll"), log = $("#ai-log"), empty = $("#ai-empty"), form = $("#ai-form"), box = $("#ai-q"), send = $("#ai-send"), down = $("#ai-down"), newBtn = $("#ai-new");
const photoBtn = $("#ai-photo"), fileIn = $("#ai-file"), attach = $("#ai-attach"), thumb = $("#ai-thumb"), thumbX = $("#ai-thumb-x");
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

let busy = false, ctrl = null, stick = true, pending = null;
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
  return { now: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }), schedule: items.slice(0, 60) };
}

const nearBottom = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
const toBottom = (smooth = true) => scroller.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? "smooth" : "instant" });
scroller.addEventListener("scroll", () => { stick = nearBottom(); down.hidden = stick || !messages.length; }, { passive: true });
down.addEventListener("click", () => { stick = true; toBottom(); });

const canSend = () => !!box.value.trim() || !!pending;
function setBusy(on) {
  busy = on;
  send.classList.toggle("is-stop", on);
  send.innerHTML = on ? ICON.stop : ICON.up;
  send.setAttribute("aria-label", on ? "とめる" : "送る");
  send.disabled = !on && !canSend();
  photoBtn.disabled = on;
  log.setAttribute("aria-busy", String(on));
}

function showEmpty(on) { empty.hidden = !on; newBtn.hidden = on; }

function userRow(text, img) {
  const el = document.createElement("div");
  el.className = "ai-user ai-msg-in";
  if (img === true) el.insertAdjacentHTML("beforeend", '<span class="ai-photo-tag">写真つき</span>');
  else if (img) { const i = document.createElement("img"); i.src = img; i.alt = "送った写真"; el.append(i); }
  if (text) { const p = document.createElement("span"); p.textContent = text; el.append(p); }
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

async function mockStream(onText, signal, hasImage) {
  const text = hasImage
    ? "おう、写真を見たぜ。これは **体育館** の近くっぽいな。[[map:gym2]]\n\n## ステージ\n- 太平洋セメントアリーナで、ライブをやってるぜ。[[map:gym2]]\n## 食べ物\n- 模擬店は、校舎のほうに並んでるぜ。\n\nここからの行き方は、これだ。[[route:entrance>gym2]]"
    : "おう、これは見た目を確かめるための、ニセの返事だぜ。\n- 1つ目の例だ\n- 2つ目の例だ\n**大事なこと**は、本部で確かめてくれよな。";
  await new Promise((r) => setTimeout(r, 900));
  for (const ch of text.match(/[\s\S]{1,4}/g)) { if (signal.aborted) return; onText(ch); await new Promise((r) => setTimeout(r, 40)); }
}

async function generate(image) {
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
    if (mock) await mockStream(onText, ctrl.signal, !!image);
    else {
      const res = await fetch(`${API}/api/ask`, { method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: messages.slice(-8).map((m) => ({ role: m.role, text: m.text })), live: liveInfo(), ...(image ? { image } : {}) }) });
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
      body.querySelector("[data-retry]").addEventListener("click", () => { row.remove(); generate(image); });
    }
  } finally {
    ctrl = null; setBusy(false);
    if (!coarse) box.focus();
  }
}

let lastImage = null;
function ask(q) {
  q = q.trim();
  const image = pending;
  if (busy || (!q && !image)) return;
  if (!q) q = "この写真について、教えて。";
  showEmpty(false);
  messages.push({ role: "user", text: q, img: !!image }); save();
  userRow(q, image);
  lastImage = image;
  clearPending();
  stick = true;
  generate(image);
}
function regenerate() {
  if (busy) return;
  while (messages.length && messages.at(-1).role === "ai") messages.pop();
  if (!messages.length) return;
  save();
  const rows = [...log.children];
  while (rows.length && !rows.at(-1).classList.contains("ai-user")) rows.pop().remove();
  stick = true;
  generate(messages.at(-1).img ? lastImage : null);
}

function restore() {
  for (const m of messages) {
    if (m.role === "user") userRow(m.text, m.img ? true : null);
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
  messages = []; save(); lastImage = null;
  log.innerHTML = "";
  showEmpty(true);
  box.value = ""; fit(); clearPending(); send.disabled = true;
  scroller.scrollTo({ top: 0 });
}

function fit() { box.style.height = "auto"; box.style.height = `${Math.min(box.scrollHeight, 132)}px`; }

function clearPending() {
  pending = null;
  attach.hidden = true;
  thumb.removeAttribute("src");
  fileIn.value = "";
  if (!busy) send.disabled = !box.value.trim();
}
async function shrink(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  let q = 0.82, url = c.toDataURL("image/jpeg", q);
  while (url.length > 600000 && q > 0.4) { q -= 0.1; url = c.toDataURL("image/jpeg", q); }
  return url;
}
photoBtn.addEventListener("click", () => fileIn.click());
fileIn.addEventListener("change", async () => {
  const f = fileIn.files?.[0];
  if (!f) return;
  try {
    pending = await shrink(f);
    thumb.src = pending;
    attach.hidden = false;
    send.disabled = false;
    if (stick) toBottom(false);
  } catch {
    clearPending();
  }
});
thumbX.addEventListener("click", clearPending);

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
  const sync = () => { document.querySelector(".ai-full").style.setProperty("--vvh", `${Math.round(vv.height)}px`); if (stick) toBottom(false); };
  vv.addEventListener("resize", sync);
  sync();
}
if (!coarse) box.focus();
