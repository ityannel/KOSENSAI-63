// PC（横に広い画面）だけ：真ん中のスマホの画面の左右に、ロゴと日付（左）・タブとメニュー（右）を出す。
// うしろは、いまの空の絵（ポスターと同じ。theme.js の差し色 data-tint で入れかわる）と、ゆれる短冊。
// トップページと地図のページの両方で読む。表示するかどうかは style.css（幅 1000px 以上）
import { FESTIVAL } from "./config.js";

const onTop = !!document.querySelector(".scene"); // トップページ
const onMido = ["mido", "rally", "vote"].includes(document.body.dataset.page); // みどころ・スタンプカードのページ（サイトの中のページ）
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;

// メニュー：トップページのセクション（地図のページからはトップページのその場所へ）
// 一度削除したもの：高専祭について（about）・タイムテーブル（schedule）・Enistagram の欄（enistagram）・混雑状況（crowd）・スタンプラリー（rally）・企画案内（guide）・会場の様子（report）
// トップページの上から順に。いま読んでいるところに印がつく
const MENU = [
  ["days", "日程", "SCHEDULE", svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>')],
  ["message", "学生主事より", "MESSAGE", svg('<path d="M4.5 5.5h15v10h-8l-4 3.5v-3.5h-3z"/>')],
  ["crowd-now", "いまの混雑", "CROWD", svg('<circle cx="8" cy="8" r="2.5"/><circle cx="16.5" cy="9" r="2"/><path d="M3.5 19c0-3 2-5 4.5-5s4.5 2 4.5 5M14 14.5c.8-.6 1.6-.9 2.5-.9 2.2 0 4 1.8 4 4.4"/>')],
  ["pickup", "みどころ", "HIGHLIGHTS", svg('<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.8 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>')],
  ["ennichi", "縁日", "FOOD & FUN", svg('<path d="M3.5 9L5 4h14l1.5 5M3.5 9h17M3.5 9a2.8 2.8 0 0 0 5.6 0 2.9 2.9 0 0 0 5.8 0 2.8 2.8 0 0 0 5.6 0M5 12v8h14v-8M10 20v-5h4v5"/>')],
  ["vote", "模擬店総選挙", "VOTE", svg('<path d="M5 20h14M7 20v-6h10v6M12 14V4M12 4l-4 4M12 4l4 4"/>')],
  ["info", "ご来場の皆さまへ", "INFO", svg('<path d="M4 10v4h3l6 4V6L7 10zM17 9a4 4 0 0 1 0 6"/>')],
  ["sponsors", "協賛", "SPONSORS", svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>')],
].filter(([id]) => !onTop || document.getElementById(id)); // トップページにない場所は出さない
// ほかのページ・地図のよく使うところ（すぐ開ける）
const MORE = [
  ["mido.html", "みどころを詳しく", "TIMETABLE", svg('<path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/><path d="M14.5 7.5v9" stroke-dasharray="1.6 2.2"/>')],
  ["map.html?list=now", "いまやっている", "NOW ON", svg('<circle cx="12" cy="12" r="2.5"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>')],
  ["map.html?list=food", "模擬店をさがす", "FIND FOOD", svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/>')],
  ["vote.html", "模擬店総選挙に投票", "VOTE", svg('<path d="M5 20h14M7 20v-6h10v6M12 14V4M12 4l-4 4M12 4l4 4"/>')],
  ["rally.html", "スタンプカード", "STAMP CARD", svg('<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="8.5" cy="12" r="2.3"/><circle cx="15.5" cy="12" r="2.3"/>')],
  ["map.html?list=toilet", "トイレ", "RESTROOMS", svg('<circle cx="7.5" cy="5" r="1.7"/><circle cx="16.5" cy="5" r="1.7"/><path d="M7.5 8.5v11M5 9h5l-.3 5.5M16.5 8.5l-2.8 7h5.6zM16.5 15.5v4"/>')],
];
// MORE の各行が出る条件：トップページの、その欄が出ているとき（"now" は開催中だけ、"*" はいつも）
const MORE_NEEDS = { "mido.html": "pickup", "map.html?list=now": "now", "map.html?list=food": "ennichi", "vote.html": "vote", "rally.html": "stamp", "map.html?list=toilet": "*" };
const COLORS = ["var(--sky-1)", "var(--sky-3)", "var(--sun)", "#E7A0A0", "var(--en)"];

// 日付：10.24 SAT
const WD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const dayOf = (iso) => {
  const d = new Date(iso);
  const [m, dd, w] = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" }).formatToParts(d)
    .reduce((a, p) => (p.type === "month" ? [p.value, a[1], a[2]] : p.type === "day" ? [a[0], p.value, a[2]] : p.type === "weekday" ? [a[0], a[1], p.value.toUpperCase()] : a), ["", "", ""]);
  return { md: `${m}.${dd}`, wd: WD.includes(w) ? w : "" };
};
const days = FESTIVAL.days.map((d) => dayOf(d.open));

// タブ（サイト・地図・Enistagram）。地図のページでは、地図と Enistagram はページを読み直さずに切りかえる
const TABS = [
  ["site", "サイト", onTop ? "#" : "./", svg('<path d="M3.5 11L12 4l8.5 7M6 9.5V20h4.5v-5.5h3V20H18V9.5"/>')],
  ["map", "地図", "map.html", svg('<path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5zM9 4v13.5M15 6.5V20"/>')],
  ["feed", "Enistagram", "map.html?tab=feed", svg('<path d="M16.6 5.2A9 9 0 1 0 16.6 18.8L9.5 12z"/><circle cx="9" cy="7.2" r="1.1" fill="currentColor" stroke="none"/><circle cx="13.3" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="17.3" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="21.3" cy="12" r="1.35" fill="currentColor" stroke="none"/>')],
];

// ゆれる短冊（飾り）：左右に4枚ずつ。位置（画面の幅の %）・ひもの長さ・色・ゆれの速さ
const TZ = [[6, 40, 0], [14, 90, 1], [22, 30, 2], [30, 70, 3], [70, 60, 4], [78, 26, 0], [86, 84, 2], [94, 44, 1]];

document.body.insertAdjacentHTML("beforeend", `
  <div class="pc-bg" aria-hidden="true">
    ${TZ.map(([x, len, c], i) => `<i class="pc-tz" style="--x:${x}%; --len:${len}px; --c:${COLORS[c]}; --dur:${(4.2 + (i % 3) * 0.9).toFixed(1)}s; --delay:${(-i * 0.7).toFixed(1)}s"></i>`).join("")}
  </div>
  <aside class="pc-side is-left">
    <a class="pc-logo" href="${onTop ? "#" : "./"}" aria-label="第63回 函館高専祭「縁」トップへ"><span class="pc-logo-in"><img src="assets/img/logo.webp" width="673" height="657" alt="" loading="lazy" decoding="async"></span></a>
    <p class="pc-ed">第${esc(FESTIVAL.edition)}回 函館高専祭</p>
    <p class="pc-date">${days.map((d) => `<span><b>${d.md}</b><small>${d.wd}</small></span>`).join('<i aria-hidden="true"></i>')}</p>
  </aside>
  <nav class="pc-side is-right" aria-label="メニュー">
    <div class="pc-tabs">${TABS.map(([id, label, href, icon]) => `<a href="${href}" data-pc-tab="${id}">${icon}<span${id === "feed" ? ' class="e-word"' : ""}>${esc(label)}</span></a>`).join("")}</div>
    <p class="pc-h">MENU</p>
    <ul class="pc-menu">${MENU.map(([id, ja, en, icon], i) => `<li><a href="${onTop ? "" : "./"}#${id}" data-pc-sec="${id}"><span class="pc-ic" style="--c:${COLORS[i % COLORS.length]}">${icon}</span><span class="pc-txt"><b>${esc(ja)}</b></span></a></li>`).join("")}</ul>
    <p class="pc-h" id="pc-more-h">MORE</p>
    <ul class="pc-menu" id="pc-more">${MORE.map(([href, ja, en, icon], i) => `<li data-need="${MORE_NEEDS[href] ?? "*"}"><a href="${href}"${href === `${document.body.dataset.page}.html` ? ' aria-current="true"' : ""}><span class="pc-ic" style="--c:${COLORS[(i + 3) % COLORS.length]}">${icon}</span><span class="pc-txt"><b>${esc(ja)}</b></span></a></li>`).join("")}</ul>
  </nav>`);

// メニューの順番は、トップページの欄の並びに合わせる（本部コンソールの「サイトの設定」で変わる。blocks.js が知らせる）。出していない欄は、メニューからも消す
// 日程（いちばん上の絵）はいつも最初。ほかのページでは、前にトップページで読んだ並び（このスマホ・PC に覚えてある）
const SEC_OF = { message: "message", vote: "vote", crowd: "crowd-now", pickup: "pickup", ennichi: "ennichi", info: "info", sponsors: "sponsors" }; // 欄の名前 → メニューの行き先
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
// MORE：いまトップページに出ている欄だけ。欄を出していなければ、その行きさき（みどころ・模擬店・スタンプなど）の入口も出さない。「いまやっている」は開催中だけ
function syncMore(blocks) {
  const on = new Set((Array.isArray(blocks) ? blocks : []).filter((b) => b?.show !== false && b?.visible !== false).map((b) => b.id));
  const known = Array.isArray(blocks) && blocks.length > 0; // 並びを知らないときは、全部出す
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
try { sync(window.kosenBlocks ?? JSON.parse(localStorage.getItem("kosen63-blocks") ?? "null")); } catch { /* 覚えていない */ }
document.addEventListener("blocks:order", (e) => sync(e.detail));
new MutationObserver(() => syncMore(lastBlocks)).observe(document.body, { attributes: true, attributeFilter: ["data-phase"] }); // 開催前 → 開催中に変わったら、「いまやっている」を出す

// 左の「縁」のロゴで遊ぶ：マウスの方へ3Dで傾いて光が動く。押すと、ぷにっとつぶれて短冊が飛び散る。何回も続けて押すと一回転
const logo = document.querySelector(".pc-logo");
const logoIn = logo.querySelector(".pc-logo-in");
const calm = matchMedia("(prefers-reduced-motion: reduce)");
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
  void logoIn.offsetWidth; // アニメーションを最初から
  logoIn.classList.add(spin ? "is-spin" : "is-pop");
  // 短冊と丸を飛び散らせる（ロゴの真ん中から）
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

// いまのタブに印
function markTab() {
  const now = onTop || onMido ? "site" : document.body.classList.contains("is-feed") ? "feed" : "map";
  document.querySelectorAll("[data-pc-tab]").forEach((a) => (a.dataset.pcTab === now ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
}
markTab();
if (!onTop && !onMido) {
  new MutationObserver(markTab).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  // 地図のページの中の切りかえは、下のタブ（隠れている）を押したのと同じにする
  document.querySelector(".pc-tabs").addEventListener("click", (e) => {
    const a = e.target.closest("[data-pc-tab]");
    const inner = a && document.querySelector(`#m-tabs [data-tab="${a.dataset.pcTab}"]`);
    if (inner) { e.preventDefault(); inner.click(); }
  });
} else if (onTop) {
  // トップページ：「サイト」はいちばん上へ。メニューは、いま読んでいるセクションに印
  document.querySelector('[data-pc-tab="site"]').addEventListener("click", (e) => { e.preventDefault(); scrollTo({ top: 0 }); });
  const links = new Map([...document.querySelectorAll("[data-pc-sec]")].map((a) => [a.dataset.pcSec, a]));
  const seen = new Map();
  const io = new IntersectionObserver((es) => {
    for (const e of es) seen.set(e.target.id, e.isIntersecting);
    const cur = [...document.querySelectorAll("[data-pc-sec]")].map((a) => a.dataset.pcSec).find((id) => seen.get(id)); // メニューのいまの順で
    links.forEach((a, id) => (id === cur ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
  }, { rootMargin: "-35% 0px -55% 0px" });
  links.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
}
