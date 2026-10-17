const DIST = 96;
const FAST = 0.55;
const calm = matchMedia("(prefers-reduced-motion: reduce)");

const scrollersOf = (from, root) => {
  const list = [];
  for (let n = from; n && n.nodeType === 1; n = n.parentElement) {
    if (n.scrollHeight > n.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(n).overflowY)) list.push(n);
    if (n === root) break;
  }
  return list;
};

export function resetPull(root) {
  root.style.transition = "";
  root.style.transform = "";
}

export function pullDown(root, onClose, { page = false, skip = "input, textarea, select, [data-no-pull]" } = {}) {
  let g = null;
  const settle = () => {
    root.style.transition = "transform 0.26s cubic-bezier(0.2, 0.8, 0.2, 1)";
    root.style.transform = "translateY(0)";
    setTimeout(() => resetPull(root), 280);
  };
  const dismiss = () => {
    if (calm.matches) return onClose();
    root.style.transition = "transform 0.22s cubic-bezier(0.4, 0, 1, 1)";
    root.style.transform = `translateY(${innerHeight}px)`;
    setTimeout(onClose, 200);
  };
  const scrolled = (s) => s.sc.some((n) => n.scrollTop > 0) || (page && (document.scrollingElement?.scrollTop ?? 0) > 0);

  root.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1 || e.target.closest?.(skip)) { g = null; return; }
    const t = e.touches[0];
    g = { x: t.clientX, y: t.clientY, on: false, dy: 0, ly: t.clientY, lt: e.timeStamp, v: 0, sc: scrollersOf(e.target, root) };
  }, { passive: true });

  root.addEventListener("touchmove", (e) => {
    if (!g) return;
    const t = e.touches[0], dy = t.clientY - g.y, dx = t.clientX - g.x;
    if (!g.on) {
      if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || scrolled(g)) { g = null; return; }
      g.on = true;
      root.style.transition = "none";
    }
    if (e.cancelable) e.preventDefault();
    const dt = Math.max(1, e.timeStamp - g.lt);
    g.v = (t.clientY - g.ly) / dt;
    g.ly = t.clientY;
    g.lt = e.timeStamp;
    g.dy = Math.max(0, dy);
    root.style.transform = `translateY(${g.dy}px)`;
  }, { passive: false });

  const end = (e) => {
    const s = g;
    g = null;
    if (!s?.on) return;
    const quick = e.timeStamp - s.lt < 90 ? s.v : 0;
    if (s.dy > DIST || (quick > FAST && s.dy > 24)) dismiss(); else settle();
  };
  root.addEventListener("touchend", end);
  root.addEventListener("touchcancel", end);
  addEventListener("pageshow", () => resetPull(root));
}
