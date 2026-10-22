const MAX_ZOOM = 6;
const ZOOMABLE = ".tk-photo:not(.is-back), .dt-photo-img, .dt-logo, .dt-flyer img, .en-flyer, .k-msg-photo, .report-card img, #photo-grid img, .v-photo, .eh-photo img, .mm-card img, #secret-img";
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

const host = (() => { try { return top !== self && top.document ? top : self; } catch { return self; } })();
const hdoc = host.document;

if (!hdoc.getElementById("zm-css")) {
  const link = hdoc.createElement("link");
  link.id = "zm-css";
  link.rel = "stylesheet";
  link.href = new URL("zoom.css", import.meta.url).href;
  hdoc.head.append(link);
}

const icon = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const bigOf = (src) => src.replace(/(-l)?\.webp$/, "-l.webp");

let root, stage, img, titleEl, countEl, prevBtn, nextBtn, closeBtn;
let items = [];
let cur = 0;
let opener = null;
let onChange = null;
let NW = 1;
let NH = 1;
let base = 1;
let s = 1;
let tx = 0;
let ty = 0;
let seq = 0;
const pts = new Map();
let pinch = null;
let pan = null;
let lastTap = 0;
let lastTapAt = { x: 0, y: 0 };

function build() {
  root = hdoc.createElement("div");
  root.className = "zm";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "画像を大きく見る");
  root.innerHTML = `<div class="zm-top"><span class="zm-title"></span><button type="button" class="zm-close" aria-label="とじる">${icon('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>')}</button></div>
    <div class="zm-stage"><img class="zm-img" alt="" draggable="false"></div>
    <div class="zm-bot"><button type="button" class="zm-prev" aria-label="まえの画像">${icon('<path d="M14.5 5.5L8 12l6.5 6.5"/>')}</button><span class="zm-count"></span><button type="button" class="zm-next" aria-label="つぎの画像">${icon('<path d="M9.5 5.5L16 12l-6.5 6.5"/>')}</button></div>`;
  hdoc.body.append(root);
  const q = (c) => root.querySelector(c);
  stage = q(".zm-stage");
  img = q(".zm-img");
  titleEl = q(".zm-title");
  countEl = q(".zm-count");
  prevBtn = q(".zm-prev");
  nextBtn = q(".zm-next");
  closeBtn = q(".zm-close");
  closeBtn.addEventListener("click", close);
  prevBtn.addEventListener("click", () => go(cur - 1));
  nextBtn.addEventListener("click", () => go(cur + 1));
  stage.addEventListener("pointerdown", down);
  stage.addEventListener("pointermove", move);
  stage.addEventListener("pointerup", up);
  stage.addEventListener("pointercancel", up);
  stage.addEventListener("wheel", wheel, { passive: false });
  stage.addEventListener("dblclick", (e) => { e.preventDefault(); toggleZoom(e.clientX, e.clientY); });
  const keys = (e) => keydown(e);
  host.addEventListener("keydown", keys, true);
  if (host !== self) addEventListener("keydown", keys, true);
  host.addEventListener("resize", () => { if (!root.hidden) fit(); });
}

const rect = () => stage.getBoundingClientRect();
const paint = () => { img.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`; };

function clamp() {
  const r = rect();
  const w = NW * s;
  const h = NH * s;
  tx = w <= r.width ? (r.width - w) / 2 : Math.min(0, Math.max(r.width - w, tx));
  ty = h <= r.height ? (r.height - h) / 2 : Math.min(0, Math.max(r.height - h, ty));
}

function fit() {
  const r = rect();
  base = Math.min(r.width / NW, r.height / NH);
  s = base;
  tx = 0;
  ty = 0;
  clamp();
  paint();
}

function zoomAt(cx, cy, next) {
  const r = rect();
  const px = cx - r.left;
  const py = cy - r.top;
  const k = Math.min(base * MAX_ZOOM, Math.max(base, next)) / s;
  tx = px - (px - tx) * k;
  ty = py - (py - ty) * k;
  s *= k;
  clamp();
  paint();
}

const zoomed = () => s > base * 1.02;
const ease = (ms = 240) => {
  img.style.transition = calm ? "" : "transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)";
  setTimeout(() => { img.style.transition = ""; }, ms);
};
function toggleZoom(x, y) {
  ease();
  zoomAt(x, y, zoomed() ? base : base * 2.6);
}

function show(i) {
  cur = i;
  const it = items[i];
  const token = ++seq;
  titleEl.textContent = it.title ?? "";
  countEl.textContent = items.length > 1 ? `${i + 1} / ${items.length}` : "";
  root.classList.toggle("is-multi", items.length > 1);
  prevBtn.disabled = i <= 0;
  nextBtn.disabled = i >= items.length - 1;
  img.alt = it.alt ?? it.title ?? "";
  img.style.visibility = "hidden";
  const first = new Image();
  first.onload = () => {
    if (token !== seq) return;
    NW = first.naturalWidth || 1;
    NH = first.naturalHeight || 1;
    img.style.width = `${NW}px`;
    img.style.height = `${NH}px`;
    img.src = first.src;
    fit();
    img.style.visibility = "";
  };
  first.onerror = () => { if (token === seq && first.src !== new URL(it.src, location.href).href) { first.onerror = null; first.src = it.src; } };
  first.src = it.big || it.src;
  for (const j of [i - 1, i + 1]) if (items[j]) new Image().src = items[j].big || items[j].src;
}

function go(i) {
  if (i < 0 || i >= items.length || i === cur) return;
  show(i);
  onChange?.(i);
}

export function openZoom(list, index = 0, opts = {}) {
  if (!list.length) return;
  if (!root) build();
  items = list;
  opener = opts.opener ?? null;
  onChange = opts.onChange ?? null;
  root.hidden = false;
  show(Math.min(Math.max(index, 0), list.length - 1));
  requestAnimationFrame(() => { root.classList.add("is-open"); closeBtn.focus({ preventScroll: true }); });
}

function close() {
  if (!root || root.hidden) return;
  root.classList.remove("is-open");
  const done = () => { root.hidden = true; img.removeAttribute("src"); seq++; };
  if (calm) done(); else setTimeout(done, 220);
  opener?.focus?.({ preventScroll: true });
}

const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
const mid = () => { const [a, b] = [...pts.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };

function down(e) {
  try { stage.setPointerCapture(e.pointerId); } catch {  }
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pts.size === 2) {
    pan = null;
    const m = mid();
    pinch = { d: dist(), s, cx: m.x, cy: m.y };
  } else if (pts.size === 1) {
    pan = { x: e.clientX, y: e.clientY, tx, ty, t: e.timeStamp, moved: 0 };
    stage.classList.add("is-drag");
  }
}

function move(e) {
  if (!pts.has(e.pointerId)) return;
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const r = rect();
  if (pinch && pts.size >= 2) {
    const m = mid();
    const next = Math.min(base * MAX_ZOOM, Math.max(base * 0.8, pinch.s * dist() / pinch.d));
    const k = next / s;
    const px = m.x - r.left;
    const py = m.y - r.top;
    tx = px - (px - tx) * k + (m.x - pinch.cx);
    ty = py - (py - ty) * k + (m.y - pinch.cy);
    s = next;
    pinch.cx = m.x;
    pinch.cy = m.y;
    paint();
    return;
  }
  if (!pan) return;
  const dx = e.clientX - pan.x;
  const dy = e.clientY - pan.y;
  pan.moved = Math.max(pan.moved, Math.hypot(dx, dy));
  const w = NW * s;
  const h = NH * s;
  if (zoomed()) {
    tx = w > r.width ? Math.min(r.width * 0.15, Math.max(r.width - w - r.width * 0.15, pan.tx + dx)) : (r.width - w) / 2;
    ty = h > r.height ? Math.min(r.height * 0.15, Math.max(r.height - h - r.height * 0.15, pan.ty + dy)) : (r.height - h) / 2;
  } else {
    tx = (r.width - w) / 2 + dx;
    ty = (r.height - h) / 2 + dy;
  }
  paint();
}

function up(e) {
  if (!pts.delete(e.pointerId)) return;
  if (pinch) {
    if (pts.size < 2) {
      pinch = null;
      if (s < base) { ease(); fit(); } else { clamp(); paint(); }
      const left = [...pts.values()][0];
      pan = left ? { x: left.x, y: left.y, tx, ty, t: e.timeStamp, moved: 99 } : null;
    }
    return;
  }
  if (!pan) return;
  stage.classList.remove("is-drag");
  const dx = e.clientX - pan.x;
  const dy = e.clientY - pan.y;
  const quick = e.timeStamp - pan.t < 400;
  const moved = pan.moved;
  pan = null;
  if (zoomed()) { clamp(); paint(); return; }
  ease();
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4 && (quick || Math.abs(dx) > 120) && items.length > 1) {
    fit();
    go(cur + (dx < 0 ? 1 : -1));
  } else if (dy > 110 && dy > Math.abs(dx) * 1.4) {
    close();
  } else {
    fit();
    if (moved < 8) {
      const near = Math.hypot(e.clientX - lastTapAt.x, e.clientY - lastTapAt.y) < 30;
      if (e.timeStamp - lastTap < 320 && near) { lastTap = 0; toggleZoom(e.clientX, e.clientY); }
      else { lastTap = e.timeStamp; lastTapAt = { x: e.clientX, y: e.clientY }; }
    }
  }
}

function wheel(e) {
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)));
}

function keydown(e) {
  if (!root || root.hidden) return;
  const k = e.key;
  const r = rect();
  const c = [r.left + r.width / 2, r.top + r.height / 2];
  if (k === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(); }
  else if (k === "ArrowLeft") { e.preventDefault(); e.stopImmediatePropagation(); go(cur - 1); }
  else if (k === "ArrowRight") { e.preventDefault(); e.stopImmediatePropagation(); go(cur + 1); }
  else if (k === "+" || k === "=") zoomAt(c[0], c[1], s * 1.4);
  else if (k === "-") zoomAt(c[0], c[1], s / 1.4);
  else if (k === "0") fit();
}

let pending = null;
let lastMedia = { el: null, t: 0 };
function openFrom(el) {
  const list = (el.dataset.photos ?? "").split("|").filter(Boolean);
  const title = (el.getAttribute("alt") ?? "").replace(/の写真.*$/, "");
  const alt = title ? `${title}の写真` : "写真";
  const one = el.currentSrc || el.src;
  const set = list.length
    ? list.map((src, i) => ({ src, big: bigOf(src), title, alt: `${alt}（${i + 1}枚目）` }))
    : [{ src: one, big: /\/img\/stage\//.test(one) ? bigOf(one) : "", title, alt }];
  openZoom(set, 0, { opener: el.closest("button, a") ?? null });
}

document.addEventListener("click", (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const el = e.target.closest?.(ZOOMABLE);
  if (!el || !(el.currentSrc || el.getAttribute("src")) || el.closest(".zm")) return;
  const media = el.closest("[data-dbl]");
  if (!media) { e.preventDefault(); e.stopPropagation(); }
  if (media) {
    clearTimeout(pending);
    const now = e.timeStamp;
    if (lastMedia.el === media && now - lastMedia.t < 350) { lastMedia = { el: null, t: 0 }; return; }
    lastMedia = { el: media, t: now };
    pending = setTimeout(() => openFrom(el), 360);
    return;
  }
  openFrom(el);
}, true);
