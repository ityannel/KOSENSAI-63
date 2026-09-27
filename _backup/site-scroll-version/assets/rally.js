// スタンプラリー
// ・模擬店に貼った QR（?s=店ID&c=合言葉）を読むか、合言葉を入力するとスタンプが押される
// ・合言葉は日ごとに変えられる（config.js の codes に日付ごとの暗号化した値を入れる）
// ・スタンプはこのスマホの中だけに保存する（名前などの個人情報は集めない）
// ・goal 個たまると達成画面。本部のスタッフが番号を入れると「引き換え済み」になる
import { RALLY, FESTIVAL } from "./config.js";

const STORE_KEY = "kosen63-rally";
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// 表記ゆれを吸収：全角半角・大文字小文字・カタカナ→ひらがな・空白
export function normalize(s) {
  return String(s).normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "")
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function load() {
  try {
    return { stamps: {}, claimedAt: null, ...JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") };
  } catch {
    return { stamps: {}, claimedAt: null };
  }
}
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // プライベートブラウズなどで保存できないときは、このページを開いている間だけ有効
  }
}

let state = load();
let nowMs = () => Date.now();
const tokyoDate = () => new Date(nowMs()).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }); // YYYY-MM-DD

// 合言葉が今日のどの店のものかを調べる。店IDが分かっていればその店だけ
async function findShop(code, shopId) {
  const today = tokyoDate();
  const candidates = shopId ? RALLY.shops.filter((s) => s.id === shopId) : RALLY.shops;
  for (const shop of candidates) {
    const expected = shop.codes[today];
    if (expected && expected === await sha256(`kosen63:${shop.id}:${today}:${normalize(code)}`)) return shop;
  }
  return null;
}

async function stamp(code, shopId) {
  if (!RALLY.shops.some((s) => s.codes[tokyoDate()])) {
    return message("スタンプは開催日（" + FESTIVAL.days.map((d) => d.label).join("・") + "）に押せます。", "warn");
  }
  const shop = await findShop(code, shopId);
  if (!shop) return message("合言葉が違うみたいです。お店の人にもう一度聞いてみてください。", "warn");
  if (state.stamps[shop.id]) return message(`「${shop.name}」のスタンプはもう押してあります。`, "info");
  state.stamps[shop.id] = nowMs();
  save();
  render();
  celebrate(shop);
}

function message(text, kind = "info") {
  const el = $("#rally-msg");
  el.textContent = text;
  el.dataset.kind = kind;
}

// スタンプを押した瞬間の演出
function celebrate(shop) {
  const count = Object.keys(state.stamps).length;
  const toast = $("#stamp-toast");
  toast.innerHTML = `
    <div class="toast-card" role="alertdialog" aria-labelledby="toast-title">
      <div class="hanko big" aria-hidden="true">縁</div>
      <p id="toast-title" class="toast-title">スタンプGET!</p>
      <p>${esc(shop.name)}</p>
      <p class="toast-count">${count} / ${RALLY.goal}${count >= RALLY.goal ? "　達成！" : ""}</p>
      <button type="button" class="btn" id="toast-close">とじる</button>
    </div>`;
  toast.hidden = false;
  const close = () => { toast.hidden = true; $("#rally").scrollIntoView({ block: "start" }); };
  $("#toast-close").addEventListener("click", close, { once: true });
  $("#toast-close").focus();
  message(`「${shop.name}」のスタンプを押しました！`, "ok");
}

function render() {
  const count = Object.keys(state.stamps).length;
  const done = count >= RALLY.goal;

  $("#rally-progress").innerHTML = `
    <span class="rally-count"><b>${count}</b> / ${RALLY.goal}</span>
    <span class="rally-bar" style="--p:${Math.min(1, count / RALLY.goal)}"><i></i></span>`;

  $("#rally-card").innerHTML = RALLY.shops.map((s) => {
    const t = state.stamps[s.id];
    return `
      <li class="rally-slot${t ? " is-stamped" : ""}">
        <span class="hanko" aria-hidden="true">${t ? "縁" : ""}</span>
        <span class="rally-shop">${esc(s.name)}</span>
        <span class="visually-hidden">${t ? "スタンプ済み" : "まだ"}</span>
      </li>`;
  }).join("");

  const goal = $("#rally-goal");
  goal.hidden = !done;
  if (!done) return;
  if (state.claimedAt) {
    const when = new Date(state.claimedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
    goal.innerHTML = `
      <div class="goal-card is-claimed">
        <div class="claimed-seal" aria-hidden="true">引換済</div>
        <p class="goal-title">引き換え済みです</p>
        <p>${esc(when)} に引き換えました。ご参加ありがとうございました！</p>
      </div>`;
    return;
  }
  // 画面のスクショで使い回せないよう、今の時刻が秒単位で動き、背景も流れ続ける
  goal.innerHTML = `
    <div class="goal-card">
      <p class="goal-title">達成！</p>
      <p>${esc(RALLY.prize)}。<br>この画面を<b>${esc(RALLY.claimPlace)}</b>で見せてください。</p>
      <p class="goal-clock" id="goal-clock" aria-live="off"></p>
      <form class="claim-form" id="claim-form">
        <label for="claim-pin">スタッフ用</label>
        <input id="claim-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="番号">
        <button class="btn" type="submit">引き換える</button>
      </form>
      <p class="claim-msg" id="claim-msg" role="status"></p>
    </div>`;
  $("#claim-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pin = $("#claim-pin").value;
    if (await sha256(`kosen63:staff:${normalize(pin)}`) !== RALLY.staffPinHash) {
      $("#claim-msg").textContent = "番号が違います（スタッフが入力します）";
      return;
    }
    state.claimedAt = nowMs();
    save();
    render();
  });
}

function tickClock() {
  const el = document.getElementById("goal-clock");
  if (el) el.textContent = new Date(nowMs()).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export function initRally(getNow) {
  nowMs = getNow;
  $("#rally-goal-text").textContent = `${RALLY.goal}個`;
  render();
  setInterval(tickClock, 1000);
  tickClock();

  $("#rally-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#rally-code");
    if (!input.value.trim()) return;
    stamp(input.value);
    input.value = "";
  });

  // QR から来たとき（?s=店ID&c=合言葉）。押したらURLから消して、再読み込みで二重に出ないようにする
  const params = new URLSearchParams(location.search);
  if (params.has("s") && params.has("c")) {
    const [s, c] = [params.get("s"), params.get("c")];
    params.delete("s");
    params.delete("c");
    history.replaceState(null, "", location.pathname + (params.size ? `?${params}` : "") + "#rally");
    stamp(c, s);
  }
}
