import { robotSvg } from "./ai-robot.js";
import { STAGE, EVENTS, VENUES } from "./config.js";
import { isLocal, esc, md, parseMarks, loadChat, saveChat, recordUse, leftNow, askStream, errorText, limitText, saveTour, SUGGEST } from "./ai-core.js";

const mock = isLocal && new URLSearchParams(location.search).has("mock");

const ICON = {
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8"/></svg>',
  tour: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="6" r="2.2"/><circle cx="18.5" cy="9" r="2.2"/><circle cx="8" cy="18.5" r="2.2"/><path d="M7.5 7l9 1.3M17.3 11l-7.8 5.7"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
  sort: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16M3.5 16.5L7 20l3.5-3.5M17 20V4M13.5 7.5L17 4l3.5 3.5"/></svg>',
};

let host = null;
let messages = loadChat();
let busy = false, ctrl = null, pending = "", failure = "", stick = true, bodyEl = null;
const sorted = new Map();

const hm = (iso) => new Date(iso).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
const day = (iso) => new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" });
const venue = (id) => VENUES.find((v) => v.id === id)?.name ?? id;

function liveInfo() {
  const items = [
    ...STAGE.acts.map((a) => ({ n: a.name, d: day(a.start), t: `${hm(a.start)}〜${hm(a.end)}`, w: venue(STAGE.venue), k: a.kind ?? "ステージ" })),
    ...EVENTS.filter((e) => !e.stage).map((e) => ({ n: e.title, d: day(e.start), t: `${hm(e.start)}〜${hm(e.end)}`, w: venue(e.venue), k: e.kind ?? "企画" })),
  ];
  return {
    now: new Date(host.now()).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }),
    schedule: items.slice(0, 60),
    ...host.live(),
  };
}

function marksHtml(marks) {
  const pins = [];
  const cards = [];
  for (const m of marks) {
    if (m.kind === "map") {
      const id = m.ids[0];
      if (host.has(id) && !pins.includes(id)) pins.push(id);
    } else {
      const ids = m.kind === "route" ? m.ids.slice(0, 2) : m.ids;
      const base = host.tourInfo(ids, m.kind === "route");
      const next = base && sorted.get(base.ids.join(">"));
      const info = next ? host.tourInfo(next, false) ?? base : base;
      if (info) cards.push({ kind: m.kind, info, orig: base.ids.join(">"), isSorted: info !== base });
      else for (const id of ids) if (host.has(id) && !pins.includes(id)) pins.push(id);
    }
  }
  const pinHtml = pins.length ? `<div class="ai-links">${pins.map((id) => `<button type="button" class="ai-link" data-ai-go="${esc(id)}">${ICON.pin}<span>${esc(host.title(id))}</span><small>地図で見る</small></button>`).join("")}</div>` : "";
  const cardHtml = cards.map((c) => tourCard(c.kind, c.info, c.orig, c.isSorted)).join("");
  return pinHtml + cardHtml;
}

function tourCard(kind, info, orig, isSorted) {
  const key = info.ids.join(">");
  const on = host.overlayKey() === key;
  const legs = info.legs;
  const rows = info.stops.map((s, i) => `
    <li class="${i === 0 && info.fromHere ? "is-start" : ""}">
      <button type="button" class="aim-stop" data-ai-go="${esc(s.id)}"><i>${info.fromHere ? (i === 0 ? "★" : i) : i + 1}</i><span><b>${esc(s.title)}</b><small>${esc(s.sub)}</small></span></button>
      ${legs[i] ? `<button type="button" class="aim-leg" data-ai-leg="${i}" data-ai-key="${esc(key)}" ${on ? "" : "disabled"}>${ICON.route}<span>${legs[i].ok ? `${legs[i].minutes}分・${legs[i].meters}m` : "道が見つかりません"}</span><small>道案内</small></button>` : ""}
    </li>`).join("");
  return `<div class="aim-tour${on ? " is-on" : ""}">
    <p class="aim-tour-h">${ICON.tour}<b>${kind === "route" ? "道順" : "回るルート"}</b><span>${info.minutes}分・${info.meters}m</span></p>
    <ol class="aim-stops">${rows}</ol>
    <div class="aim-tour-acts">
      ${on ? `<button type="button" class="sh-btn" data-ai-hide>地図から消す</button>` : `<button type="button" class="sh-btn primary" data-ai-show="${esc(key)}" data-ai-route="${kind === "route" ? 1 : 0}">地図に出す</button>`}
      ${isSorted ? `<button type="button" class="sh-btn" data-ai-unsort="${esc(orig)}">もとの順にもどす</button>`
        : kind === "tour" && info.stops.length > 3 ? `<button type="button" class="sh-btn" data-ai-sort="${esc(key)}">${ICON.sort}近い順にする</button>` : ""}
    </div>
  </div>`;
}

function html() {
  const rows = [];
  for (const m of messages) {
    if (m.role === "user") { rows.push(`<div class="ai-user">${esc(m.text)}</div>`); continue; }
    const { text, marks } = parseMarks(m.text, true);
    rows.push(`<div class="ai-row"><i class="ai-av" aria-hidden="true">${robotSvg()}</i><div class="ai-body">${md(text)}${marksHtml(marks)}</div></div>`);
  }
  if (busy) {
    const { text } = parseMarks(pending, false);
    rows.push(`<div class="ai-row"><i class="ai-av" aria-hidden="true">${robotSvg()}</i><div class="ai-body${text ? " ai-caret" : ""}">${text ? md(text) : '<span class="ai-typing" aria-label="考え中"><i></i><i></i><i></i></span>'}</div></div>`);
  }
  if (failure) rows.push(`<div class="ai-row"><i class="ai-av" aria-hidden="true">${robotSvg()}</i><div class="ai-body"><p class="ai-err">${esc(failure)}<button type="button" data-ai-retry>もう一度</button></p></div></div>`);
  const left = leftNow();
  const empty = !messages.length && !busy;
  return `<div class="aim">
    <div class="aim-head">
      <i class="ai-av" aria-hidden="true">${robotSvg()}</i><h2>AIくん</h2>
      <span class="aim-tools">
        ${busy ? `<button type="button" class="aim-tool" data-ai-stop aria-label="とめる" title="とめる">${ICON.stop}</button>` : ""}
        ${messages.length ? `<button type="button" class="aim-tool" data-ai-new aria-label="新しい会話" title="新しい会話">${ICON.plus}</button>` : ""}
        <a class="aim-tool" href="ai.html" aria-label="全画面で話す" title="全画面で話す">${ICON.full}</a>
      </span>
    </div>
    ${empty ? `<p class="sh-hint">おう、地図を見ながら聞いてくれ。場所は地図に印が出て、「回りたい」と言えばルートも引くぜ。</p>
      <div class="aim-chips">${SUGGEST.map.map((q) => `<button type="button" data-ai-ask="${esc(q)}">${esc(q)}</button>`).join("")}</div>` : ""}
    <div class="aim-log" role="log" aria-live="polite">${rows.join("")}</div>
    ${messages.length && !busy ? `<p class="aim-more">つづけて聞くときは、上の検索バーに文章を入れてね。</p>` : ""}
    <p class="aim-note">AIの答えは、まちがうことがあります。${left.day <= 5 ? `今日は、あと${left.day}回まで聞けます。` : ""}<a href="terms.html">くわしく</a></p>
  </div>`;
}

function onClick(e) {
  const t = e.target;
  const go = t.closest("[data-ai-go]");
  if (go) { host.go(go.dataset.aiGo); return; }
  const ask = t.closest("[data-ai-ask]");
  if (ask) { send(ask.dataset.aiAsk); return; }
  const show = t.closest("[data-ai-show]");
  if (show) { host.showTour(show.dataset.aiShow.split(">"), { route: show.dataset.aiRoute === "1" }); return; }
  if (t.closest("[data-ai-hide]")) { host.clearOverlay(); paint(); return; }
  const sort = t.closest("[data-ai-sort]");
  if (sort) {
    const orig = sort.dataset.aiSort;
    const next = host.sortTour(orig.split(">"));
    if (next) sorted.set(orig, next);
    paint();
    return;
  }
  const unsort = t.closest("[data-ai-unsort]");
  if (unsort) {
    const orig = unsort.dataset.aiUnsort;
    sorted.delete(orig);
    host.showTour(orig.split(">"));
    paint();
    return;
  }
  const leg = t.closest("[data-ai-leg]:not([disabled])");
  if (leg) { host.startLeg(Number(leg.dataset.aiLeg)); return; }
  if (t.closest("[data-ai-stop]")) { ctrl?.abort(); return; }
  if (t.closest("[data-ai-new]")) { reset(); return; }
  if (t.closest("[data-ai-retry]")) { failure = ""; generate(); }
}

export function render(body) {
  if (bodyEl !== body) {
    bodyEl = body;
    body.addEventListener("click", (e) => { if (body.querySelector(".aim")) onClick(e); });
    body.addEventListener("scroll", () => { stick = body.scrollHeight - body.scrollTop - body.clientHeight < 60; }, { passive: true });
  }
  const h = html();
  if (body._aiHtml === h && body.querySelector(".aim")) return;
  const top = body.scrollTop;
  body.innerHTML = body._aiHtml = h;
  body.scrollTop = stick ? body.scrollHeight : top;
}

function paint() {
  host.repaint();
}

function reset() {
  ctrl?.abort();
  messages = [];
  failure = "";
  pending = "";
  sorted.clear();
  saveChat(messages);
  saveTour(null);
  host.clearOverlay();
  stick = true;
  paint();
}

function sampleMock() {
  const ids = host.sampleIds(4);
  const [a, b, c] = ids;
  return `（ニセの返事）おう、任せとけ。\n\n## 回るならこの順だぜ\n- ${host.title(a)}で、まず腹ごしらえ。\n- ${host.title(b)}を見て\n- ${host.title(c)}で締めだ。\n\n[[tour:${ids.join(">")}]]\n\n空いてる所は、ここだぜ。[[map:${a}]][[map:${b}]]`;
}

async function generate() {
  ctrl = new AbortController();
  busy = true;
  pending = "";
  failure = "";
  stick = true;
  paint();
  let text = "";
  const onText = (t) => { text += t; pending = text; paint(); };
  try {
    if (mock) {
      const full = sampleMock();
      await new Promise((r) => setTimeout(r, 700));
      for (const ch of full.match(/[\s\S]{1,5}/g)) { if (ctrl.signal.aborted) break; onText(ch); await new Promise((r) => setTimeout(r, 30)); }
    } else {
      await askStream({ messages, live: liveInfo(), map: host.context(), signal: ctrl.signal, onText });
    }
    if (!text.trim()) throw new Error("fail");
    recordUse();
    messages.push({ role: "ai", text });
    saveChat(messages);
    busy = false;
    pending = "";
    applyMarks(text);
  } catch (e) {
    busy = false;
    pending = "";
    if (e.name === "AbortError" || ctrl?.signal.aborted) {
      if (text.trim()) { messages.push({ role: "ai", text }); saveChat(messages); applyMarks(text); }
    } else {
      if (text.trim()) { messages.push({ role: "ai", text }); saveChat(messages); }
      failure = errorText(e);
    }
  } finally {
    ctrl = null;
    busy = false;
    paint();
  }
}

function applyMarks(text) {
  const { marks } = parseMarks(text, true);
  const tour = marks.find((m) => m.kind === "tour");
  if (tour && host.showTour(tour.ids)) return;
  const route = marks.find((m) => m.kind === "route");
  if (route && route.ids.length >= 2 && host.showTour(route.ids.slice(0, 2), { route: true })) return;
  const pins = [...new Set(marks.filter((m) => m.kind === "map").map((m) => m.ids[0]).filter((id) => host.has(id)))];
  if (pins.length) host.setPins(pins);
}

export function send(q) {
  q = String(q ?? "").trim().slice(0, 200);
  if (!q || busy) return;
  host.enter();
  const limit = limitText(leftNow());
  if (limit) {
    messages.push({ role: "user", text: q }, { role: "ai", text: limit });
    saveChat(messages);
    paint();
    return;
  }
  messages.push({ role: "user", text: q });
  saveChat(messages);
  generate();
}

export function isBusy() { return busy; }
export function hasChat() { return messages.length > 0; }
export function reload() { messages = loadChat(); }

export function init(h) {
  host = h;
}
