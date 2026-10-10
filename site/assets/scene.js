import { RALLY } from "./config.js";
import { stampCount, stampGoal } from "./rally.js";

const POSTER_W = 1215, POSTER_H = 1845;
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const SPOTS = [
  {
    id: "p1", person: true, box: [229, 1260, 326, 1529], topic: "map", label: "白いシャツの人に、地図のことを聞く",
    lines: () => ["企画、どれから見る？", "学科展示、けっこう本気らしいよ", "構内装飾も見てって！"],
  },
  {
    id: "p2", person: true, box: [344, 1249, 429, 1518], topic: "food", label: "パーカーの人に、ごはんのことを聞く",
    lines: (c) => (c.phase === "before"
      ? ["どの模擬店行く？", "クレープは絶対並ぶって"]
      : ["いちゃの食レポ見た？", "お腹すいてきた…"]),
  },
  {
    id: "p3", person: true, box: [698, 1237, 842, 1421], topic: "rally", label: "走っている人に、スタンプラリーのことを聞く",
    lines: (c) => {
      if (c.stream) return [`「${c.stream.name}」を${c.stream.live ? "生" : ""}配信中！`];
      const n = stampCount();
      if (n >= stampGoal()) return [c.prizeOut ? "スタンプそろった！ 景品は終わっちゃったけど…" : "スタンプそろった！本部行こ！"];
      if (n > 0) return [`スタンプあと${stampGoal() - n}個！`];
      return ["スタンプラリー、一緒に回ろ！", "スタンプ集めに走ってる！"];
    },
  },
  {
    id: "p4", person: true, box: [950, 1203, 1099, 1461], topic: "now", label: "手を伸ばしている人に、今なにやってるか聞く",
    lines: (c) => (c.nowEvent
      ? [`いま${c.nowEvent.venueName}で「${c.nowEvent.title}」やってる！`]
      : ["次のイベント、何時から？", "ステージ見に行こうよ！"]),
  },
  {
    id: "p5", person: true, box: [1099, 1180, 1191, 1455], topic: "crowd", label: "黒い服の人に、混み具合を聞く",
    lines: () => ["ごみはちゃんと分けてね", "校内は全面禁煙だよ", "困ったら本部へ！"],
  },
  { id: "bldg", box: [555, 946, 916, 1220], topic: "map", label: "校内マップ", lines: () => ["校内マップ"] },
];

const sceneBox = () => {
  const r = document.querySelector(".scene")?.getBoundingClientRect() ?? { left: 0, right: innerWidth };
  const vw = document.documentElement.clientWidth;
  return { left: Math.max(0, r.left), right: Math.min(vw, r.right) };
};
const onScreen = (el) => { if (!el) return false; const r = el.getBoundingClientRect(), s = sceneBox(); return r.right > s.left && r.left < s.right; };
const HIDDEN = [
  { id: "window", box: [11, 1272, 115, 1386], line: "……ニャー。（窓の奥に誰かいる）" },
  { id: "cover", box: [658, 1426, 761, 1535], line: "黄色いカバー、ずっとここで見守ってる" },
  { id: "dhouse", box: [784, 1169, 870, 1232], line: "「D」って何の頭文字だろう？" },
  { id: "antenna", box: [827, 894, 861, 974], line: "アンテナ感度、今日も良好です" },
  { id: "sun", box: [641, 831, 1031, 934], line: "この夕焼け、5人も見てるかな" },
];
const SECRET_KEY = "kosen63-secrets";

let getCtx = () => ({ phase: "before", nowEvent: null });
let chatter = {};

function linesOf(s) {
  const live = chatter?.[s.id]?.trim();
  return live ? [live] : s.lines(getCtx());
}

const boxStyle = ([l, t, r, b]) => `left:${(l / POSTER_W) * 100}%; top:${(t / POSTER_H) * 100}%;
  width:${((r - l) / POSTER_W) * 100}%; height:${((b - t) / POSTER_H) * 100}%`;

function renderSpots() {
  const found = loadFound();
  const spot = (s) => {
    const side = s.box[0] > POSTER_W * 0.62 ? "left" : "right";
    return `
      <span class="spot is-person" id="spot-${s.id}" aria-hidden="true" style="${boxStyle(s.box)}">
        <span class="bubble bubble-${side}"></span>
      </span>`;
  };
  const hidden = (h) => {
    const side = h.box[0] > POSTER_W * 0.62 ? "left" : "right";
    return `
      <button type="button" class="spot is-secret${found.includes(h.id) ? " found" : ""}" id="secret-${h.id}" data-secret="${h.id}"
        aria-label="絵の中の小さな秘密" style="${boxStyle(h.box)}">
        <span class="bubble bubble-${side}" aria-hidden="true">${esc(h.line)}</span>
      </button>`;
  };
  $("#hotspots").innerHTML =
    HIDDEN.map(hidden).join("") +
    SPOTS.filter((s) => s.person).map(spot).join("");
  refreshSpots();
}

function loadFound() {
  try { return JSON.parse(localStorage.getItem(SECRET_KEY) ?? "[]"); } catch { return []; }
}
function findSecret(id) {
  const el = document.getElementById(`secret-${id}`);
  el.classList.add("is-talking");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("is-talking"), 3200);
  const found = loadFound();
  if (found.includes(id)) return;
  found.push(id);
  try { localStorage.setItem(SECRET_KEY, JSON.stringify(found)); } catch {}
  el.classList.add("found");
  const toast = $("#secret-toast");
  const need = HIDDEN.filter((h) => found.includes(h.id) || onScreen(document.getElementById(`secret-${h.id}`))).length;
  toast.textContent = found.length >= need ? "隠し縁、ぜんぶ見つけた！" : `隠し縁 ${found.length} / ${need}`;
  toast.hidden = false;
  toast.classList.remove("pop");
  void toast.offsetWidth;
  toast.classList.add("pop");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (toast.hidden = true), 2600);
  if (found.length >= need) setTimeout(() => (location.hash = "secret"), 1400);
}

export function setChatter(data) {
  chatter = data ?? {};
  for (const s of SPOTS.filter((x) => x.person)) {
    document.getElementById(`spot-${s.id}`)?.classList.toggle("is-live", !!chatter[s.id]?.trim());
  }
  const first = SPOTS.find((s) => chatter[s.id]?.trim());
  if (first && !document.body.classList.contains("intro")) talk(first.id, 5000);
}

function refreshSpots() {
  for (const s of SPOTS) {
    const el = document.getElementById(`spot-${s.id}`);
    if (el && !el.classList.contains("is-talking")) el.querySelector(".bubble").textContent = pick(linesOf(s));
  }
}

export function say(id, text, ms = 3200) {
  const el = document.getElementById(`spot-${id}`);
  if (!el) return;
  document.querySelectorAll(".spot.is-person.is-talking").forEach((o) => o !== el && o.classList.remove("is-talking"));
  const s = SPOTS.find((x) => x.id === id);
  const b = el.querySelector(".bubble");
  b.textContent = text ?? pick(linesOf(s));
  el.classList.add("is-talking");
  b.style.transform = "";
  b.style.removeProperty("--tail");
  const w = b.offsetWidth;
  const left = el.getBoundingClientRect().left + b.offsetLeft, right = left + w;
  const sb = sceneBox();
  const shift = Math.min(0, sb.right - 8 - right) || Math.max(0, sb.left + 8 - left);
  b.style.transform = shift ? `translateX(${shift}px)` : "";
  if (shift) {
    const base = b.classList.contains("bubble-left") ? w - 18 : 18;
    b.style.setProperty("--tail", `${Math.max(16, Math.min(w - 16, base - shift))}px`);
  }
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("is-talking"), ms);
}
const talk = (id, ms) => say(id, null, ms);

const panels = [...document.querySelectorAll(".panel")];
let lastTrigger = null;

function route() {
  const id = decodeURIComponent(location.hash.slice(1)).split("/")[0];
  const panel = panels.find((p) => p.id === id) ?? null;
  panels.forEach((p) => (p.hidden = p !== panel));
  $("#panel-backdrop").hidden = !panel;
  document.body.classList.toggle("panel-open", !!panel);
  const sc = document.querySelector(".scene");
  if (sc) sc.inert = !!panel;
  if (panel) {
    panel.scrollTop = 0;
    panel.querySelector(".panel-title").focus({ preventScroll: true });
  }
}

function closePanel() {
  history.replaceState(null, "", location.pathname + location.search);
  route();
  lastTrigger?.focus({ preventScroll: true });
}

const IDLE_MS = 15000;
function initAwake() {
  const body = document.body;
  let timer = null;
  const sleep = () => {
    if (body.matches(".answer-open, .panel-open")) return schedule();
    body.classList.remove("awake");
  };
  const schedule = () => { clearTimeout(timer); timer = setTimeout(sleep, IDLE_MS); };
  const wake = (e) => {
    if (e?.target?.closest?.(".testwin")) return;
    body.classList.add("awake");
    schedule();
  };
  addEventListener("pointerdown", wake, { passive: true });
  addEventListener("keydown", wake);
  addEventListener("wheel", wake, { passive: true });
  if (location.hash) wake();
}

export function setAwake(on) {
  document.body.classList.toggle("awake", on);
}

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
function initIntro(onDone) {
  const body = document.body;
  const done = () => {
    if (!body.classList.contains("intro")) return;
    body.classList.remove("intro");
    try { localStorage.setItem("kosen63-intro-seen", "1"); } catch {}
    onDone();
  };
  if (!body.classList.contains("intro") || location.hash) {
    body.classList.remove("intro");
    return onDone();
  }
  const timer = setTimeout(done, reduceMotion ? 1200 : 4400);
  const skip = () => { clearTimeout(timer); done(); };
  addEventListener("pointerdown", skip, { once: true });
  addEventListener("keydown", skip, { once: true });
}

export function initScene(ctxFn) {
  getCtx = ctxFn;
  renderSpots();
  setInterval(refreshSpots, 5000);

  for (const p of panels) {
    p.setAttribute("role", "dialog");
    p.setAttribute("aria-modal", "true");
    p.querySelector(".panel-title").tabIndex = -1;
    p.insertAdjacentHTML("afterbegin", '<button type="button" class="panel-close" aria-label="閉じる">×</button>');
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest(".panel-close") || e.target.id === "panel-backdrop") closePanel();
    const trigger = e.target.closest("a[href^='#']");
    if (trigger) lastTrigger = trigger;
    const secret = e.target.closest("[data-secret]");
    if (secret) findSecret(secret.dataset.secret);
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("panel-open")) closePanel();
  });
  addEventListener("hashchange", route);
  route();


  initIntro(() => {
    initAwake();
    if (reduceMotion) return;
    const people = SPOTS.filter((s) => s.person).map((s) => s.id);
    setInterval(() => {
      if (document.body.matches(".panel-open, .answer-open") || document.hidden || scrollY > innerHeight * 0.5) return;
      const seen = people.filter((id) => onScreen(document.getElementById(`spot-${id}`)));
      const live = seen.filter((id) => chatter[id]?.trim());
      if (seen.length) talk(live.length && Math.random() < 0.6 ? pick(live) : pick(seen));
    }, 5500);
  });
}
