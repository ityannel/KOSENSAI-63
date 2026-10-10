import { RALLY, FESTIVAL, ELECTION, SHOPS, EVENTS, VENUES, shopIdOf } from "./config.js";
import { rallyReady, rallyLoaded, onRallyChange } from "./rally-data.js";
import { openQrScanner } from "./qr-scan.js";

const STORE_KEY = "kosen63-rally";
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  if (!globalThis.crypto?.subtle) return sha256Fallback(bytes);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sha256Fallback(bytes) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const len = bytes.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor((len * 8) / 2 ** 32));
  view.setUint32(padded.length - 4, (len * 8) >>> 0);
  const W = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      [h, g, f, e, d, c, b, a] = [g, f, e, (d + t1) >>> 0, c, b, a, (t1 + t2) >>> 0];
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => (H[i] = (H[i] + v) >>> 0));
  }
  return H.map((v) => v.toString(16).padStart(8, "0")).join("");
}

function load() {
  try {
    return { stamps: {}, claimedAt: null, ...JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") };
  } catch {
    return { stamps: {}, claimedAt: null };
  }
}
function save() {
  if (DEMO) return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    const note = document.getElementById("rally-note");
    if (!note) return;
    note.dataset.kind = "warn";
    note.textContent = "このブラウザではスタンプを保存できません。ページを閉じると消えてしまうので、SafariやChromeで開き直してください。";
  }
}

function warnInAppBrowser() {
  if (!/Instagram|FBAN|FBAV|\bLine\//i.test(navigator.userAgent)) return;
  const note = document.getElementById("rally-note");
  if (!note) return;
  note.dataset.kind = "warn";
  note.innerHTML = "いまアプリの中のブラウザで開いています。<b>スタンプがSafariやChromeと別々になってしまう</b>ので、右上のメニューから「ブラウザで開く」を選んでから集めてください。";
}

let state = load();
const DEMO = ["localhost", "127.0.0.1"].includes(location.hostname) && new URLSearchParams(location.search).has("demo");
const DEMO_SHOPS = [{ id: "d1", name: "5SE", vote: true }, { id: "d2", name: "麺屋 つちよし", vote: true }, { id: "d3", name: "クッキングミオ♡", vote: true }, { id: "d4", name: "やきとり処清", vote: true }];
const shops = () => (DEMO ? DEMO_SHOPS : RALLY.shops);
export const stampGoal = () => Math.max(1, Math.min(RALLY.goal, shops().length || RALLY.goal));
if (DEMO) state = { ...state, stamps: { d1: Date.parse("2026-10-24T11:20:00+09:00"), d2: Date.parse("2026-10-24T13:05:00+09:00") } };
export const stampCount = () => Object.keys(state.stamps).length;
export const stampIds = () => Object.keys(state.stamps);
let nowMs = () => Date.now();
let prizeOut = false;
const tokyoDate = () => new Date(nowMs()).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

const usableDays = () => [tokyoDate(), "*", "fest"];
async function findShop(code, shopId) {
  const shop = RALLY.shops.find((s) => s.id === shopId);
  const key = String(code).trim();
  for (const day of usableDays()) {
    const expected = shop?.codes?.[day];
    if (expected && expected === await sha256(`kosen63:${shop.id}:${day}:${key}`)) return shop;
  }
  return null;
}

async function stamp(code, shopId) {
  await rallyReady(4000);
  if (!RALLY.shops.some((s) => usableDays().some((d) => s.codes?.[d]))) {
    return message("スタンプは開催日（" + FESTIVAL.days.map((d) => d.label).join("・") + "）に押せます。", "warn");
  }
  const shop = await findShop(code, shopId);
  if (!shop && !rallyLoaded()) return message("お店の情報を読みこめていません。電波のよい所で、もう一度 QR を読んでください。", "warn");
  if (!shop) return message("この QR ではスタンプを押せませんでした。近くのスタッフに聞いてみてください。", "warn");
  if (state.stamps[shop.id]) return message(`「${shop.name}」のスタンプはもう押してあります。`, "info");
  state.stamps[shop.id] = nowMs();
  save();
  syncLog();
  celebrate(shop);
}

const signature = () => JSON.stringify([state.stamps, state.claimedAt ?? null]);
let fbP = null;
function firebase() {
  fbP ??= (async () => {
    const { FIREBASE_VERSION, firebaseConfig, connectEmulators, firestoreFor } = await import("./live.js");
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
    const [appMod, auth, fs] = await Promise.all([import(`${base}/firebase-app.js`), import(`${base}/firebase-auth.js`), import(`${base}/firebase-firestore.js`)]);
    const app = appMod.getApps().find((x) => x.name === "[DEFAULT]") ?? appMod.initializeApp(firebaseConfig);
    const k = { auth, fs, a: auth.getAuth(app), db: firestoreFor(fs, app) };
    connectEmulators({ fs, db: k.db, auth, a: k.a });
    return k;
  })();
  return fbP;
}
let syncP = null;
function syncLog() {
  if (DEMO || state.synced === signature()) return Promise.resolve();
  if (!Object.keys(state.stamps).length && !state.claimedAt && !state.synced) return Promise.resolve();
  return (syncP ??= writeLog().finally(() => { syncP = null; }));
}
async function writeLog() {
  try {
    const k = await firebase();
    if (!k.a.currentUser) await k.auth.signInAnonymously(k.a);
    const sig = signature();
    await k.fs.setDoc(k.fs.doc(k.db, "rally_logs", k.a.currentUser.uid), { stamps: { ...state.stamps }, claimed_at: state.claimedAt ?? null, updated_at: k.fs.serverTimestamp() });
    state.synced = sig;
    save();
  } catch (err) {
    console.warn("[rally] 本部へ写せませんでした:", err?.code ?? err);
  }
}
const changeFns = new Set();
function applyReset(resetAt) {
  if (!resetAt || resetAt <= (state.resetSeen ?? 0)) return;
  const first = state.resetSeen == null && !Object.keys(state.stamps).length;
  state.resetSeen = resetAt;
  if (!first) {
    state.stamps = Object.fromEntries(Object.entries(state.stamps).filter(([, t]) => t > resetAt));
    if (state.claimedAt && state.claimedAt <= resetAt) state.claimedAt = null;
    state.synced = null;
  }
  save();
  changeFns.forEach((fn) => fn());
  syncLog();
}
if (!DEMO) {
  import("./live.js").then(({ subscribeRallyControl }) => subscribeRallyControl((d) => applyReset(d?.reset_at?.toMillis?.() ?? null))).catch(() => {});
  setTimeout(syncLog, 1500);
}


const shopOf = (id) => shops().find((s) => s.id === id);
let zoomEl = null;
function openStampZoom(id) {
  const t = state.stamps[id];
  if (!t) return;
  if (!zoomEl) {
    zoomEl = document.createElement("dialog");
    zoomEl.className = "rc-zoom";
    zoomEl.setAttribute("aria-label", "スタンプ");
    zoomEl.addEventListener("click", () => zoomEl.close());
    document.body.append(zoomEl);
  }
  const when = new Date(t).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).replace("/", ".");
  zoomEl.innerHTML = `<span class="rc-zoom-ring"><i class="rc-hanko">縁</i></span><b class="rc-zoom-name">${esc(shopOf(id)?.name ?? "")}</b><small class="rc-zoom-date">${esc(when)}</small>`;
  zoomEl.showModal();
}
const md = (t) => new Date(t).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).replace("/", ".");
const TILTS = [-9, 7, -4, 11, -12, 5];
let justStamped = null;

function cardNo() {
  if (!state.no) { state.no = String(1000 + Math.floor(Math.random() * 9000)); save(); }
  return state.no;
}

function message(text, kind = "info") {
  const el = $("#rally-msg");
  if (!el) return;
  el.textContent = text;
  el.dataset.kind = kind;
}

function celebrate(shop) {
  justStamped = shop.id;
  const card = $(".rc");
  if (card) card.setAttribute("aria-pressed", "false");
  render();
  $("#rc")?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  const count = stampCount();
  message(count >= stampGoal() ? `「${shop.name}」のスタンプを押しました。達成です！` : `「${shop.name}」のスタンプを押しました！ あと${stampGoal() - count}個`, "ok");
}

function voteState() {
  const t = nowMs();
  return t < Date.parse(ELECTION.opens) ? "before" : t < Date.parse(ELECTION.closes) ? "open" : "closed";
}
const voteDay = (iso) => new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }).replace("/", ".");
let voting = false, voteNote = null, pickId = null;
const voteShops = () => SHOPS.map((s) => ({ id: shopIdOf(s), name: String(s.name).replace(/\n/g, " ") }));
const VOTE_LEAD = "気に入った模擬店に、一回だけ投票できます<br>応援したいお店を選ぼう！";
const voteUrl = (shop) => (ELECTION.prefill && shop ? ELECTION.prefill.replace("{shop}", encodeURIComponent(shop.name)) : ELECTION.form);
function renderVote() {
  const el = $("#rally-vote");
  if (!el) return;
  const phase = voteState();
  const title = '<h2 class="rv-title visually-hidden" id="rv-title">模擬店総選挙</h2>';
  if (phase === "before") {
    el.innerHTML = `${title}<p class="rv-lead">${esc(voteDay(ELECTION.opens))}から、気に入った模擬店に投票できます。</p>`;
    return;
  }
  if (phase === "closed") {
    const res = EVENTS.find((e) => e.title.includes("結果発表"));
    const hall = VENUES.find((v) => v.id === res?.venue);
    el.innerHTML = `${title}<p class="rv-lead">投票は終わりました。${res ? `結果発表は ${esc(voteDay(res.start))} から${hall ? `、${esc(hall.alias ? `${hall.alias}（${hall.name}）` : hall.name)}` : ""}です。` : ""}</p>`;
    return;
  }
  if (!ELECTION.form) { el.innerHTML = `${title}<p class="rv-lead">投票のフォームは、準備ができしだい、ここに出ます。</p>`; return; }
  el.innerHTML = `
    ${title}
    <p class="rv-lead">${esc(voteDay(ELECTION.closes))}まで。1人1票です。</p>
    ${ELECTION.prefill ? `<ul class="rv-list">${voteShops().map((s) => `<li><a class="rv-btn" href="${esc(voteUrl(s))}" target="_blank" rel="noopener"><span class="rv-name">${esc(s.name)}</span><span class="rv-go">投票する</span></a></li>`).join("")}</ul>` : ""}
    <a class="rv-submit" href="${esc(ELECTION.form)}" target="_blank" rel="noopener">${ELECTION.prefill ? "お店を選ばずに、フォームを開く" : "投票フォームを開く"}</a>`;
}
function renderVoteLink() {
  const el = $("#rally-vote-link");
  if (!el) return;
  const phase = voteState();
  el.hidden = false;
  el.innerHTML = `<b>模擬店総選挙</b><span>${phase === "closed" ? "投票は終わりました" : phase === "before" ? `${voteDay(ELECTION.opens)}から投票できます` : VOTE_LEAD}</span>`;
}

function slotsHtml() {
  const ids = Object.keys(state.stamps).sort((a, b) => state.stamps[a] - state.stamps[b]);
  const n = Math.max(stampGoal(), ids.length);
  return Array.from({ length: n }, (_, i) => {
    const id = ids[i];
    if (!id) return `<li class="rc-slot"><span class="rc-ring" aria-hidden="true"><b>${i + 1}</b></span><span class="visually-hidden">${i + 1}個目：まだ</span></li>`;
    const s = shopOf(id);
    return `<li class="rc-slot is-stamped${id === justStamped ? " is-new" : ""}" style="--tilt:${TILTS[i % TILTS.length]}deg">
      <span class="rc-ring" role="button" tabindex="0" data-zoom="${esc(id)}" aria-label="${esc(s?.name ?? "")}のスタンプを大きく見る"><i class="rc-hanko">縁</i>${id === justStamped ? '<i class="rc-pon">ポンッ</i>' : ""}</span>
    </li>`;
  }).join("");
}

function render() {
  renderVote();
  renderVoteLink();
  if (!$("#rc")) return;
  const count = stampCount();
  const done = count >= stampGoal();
  const canClaim = done && !state.claimedAt && !prizeOut;
  const sorry = $("#rally-sorry");
  if (sorry) sorry.hidden = !prizeOut;
  const flipped = $(".rc")?.getAttribute("aria-pressed") === "true";
  $("#rc").style.setProperty("--rc-base", 72 + Math.max(0, Math.ceil(Math.max(stampGoal(), count) / 3) - 2) * 34);
  const list = shops();
  $("#rc").innerHTML = `
    <button type="button" class="rc" aria-pressed="${flipped}" aria-label="スタンプカード（押すと裏返る）">
      <span class="rc-face rc-front">
        <span class="rc-head">
          <img class="rc-logo" src="assets/img/logo-s.webp" width="673" height="657" alt="">
          <span class="rc-name"><b>スタンプラリー</b><small>第${esc(FESTIVAL.edition)}回 函館高専祭「縁」</small></span>
          <span class="rc-no">No.<b>${cardNo()}</b></span>
        </span>
        <ol class="rc-slots">${slotsHtml()}</ol>
        <span class="rc-foot">
          <b class="rc-state">${done ? (state.claimedAt ? "引き換え済み" : prizeOut ? "達成！（景品は終了しました）" : "達成！ 景品と交換できます") : `あと<em>${stampGoal() - count}</em>個で${prizeOut ? "達成" : "景品"}！`}</b>
          <small class="rc-turn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.3-4.9M4 5v4h4M4 13a8 8 0 0 0 14.3 4.9M20 19v-4h-4"/></svg>うらを見る</small>
        </span>
        ${state.claimedAt ? '<i class="rc-claimed" aria-hidden="true">引換済</i>' : ""}
      </span>
      <span class="rc-face rc-back">
        <b class="rc-back-title">あそびかた</b>
        <ol class="rc-rules">
          <li>校内の数か所に置いてある QR を読む（はじめの1個は、玄関のインフォメーションで）</li>
          <li>スタンプが<em>${stampGoal()}個</em>たまったら達成</li>
        </ol>
      </span>
    </button>
    <button type="button" class="rc-claim" tabindex="${canClaim ? 0 : -1}">引き換える！</button>`;
  justStamped = null;
  const wrap = $("#rc");
  wrap.classList.remove("is-done");
  if (canClaim) requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add("is-done")));

}

function claim() {
  if (!(stampCount() >= stampGoal()) || state.claimedAt || prizeOut) return;
  if (!confirm("景品と引き換えますか？\n押すと「引き換え済み」になります（元に戻せません）")) return;
  state.claimedAt = nowMs();
  save();
  syncLog();
  render();
}

export function initRallyPage(getNow = () => Date.now()) {
  nowMs = getNow;
  warnInAppBrowser();
  render();
  onRallyChange(render);
  changeFns.add(() => { justStamped = null; render(); message("本部がスタンプラリーをリセットしました。", "info"); });
  import("./live.js").then(({ subscribeLive }) => subscribeLive((d) => {
    const v = !!d?.prize_out;
    if (v !== prizeOut) { prizeOut = v; render(); }
  })).catch(() => {  });

  $("#rc").addEventListener("keydown", (e) => {
    const z = e.target.closest?.("[data-zoom]");
    if (z && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openStampZoom(z.dataset.zoom); }
  });
  $("#rc").addEventListener("click", (e) => {
    const z = e.target.closest("[data-zoom]");
    if (z) return openStampZoom(z.dataset.zoom);
    if (e.target.closest(".rc-claim")) return claim();
    const b = e.target.closest(".rc");
    if (b) b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true"));
  });
  $("#rally-scan").addEventListener("click", openScan);
  takeQrParams();
}

const openScan = () => openQrScanner({
  title: "QR を読む",
  hint: "校内に置いてある QR を枠に入れてください",
  wrong: "スタンプラリーの QR ではないようです",
  noCamera: "スマホのカメラアプリで QR を読んでも、スタンプは押せます",
  accept: (text) => {
    try {
      const q = new URL(text, location.href).searchParams;
      return q.get("s") && q.get("c") ? { s: q.get("s"), c: q.get("c") } : null;
    } catch { return null; }
  },
  onRead: ({ s, c }) => stamp(c, s),
});
function takeQrParams() {
  const params = new URLSearchParams(location.search);
  if (params.has("s") && params.has("c")) {
    const [s, c] = [params.get("s"), params.get("c")];
    params.delete("s");
    params.delete("c");
    history.replaceState(null, "", location.pathname + (params.size ? `?${params}` : ""));
    stamp(c, s);
  }
}

export function initVotePage(getNow = () => Date.now()) {
  nowMs = getNow;
  const s = new URLSearchParams(location.search).get("s");
  const shop = s && voteShops().find((v) => v.id === s);
  if (shop && voteState() === "open" && ELECTION.prefill) { location.replace(voteUrl(shop)); return; }
  render();
  changeFns.add(render);
}

export function renderVoteEntry(el) {
  if (!el) return;
  const phase = voteState();
  el.innerHTML = phase === "before" ? `${voteDay(ELECTION.opens)}から` : phase === "closed" ? "投票は終わりました" : VOTE_LEAD;
}

let miniEl = null;
export function renderMini(el) {
  if (!el) return;
  if (!miniEl) changeFns.add(() => renderMini(miniEl));
  miniEl = el;
  const count = stampCount();
  const n = Math.max(stampGoal(), count);
  el.innerHTML = `
    <a class="rc-mini" href="rally.html">
      <img class="rc-logo" src="assets/img/logo-s.webp" width="673" height="657" alt="">
      <span class="rc-mini-txt"><b>スタンプカード</b></span>
      <span class="rc-mini-dots" aria-label="${count} / ${stampGoal()}">${Array.from({ length: n }, (_, i) => `<i${i < count ? ' class="on"' : ""}>${i < count ? "縁" : ""}</i>`).join("")}</span>
    </a>`;
}
