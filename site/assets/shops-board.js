// トップページの「縁日」：模擬店の紹介。掲示板にチラシ（A4 のたて長）を貼ったように、横にすべらせて見る。
// チラシの画像（config.js の SHOPS の flyer）があればそれを、まだなければ「お品書き」の札（店名・団体・ひとこと・ジャンル）を出す。
// 並びは開くたびにばらばら（どのお店も同じように目に入るように。模擬店総選挙もあるので）。上の札でジャンルをしぼれる。
// 押すと、そのお店の詳しいシート（detail.js）。地図へはそこから
// 回転ずしのように、ゆっくり自動で流れ続ける（さわると止まり、はなして3秒で再開。見えていないとき・動きを減らす設定のときは止める）
import { SHOPS, GENRES, HOMEROOMS, MAP } from "./config.js";
import { wireDetails } from "./detail.js";

const box = document.getElementById("ennichi-list");
const chipsBox = document.getElementById("ennichi-chips");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// 地図のどこを開くか：教室の部屋番号 → 決まった場所 → 「〇棟〇階の模擬店」
const mapId = (s) => s.room ?? (s.place || HOMEROOMS[s.cls]) ?? `shops-${s.bldg}${s.floor}`;
// 場所の書き方は地図と同じ「L-2F」（部屋番号しかないお店は、部屋番号の棟と階から）
const where = (s) => {
  if (s.place) return MAP.places.find((p) => p.id === s.place)?.name ?? "";
  if (s.bldg) return `${s.bldg}-${s.floor}`;
  const code = s.room ?? HOMEROOMS[s.cls];
  return code ? `${code[0]}-${code[1]}F` : "";
};
const genreColor = (g) => GENRES.find((x) => x.id === g)?.color ?? "#8a6b4a";

// ジャンルの札：食べもののジャンル（お店があるものだけ）と、食べもの以外（あそび・体験）
const PLAY = "あそび・体験";
const genresOf = (s) => (s.food ? s.genre ?? [] : [PLAY]);
const CHIPS = ["すべて", ...GENRES.map((g) => g.id).filter((g) => SHOPS.some((s) => genresOf(s).includes(g))), ...(SHOPS.some((s) => !s.food) ? [PLAY] : [])];
let pick = "すべて";

// ばらばらの順（開くたびに変わる）
const order = SHOPS.map((s) => [Math.random(), s]).sort((a, b) => a[0] - b[0]).map(([, s]) => s);
const TILTS = [-2.5, 1.8, -1.2, 2.4, -1.8, 1];

function card(s, i, copy = false) {
  const g = genresOf(s);
  const tint = s.food ? genreColor(g[0]) : "#4f7fa8";
  return `<li${copy ? ' aria-hidden="true"' : ""}><a${copy ? ' tabindex="-1"' : ""} data-shop="${SHOPS.indexOf(s)}" class="en-card${s.flyer ? " has-flyer" : ""}" href="map.html#${esc(mapId(s))}" style="--tilt:${TILTS[i % TILTS.length]}deg; --g:${tint}">
    <i class="en-tape" aria-hidden="true"></i>
    ${s.flyer
      ? `<img class="en-flyer" src="${esc(s.flyer)}" alt="${esc(s.name)}のチラシ" loading="lazy" decoding="async">`
      : `<span class="en-paper">
          <span class="en-tags">${g.map((x) => `<span>${esc(x)}</span>`).join("")}</span>
          <b class="en-name">${esc(s.name)}</b>
          ${s.note ? `<span class="en-note">${esc(s.note)}</span>` : ""}
          <span class="en-group">${esc(s.group ?? "")}</span>
        </span>`}
    <span class="en-where">@${esc(where(s)).replace(/[0-9]+/g, (m) => `<span class="vi-num">${m}</span>`)}</span>
  </a></li>`;
}

function render() {
  chipsBox.innerHTML = CHIPS.map((c) => `<button type="button" data-g="${esc(c)}" aria-pressed="${pick === c}">${esc(c)}</button>`).join("");
  const list = pick === "すべて" ? order : order.filter((s) => genresOf(s).includes(pick));
  // 切れ目なく流すために、同じ並びをもう1回つなげる（2回目は読み上げ・Tab では飛ばす）
  box.innerHTML = list.map((s, i) => card(s, i)).join("");
  loopW = 0;
  if (box.scrollWidth > box.clientWidth * 1.2) {
    const first = box.firstElementChild;
    box.insertAdjacentHTML("beforeend", list.map((s, i) => card(s, i, true)).join(""));
    loopW = box.children[list.length].offsetLeft - first.offsetLeft; // 1周の長さ
  }
  box.scrollLeft = 0;
}

// ---------- 自動で流す ----------
const calm = matchMedia("(prefers-reduced-motion: reduce)");
const SPEED = 28; // 1秒に動く px（402px 幅のとき）
let loopW = 0, visible = false, holdUntil = 0, hover = false, last = 0, pos = 0;
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(64, now - (last || now)); last = now;
  if (!loopW || !visible || hover || calm.matches || document.hidden || Date.now() < holdUntil) { pos = box.scrollLeft; return; }
  pos += (SPEED * box.clientWidth / 402) * dt / 1000;
  if (pos >= loopW) pos -= loopW;
  box.scrollLeft = pos;
}
const hold = () => { holdUntil = Date.now() + 3000; };

if (box && chipsBox) {
  chipsBox.addEventListener("click", (e) => {
    const b = e.target.closest("[data-g]");
    if (!b) return;
    pick = b.dataset.g;
    render();
  });
  render();
  // さわっている間・はなして3秒は止める。自分ですべらせたら、そこから続きを流す
  for (const ev of ["pointerdown", "touchstart", "wheel", "keydown", "focusin"]) box.addEventListener(ev, hold, { passive: true });
  box.addEventListener("scroll", () => { if (Date.now() < holdUntil) { hold(); if (loopW && box.scrollLeft >= loopW) box.scrollLeft -= loopW; } }, { passive: true });
  box.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") hover = true; });
  box.addEventListener("pointerleave", () => { hover = false; });
  new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); }).observe(box);
  wireDetails(box);
  requestAnimationFrame(tick);
}
