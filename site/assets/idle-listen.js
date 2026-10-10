export function whileVisible(start, idleMs = 120000) {
  let stop = null, timer = 0;
  const on = () => { if (!stop) stop = start(); };
  const off = () => { stop?.(); stop = null; };
  on();
  document.addEventListener("visibilitychange", () => {
    clearTimeout(timer);
    if (document.hidden) timer = setTimeout(off, idleMs); else on();
  });
}
