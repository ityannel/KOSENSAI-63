const NW = 1405;
const NH = 1995;
const TOTAL = 24;
const MAX_ZOOM = 5;
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, r = document) => r.querySelector(s);

const figs = [...document.querySelectorAll(".pg")];
const chips = [...document.querySelectorAll("#bro-chips a")];
const titleOf = (i) => figs[i - 1]?.querySelector("figcaption")?.textContent.replace(/^\d+ \/ \d+\s+/, "") ?? "";
const srcOf = (i) => `assets/img/brochure/p${String(i).padStart(2, "0")}.webp`;

chips.forEach((a) => a.addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById(`sec-${a.dataset.sec}`)?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
}));

const marks = chips.map((a) => [a, document.getElementById(`sec-${a.dataset.sec}`)]).filter(([, el]) => el);
let ticking = false;
function syncChips() {
  ticking = false;
  const line = innerHeight * 0.4;
  let cur = null;
  for (const [a, el] of marks) if (el.getBoundingClientRect().top < line) cur = a;
  for (const [a] of marks) {
    if (a === cur) {
      if (a.getAttribute("aria-current") !== "true") {
        a.setAttribute("aria-current", "true");
        const bar = a.parentElement;
        bar.scrollTo({ left: a.offsetLeft - (bar.clientWidth - a.offsetWidth) / 2, behavior: calm ? "auto" : "smooth" });
      }
    } else a.removeAttribute("aria-current");
  }
}
addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(syncChips); } }, { passive: true });
syncChips();

const icon = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
let lb = null;
let stage, img, titleEl, countEl, prevBtn, nextBtn, closeBtn;
let cur = 1;
let opener = null;
let base = 1;
let s = 1;
let tx = 0;
let ty = 0;
const pts = new Map();
let pinch = null;
let pan = null;
let lastTap = 0;
let lastTapAt = { x: 0, y: 0 };

function build() {
  lb = document.createElement("div");
  lb.className = "bro-lb";
  lb.hidden = true;
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-label", "パンフレットを大きく見る");
  lb.innerHTML = `<div class="bro-lb-top"><span class="bro-lb-title"></span><button type="button" class="bro-lb-close" aria-label="とじる">${icon('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>')}</button></div>
    <div class="bro-lb-stage"><img class="bro-lb-img" alt="" width="${NW}" height="${NH}" draggable="false"></div>
    <div class="bro-lb-bot"><button type="button" class="bro-lb-prev" aria-label="まえのページ">${icon('<path d="M14.5 5.5L8 12l6.5 6.5"/>')}</button><span class="bro-lb-count"></span><button type="button" class="bro-lb-next" aria-label="つぎのページ">${icon('<path d="M9.5 5.5L16 12l-6.5 6.5"/>')}</button></div>`;
  document.body.append(lb);
  stage = $(".bro-lb-stage", lb);
  img = $(".bro-lb-img", lb);
  titleEl = $(".bro-lb-title", lb);
  countEl = $(".bro-lb-count", lb);
  prevBtn = $(".bro-lb-prev", lb);
  nextBtn = $(".bro-lb-next", lb);
  closeBtn = $(".bro-lb-close", lb);
  closeBtn.addEventListener("click", close);
  prevBtn.addEventListener("click", () => go(cur - 1));
  nextBtn.addEventListener("click", () => go(cur + 1));
  stage.addEventListener("pointerdown", down);
  stage.addEventListener("pointermove", move);
  stage.addEventListener("pointerup", up);
  stage.addEventListener("pointercancel", up);
  stage.addEventListener("wheel", wheel, { passive: false });
  stage.addEventListener("dblclick", (e) => { e.preventDefault(); toggleZoom(e.clientX, e.clientY); });
  addEventListener("resize", () => { if (!lb.hidden) fit(); });
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
  base = Math.min(r.width / NW, r.height / NH) * 0.98;
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
function toggleZoom(x, y) {
  img.style.transition = calm ? "" : "transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)";
  zoomAt(x, y, zoomed() ? base : base * 2.6);
  setTimeout(() => { img.style.transition = ""; }, 240);
}

function show(i) {
  cur = i;
  img.src = srcOf(i);
  img.alt = `パンフレット ${i}ページ目 ${titleOf(i)}`;
  titleEl.textContent = titleOf(i);
  countEl.textContent = `${i} / ${TOTAL}`;
  prevBtn.disabled = i <= 1;
  nextBtn.disabled = i >= TOTAL;
  fit();
  for (const j of [i - 1, i + 1]) if (j >= 1 && j <= TOTAL) new Image().src = srcOf(j);
}

function go(i) {
  if (i < 1 || i > TOTAL || i === cur) return;
  show(i);
  figs[i - 1]?.scrollIntoView({ block: "center" });
}

function open(i, from) {
  if (!lb) build();
  opener = from;
  lb.hidden = false;
  show(i);
  requestAnimationFrame(() => { fit(); lb.classList.add("is-open"); });
  closeBtn.focus({ preventScroll: true });
}

function close() {
  if (!lb || lb.hidden) return;
  lb.classList.remove("is-open");
  const done = () => { lb.hidden = true; img.removeAttribute("src"); };
  if (calm) done(); else setTimeout(done, 230);
  opener?.focus({ preventScroll: true });
}

const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
const mid = () => { const [a, b] = [...pts.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };

function down(e) {
  stage.setPointerCapture(e.pointerId);
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
  if (pinch && pts.size >= 2) {
    const m = mid();
    const r = rect();
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
  if (zoomed()) {
    tx = pan.tx + dx;
    ty = pan.ty + dy;
    const r = rect();
    const w = NW * s;
    const h = NH * s;
    if (w > r.width) tx = Math.min(r.width * 0.15, Math.max(r.width - w - r.width * 0.15, tx));
    else tx = (r.width - w) / 2;
    if (h > r.height) ty = Math.min(r.height * 0.15, Math.max(r.height - h - r.height * 0.15, ty));
    else ty = (r.height - h) / 2;
  } else {
    ty = (rect().height - NH * s) / 2 + dy;
    tx = (rect().width - NW * s) / 2 + dx;
  }
  paint();
}

function up(e) {
  const had = pts.delete(e.pointerId);
  if (!had) return;
  if (pinch) {
    if (pts.size < 2) {
      pinch = null;
      if (s < base) {
        img.style.transition = calm ? "" : "transform 0.2s ease";
        fit();
        setTimeout(() => { img.style.transition = ""; }, 220);
      } else { clamp(); paint(); }
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
  img.style.transition = calm ? "" : "transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)";
  setTimeout(() => { img.style.transition = ""; }, 240);
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4 && (quick || Math.abs(dx) > 120)) {
    fit();
    go(cur + (dx < 0 ? 1 : -1));
  } else if (dy > 110 && dy > Math.abs(dx) * 1.4) {
    close();
  } else {
    fit();
    if (moved < 8) {
      const now = e.timeStamp;
      const near = Math.hypot(e.clientX - lastTapAt.x, e.clientY - lastTapAt.y) < 30;
      if (now - lastTap < 320 && near) { lastTap = 0; toggleZoom(e.clientX, e.clientY); }
      else { lastTap = now; lastTapAt = { x: e.clientX, y: e.clientY }; }
    }
  }
}

function wheel(e) {
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)));
}

document.getElementById("bro-list").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-i]");
  if (b) open(Number(b.dataset.i), b);
});

addEventListener("keydown", (e) => {
  if (!lb || lb.hidden) return;
  const k = e.key;
  if (k === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(); }
  else if (k === "ArrowLeft") { e.preventDefault(); go(cur - 1); }
  else if (k === "ArrowRight") { e.preventDefault(); go(cur + 1); }
  else if (k === "+" || k === "=") { const r = rect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, s * 1.4); }
  else if (k === "-") { const r = rect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, s / 1.4); }
  else if (k === "0") fit();
}, true);
