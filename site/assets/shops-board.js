import { SHOPS, GENRES, HOMEROOMS, MAP } from "./config.js";
import { wireDetails, watchShops, liveOf } from "./detail.js";

const box = document.getElementById("ennichi-list");
const chipsBox = document.getElementById("ennichi-chips");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const mapId = (s) => s.room ?? (s.place || HOMEROOMS[s.cls]) ?? `shops-${s.bldg}${s.floor}`;
const where = (s) => {
  if (s.place) return MAP.places.find((p) => p.id === s.place)?.name ?? "";
  if (s.bldg) return `${s.bldg}-${s.floor}`;
  const code = s.room ?? HOMEROOMS[s.cls];
  return code ? `${code[0]}-${code[1]}F` : "";
};
const genreColor = (g) => GENRES.find((x) => x.id === g)?.color ?? "#8a6b4a";

const PLAY = "あそび・体験";
const genresOf = (s) => (s.food ? s.genre ?? [] : [PLAY]);
const CHIPS = ["すべて", ...GENRES.map((g) => g.id).filter((g) => SHOPS.some((s) => genresOf(s).includes(g))), ...(SHOPS.some((s) => !s.food) ? [PLAY] : [])];
let pick = "すべて";

const order = SHOPS.map((s) => [Math.random(), s]).sort((a, b) => a[0] - b[0]).map(([, s]) => s);
const TILTS = [-2.5, 1.8, -1.2, 2.4, -1.8, 1];
const PAPERS = ["#FFF8E8", "#FFEFE0", "#F6F3DA", "#EAF3EA", "#EEF1F8", "#FBEAF0"];
const paperOf = (name) => PAPERS[[...String(name)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % PAPERS.length];

const nameSize = (name) => {
  const w = Math.max(...String(name).split(/\r?\n/).map((ln) => [...ln].reduce((a, ch) => a + (ch.charCodeAt(0) < 256 ? 0.58 : 1), 0)));
  return Math.max(15, Math.min(25, Math.floor((126 / Math.max(w, 1)) * 10) / 10));
};
function card(s, i, copy = false) {
  const g = [...genresOf(s)].sort((a, b) => (b === pick) - (a === pick));
  const tint = s.food ? genreColor(g[0]) : "#4f7fa8";
  return `<li${copy ? ' aria-hidden="true"' : ""}><a${copy ? ' tabindex="-1"' : ""} data-shop="${SHOPS.indexOf(s)}" class="en-card${s.flyer ? " has-flyer" : ""}" href="map.html#${esc(mapId(s))}" style="--tilt:${TILTS[i % TILTS.length]}deg; --g:${tint}; --paper:${paperOf(s.name)}">
    <i class="en-tape" aria-hidden="true"></i>
    ${s.flyer
      ? `<img class="en-flyer" src="${esc(s.flyer)}" alt="${esc(s.name)}のチラシ" loading="lazy" decoding="async">`
      : `<span class="en-paper">
          <b class="en-name" style="font-size:calc(${nameSize(s.name)} * var(--u))">${esc(s.name)}</b>
          <span class="en-tags">${g.map((x) => `<span style="--gc:${genreColor(x)}">${esc(x.replace(/系$/, ""))}</span>`).join("")}</span>
          ${s.note ? `<span class="en-note">${esc(s.note)}</span>` : ""}
          <span class="en-group">${esc(s.group ?? "")}</span>
        </span>`}
    <span class="en-live" data-live-card></span>
    <span class="en-where">@${esc(where(s)).replace(/[0-9]+/g, (m) => `<span class="vi-num">${m}</span>`)}</span>
  </a></li>`;
}

function render() {
  chipsBox.innerHTML = CHIPS.map((c) => `<button type="button" data-g="${esc(c)}" aria-pressed="${pick === c}">${esc(c)}</button>`).join("");
  const list = pick === "すべて" ? order : order.filter((s) => genresOf(s).includes(pick));
  box.innerHTML = list.map((s, i) => card(s, i)).join("");
  loopW = 0;
  if (box.scrollWidth > box.clientWidth * 1.2) {
    const first = box.firstElementChild;
    box.insertAdjacentHTML("beforeend", list.map((s, i) => card(s, i, true)).join(""));
    loopW = box.children[list.length].offsetLeft - first.offsetLeft;
  }
  box.scrollLeft = 0;
  paintLive();
}
function paintLive() {
  box.querySelectorAll("a[data-shop]").forEach((a) => {
    const x = liveOf(SHOPS[+a.dataset.shop]);
    const el = a.querySelector("[data-live-card]");
    if (!el) return;
    el.hidden = !x;
    el.innerHTML = String(x?.label ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`).replace(/[0-9]+/g, (m) => `<span class="vi-num">${m}</span>`);
    if (x) el.style.setProperty("--c", x.color);
  });
}

const calm = matchMedia("(prefers-reduced-motion: reduce)");
const SPEED = 28;
let loopW = 0, visible = false, holdUntil = 0, hover = false, last = 0, pos = 0;
let running = false;
function tick(now) {
  if (!visible) { running = false; last = 0; return; }
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
  let built = false;
  new IntersectionObserver((es, io) => {
    if (built || !es.some((e) => e.isIntersecting)) return;
    built = true; io.disconnect(); render(); watchShops(paintLive);
  }, { rootMargin: "600px 0px" }).observe(box);
  for (const ev of ["pointerdown", "touchstart", "wheel", "keydown", "focusin"]) box.addEventListener(ev, hold, { passive: true });
  box.addEventListener("scroll", () => { if (Date.now() < holdUntil) { hold(); if (loopW && box.scrollLeft >= loopW) box.scrollLeft -= loopW; } }, { passive: true });
  box.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") hover = true; });
  box.addEventListener("pointerleave", () => { hover = false; });
  new IntersectionObserver((es) => {
    visible = es.some((e) => e.isIntersecting);
    if (visible && !running) { running = true; requestAnimationFrame(tick); }
  }).observe(box);
  wireDetails(box);
}
