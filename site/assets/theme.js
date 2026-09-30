// 画面の明るさと、差し色（ポスターの空の色）。トップページ・地図・Enistagram・みどころで共通。
// <head> でふつうの script として読む（色が一瞬ちがって見えないように、描く前に決める）。
// - 明るさ：いつもライト（ライト／ダークの切りかえは出さない。スマホがダークモードでもライト）。html[data-theme] = light
// - 差し色：ポスターの空（明け方・昼・夕焼け・日暮れ・夜・くもり・雨・雪）の色（html[data-tint]）。
//   トップページは空の絵が変わるたびに main.js が setTint する。地図はそれを覚えたもの（30分まで）か、時刻で決める
(() => {
  const KEY = "kosen63-theme", TINT_KEY = "kosen63-tint";
  const root = document.documentElement;
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 保存できないブラウザ */ } };
  const pref = () => "light"; // ダークは出さない（前に選んだものが残っていても使わない）

  function apply() {
    const p = pref();
    root.dataset.theme = p === "auto" ? (mq.matches ? "dark" : "light") : p;
    root.style.colorScheme = root.dataset.theme;
    for (const b of document.querySelectorAll("[data-theme-set]")) b.setAttribute("aria-pressed", String(b.dataset.themeSet === p));
    // 地図のページは、ブラウザの上の帯の色も合わせる（トップページは絵の色のまま）
    const meta = document.querySelector('meta[name="theme-color"][data-light]');
    if (meta) meta.content = root.dataset.theme === "dark" ? meta.dataset.dark : meta.dataset.light;
  }

  // 時刻（日本時間）から空を決める（main.js の SKIES と同じ区切り）。?sky=night などで確かめられる
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
    try { saved = JSON.parse(get(TINT_KEY) ?? "null"); } catch { /* 読めなければ時刻で */ }
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
  // 切りかえボタン（どのページでも data-theme-set="auto|light|dark" のボタンを置けば動く）
  addEventListener("click", (e) => { const b = e.target.closest?.("[data-theme-set]"); if (b) window.kosenTheme.set(b.dataset.themeSet); });
  addEventListener("DOMContentLoaded", apply);
})();
