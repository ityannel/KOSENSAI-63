(() => {
  const KEY = "kosen63-theme", TINT_KEY = "kosen63-tint";
  const root = document.documentElement;
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
