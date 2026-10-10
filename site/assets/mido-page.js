import { FESTIVAL } from "./config.js";
import { ALL_TICKETS as TICKETS, ticketHtml, rowHtml, isOn, isPast, dayOf, esc, venueName } from "./tickets.js";
import { drawThread, watchThread } from "./thread.js";
import { wireDetails } from "./detail.js";
import { watchSchedule } from "./schedule.js";

const params = new URLSearchParams(location.search);
const nowParam = params.get("now");
const offset = nowParam ? new Date(nowParam.includes("+") ? nowParam : nowParam + "+09:00") - Date.now() : 0;
const nowMs = () => Date.now() + offset;

const fmt = (iso, o) => new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", ...o }).format(new Date(iso));
const DAYS = FESTIVAL.days.map((d) => [dayOf({ start: d.open }), `${fmt(d.open, { month: "numeric" })}.${dayOf({ start: d.open })} ${fmt(d.open, { weekday: "short" }).toUpperCase()}`]);
const CATS = [["now", "いまやっている"], ["stage", "ステージ"], ["event", "企画"]];
const VIEW_KEY = "kosen63-mido-view";
const savedView = (() => { try { return localStorage.getItem(VIEW_KEY); } catch { return null; } })();
const state = { day: "all", cat: "all", q: "", past: false, view: savedView === "list" ? "list" : "ticket" };
const norm = (s) => String(s ?? "").normalize("NFKC").toLowerCase().replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/\s+/g, "");
const hay = (e) => norm([e.title, e.kind, e.mood, e.copy, venueName(e.venue)].join(" "));

const today = FESTIVAL.days.find((d) => fmt(d.open, { year: "numeric", month: "numeric", day: "numeric" }) === fmt(new Date(nowMs()).toISOString(), { year: "numeric", month: "numeric", day: "numeric" }));
if (today) state.day = dayOf({ start: today.open });

const chip = (key, v, label, on) => `<button type="button" data-${key}="${esc(v)}" aria-pressed="${on}">${esc(label)}</button>`;

function render() {
  const t = nowMs();
  document.getElementById("mido-chips").innerHTML = [
    chip("all", "all", "すべて", state.day === "all" && state.cat === "all"),
    ...DAYS.map(([v, label]) => chip("day", v, label, state.day === v)),
    ...CATS.map(([v, label]) => chip("cat", v, label, state.cat === v)),
  ].join("");
  const q = norm(state.q);
  const list = TICKETS.filter((e) =>
    (state.day === "all" || dayOf(e) === state.day)
    && (state.cat === "all" || (state.cat === "now" ? isOn(e, t) : state.cat === "stage" ? e.stageAct : !e.stageAct))
    && (!q || hay(e).includes(q)));
  const past = list.filter((e) => isPast(e, t));
  const rest = list.filter((e) => !isPast(e, t));
  let lastDay = "";
  const cards = (arr) => arr.map((e, i) => {
    const d = dayOf(e);
    const head = d !== lastDay ? `<h2 class="mido-day">${fmt(e.start, { month: "numeric" })}.${d} ${fmt(e.start, { weekday: "short" }).toUpperCase()}</h2>` : "";
    lastDay = d;
    return head + (state.view === "list" ? rowHtml(e, t) : ticketHtml(e, i, t));
  }).join("");
  const toggle = past.length ? `<button type="button" class="mido-more mido-past" data-past aria-expanded="${state.past}"><span>${state.past ? "終了したイベントをとじる" : `終了したイベントを見る（${past.length}件）`}</span></button>` : "";
  document.getElementById("mido-tickets").innerHTML = toggle + (state.past ? cards(past) : "") + cards(rest);
  const box = document.getElementById("mido-tickets");
  box.classList.toggle("is-list", state.view === "list");
  document.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === state.view)));
  if (state.view === "ticket") drawThread(box); else box.querySelector(":scope > .tk-thread")?.remove();
  document.getElementById("mido-empty").hidden = list.length > 0;
}

document.getElementById("mido-chips").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.all) { state.day = "all"; state.cat = "all"; }
  if (b.dataset.day) state.day = state.day === b.dataset.day ? "all" : b.dataset.day;
  if (b.dataset.cat) state.cat = state.cat === b.dataset.cat ? "all" : b.dataset.cat;
  render();
});
document.getElementById("mido-q").addEventListener("input", (e) => { state.q = e.target.value; render(); });
document.querySelector(".mido-view").addEventListener("click", (e) => {
  const b = e.target.closest("[data-view]");
  if (!b || b.dataset.view === state.view) return;
  state.view = b.dataset.view;
  try { localStorage.setItem(VIEW_KEY, state.view); } catch {  }
  render();
});
document.getElementById("mido-tickets").addEventListener("click", (e) => {
  if (!e.target.closest("[data-past]")) return;
  state.past = !state.past;
  render();
});

const sheet = document.querySelector(".mido-full");
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
function close(e) {
  e?.preventDefault();
  const fromSite = document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1;
  let gone = false;
  const go = () => { if (gone) return; gone = true; fromSite ? history.back() : location.assign("./#pickup"); };
  if (calm) return go();
  sheet.classList.add("is-closing");
  sheet.addEventListener("animationend", go, { once: true });
  setTimeout(go, 600);
}
document.querySelector(".mido-close").addEventListener("click", close);
addEventListener("keydown", (e) => { if (e.key === "Escape" && !e.target.closest?.("input")) close(e); });
addEventListener("pageshow", () => sheet.classList.remove("is-closing"));

render();
watchThread(document.getElementById("mido-tickets"));
wireDetails(document.getElementById("mido-tickets"), nowMs);
setInterval(render, 30000);
setTimeout(() => watchSchedule(), 1500);
