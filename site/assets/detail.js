// みどころのチケット・縁日のお店を押したときに、下から出てくる詳しいシート。
// 地図へはいきなり行かず、ここの「地図で場所を見る」から行く。
// トップページ（main.js・shops-board.js）と、みどころのページ（mido-page.js）で使う
import { SHOPS, GENRES, HOMEROOMS, MAP, ELECTION } from "./config.js";
import { ALL_TICKETS, ticketHtml, isOn, isPast, esc, hhmm, venueName, photosOf } from "./tickets.js";
import { tRange } from "./schedule.js";

const fmt = (iso, o) => new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", ...o }).format(new Date(iso));
const dayText = (iso) => `${fmt(iso, { month: "numeric" })}.${fmt(iso, { day: "numeric" })} ${fmt(iso, { weekday: "short" }).toUpperCase()}`;
const mins = (ms) => Math.max(1, Math.round(ms / 60000));

// ---------- シートの外側（1つだけ作って使いまわす） ----------
let root, sheet, body, lastFocus;
function build() {
  if (root) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="dt" id="dt" hidden>
      <div class="dt-backdrop" data-dt-close></div>
      <section class="dt-sheet" role="dialog" aria-modal="true" aria-labelledby="dt-title" tabindex="-1">
        <button type="button" class="mido-close dt-close" data-dt-close aria-label="とじる"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg></span></button>
        <div class="dt-body" id="dt-body"></div>
      </section>
    </div>`);
  root = document.getElementById("dt");
  sheet = root.querySelector(".dt-sheet");
  body = document.getElementById("dt-body");
  root.addEventListener("click", (e) => { if (e.target.closest("[data-dt-close]")) close(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !root.hidden) close(); });
}
function open(html) {
  build();
  lastFocus = document.activeElement;
  body.innerHTML = html;
  root.hidden = false;
  root.classList.remove("is-closing");
  document.documentElement.classList.add("dt-open"); // うしろのページを動かさない
  sheet.scrollTop = 0;
  sheet.focus({ preventScroll: true }); // シートに合わせる（× に枠が出ないように）
}
function close() {
  if (!root || root.hidden) return;
  const done = () => { root.hidden = true; document.documentElement.classList.remove("dt-open"); lastFocus?.focus?.({ preventScroll: true }); };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return done();
  root.classList.add("is-closing");
  let gone = false;
  const go = () => { if (!gone) { gone = true; done(); } };
  sheet.addEventListener("animationend", go, { once: true });
  setTimeout(go, 450);
}

const mapLinks = (id) => `
  <div class="dt-links">
    <a class="mido-more dt-go" href="map.html#${esc(id)}"><span>地図で場所を見る</span></a>
  </div>`;

// ---------- イベント・ステージの団体 ----------
export function openEvent(e, t = Date.now()) {
  const on = isOn(e, t), past = isPast(e, t);
  const start = Date.parse(e.start);
  const state = on ? "" : past ? "終了しました" : start - t < 3 * 3600000 ? `あと${mins(start - t)}分で始まります` : "";
  open(`
    <div class="dt-ticket" aria-hidden="true">${ticketHtml(e, 0, t)}</div>
    ${e.photo ? (() => { const all = photosOf(e); return `<figure class="dt-photo"><img class="dt-photo-img" data-photos="${esc(all.join("|"))}" src="${esc(e.photo.replace(/\.webp$/, "-l.webp"))}" alt="${esc(e.title)}の写真（押すと画面いっぱいに表示）" decoding="async"></figure>`; })() : ""}
    <h2 class="dt-title" id="dt-title">${esc(e.title)}${on ? ' <span class="dt-now">NOW</span>' : ""}</h2>
    ${state ? `<p class="dt-state">${esc(state)}</p>` : ""}
    <dl class="dt-facts">
      <div><dt>日時</dt><dd>${dayText(e.start)}　${tRange(e)}</dd></div>
      <div><dt>場所</dt><dd>${esc(venueName(e.venue))}</dd></div>
      ${[e.kind, e.mood].filter(Boolean).length ? `<div><dt>種類</dt><dd>${esc([e.kind, e.mood].filter(Boolean).join("・"))}</dd></div>` : ""}
    </dl>
    ${e.copy ? `<p class="dt-copy">${esc(e.copy).replace(/\n/g, "<br>")}</p>` : ""}
    ${/^[\w.]{1,30}$/.test(e.insta ?? "") ? `<div class="dt-links"><a class="mido-more dt-go dt-insta" href="https://www.instagram.com/${esc(e.insta)}/" target="_blank" rel="noopener noreferrer"><span><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.6"/><path d="M16.8 7.2h.01"/></svg>Instagram　@${esc(e.insta)}</span></a></div>` : ""}
    ${e.internal ? '<p class="dt-note">学内の方限定の企画です。</p>' : ""}
    ${e.live ? '<p class="dt-note">YouTube で生配信します（配信中はトップページに出ます）。</p>' : ""}
    ${mapLinks(e.venue)}`);
}

// ---------- 縁日のお店 ----------
const where = (s) => {
  if (s.place) return MAP.places.find((p) => p.id === s.place)?.name ?? "";
  if (s.bldg) return `${s.bldg}-${s.floor}`;
  const code = s.room ?? HOMEROOMS[s.cls];
  return code ? `${code[0]}-${code[1]}F` : "";
};
export const shopMapId = (s) => s.room ?? (s.place || HOMEROOMS[s.cls]) ?? `shops-${s.bldg}${s.floor}`;
function voteUrl(s, now) {
  const e = ELECTION;
  if (!e?.form || now < Date.parse(e.opens) || now >= Date.parse(e.closes)) return null;
  return e.prefill ? e.prefill.replace("{shop}", encodeURIComponent(s.name)) : e.form;
}
// お店のいまの様子（待ち時間・休業中）と、お店のひとこと。シートを開いたときに Firestore から読む（トップを開いただけでは読まない）
const STATUS = { "10min": ["10分待ち", "#e8a317"], "20min": ["20分以上待ち", "#d93025"], soldout: ["売り切れ", "#6b6b6b"], closed: ["休業中", "#4b5a8a"] };
let liveList = null, liveP = null;
const liveWatchers = new Set(); // 縁日の札（shops-board.js）など、お店の様子が届くたびに知りたいところ
function liveShops() {
  liveP ??= import("./live.js").then(({ subscribeShops }) => subscribeShops((list) => {
    liveList = list;
    document.querySelectorAll("[data-live-shop]").forEach(fillLive);
    liveWatchers.forEach((fn) => fn());
  })).catch(() => {});
  return liveP;
}
const norm = (t) => String(t ?? "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();
// 地図（map.js の shopDocFor）と同じ見分け方：map（クラス・部屋番号・名前）か、名前
function docFor(s) {
  const room = s.room ?? HOMEROOMS[s.cls];
  return liveList?.find((d) => (d.map ? [s.name, s.cls, room].filter(Boolean).some((v) => norm(v) === norm(d.map)) : norm(d.name) === norm(s.name))) ?? null;
}
// お店の様子を読み始める（縁日の札から）。届くたびに fn を呼ぶ
export function watchShops(fn) { liveWatchers.add(fn); if (liveList) fn(); liveShops(); }
export const liveOf = (s) => { const d = docFor(s); const st = d && STATUS[d.status]; return st ? { label: st[0], color: st[1], at: d.updated_at } : null; }; // 待ちなし・情報なしは null
const ago = (ms) => { const m = Math.floor((Date.now() - ms) / 60000); return m < 1 ? "たった今" : m < 60 ? `${m}分前` : `${Math.floor(m / 60)}時間前`; };
function fillLive(el) {
  const s = SHOPS[+el.dataset.liveShop];
  const d = s && docFor(s);
  const st = d && STATUS[d.status];
  el.innerHTML = `${st ? `<p class="dt-status" style="--c:${st[1]}"><i></i>${esc(st[0])}${d.updated_at ? `<small>${esc(ago(d.updated_at))}</small>` : ""}</p>` : ""}
    ${d?.message ? `<p class="dt-msg"><b>お店から</b>${esc(d.message)}${d.message_at ? `<small>${esc(ago(d.message_at))}</small>` : ""}</p>` : ""}`;
}
export function openShop(s, now = Date.now()) {
  const genres = s.food ? s.genre ?? [] : ["あそび・体験"];
  const color = (g) => GENRES.find((x) => x.id === g)?.color ?? "#4f7fa8";
  const vote = voteUrl(s, now);
  open(`
    ${s.flyer ? `<a class="dt-flyer" href="${esc(s.flyer)}" target="_blank" rel="noopener"><img src="${esc(s.flyer)}" alt="${esc(s.name)}のチラシ"></a><p class="dt-small">チラシを押すと、大きく開きます（指で拡大できます）</p>` : ""}
    <p class="dt-tags">${genres.map((g) => `<span style="--g:${color(g)}">${esc(g)}</span>`).join("")}</p>
    <h2 class="dt-title" id="dt-title">${esc(s.name)}</h2>
    <div class="dt-live" data-live-shop="${SHOPS.indexOf(s)}"></div>
    ${s.note ? `<p class="dt-copy">${esc(s.note)}</p>` : ""}
    <dl class="dt-facts">
      <div><dt>団体</dt><dd>${esc(s.group ?? "")}</dd></div>
      <div><dt>場所</dt><dd>${esc(where(s))}</dd></div>
    </dl>
    ${vote ? `<a class="mido-more dt-go dt-vote" href="${esc(vote)}" target="_blank" rel="noopener"><span>模擬店総選挙で、このお店に投票</span></a>` : ""}
    ${mapLinks(shopMapId(s))}`);
  const live = document.querySelector("[data-live-shop]");
  if (live) { if (liveList) fillLive(live); liveShops(); }
}

// ほかの場所（ご来場の皆さまへの札など）からも、同じシートを使う
export { open as openSheet };

// 押したチケット・お店から、詳しいシートを開く（リンクの行き先は地図のまま残す。新しいタブで開くときなどはそのまま）
export function wireDetails(container, getNow = () => Date.now()) {
  container?.addEventListener("click", (ev) => {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    const tk = ev.target.closest("[data-tk]");
    const sh = ev.target.closest("[data-shop]");
    if (tk) { ev.preventDefault(); openEvent(ALL_TICKETS[+tk.dataset.tk], getNow()); }
    else if (sh) { ev.preventDefault(); openShop(SHOPS[+sh.dataset.shop], getNow()); }
  });
}

// ---------- 写真を大きく見る（スライドショー） ----------
// チケットの写真（.tk-photo）・詳しいシートの写真（.dt-photo-img）を押すと、元の構図のままの大きい写真を出す。
// 写真が複数あるときは、左右の矢印・スワイプ・← → キーで送れる（data-photos に、見せる順の小さい版の URL が「|」でつながっている）。大きい版は「◯◯.webp」の「◯◯-l.webp」
// チケットを押したときの動き（シートを開く）より先に受けたいので、capture で拾う
let zoom, zoomImg, zoomLast, zList = [], zIdx = 0, zName = "";
const bigOf = (src) => src.replace(/(-l)?\.webp$/, "-l.webp");
function zoomBuild() {
  if (zoom) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="pz" id="pz" hidden tabindex="-1" role="dialog" aria-modal="true" aria-label="写真を大きく表示">
      <button type="button" class="mido-close pz-close" data-pz-close aria-label="とじる"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg></span></button>
      <button type="button" class="pz-nav pz-prev" aria-label="前の写真"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
      <button type="button" class="pz-nav pz-next" aria-label="次の写真"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
      <figure class="pz-fig"><img class="pz-img" alt="" decoding="async"><figcaption class="pz-cap"></figcaption></figure>
    </div>`);
  zoom = document.getElementById("pz");
  zoomImg = zoom.querySelector(".pz-img");
  zoom.addEventListener("click", (e) => {
    if (e.target.closest(".pz-prev")) return zoomGo(-1, e);
    if (e.target.closest(".pz-next")) return zoomGo(1, e);
    zoomClose(); // 矢印以外は、どこを押してもとじる
  });
  addEventListener("keydown", (e) => {
    if (zoom.hidden) return;
    if (e.key === "Escape") { e.stopPropagation(); zoomClose(); }
    else if (e.key === "ArrowLeft") zoomGo(-1, e);
    else if (e.key === "ArrowRight") zoomGo(1, e);
  }, true);
  // スワイプ（指で左右）
  let x0 = null;
  zoom.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  zoom.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) { zoomGo(dx < 0 ? 1 : -1, e); zoom.dataset.swiped = "1"; setTimeout(() => delete zoom.dataset.swiped, 350); }
  });
}
function zoomShow() {
  const src = zList[zIdx];
  zoomImg.src = src; // 大きい版が届くまで、小さい版を出しておく
  const big = new Image();
  big.onload = () => { if (!zoom.hidden && zList[zIdx] === src) zoomImg.src = big.src; };
  big.src = bigOf(src);
  zoomImg.alt = zName ? `${zName}の写真（${zIdx + 1}枚目）` : "写真";
  zoom.querySelector(".pz-cap").textContent = zName;
  zoom.classList.toggle("is-multi", zList.length > 1);
}
function zoomGo(d, e) {
  e?.preventDefault?.(); e?.stopPropagation?.();
  if (zList.length < 2) return;
  zIdx = (zIdx + d + zList.length) % zList.length;
  zoomImg.classList.remove("is-slide-l", "is-slide-r"); void zoomImg.offsetWidth; // アニメーションをやりなおす
  zoomImg.classList.add(d > 0 ? "is-slide-l" : "is-slide-r");
  zoomShow();
}
function zoomOpen(thumb) {
  zoomBuild();
  zoomLast = document.activeElement;
  zList = (thumb.dataset.photos || thumb.getAttribute("src")).split("|").filter(Boolean);
  zIdx = 0;
  zName = thumb.alt.replace(/の写真.*$/, "");
  zoomImg.classList.remove("is-slide-l", "is-slide-r");
  zoomShow();
  zoom.classList.remove("is-closing");
  zoom.hidden = false;
  zoom.focus({ preventScroll: true }); // 枠が出ないように、× ではなく外側に合わせる
}
function zoomClose() {
  if (!zoom || zoom.hidden) return;
  if (zoom.dataset.swiped) return; // スワイプの直後のタップで、とじない
  const done = () => { zoom.hidden = true; zoomLast?.focus?.({ preventScroll: true }); };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return done();
  zoom.classList.add("is-closing");
  setTimeout(done, 220);
}
document.addEventListener("click", (e) => {
  const img = e.target.closest?.(".tk-photo:not(.is-back), .dt-photo-img");
  if (!img) return;
  e.preventDefault();
  e.stopPropagation(); // チケットを押した扱いにしない（シートを開かない）
  zoomOpen(img);
}, true);
