// スタンプラリー
// ・模擬店に貼った QR（rally.html?s=店ID&c=QRの鍵）を、スマホのカメラかページの「お店の QR を読む」で読むとスタンプが押される。
//   入力欄はない（QR を読むだけ）
// ・QR の鍵は日ごとに変わる推測できない長い文字列。config.js にはその暗号化した値だけを置く（tools/make-rally-qr.py で作る）
// ・スタンプはこのスマホの中に保存する（名前などの個人情報は集めない）。本部が全員の状況を見られるよう、
//   押したお店と時刻だけを Firestore の rally_logs/{匿名ログインの印} にも写す（本部だけが読める）
// ・本部が「全員の履歴をリセット」すると rally_control/current の reset_at が変わり、それより前のスタンプは各スマホで消える
// ・goal 個たまると達成画面。本部のスタッフが番号を入れると「引き換え済み」になる
// ・模擬店総選挙：スタンプを押した模擬店（rally/current の shops で vote: true のもの）に、1人1票。votes/{匿名ログインの印} = { shop }。
//   押しなおすと、投票先が変わる（票は1つのまま）。受け付けは config.js の ELECTION の opens〜closes
import { RALLY, FESTIVAL, ELECTION } from "./config.js";
import { rallyReady, onRallyChange } from "./rally-data.js"; // 本部コンソールで作った対象のお店（Firestore）
import { openQrScanner } from "./qr-scan.js";

const STORE_KEY = "kosen63-rally";
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// スタッフ番号の表記ゆれ（全角数字・空白）をそろえる
const normalizePin = (s) => String(s).normalize("NFKC").replace(/\s+/g, "");

// スタッフ番号を PBKDF2（SHA-256・何十万回）で混ぜる。ページのソースから番号を総当たりで割り出しにくくするため
async function pinHash(pin, { salt, iterations }) {
  if (!globalThis.crypto?.subtle) throw new Error("https で開いてください");
  const hex = (h) => new Uint8Array(h.match(/../g).map((b) => parseInt(b, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(normalizePin(pin)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: hex(salt), iterations }, key, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  // https でないページ（同じWi-Fiのスマホで確認するときなど）では crypto.subtle が使えないので自前で計算する
  if (!globalThis.crypto?.subtle) return sha256Fallback(bytes);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// SHA-256（FIPS 180-4）をそのまま書いたもの
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
  if (DEMO) return; // 見た目をたしかめているときは、本物のスタンプに混ぜない
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // 保存できないブラウザでは、このページを開いている間だけ有効。そのことを知らせる
    const note = document.getElementById("rally-note");
    if (!note) return;
    note.dataset.kind = "warn";
    note.textContent = "このブラウザではスタンプを保存できません。ページを閉じると消えてしまうので、SafariやChromeで開き直してください。";
  }
}

// Instagram や LINE のアプリ内ブラウザは、Safari / Chrome と保存場所が別になる。
// QR をカメラで読むと Safari / Chrome で開くので、スタンプが別々に分かれてしまう
function warnInAppBrowser() {
  if (!/Instagram|FBAN|FBAV|\bLine\//i.test(navigator.userAgent)) return;
  const note = document.getElementById("rally-note");
  note.dataset.kind = "warn";
  note.innerHTML = "いまアプリの中のブラウザで開いています。<b>スタンプがSafariやChromeと別々になってしまう</b>ので、右上のメニューから「ブラウザで開く」を選んでから集めてください。";
}

let state = load();
// 対象のお店。手元（localhost）で ?demo を付けたときだけ、見た目をたしかめる仮のお店とスタンプ
const DEMO = ["localhost", "127.0.0.1"].includes(location.hostname) && new URLSearchParams(location.search).has("demo");
const DEMO_SHOPS = [{ id: "d1", name: "5SE たこ焼き", vote: true }, { id: "d2", name: "麺屋 つちよし", vote: true }, { id: "d3", name: "クッキングミオ♡", vote: true }, { id: "d4", name: "やきとり処清", vote: true }];
const shops = () => (DEMO ? DEMO_SHOPS : RALLY.shops);
if (DEMO) state = { ...state, stamps: { d1: Date.parse("2026-10-24T11:20:00+09:00"), d2: Date.parse("2026-10-24T13:05:00+09:00") } };
export const stampCount = () => Object.keys(state.stamps).length;
export const stampIds = () => Object.keys(state.stamps);
let nowMs = () => Date.now();
let prizeOut = false; // 景品がなくなった（本部コンソールのスイッチ。site_live/current の prize_out）
const tokyoDate = () => new Date(nowMs()).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }); // YYYY-MM-DD

// QR の鍵がそのお店のものかを調べる。codes["fest"] は開催日ならどの日でも使える鍵（本部コンソールが作る。2日とも同じ QR）、
// codes["YYYY-MM-DD"] はその日だけの鍵、codes["*"] は日付に関係なくいつでも使える鍵（テスト用のお店だけに使う）
const isFestDay = () => FESTIVAL.days.some((d) => d.open.startsWith(tokyoDate()));
const usableDays = () => [tokyoDate(), "*", ...(isFestDay() ? ["fest"] : [])];
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
  await rallyReady(4000); // 対象のお店を読みこむまで少し待つ（前に読んだものがあればすぐ）
  if (!RALLY.shops.some((s) => usableDays().some((d) => s.codes?.[d]))) {
    return message("スタンプは開催日（" + FESTIVAL.days.map((d) => d.label).join("・") + "）に押せます。", "warn");
  }
  const shop = await findShop(code, shopId);
  if (!shop) return message("この QR ではスタンプを押せませんでした。近くのスタッフに聞いてみてください。", "warn");
  if (state.stamps[shop.id]) return message(`「${shop.name}」のスタンプはもう押してあります。`, "info");
  state.stamps[shop.id] = nowMs();
  save();
  syncLog();
  celebrate(shop);
}

// ---------- 本部へ写す・全員リセット ----------
// 押したスタンプ（お店と時刻）と引き換えた時刻を rally_logs/{匿名ログインの印} に写す。
// 同じ中身はもう一度書かない。電波がなくて書けなかったら、次にページを開いたときにまた写す
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
  if (!Object.keys(state.stamps).length && !state.claimedAt && !state.synced) return Promise.resolve(); // 何も押していない人は写さない（ログインもしない）
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
// スタンプが変わったとき（全員リセットで消えたときなど）に描き直すもの
const changeFns = new Set();
// 本部が全員の履歴をリセットした：その時刻より前に押したスタンプと引き換えを、このスマホからも消す
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
  setTimeout(syncLog, 1500); // 前に書けなかった分（この仕組みより前に押したスタンプも）を写す
}


// ---------- スタンプカード（rally.html）：本物のカードのように ----------
// 表：「縁」のロゴ・カード番号・スタンプの丸（達成に必要な数）。押したお店の名前と日にちが、はんこの下に入る
// 裏：あそびかた・景品・引き換える場所・対象のお店。カードを押すと、くるっと裏返る
const shopOf = (id) => shops().find((s) => s.id === id);
const md = (t) => new Date(t).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).replace("/", ".");
const TILTS = [-9, 7, -4, 11, -12, 5];
let justStamped = null; // いま押したお店（そのはんこだけ、ポンッと押される動き）

// カード番号：このスマホで最初に開いたときに決める（4けた）。本物のカードの通し番号のように
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

// スタンプを押した瞬間：カードを表に戻して、そのはんこだけ上から押される
function celebrate(shop) {
  justStamped = shop.id;
  const card = $(".rc");
  if (card) card.setAttribute("aria-pressed", "false");
  render();
  $("#rc")?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  const count = stampCount();
  const canVote = shop.vote && voteState() === "open";
  message((count >= RALLY.goal ? `「${shop.name}」のスタンプを押しました。達成です！` : `「${shop.name}」のスタンプを押しました！ あと${RALLY.goal - count}個`) + (canVote ? "　下から、このお店に投票もできます。" : ""), "ok");
}

// ---------- 模擬店総選挙 ----------
// before：まだ／open：受け付け中／closed：終わった。?now= で時刻を動かして試せる（スタンプと同じ）
function voteState() {
  const t = nowMs();
  return t < Date.parse(ELECTION.opens) ? "before" : t < Date.parse(ELECTION.closes) ? "open" : "closed";
}
const voteDay = (iso) => new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
let voting = false, voteNote = null;
function renderVote() {
  const el = $("#rally-vote");
  if (!el) return;
  const voters = shops().filter((s) => s.vote);
  if (!voters.length) { el.hidden = true; return; }
  const phase = voteState();
  const mine = state.vote?.shop ?? null;
  const cands = stampIds().map(shopOf).filter((s) => s?.vote);
  const mineName = mine ? shopOf(mine)?.name ?? "" : "";
  el.hidden = false;
  const note = voteNote ? `<p class="rv-note" data-kind="${voteNote.kind}" role="status">${esc(voteNote.text)}</p>` : "";
  if (phase === "before") {
    el.innerHTML = `<h2 class="rv-title" id="rv-title">模擬店総選挙</h2><p class="rv-lead">${esc(voteDay(ELECTION.opens))}から。模擬店の QR を読んでスタンプを押すと、そのお店に1票入れられます（1人1票）。</p>`;
    return;
  }
  if (phase === "closed") {
    el.innerHTML = `<h2 class="rv-title" id="rv-title">模擬店総選挙</h2><p class="rv-lead">投票は終わりました。${mineName ? `あなたの1票：<b>${esc(mineName)}</b>。` : ""}結果は、10/25 16:00 から第二体育館で発表です。</p>`;
    return;
  }
  el.innerHTML = `
    <h2 class="rv-title" id="rv-title">模擬店総選挙</h2>
    <p class="rv-lead">${esc(voteDay(ELECTION.closes))}まで。<b>1人1票</b>。スタンプを押した模擬店から選べます。${mine ? "ほかのお店を押すと、投票先を変えられます。" : ""}</p>
    ${cands.length ? `<ul class="rv-list">${cands.map((s) => `<li><button type="button" class="rv-btn${s.id === mine ? " is-on" : ""}" data-vote="${esc(s.id)}" aria-pressed="${s.id === mine}"${voting ? " disabled" : ""}><span class="rv-name">${esc(s.name)}</span><span class="rv-go">${s.id === mine ? "投票ずみ" : "投票する"}</span></button></li>`).join("")}</ul>`
      : `<p class="rv-empty">模擬店の QR を読んでスタンプを押すと、ここからそのお店に投票できます。</p>`}
    ${note}`;
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
async function castVote(shopId) {
  const s = shopOf(shopId);
  if (voting || !s?.vote || !state.stamps[shopId] || voteState() !== "open" || state.vote?.shop === shopId) return;
  voting = true;
  voteNote = { kind: "info", text: "送っています…" };
  renderVote();
  try {
    if (!DEMO) {
      await syncLog(); // 押したスタンプを先に本部へ写す（ルールが「スタンプを押した店だけ」を確かめるため）
      const k = await firebase();
      if (!k.a.currentUser) await k.auth.signInAnonymously(k.a);
      await withTimeout(k.fs.setDoc(k.fs.doc(k.db, "votes", k.a.currentUser.uid), { shop: shopId, updated_at: k.fs.serverTimestamp() }), 12000);
    }
    state.vote = { shop: shopId, at: nowMs() };
    save();
    voteNote = { kind: "ok", text: `「${s.name}」に投票しました。ありがとうございます！` };
  } catch (err) {
    console.warn("[rally] 投票できませんでした:", err?.code ?? err);
    voteNote = { kind: "warn", text: "投票を送れませんでした。電波を確かめて、もう一度押してください。" };
  }
  voting = false;
  renderVote();
}
// 自分の票を、本部の記録と合わせる（本部が投票をリセットしたとき・別の画面で変えたとき）。ページを開くたびに1回だけ読む
async function refreshVote() {
  if (DEMO || voteState() === "before" || !Object.keys(state.stamps).length) return;
  try {
    const k = await firebase();
    await k.a.authStateReady?.();
    const u = k.a.currentUser;
    if (!u) return;
    const snap = await k.fs.getDoc(k.fs.doc(k.db, "votes", u.uid));
    const shop = snap.exists() ? snap.data().shop : null;
    if (shop !== (state.vote?.shop ?? null)) {
      state.vote = shop ? { shop, at: snap.data().updated_at?.toMillis?.() ?? nowMs() } : null;
      save();
      renderVote();
    }
  } catch { /* 読めなくても、投票はできる */ }
}

function slotsHtml() {
  const ids = Object.keys(state.stamps).sort((a, b) => state.stamps[a] - state.stamps[b]); // 押した順
  const n = Math.max(RALLY.goal, ids.length);
  return Array.from({ length: n }, (_, i) => {
    const id = ids[i];
    if (!id) return `<li class="rc-slot"><span class="rc-ring" aria-hidden="true"><b>${i + 1}</b></span><span class="visually-hidden">${i + 1}個目：まだ</span></li>`;
    const s = shopOf(id);
    return `<li class="rc-slot is-stamped${id === justStamped ? " is-new" : ""}" style="--tilt:${TILTS[i % TILTS.length]}deg">
      <span class="rc-ring" aria-hidden="true"><i class="rc-hanko">縁</i>${id === justStamped ? '<i class="rc-pon">ポンッ</i>' : ""}</span>
      <span class="rc-shop">${esc(s?.name ?? "")}</span><small class="rc-date">${md(state.stamps[id])}</small>
    </li>`;
  }).join("");
}

function render() {
  renderVote();
  const count = stampCount();
  const done = count >= RALLY.goal;
  const sorry = $("#rally-sorry");
  if (sorry) sorry.hidden = !prizeOut;
  const flipped = $(".rc")?.getAttribute("aria-pressed") === "true";
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
          <b class="rc-state">${done ? (state.claimedAt ? "引き換え済み" : prizeOut ? "達成！（景品は終了しました）" : "達成！ 景品と交換できます") : `あと<em>${RALLY.goal - count}</em>個で${prizeOut ? "達成" : "景品"}！`}</b>
          <small class="rc-turn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.3-4.9M4 5v4h4M4 13a8 8 0 0 0 14.3 4.9M20 19v-4h-4"/></svg>うらを見る</small>
        </span>
        ${state.claimedAt ? '<i class="rc-claimed" aria-hidden="true">引換済</i>' : ""}
      </span>
      <span class="rc-face rc-back">
        <b class="rc-back-title">あそびかた</b>
        <ol class="rc-rules">
          <li>模擬店・学科展示・会場に置いてある QR を読む（はじめの1個は、玄関のインフォメーションで）</li>
          <li>スタンプが<em>${RALLY.goal}個</em>たまったら達成</li>
          <li>${prizeOut ? "景品は終了しました（ごめんなさい）" : `${esc(RALLY.claimPlace)}で、この画面を見せて景品と交換`}</li>
        </ol>
        <small class="rc-prize">${prizeOut ? "景品は、すべてなくなりました。ごめんなさい。" : esc(RALLY.prize)}</small>
        <small class="rc-shops">${list.length ? `対象：${list.map((s) => esc(s.name)).join("・")}` : "対象の場所は、決まりしだいここに出ます"}</small>
      </span>
    </button>`;
  justStamped = null;

  const goal = $("#rally-goal");
  goal.hidden = !done;
  if (!done) return;
  if (state.claimedAt) {
    const when = new Date(state.claimedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
    goal.innerHTML = `
      <div class="goal-card is-claimed">
        <p class="goal-title">引き換え済みです</p>
        <p>${esc(when)} に引き換えました。ご参加ありがとうございました！</p>
      </div>`;
    return;
  }
  if (prizeOut) { // 景品がなくなったあと：引き換えの画面のかわりに、おわび
    goal.innerHTML = `
      <div class="goal-card is-claimed">
        <p class="goal-title">達成！</p>
        <p>ごめんなさい。景品は、すべてなくなりました。<br>最後まで集めてくれて、ありがとうございました！</p>
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
        <input id="claim-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="12" placeholder="番号">
        <button type="submit">引き換える</button>
      </form>
      <p class="claim-msg" id="claim-msg" role="status"></p>
    </div>`;
  tickClock();
  $("#claim-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pin = $("#claim-pin").value;
    if (!RALLY.staffPin) {
      $("#claim-msg").textContent = "引き換えの番号がまだ設定されていません（本部に知らせてください）";
      return;
    }
    const button = e.submitter;
    if (button) button.disabled = true;
    $("#claim-msg").textContent = "確かめています…";
    let ok = false;
    try {
      ok = await pinHash(pin, RALLY.staffPin) === RALLY.staffPin.hash;
    } catch (err) {
      $("#claim-msg").textContent = `確かめられませんでした（${err.message}）`;
      if (button) button.disabled = false;
      return;
    }
    if (button) button.disabled = false;
    if (!ok) {
      $("#claim-msg").textContent = "番号が違います（スタッフが入力します）";
      return;
    }
    state.claimedAt = nowMs();
    save();
    syncLog();
    render();
  });
}

function tickClock() {
  const el = document.getElementById("goal-clock");
  if (el) el.textContent = new Date(nowMs()).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" });
}

// スタンプカードのページ（rally.html）
export function initRallyPage(getNow = () => Date.now()) {
  nowMs = getNow;
  warnInAppBrowser();
  render();
  onRallyChange(render);
  changeFns.add(() => { justStamped = null; render(); message("本部がスタンプラリーをリセットしました。", "info"); });
  setInterval(tickClock, 1000);
  import("./live.js").then(({ subscribeLive }) => subscribeLive((d) => {
    const v = !!d?.prize_out;
    if (v !== prizeOut) { prizeOut = v; render(); }
  })).catch(() => { /* 読めなくても、スタンプは押せる */ });

  $("#rally-vote").addEventListener("click", (e) => {
    const b = e.target.closest("[data-vote]");
    if (b) castVote(b.dataset.vote);
  });
  refreshVote();
  // カードを押すと裏返る
  $("#rc").addEventListener("click", (e) => {
    const b = e.target.closest(".rc");
    if (b) b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true"));
  });
  // お店の QR を読む（ページの中のカメラ）。読めたら、その QR の鍵でスタンプを押す
  $("#rally-scan").addEventListener("click", () => openQrScanner({
    title: "QR を読む",
    hint: "模擬店・学科展示・会場に置いてある QR を枠に入れてください",
    wrong: "スタンプラリーの QR ではないようです",
    noCamera: "スマホのカメラアプリで QR を読んでも、スタンプは押せます",
    accept: (text) => {
      try {
        const q = new URL(text, location.href).searchParams;
        return q.get("s") && q.get("c") ? { s: q.get("s"), c: q.get("c") } : null;
      } catch { return null; }
    },
    onRead: ({ s, c }) => stamp(c, s),
  }));

  // QR から来たとき（?s=店ID&c=QRの鍵）。押したらURLから消して、再読み込みで二重に出ないようにする
  const params = new URLSearchParams(location.search);
  if (params.has("s") && params.has("c")) {
    const [s, c] = [params.get("s"), params.get("c")];
    params.delete("s");
    params.delete("c");
    history.replaceState(null, "", location.pathname + (params.size ? `?${params}` : ""));
    stamp(c, s);
  }
}

// トップページの「縁日」の下の、小さなスタンプカード（入口）。押すとスタンプカードのページ
let miniEl = null;
export function renderMini(el) {
  if (!el) return;
  if (!miniEl) changeFns.add(() => renderMini(miniEl));
  miniEl = el;
  const count = stampCount();
  const n = Math.max(RALLY.goal, count);
  el.innerHTML = `
    <a class="rc-mini" href="rally.html">
      <img class="rc-logo" src="assets/img/logo-s.webp" width="673" height="657" alt="">
      <span class="rc-mini-txt"><b>スタンプカード</b></span>
      <span class="rc-mini-dots" aria-label="${count} / ${RALLY.goal}">${Array.from({ length: n }, (_, i) => `<i${i < count ? ' class="on"' : ""}>${i < count ? "縁" : ""}</i>`).join("")}</span>
    </a>`;
}
