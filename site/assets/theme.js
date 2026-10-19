(() => {
  const KEY = "kosen63-theme", TINT_KEY = "kosen63-tint";
  const root = document.documentElement;
  const lite = (() => {
    const q = new URLSearchParams(location.search).get("lite");
    try { if (q === "1" || q === "0") localStorage.setItem("kosen63-lite", q); } catch {  }
    let saved = null;
    try { saved = localStorage.getItem("kosen63-lite"); } catch {  }
    if (saved === "1" || saved === "0") return saved === "1";
    const c = navigator.connection;
    return (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || !!c?.saveData || /(^|-)2g$|3g/.test(c?.effectiveType ?? "");
  })();
  if (lite) root.classList.add("lite");
  const setLite = (on) => { try { localStorage.setItem("kosen63-lite", on ? "1" : "0"); } catch {  } location.reload(); };
  const liteUi = () => {
    const st = document.createElement("style");
    st.textContent = ".lite-note{position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));z-index:9999;display:flex;align-items:center;gap:8px;width:min(92vw,380px);box-sizing:border-box;translate:-50% 0;padding:10px 12px;border:2px solid #634A2E;border-radius:14px;background:#FFFBF2;color:#634A2E;font:700 13px/1.5 'Zen Kaku Gothic New',sans-serif;box-shadow:-4px 3px 0 rgba(48,44,41,.45)}.lite-note span{flex:1}.lite-note button,.lite-btn{padding:6px 12px;border:1.5px solid #634A2E;border-radius:999px;background:#FEEBC4;color:#634A2E;font:700 12.5px 'Zen Kaku Gothic New',sans-serif;cursor:pointer}.lite-note .x{padding:4px 9px;border:0;background:none;font-size:18px;line-height:1}.lite-btn{padding:10px 18px;font-size:14px}";
    document.head.append(st);
    document.querySelectorAll("[data-lite-toggle]").forEach((b) => {
      const on = root.classList.contains("lite");
      b.classList.add("lite-btn");
      b.textContent = on ? "軽量モード：オン（ふつうの表示にする）" : "軽量モード：オフ（軽くする）";
      b.addEventListener("click", () => setLite(!on));
    });
    let shown = false;
    try { shown = localStorage.getItem("kosen63-lite-note") === "1"; } catch {  }
    if (!root.classList.contains("lite") || shown || document.querySelector("[data-lite-toggle]")) return;
    const n = document.createElement("div");
    n.className = "lite-note";
    n.setAttribute("role", "status");
    n.innerHTML = '<span>軽量モードで表示しています。動きや効果を減らして、軽くしています。</span><button type="button" data-a="off">ふつうに戻す</button><button type="button" class="x" data-a="x" aria-label="閉じる">×</button>';
    n.addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (!a) return;
      try { localStorage.setItem("kosen63-lite-note", "1"); } catch {  }
      if (a === "off") setLite(false); else n.remove();
    });
    document.body.append(n);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", liteUi); else liteUi();
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch {  } };
  const pref = () => "light";

  function apply() {
    const p = pref();
    root.dataset.theme = p === "auto" ? (mq.matches ? "dark" : "light") : p;
    root.style.colorScheme = root.dataset.theme;
    for (const b of document.querySelectorAll("[data-theme-set]")) b.setAttribute("aria-pressed", String(b.dataset.themeSet === p));
    const meta = document.querySelector('meta[name="theme-color"][data-light]');
    if (meta) meta.content = root.dataset.theme === "dark" ? meta.dataset.dark : meta.dataset.light;
  }

  function skyByTime() {
    const forced = new URLSearchParams(location.search).get("sky");
    if (forced) return forced;
    const [h, m] = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }).split(":").map(Number);
    const t = h + m / 60;
    return t < 5 ? "night" : t < 7 ? "dawn" : t < 15.5 ? "day" : t < 17.5 ? "sunset" : t < 19 ? "dusk" : "night";
  }
  function setTint(name, remember = true) {
    root.dataset.tint = name;
    if (remember) put(TINT_KEY, JSON.stringify({ name, at: Date.now() }));
  }
  function autoTint() {
    let saved = null;
    try { saved = JSON.parse(get(TINT_KEY) ?? "null"); } catch {  }
    const fresh = saved && Date.now() - saved.at < 30 * 60000 && !new URLSearchParams(location.search).has("sky");
    setTint(fresh ? saved.name : skyByTime(), false);
  }

  window.kosenTheme = {
    get: pref,
    set(p) { put(KEY, p); apply(); dispatchEvent(new CustomEvent("kosen-theme", { detail: root.dataset.theme })); },
    setTint,
  };
  mq.addEventListener?.("change", () => { apply(); dispatchEvent(new CustomEvent("kosen-theme", { detail: root.dataset.theme })); });
  apply();
  autoTint();
  if (!root.dataset.tintLocked) setInterval(() => { if (!root.dataset.tintLocked) autoTint(); }, 5 * 60000);
  addEventListener("click", (e) => { const b = e.target.closest?.("[data-theme-set]"); if (b) window.kosenTheme.set(b.dataset.themeSet); });
  addEventListener("DOMContentLoaded", apply);
  addEventListener("dragstart", (e) => { const el = e.target instanceof Element ? e.target : e.target?.parentElement; if (el?.closest("img, a:has(img)")) e.preventDefault(); });
})();
