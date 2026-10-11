import { STAGE, EVENTS, VENUES, MAP, SHOPS, HOMEROOMS, DEPT_EXHIBITS } from "./config.js";
import { robotSvg } from "./ai-robot.js";
import { startLive, liveSnapshot } from "./ai-live.js";
import { isLocal, esc, md, parseMarks, loadChat, saveChat, recordUse, leftNow, askStream, errorText, limitText, readHere, readCtx, saveTour, SUGGEST } from "./ai-core.js";

const $ = (s) => document.querySelector(s);
const mock = isLocal && new URLSearchParams(location.search).has("mock");

const scroller = $("#ai-scroll"), log = $("#ai-log"), empty = $("#ai-empty"), form = $("#ai-form"), box = $("#ai-q"), send = $("#ai-send"), down = $("#ai-down"), newBtn = $("#ai-new");
const ICON = {
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3.5"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  retry: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8"/></svg>',
  tour: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="6" r="2.2"/><circle cx="18.5" cy="9" r="2.2"/><circle cx="8" cy="18.5" r="2.2"/><path d="M7.5 7l9 1.3M17.3 11l-7.8 5.7"/></svg>',
};

let messages = loadChat();
const save = () => saveChat(messages);

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
const nameOf = (id) => (id && places.has(id) ? { id, name: places.get(id) } : null);

function pull(text, final) {
  const { text: clean, marks } = parseMarks(text, final);
  const links = [];
  const pinIds = [];
  for (const m of marks) {
    if (m.kind === "map") {
      const id = m.ids[0];
      if (places.has(id) && !pinIds.includes(id)) {
        pinIds.push(id);
        links.push({ href: `map.html#${encodeURIComponent(id)}`, icon: ICON.pin, label: places.get(id), hint: "地図で見る" });
      }
    } else if (m.kind === "route") {
      const [a, b] = m.ids;
      if (places.has(a) && places.has(b)) links.push({ href: `map.html?from=${encodeURIComponent(a)}&to=${encodeURIComponent(b)}`, icon: ICON.route, label: `${places.get(a)} → ${places.get(b)}`, hint: "道案内" });
    } else if (m.kind === "tour") {
      const ids = m.ids.filter((id, i, a) => places.has(id) && a.indexOf(id) === i);
      if (ids.length >= 2 || (ids.length === 1 && readHere())) links.unshift({ href: `map.html?tour=${ids.map(encodeURIComponent).join(">")}`, icon: ICON.tour, label: `回るルート（${ids.length}か所）`, hint: "地図に出す", tour: ids });
    }
  }
  if (pinIds.length >= 2) links.push({ href: `map.html?pins=${pinIds.map(encodeURIComponent).join(",")}`, icon: ICON.pin, label: `ぜんぶ地図で見る（${pinIds.length}か所）`, hint: "地図" });
  return { text: clean, links, tour: links.find((l) => l.tour)?.tour ?? null };
}

function render(body, text, final) {
  const { text: clean, links } = pull(text, final);
  body.innerHTML = md(clean) + (links.length ? `<div class="ai-links">${links.map((l) => `<a class="ai-link${l.tour ? " is-tour" : ""}" href="${l.href}">${l.icon}<span>${esc(l.label)}</span><small>${l.hint}</small></a>`).join("")}</div>` : "");
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
function mapInfo() {
  const here = readHere();
  const c = readCtx();
  const sameHere = c && (c.here ?? null) === (here ?? null);
  return {
    here: nameOf(here),
    selected: nameOf(c?.selected),
    floor: c?.floor ?? null,
    route: c?.to ? { from: nameOf(c.from), to: nameOf(c.to), minutes: c.minutes ?? null, meters: c.meters ?? null } : null,
    near: sameHere && Array.isArray(c.near) ? c.near.slice(0, 12) : [],
    tour: null,
  };
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

async function mockStream(onText, signal) {
  const snap = liveSnapshot();
  const text = `（ニセの返事：いまの状況 混雑${snap.crowd?.length ?? "-"}件・待ち時間${snap.shops?.length ?? "-"}件・お知らせ${snap.notice ? "あり" : "なし"}・天気${snap.weather?.text ?? "-"}）
` + "おう、聞いてくれてありがとな。**体育館**はこっちだぜ。[[map:gym2]]\n\n## ステージ\n- 太平洋セメントアリーナで、ライブをやってるぜ。[[map:gym2]]\n## 食べ物\n- 模擬店は、校舎のほうに並んでるぜ。\n\n## 回るなら\n- 玄関 → 体育館 → 食堂の順だぜ。[[tour:entrance>gym2>cafeteria]]\n\nここからの行き方は、これだ。[[route:entrance>gym2]]";
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
    else await askStream({ messages, live: liveInfo(), map: mapInfo(), signal: ctrl.signal, onText });
    paint(true);
    if (!text.trim()) throw new Error("fail");
    recordUse();
    paintLeft();
    const tour = pull(text, true).tour;
    if (tour) saveTour(tour);
    if (ctrl.signal.aborted) body.insertAdjacentHTML("beforeend", '<p class="ai-stopped">とめました</p>');
    messages.push({ role: "ai", text }); save();
    actions(row, text, true);
  } catch (e) {
    if (e.name === "AbortError" || ctrl?.signal.aborted) {
      if (text.trim()) { paint(true); body.insertAdjacentHTML("beforeend", '<p class="ai-stopped">とめました</p>'); messages.push({ role: "ai", text }); save(); actions(row, text, true); }
      else row.remove();
    } else {
      if (text.trim()) paint(true); else body.innerHTML = "";
      body.insertAdjacentHTML("beforeend", `<p class="ai-err">${errorText(e)}<button type="button" data-retry>もう一度</button></p>`);
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
  const limit = limitText(left);
  if (limit) {
    showEmpty(false);
    userRow(q);
    const { body } = aiRow();
    body.innerHTML = `<p>${limit}</p>`;
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
for (const q of SUGGEST.full) {
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
