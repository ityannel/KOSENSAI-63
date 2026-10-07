// テスト用の操作パネル。URL に ?test=1 を付けたときだけ読み込まれる（来場者には出ない）。
// 時刻・空・天気・デモデータは URL の値を変えて読み込み直す。花火やメニューなどはその場で動かす。
import { RALLY, FESTIVAL } from "./config.js";

const params = new URLSearchParams(location.search);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// よく使う時刻（日本時間）
export const TIMES = [
  ["いま（本当の時刻）", ""],
  ["開幕10秒前（花火）", "2026-10-24T11:59:50"],
  ["開催中・企画あり", "2026-10-24T13:30"],
  ["企画の間（NEXTだけ）", "2026-10-24T14:45"],
  ["1日目の夜", "2026-10-24T18:00"],
  ["2日目の朝（開場前）", "2026-10-25T08:30"],
  ["結果発表（配信・15:45）", "2026-10-25T15:45"],
  ["1日目の公開終了（16:00）直前", "2026-10-24T15:59:50"],
  ["公開終了後（大抽選会・学内のみ）", "2026-10-25T16:05"],
  ["終了後", "2026-10-26T10:00"],
];
export const SKIES = [["自動", ""], ["明け方", "dawn"], ["昼", "day"], ["夕焼け", "sunset"], ["日暮れ", "dusk"], ["夜", "night"]];
export const WEATHERS = [["本物", ""], ["晴れ", "clear"], ["くもり", "cloudy"], ["霧", "fog"], ["雨", "rain"], ["雪", "snow"], ["雷", "thunder"]];
// トップページの場所（スクロールで出るもの）と、押すと開くパネル
export const PANELS = [["日程・入口", "days"], ["みどころ", "pickup"], ["縁日（模擬店）", "ennichi"], ["ご来場の皆さまへ", "info"], ["協賛", "sponsors"],
  ["（パネル）高専祭について", "about"], ["（パネル）タイムテーブル", "schedule"], ["（パネル）Enistagram", "enistagram"], ["（パネル）混雑状況", "crowd"],
  ["（パネル）企画案内", "guide"], ["（パネル）食レポ・写真", "report"], ["（パネル）隠し縁のごほうび", "secret"]];
// ほかのページ（今の設定のまま開く）
export const PAGES = [["校内マップ", "map.html"], ["Enistagram", "map.html?tab=feed"], ["みどころ", "mido.html"], ["スタンプカード", "rally.html"],
  ["模擬店用のページ", "shop.html"], ["本部コンソール", "staff/"]];
const local = ["localhost", "127.0.0.1"].includes(location.hostname);

// URL の値を変えて読み込み直す（test=1 は残す）
function reloadWith(changes) {
  const p = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(changes)) {
    if (v === "" || v == null || v === false) p.delete(k);
    else p.set(k, v === true ? "1" : v);
  }
  p.set("test", "1");
  location.href = `${location.pathname}?${p}`;
}
function store(fn) {
  try { fn(localStorage); } catch { /* 保存できないブラウザ */ }
}

// スタンプ・隠し縁・最初の演出（このブラウザに保存されている分を直接いじって、読み込み直す）
const setStamps = (ids) => {
  store((ls) => ls.setItem("kosen63-rally", JSON.stringify({ stamps: Object.fromEntries(ids.map((id) => [id, Date.now()])), claimedAt: null })));
  location.reload();
};
const currentStamps = () => { let st = {}; store((ls) => { st = JSON.parse(ls.getItem("kosen63-rally") ?? "{}").stamps ?? {}; }); return Object.keys(st); };
const STORAGE_ACTIONS = {
  stamp1() {
    const have = currentStamps();
    const next = RALLY.shops.find((s) => !have.includes(s.id));
    if (next) setStamps([...have, next.id]);
  },
  stampAll: () => setStamps(RALLY.shops.slice(0, RALLY.goal).map((s) => s.id)),
  stampClear: () => { store((ls) => ls.removeItem("kosen63-rally")); location.reload(); },
  secretReset: () => { store((ls) => ls.removeItem("kosen63-secrets")); location.reload(); },
  intro: () => { store((ls) => ls.removeItem("kosen63-intro-seen")); location.reload(); },
};
// トップの場所（見えていればそこへ）か、パネル（#about など）を開く
function goTo(id) {
  const el = document.getElementById(id);
  if (el && !el.hidden) el.scrollIntoView({ behavior: "smooth", block: "start" });
  else location.hash = id;
}

// 本部コンソールの「プレビュー」から動かす（?preview=1 で iframe の中に開いたとき）。
// 同じサイトの本部コンソールからのメッセージだけを受け付ける。できることはテスト用パネルと同じ
export function initPreviewBridge(hooks) {
  if (window.parent === window) return;
  const actions = {
    fire: () => hooks.playOpening(),
    wake: () => hooks.setAwake(true),
    sleep: () => hooks.setAwake(false),
    shake: () => hooks.shake?.push(12),
    goto: (v) => goTo(v),
    ...STORAGE_ACTIONS,
  };
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || e.source !== window.parent) return;
    const { kosenPreview, value } = e.data ?? {};
    actions[kosenPreview]?.(value);
  });
  window.parent.postMessage({ kosenPreviewReady: true, phase: document.body.dataset.phase }, location.origin);
}

export function initTest(hooks) {
  const now = params.get("now") ?? "";
  const box = document.createElement("aside");
  box.className = "testwin";
  box.setAttribute("aria-label", "テスト用パネル");
  const opt = (list, cur) => list.map(([l, v]) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(l)}</option>`).join("");
  box.innerHTML = `
    <div class="tw-head">
      <b>TEST</b><span id="tw-state"></span>
      <button type="button" class="tw-fold" aria-label="たたむ">–</button>
    </div>
    <div class="tw-body">
      <section>
        <h4>時刻</h4>
        <select id="tw-time">${opt(TIMES, TIMES.some(([, v]) => v === now) ? now : "__custom")}${TIMES.some(([, v]) => v === now) ? "" : `<option value="__custom" selected>指定：${esc(now)}</option>`}</select>
        <div class="tw-row">
          <input id="tw-dt" type="datetime-local" value="${esc(now.slice(0, 16))}">
          <button type="button" id="tw-dt-go">この時刻</button>
        </div>
        <div class="tw-row">
          <button type="button" data-shift="-60">−1時間</button>
          <button type="button" data-shift="-10">−10分</button>
          <button type="button" data-shift="10">＋10分</button>
          <button type="button" data-shift="60">＋1時間</button>
        </div>
      </section>
      <section>
        <h4>空・天気</h4>
        <div class="tw-row">
          <select id="tw-sky">${opt(SKIES, params.get("sky") ?? "")}</select>
          <select id="tw-weather">${opt(WEATHERS, params.get("weather") ?? "")}</select>
        </div>
        <label class="tw-row">風 <input id="tw-wind" type="range" min="0" max="20" value="${esc(params.get("wind") ?? "4")}"> <span id="tw-wind-v">${esc(params.get("wind") ?? "4")}</span> m/s</label>
      </section>
      <section>
        <h4>データ</h4>
        <label><input type="checkbox" id="tw-demo"${params.has("demo") ? " checked" : ""}> デモ（お知らせ・配信・食レポ・混雑・実況・灯り・仮のお店）</label>
        <label><input type="checkbox" id="tw-urgent"${params.has("urgent") ? " checked" : ""}${params.has("demo") ? "" : " disabled"}> デモのお知らせを「緊急」にする</label>
        ${local ? `<label><input type="checkbox" id="tw-emu"${params.has("emulator") ? " checked" : ""}> Firebase エミュレーターにつなぐ（手元だけ）</label>` : ""}
      </section>
      <section>
        <h4>演出</h4>
        <div class="tw-grid">
          <button type="button" id="tw-fire">花火を上げる</button>
          <button type="button" id="tw-intro">最初の演出</button>
          <button type="button" id="tw-wake">メニューを出す</button>
          <button type="button" id="tw-sleep">メニューをしまう</button>
          <button type="button" id="tw-shake">短冊を揺らす</button>
          <button type="button" id="tw-rain">天気を今すぐ変更↑</button>
        </div>
      </section>
      <section>
        <h4>スタンプ・隠し縁</h4>
        <div class="tw-grid">
          <button type="button" id="tw-stamp1">スタンプ1個</button>
          <button type="button" id="tw-stampall">そろえる</button>
          <button type="button" id="tw-stamp0">スタンプ全部消す</button>
          <button type="button" id="tw-secret">隠し縁リセット</button>
        </div>
        <p class="tw-note">スタンプは QR だけで押す。QR と引き換えのスタッフ番号は python tools/make-rally-qr.py で作る（番号の控えは tools/rally-secret.json）</p>
      </section>
      <section>
        <h4>移動</h4>
        <div class="tw-row">
          <select id="tw-panel">${opt(PANELS, "")}</select>
          <button type="button" id="tw-open">移動</button>
        </div>
        <div class="tw-row">
          <select id="tw-page">${opt(PAGES, "")}</select>
          <button type="button" id="tw-go">開く</button>
        </div>
      </section>
      <section>
        <button type="button" id="tw-reset" class="tw-wide">テストの設定を全部やめる</button>
      </section>
    </div>`;
  document.body.append(box);
  const $ = (s) => box.querySelector(s);

  // たたむ（たたんだ状態は覚えておく）
  const fold = (on) => { box.classList.toggle("is-folded", on); store((ls) => ls.setItem("kosen63-test-folded", on ? "1" : "")); };
  let folded = false;
  store((ls) => { folded = !!ls.getItem("kosen63-test-folded"); });
  fold(folded);
  $(".tw-fold").addEventListener("click", () => fold(!box.classList.contains("is-folded")));
  $(".tw-head b").addEventListener("click", () => fold(false));

  // 時刻
  $("#tw-time").addEventListener("change", (e) => { if (e.target.value !== "__custom") reloadWith({ now: e.target.value }); });
  $("#tw-dt-go").addEventListener("click", () => reloadWith({ now: $("#tw-dt").value }));
  box.querySelectorAll("[data-shift]").forEach((b) => b.addEventListener("click", () => {
    const base = now ? new Date(now + "+09:00") : new Date();
    const t = new Date(base.getTime() + Number(b.dataset.shift) * 60000);
    const jst = new Date(t.getTime() + 9 * 3600000).toISOString().slice(0, 16); // 日本時間の YYYY-MM-DDTHH:MM
    reloadWith({ now: jst });
  }));

  // 空・天気
  $("#tw-sky").addEventListener("change", (e) => reloadWith({ sky: e.target.value }));
  $("#tw-weather").addEventListener("change", (e) => reloadWith({ weather: e.target.value, wind: e.target.value ? $("#tw-wind").value : "" }));
  $("#tw-wind").addEventListener("input", (e) => ($("#tw-wind-v").textContent = e.target.value));
  $("#tw-rain").addEventListener("click", () => reloadWith({ weather: $("#tw-weather").value || "clear", wind: $("#tw-wind").value }));

  // データ
  $("#tw-demo").addEventListener("change", (e) => reloadWith({ demo: e.target.checked, urgent: e.target.checked && $("#tw-urgent").checked }));
  $("#tw-urgent").addEventListener("change", (e) => reloadWith({ urgent: e.target.checked }));
  $("#tw-emu")?.addEventListener("change", (e) => reloadWith({ emulator: e.target.checked }));

  // 演出
  $("#tw-fire").addEventListener("click", () => hooks.playOpening());
  $("#tw-intro").addEventListener("click", () => STORAGE_ACTIONS.intro());
  $("#tw-wake").addEventListener("click", () => hooks.setAwake(true));
  $("#tw-sleep").addEventListener("click", () => hooks.setAwake(false));
  $("#tw-shake").addEventListener("click", () => hooks.shake?.push(12));

  // スタンプ・隠し縁
  $("#tw-stamp1").addEventListener("click", () => STORAGE_ACTIONS.stamp1());
  $("#tw-stampall").addEventListener("click", () => STORAGE_ACTIONS.stampAll());
  $("#tw-stamp0").addEventListener("click", () => STORAGE_ACTIONS.stampClear());
  $("#tw-secret").addEventListener("click", () => STORAGE_ACTIONS.secretReset());

  // パネル
  $("#tw-open").addEventListener("click", () => goTo($("#tw-panel").value));
  // ほかのページへ。時刻・空・天気・デモなどの設定はそのまま持っていく
  $("#tw-go").addEventListener("click", () => {
    const target = new URL($("#tw-page").value, location.href);
    new URLSearchParams(location.search).forEach((v, k) => { if (!target.searchParams.has(k)) target.searchParams.set(k, v); });
    location.href = target.href;
  });

  $("#tw-reset").addEventListener("click", () => { location.href = location.pathname; });

  // 今の状態
  const state = () => {
    const b = document.body.dataset;
    const open = FESTIVAL.days.map((d) => d.label).join("・");
    $("#tw-state").textContent = `${{ before: "開催前", during: "開催中", after: "終了後" }[b.phase] ?? b.phase} / 空:${b.skyimg ?? "-"} / 天気:${b.weather ?? "-"}${document.body.classList.contains("awake") ? " / メニュー" : ""} / ${innerWidth}×${innerHeight}`;
    $("#tw-state").title = `開催日：${open}`;
  };
  state();
  setInterval(state, 1000);
}
