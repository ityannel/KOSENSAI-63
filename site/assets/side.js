import { FESTIVAL } from "./config.js";
import { robotSvg } from "./ai-robot.js";

const onTop = !!document.querySelector(".scene");
const onMido = ["mido", "rally", "vote"].includes(document.body.dataset.page);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;

const MENU = [
  ["memory", "思い出", "MEMORIES", svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>')],
  ["days", "日程", "SCHEDULE", svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>')],
  ["message", "学生主事より", "MESSAGE", svg('<path d="M4.5 5.5h15v10h-8l-4 3.5v-3.5h-3z"/>')],
  ["crowd-now", "いまの混雑", "CROWD", svg('<circle cx="8" cy="8" r="2.5"/><circle cx="16.5" cy="9" r="2"/><path d="M3.5 19c0-3 2-5 4.5-5s4.5 2 4.5 5M14 14.5c.8-.6 1.6-.9 2.5-.9 2.2 0 4 1.8 4 4.4"/>')],
  ["pickup", "みどころ", "HIGHLIGHTS", svg('<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.8 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>')],
  ["ennichi", "縁日", "FOOD & FUN", svg('<path d="M3.5 9L5 4h14l1.5 5M3.5 9h17M3.5 9a2.8 2.8 0 0 0 5.6 0 2.9 2.9 0 0 0 5.8 0 2.8 2.8 0 0 0 5.6 0M5 12v8h14v-8M10 20v-5h4v5"/>')],
  ["exhibit", "学科展示", "DEPARTMENTS", svg('<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 15h9"/>')],
  ["info", "ご来場の皆さまへ", "INFO", svg('<path d="M4 10v4h3l6 4V6L7 10zM17 9a4 4 0 0 1 0 6"/>')],
  ["sponsors", "協賛", "SPONSORS", svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>')],
].filter(([id]) => !onTop || document.getElementById(id))
  .filter(([id]) => id !== "memory" || afterClose());
function afterClose() {
  const np = new URLSearchParams(location.search).get("now");
  const now = np ? Date.parse(np.includes("+") ? np : `${np}+09:00`) : Date.now();
  return now > Date.parse(FESTIVAL.days.at(-1).close);
}
const MORE = [
  ["mido.html", "みどころを詳しく", "TIMETABLE", svg('<path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/><path d="M14.5 7.5v9" stroke-dasharray="1.6 2.2"/>')],
  ["map.html?list=now", "いまやっている", "NOW ON", svg('<circle cx="12" cy="12" r="2.5"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>')],
  ["map.html?list=food", "模擬店をさがす", "FIND FOOD", svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/>')],
  ["rally.html", "スタンプカード", "STAMP CARD", svg('<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="8.5" cy="12" r="2.3"/><circle cx="15.5" cy="12" r="2.3"/>')],
  ["ai.html", "AI番長に聞く", "ASK AI", svg('<rect x="4" y="6" width="16" height="12" rx="3"/><path d="M12 6V3.5M9 11v1.5M15 11v1.5M9.5 15.5h5"/>')],
  ["map.html?list=toilet", "トイレ", "RESTROOMS", svg('<circle cx="7.5" cy="5" r="1.7"/><circle cx="16.5" cy="5" r="1.7"/><path d="M7.5 8.5v11M5 9h5l-.3 5.5M16.5 8.5l-2.8 7h5.6zM16.5 15.5v4"/>')],
];
const MORE_NEEDS = { "ai.html": "*", "mido.html": "pickup", "map.html?list=now": "now", "map.html?list=food": "ennichi", "rally.html": "stamp", "map.html?list=toilet": "*" };
const COLORS = ["var(--sky-1)", "var(--sky-3)", "var(--sun)", "#E7A0A0", "var(--en)"];

const WD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const dayOf = (iso) => {
  const d = new Date(iso);
  const [m, dd, w] = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" }).formatToParts(d)
    .reduce((a, p) => (p.type === "month" ? [p.value, a[1], a[2]] : p.type === "day" ? [a[0], p.value, a[2]] : p.type === "weekday" ? [a[0], a[1], p.value.toUpperCase()] : a), ["", "", ""]);
  return { md: `${m}.${dd}`, wd: WD.includes(w) ? w : "" };
};
const days = FESTIVAL.days.map((d) => dayOf(d.open));

const TABS = [
  ["site", "サイト", onTop ? "#" : "./", svg('<path d="M3.5 11L12 4l8.5 7M6 9.5V20h4.5v-5.5h3V20H18V9.5"/>')],
  ["map", "地図", "map.html", svg('<path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5zM9 4v13.5M15 6.5V20"/>')],
  ["feed", "Enistagram", "map.html?tab=feed", svg('<path d="M16.6 5.2A9 9 0 1 0 16.6 18.8L9.5 12z"/><circle cx="9" cy="7.2" r="1.1" fill="currentColor" stroke="none"/><circle cx="13.3" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="17.3" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="21.3" cy="12" r="1.35" fill="currentColor" stroke="none"/>')],
];

const TZ = [[6, 40, 0], [14, 90, 1], [22, 30, 2], [30, 70, 3], [70, 60, 4], [78, 26, 0], [86, 84, 2], [94, 44, 1]];

let seed = 63;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const f1 = (n) => Number(n.toFixed(1));

const WIRES = [[-4000, 1561.2, 5000, -246.0], [-4000, 1602.4, 5000, -235.4], [600, 667.6, 5000, 5.5]];
const rigHtml = `<div class="pc-rig" aria-hidden="true">
    <svg class="pc-wires" viewBox="0 0 1215 1845" preserveAspectRatio="none">${WIRES.map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`).join("")}</svg>
  </div>`;

const starsHtml = [0, 1, 2].map((g) => `<i class="pc-stars" style="--dur:${3.5 + g * 1.7}s; box-shadow:${Array.from({ length: 26 }, () => `${f1(rnd() * 100)}vw ${f1(rnd() * 58)}vh 0 ${rnd() < 0.18 ? 0.7 : 0}px #fff`).join(",")}"></i>`).join("");

const farSvg = `<svg viewBox="0 0 1440 220" preserveAspectRatio="none"><path d="M-60 220V152C30 146 104 100 186 93C246 88 296 101 348 96C420 90 470 118 540 150C590 172 640 198 706 220ZM880 220C968 170 1060 140 1160 150C1262 160 1360 124 1500 110V220Z"/></svg>`;

const motesHtml = Array.from({ length: 14 }, () => `<i class="pc-mote" style="--x:${f1(rnd() * 100)}%; --s:${Math.round(5 + rnd() * 11)}px; --dur:${Math.round(24 + rnd() * 26)}s; --delay:${-Math.round(rnd() * 48)}s; --drift:${Math.round((rnd() - 0.5) * 140)}px; --o:${(0.3 + rnd() * 0.4).toFixed(2)}"></i>`).join("");

const sv = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const PC_LINKS = [
  ["https://www.google.com/maps/search/?api=1&query=%E5%87%BD%E9%A4%A8%E5%B7%A5%E6%A5%AD%E9%AB%98%E7%AD%89%E5%B0%82%E9%96%80%E5%AD%A6%E6%A0%A1", "Google マップ", sv('<path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5zM9 4v13.5M15 6.5V20"/>'), true],
  ["https://www.hakodate-ct.ac.jp/", "学校サイト", sv('<path d="M3 10l9-5 9 5-9 5zM7 12.5V17c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5v-4.5M21 10v5"/>'), true],
  ["https://www.instagram.com/kosen_gakuseikai/", "インスタ", sv('<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.6"/><path d="M16.8 7.2h.01"/>'), true],
  ["https://x.com/hnct_gakuseikai", "エックス", sv('<path d="M4 4h4.2l11.8 16h-4.2z"/><path d="M19.4 4l-6.2 7M4.6 20l6.2-7"/>'), true],
  ["en.html", "English", sv('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'), false],
];
const pcLinksHtml = PC_LINKS.map(([href, label, icon, ext]) => `<a href="${href}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ' lang="en" hreflang="en"'}>${icon}<span>${label}</span></a>`).join("");

document.body.insertAdjacentHTML("beforeend", `
  <div class="pc-bg" aria-hidden="true">
    ${starsHtml}
    <div class="pc-far">${farSvg}</div>
  </div>
  ${rigHtml}
  <div class="pc-fg" aria-hidden="true">
    <div class="pc-tzs">${TZ.map(([x, len, c], i) => `<i class="pc-tz" style="--x:${x}%; --len:${len}px; --c:${COLORS[c]}; --dur:${(4.2 + (i % 3) * 0.9).toFixed(1)}s; --delay:${(-i * 0.7).toFixed(1)}s"></i>`).join("")}</div>
    <div class="pc-motes">${motesHtml}</div>
  </div>
  <aside class="pc-side is-left">
    <a class="pc-logo" href="${onTop ? "#" : "./"}" aria-label="第63回 函館高専祭「縁」トップへ"><span class="pc-logo-in"><img src="assets/img/logo.webp" width="673" height="657" alt="" loading="lazy" decoding="async"></span></a>
    <p class="pc-ed">第${esc(FESTIVAL.edition)}回 函館高専祭</p>
    <p class="pc-date">${days.map((d) => `<span><b>${d.md}</b><small>${d.wd}</small></span>`).join('<i aria-hidden="true"></i>')}</p>
    <p class="pc-links">${pcLinksHtml}</p>
  </aside>
  <nav class="pc-side is-right" aria-label="メニュー">
    <div class="pc-tabs">${TABS.map(([id, label, href, icon]) => `<a href="${href}" data-pc-tab="${id}">${icon}<span${id === "feed" ? ' class="e-word"' : ""}>${esc(label)}</span></a>`).join("")}</div>
    <p class="pc-h">MENU</p>
    <ul class="pc-menu">${MENU.map(([id, ja, en, icon], i) => `<li><a href="${onTop ? "" : "./"}#${id}" data-pc-sec="${id}"><span class="pc-ic" style="--c:${COLORS[i % COLORS.length]}">${icon}</span><span class="pc-txt"><b>${esc(ja)}</b></span></a></li>`).join("")}</ul>
    <p class="pc-h" id="pc-more-h">MORE</p>
    <ul class="pc-menu" id="pc-more">${MORE.map(([href, ja, en, icon], i) => `<li data-need="${MORE_NEEDS[href] ?? "*"}"><a href="${href}"${href === `${document.body.dataset.page}.html` ? ' aria-current="true"' : ""}><span class="pc-ic" style="--c:${COLORS[(i + 3) % COLORS.length]}">${icon}</span><span class="pc-txt"><b>${esc(ja)}</b></span></a></li>`).join("")}</ul>
  </nav>`);

const SEC_OF = { memory: "memory", message: "message", crowd: "crowd-now", pickup: "pickup", ennichi: "ennichi", exhibit: "exhibit", info: "info", sponsors: "sponsors" };
function orderMenu(blocks) {
  if (!Array.isArray(blocks)) return;
  const ul = document.querySelector(".pc-menu");
  const li = (sec) => ul.querySelector(`[data-pc-sec="${sec}"]`)?.closest("li");
  for (const b of blocks) {
    const item = li(SEC_OF[b?.id]);
    if (!item) continue;
    ul.append(item);
    item.hidden = b.show === false || b.visible === false;
  }
}
function syncMore(blocks) {
  const on = new Set((Array.isArray(blocks) ? blocks : []).filter((b) => b?.show !== false && b?.visible !== false).map((b) => b.id));
  const known = Array.isArray(blocks) && blocks.length > 0;
  const during = (document.body.dataset.phase ?? "") ? document.body.dataset.phase === "during" : Date.now() >= Date.parse(FESTIVAL.days[0].open) && Date.now() <= Date.parse(FESTIVAL.days.at(-1).close);
  const ul = document.getElementById("pc-more");
  ul.querySelectorAll("li").forEach((li) => {
    const need = li.dataset.need;
    li.hidden = need === "*" ? false : need === "now" ? !during : known && !on.has(need);
  });
  const any = [...ul.children].some((li) => !li.hidden);
  ul.hidden = !any;
  document.getElementById("pc-more-h").hidden = !any;
}
let lastBlocks = null;
const sync = (blocks) => { lastBlocks = blocks ?? lastBlocks; orderMenu(lastBlocks); syncMore(lastBlocks); };
try { sync(window.kosenBlocks ?? JSON.parse(localStorage.getItem("kosen63-blocks") ?? "null")); } catch {  }
document.addEventListener("blocks:order", (e) => sync(e.detail));
new MutationObserver(() => syncMore(lastBlocks)).observe(document.body, { attributes: true, attributeFilter: ["data-phase"] });

const logo = document.querySelector(".pc-logo");
const logoIn = logo.querySelector(".pc-logo-in");
const calm = matchMedia("(prefers-reduced-motion: reduce)");
const pcLayers = [document.querySelector(".pc-bg"), document.querySelector(".pc-fg")];
let par = null, parFrame = 0;
addEventListener("pointermove", (e) => {
  if (calm.matches || e.pointerType !== "mouse") return;
  par = [(e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1];
  parFrame ||= requestAnimationFrame(() => { parFrame = 0; for (const el of pcLayers) { el.style.setProperty("--px", par[0].toFixed(3)); el.style.setProperty("--py", par[1].toFixed(3)); } });
}, { passive: true });
addEventListener("pointermove", (e) => {
  if (calm.matches || e.pointerType !== "mouse" || !logo.offsetWidth) return;
  const r = logo.getBoundingClientRect();
  const x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 1.5)));
  const y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height * 1.5)));
  logoIn.style.setProperty("--ry", `${(x * 14).toFixed(2)}deg`);
  logoIn.style.setProperty("--rx", `${(-y * 12).toFixed(2)}deg`);
  logoIn.style.setProperty("--mx", `${(50 + x * 45).toFixed(1)}%`);
  logoIn.style.setProperty("--my", `${(40 + y * 45).toFixed(1)}%`);
}, { passive: true });
document.documentElement.addEventListener("pointerleave", () => { for (const v of ["--rx", "--ry", "--mx", "--my"]) logoIn.style.removeProperty(v); });

let taps = [];
logo.addEventListener("click", () => {
  if (calm.matches) return;
  const now = Date.now();
  taps = [...taps.filter((t) => now - t < 1600), now];
  const spin = taps.length >= 5;
  if (spin) taps = [];
  logoIn.classList.remove("is-pop", "is-spin");
  void logoIn.offsetWidth;
  logoIn.classList.add(spin ? "is-spin" : "is-pop");
  const pane = logo.closest(".pc-side");
  const r = logo.getBoundingClientRect(), p = pane.getBoundingClientRect();
  const n = spin ? 28 : 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const d = (spin ? 150 : 100) + Math.random() * 90;
    const bit = document.createElement("i");
    bit.className = `pc-bit${i % 3 ? "" : " is-dot"}`;
    bit.style.cssText = `left:${r.left - p.left + r.width / 2}px; top:${r.top - p.top + r.height / 2}px; --c:${COLORS[i % COLORS.length]}; --dx:${(Math.cos(a) * d).toFixed(0)}px; --dy:${(Math.sin(a) * d * 0.8 - 40).toFixed(0)}px; --rot:${((Math.random() - 0.5) * 720).toFixed(0)}deg; --dur:${(0.9 + Math.random() * 0.5).toFixed(2)}s`;
    bit.addEventListener("animationend", () => bit.remove());
    pane.append(bit);
  }
});

function markTab() {
  const now = onTop || onMido ? "site" : document.body.classList.contains("is-feed") ? "feed" : "map";
  document.querySelectorAll("[data-pc-tab]").forEach((a) => (a.dataset.pcTab === now ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
}
markTab();
if (!onTop && !onMido) {
  new MutationObserver(markTab).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  document.querySelector(".pc-tabs").addEventListener("click", (e) => {
    const a = e.target.closest("[data-pc-tab]");
    const inner = a && document.querySelector(`#m-tabs [data-tab="${a.dataset.pcTab}"]`);
    if (inner) { e.preventDefault(); inner.click(); }
  });
} else if (onTop) {
  document.querySelector('[data-pc-tab="site"]').addEventListener("click", (e) => { e.preventDefault(); scrollTo({ top: 0 }); });
  const links = new Map([...document.querySelectorAll("[data-pc-sec]")].map((a) => [a.dataset.pcSec, a]));
  const seen = new Map();
  const io = new IntersectionObserver((es) => {
    for (const e of es) seen.set(e.target.id, e.isIntersecting);
    const cur = [...document.querySelectorAll("[data-pc-sec]")].map((a) => a.dataset.pcSec).find((id) => seen.get(id));
    links.forEach((a, id) => (id === cur ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
  }, { rootMargin: "-35% 0px -55% 0px" });
  links.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
}

if (["", "mido", "rally", "vote"].includes(document.body.dataset.page ?? "") && !document.querySelector(".mapapp") && !document.querySelector(".ai-fab")) {
  document.body.insertAdjacentHTML("beforeend", `<a class="ai-fab" href="ai.html" aria-label="AI番長に聞く" title="AI番長に聞く">${robotSvg()}</a>`);
}
