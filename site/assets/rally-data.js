// スタンプラリーの対象のお店と、引き換えのスタッフ番号（の暗号化した値）。
// 本部コンソールの「模擬店」で作ったものが Firestore の rally/current に入っていれば、そちらを使う。
// 入っていなければ config.js の RALLY（tools/make-rally-qr.py で作ったもの）のまま。
//   rally/current = { shops: [{ id, name, room?, place?, codes: { "YYYY-MM-DD": 暗号化した鍵 } }], staffPin: { salt, iterations, hash } }
// 前に読んだものはこのスマホに覚えておき、電波がなくてもスタンプを押せるようにする。
import { RALLY } from "./config.js";

const KEY = "kosen63-rally-data";
const params = new URLSearchParams(location.search);
const CONFIG = { shops: RALLY.shops.map((s) => ({ ...s })), staffPin: RALLY.staffPin };

function apply(data) {
  const useFirestore = Array.isArray(data?.shops) && data.shops.length > 0;
  const shops = useFirestore ? data.shops : CONFIG.shops;
  RALLY.shops.splice(0, RALLY.shops.length, ...shops.map((s) => ({ ...s })));
  RALLY.staffPin = data?.staffPin ?? CONFIG.staffPin;
}

// お店の情報を、一度でも読めたか（前に読んでこのスマホに覚えてあるか、いま Firestore から届いたか）。
// まだ読めていないあいだは、config.js のテスト用のお店しかないので、本物の QR を読んでも「この QR ではない」と出てしまう。それを、電波のせいだと伝えるのに使う
let loaded = false;
export const rallyLoaded = () => loaded || params.has("demo");
try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
  if (saved && !params.has("demo")) { apply(saved); loaded = true; }
} catch { /* 覚えていない・読めない */ }

const listeners = new Set();
export function onRallyChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let resolveReady;
const ready = new Promise((ok) => { resolveReady = ok; });
// 最初の読みこみを待つ（待ちすぎないように timeout ミリ秒まで）
export function rallyReady(timeout = 2000) {
  return Promise.race([ready, new Promise((ok) => setTimeout(ok, timeout))]);
}

if (params.has("demo")) {
  resolveReady();
} else {
  import("./live.js").then(({ subscribeRally }) => subscribeRally((data) => {
    const before = JSON.stringify({ shops: RALLY.shops, staffPin: RALLY.staffPin });
    apply(data);
    loaded = true;
    try { localStorage.setItem(KEY, JSON.stringify(data ?? null)); } catch { /* 保存できないブラウザ */ }
    resolveReady();
    if (JSON.stringify({ shops: RALLY.shops, staffPin: RALLY.staffPin }) !== before) listeners.forEach((fn) => fn());
  })).catch(() => resolveReady());
}
