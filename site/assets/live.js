// 当日の更新内容を Firestore の site_live/current から受け取る。
// サーバーのファイルを触らずに、Firebase コンソールで書き換えるだけでトップに反映される。
//
// site_live/current の中身:
//   phase_override : "before" | "during" | "after" | null   表示を強制的に切り替える
//   notice         : string                                  トップ下部の帯に出すお知らせ
//   now_events     : [{ title, venue, start, end }]          「今やっていること」を手動で上書き
//   stream_url     : string                                  YouTube の配信URL
//   stream_active  : boolean                                 true の間トップに配信を出す
//   food_reports   : [{ shop, text, photo }]                 いちゃの食レポ
//   photos         : [{ url, caption }]                      会場の写真
//   prize_out      : boolean                                 スタンプラリーの景品がなくなった（スタンプカードのページにおわび）
//
// 混雑状況は別のコレクション crowd/{会場ID}（本部コンソールから書き込む）
// 模擬店の待ち時間は shops/{id}（模擬店の人が shop.html から、本部が本部コンソールから書き込む）
//
// Firebase に繋がらなくてもページは config.js の内容だけで表示される。

export const FIREBASE_VERSION = "10.12.2"; // 変えたら index.html・map.html の modulepreload の版もそろえる
export const firebaseConfig = {
  apiKey: "AIzaSyCpFQ5nFnW6O0Ful2pAD3nGM-N-qxhS-04",
  authDomain: "enishi-7f43f.firebaseapp.com",
  projectId: "enishi-7f43f",
  storageBucket: "enishi-7f43f.firebasestorage.app",
  messagingSenderId: "799252125591",
  appId: "1:799252125591:web:2ff3274c2d7e1fef8bd6d2",
};

// ?demo=1 で当日の見た目を確認するためのサンプル
const DEMO = {
  notice: "【デモ】14:00から体育館で抽選会の整理券を配布します",
  notice_level: new URLSearchParams(location.search).has("urgent") ? "urgent" : "info",
  stream_url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
  stream_active: true,
  food_reports: [
    { shop: "クレープ（3-J）", text: "生地がもちもち。いちごカスタードが一番人気らしい。", photo: "" },
    { shop: "焼きそば（2-M）", text: "ソースの香りで行列ができてた。量が多くて満足。", photo: "" },
  ],
  photos: [],
};

const params = new URLSearchParams(location.search);

// 手元で試すとき（localhost で ?emulator=1）：本物の Firebase ではなく、自分の PC の Firebase エミュレーターにつなぐ
//   npx firebase-tools emulators:start --only firestore,auth --project enishi-7f43f（リポジトリのいちばん上で）
export const USE_EMULATOR = ["localhost", "127.0.0.1"].includes(location.hostname) && params.has("emulator");
export function connectEmulators({ fs: firestore, db, auth, a } = {}) {
  if (!USE_EMULATOR) return;
  if (firestore && db && !db.__kosenEmulator) {
    firestore.connectFirestoreEmulator(db, "127.0.0.1", 8089);
    db.__kosenEmulator = true;
  }
  if (auth && a && !a.__kosenEmulator) {
    auth.connectAuthEmulator(a, "http://127.0.0.1:9099", { disableWarnings: true });
    a.__kosenEmulator = true;
  }
}

// ?demo=1 のときの混雑サンプル（?now= があればその時刻を基準にする）
const demoNow = params.get("now") ? Date.parse(params.get("now") + (params.get("now").includes("+") ? "" : "+09:00")) : Date.now();
const DEMO_CROWD = {
  gym2: { level: 2, updated_at: demoNow - 3 * 60 * 1000 },
  entrance: { level: 0, updated_at: demoNow - 12 * 60 * 1000 },
  zacros: { level: 1, updated_at: demoNow - 45 * 60 * 1000 },
};
let dbPromise = null;
let fs = null;

// Firestore を1つだけ作る（live.js・posts.js・rally.js で共通）。読んだものをこのスマホ（IndexedDB）に覚えておき、
// 次にページを開いたときは、変わったものだけをサーバーから読む（読みこみの回数＝Firestore の上限・料金を減らす）。
// 覚えられないブラウザ（シークレットモードなど）では、いつもどおり毎回読む
export function firestoreFor(firestore, app) {
  if (app.__kosenDb) return app.__kosenDb;
  let db;
  try {
    db = firestore.initializeFirestore(app, { localCache: firestore.persistentLocalCache({ tabManager: firestore.persistentMultipleTabManager() }) });
  } catch {
    db = firestore.getFirestore(app); // もう作ってあった・覚えておけない
  }
  app.__kosenDb = db;
  return db;
}

// Firebase の読み込みは1回だけ
function getDb() {
  dbPromise ??= (async () => {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
    const [{ initializeApp, getApps }, firestore] = await Promise.all([
      import(`${base}/firebase-app.js`),
      import(`${base}/firebase-firestore.js`),
    ]);
    fs = firestore;
    // みんなの声（posts.js）が先に立ち上げていればそれを使う
    const db = firestoreFor(firestore, getApps().find((a) => a.name === "[DEFAULT]") ?? initializeApp(firebaseConfig));
    connectEmulators({ fs: firestore, db });
    return db;
  })();
  return dbPromise;
}

// 本部が「全員のキャッシュを削除」を押した（site_live/current の cache_reset_at）：この端末のしまってあるページ・部品（Service Worker）を消して、1回だけ読みこみなおす。
// 初めて来た人（しまってあるものがない）は、何もしない。スタンプ・投票などの記録は消さない
async function applyCacheReset(t) {
  if (!t) return;
  try {
    const seen = Number(localStorage.getItem("kosen63-cache-reset") ?? 0);
    if (t <= seen) return;
    localStorage.setItem("kosen63-cache-reset", String(t));
    const keys = "caches" in globalThis ? await caches.keys() : [];
    if (!seen && !keys.length) return;
    await Promise.all(keys.map((k) => caches.delete(k)));
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    location.reload();
  } catch (err) { console.warn("[live] キャッシュを消せませんでした:", err); }
}
export async function subscribeLive(callback) {
  if (params.has("demo")) return callback(DEMO);
  try {
    const db = await getDb();
    fs.onSnapshot(
      fs.doc(db, "site_live", "current"),
      (snap) => { const d = snap.exists() ? snap.data() : null; applyCacheReset(d?.cache_reset_at?.toMillis?.()); callback(d); },
      (err) => console.warn("[live] Firestore を読めませんでした:", err.code),
    );
  } catch (err) {
    console.warn("[live] Firebase を読み込めませんでした:", err);
  }
}

// crowd/{会場ID} = { level: 0〜3, updated_at: Timestamp }
export async function subscribeCrowd(callback) {
  if (params.has("demo")) return callback(DEMO_CROWD);
  try {
    const db = await getDb();
    fs.onSnapshot(
      fs.collection(db, "crowd"),
      (snap) => {
        const data = {};
        snap.forEach((d) => {
          const v = d.data();
          data[d.id] = { level: v.level, updated_at: v.updated_at?.toMillis?.() ?? null };
        });
        callback(data);
      },
      (err) => console.warn("[crowd] Firestore を読めませんでした:", err.code),
    );
  } catch (err) {
    console.warn("[crowd] Firebase を読み込めませんでした:", err);
  }
}

// shops/{id} = { name, status: "normal" | "10min" | "20min" | "soldout", map? }  模擬店の待ち時間（app/ と同じもの）
// map（なくてもよい）は校内マップのお店との結びつけ：config.js の SHOPS の name・クラス（例 "5SE"）・部屋番号のどれか。
// ないときは name で探す。pass などほかの項目は読んでも使わない
const DEMO_SHOPS = [
  { id: "d1", name: "めぇ～どちゅろす", status: "10min" },
  { id: "d2", name: "5SE", status: "20min" },
  { id: "d3", name: "やきとり処清", status: "soldout" },
  { id: "d4", name: "5SJ お好み焼き", status: "normal" },
];
export async function subscribeShops(callback) {
  if (params.has("demo")) return callback(DEMO_SHOPS);
  try {
    const db = await getDb();
    fs.onSnapshot(
      fs.collection(db, "shops"),
      (snap) => {
        const list = [];
        snap.forEach((d) => {
          const v = d.data();
          list.push({ id: d.id, name: String(v.name ?? ""), status: v.status ? String(v.status) : null, map: v.map ? String(v.map) : null, updated_at: v.updated_at?.toMillis?.() ?? null,
            message: typeof v.message === "string" ? v.message.slice(0, 40) : "", message_at: v.message_at?.toMillis?.() ?? null });
        });
        callback(list);
      },
      (err) => console.warn("[shops] Firestore を読めませんでした:", err.code),
    );
  } catch (err) {
    console.warn("[shops] Firebase を読み込めませんでした:", err);
  }
}

// chatter/current = { p1〜p5: string, updated_at }  本部が書く、5人のセリフの実況
// スタンプラリーの対象のお店とスタッフ番号（rally-data.js が使う）
export async function subscribeRally(callback) {
  try {
    const db = await getDb();
    fs.onSnapshot(
      fs.doc(db, "rally", "current"),
      (snap) => callback(snap.exists() ? snap.data() : null),
      (err) => console.warn("[rally] Firestore を読めませんでした:", err.code),
    );
  } catch (err) {
    console.warn("[rally] Firebase を読み込めませんでした:", err);
  }
}

// 本部コンソールの「サイトの設定」（blocks.js が使う）
//   site_config/current = { blocks: [{ id, show }] }（トップページの欄の並びと、出す・出さない）
export async function subscribeSiteConfig(callback) {
  try {
    const db = await getDb();
    fs.onSnapshot(
      fs.doc(db, "site_config", "current"),
      (snap) => callback(snap.exists() ? snap.data() : null),
      (err) => console.warn("[site_config] Firestore を読めませんでした:", err.code),
    );
  } catch (err) {
    console.warn("[site_config] Firebase を読み込めませんでした:", err);
  }
}

// スケジュールの変更（本部コンソールの「スケジュール」）：site_schedule/current = { changes: { [sid]: { start, end } } }
export async function subscribeSchedule(callback) {
  // 確かめるとき：?demo=1&sched={"a202610241215":{"start":"2026-10-24T12:25:00+09:00","end":"2026-10-24T12:45:00+09:00"}}
  if (params.has("demo")) { try { return callback(JSON.parse(params.get("sched") ?? "{}")); } catch { return callback({}); } }
  try {
    const db = await getDb();
    fs.onSnapshot(
      fs.doc(db, "site_schedule", "current"),
      (snap) => callback(snap.exists() ? (snap.data().changes ?? {}) : {}),
      (err) => console.warn("[site_schedule] Firestore を読めませんでした:", err.code),
    );
  } catch (err) {
    console.warn("[site_schedule] Firebase を読み込めませんでした:", err);
  }
}

// スタンプラリーを全員リセットした時刻（rally.js が使う）
//   rally_control/current = { reset_at }
export async function subscribeRallyControl(callback) {
  try {
    const db = await getDb();
    fs.onSnapshot(
      fs.doc(db, "rally_control", "current"),
      (snap) => callback(snap.exists() ? snap.data() : null),
      (err) => console.warn("[rally_control] Firestore を読めませんでした:", err.code),
    );
  } catch (err) {
    console.warn("[rally_control] Firebase を読み込めませんでした:", err);
  }
}

export async function subscribeChatter(callback) {
  if (params.has("demo")) return callback({ p4: "【デモ】いま体育館、めっちゃ盛り上がってる！" });
  try {
    const db = await getDb();
    fs.onSnapshot(
      fs.doc(db, "chatter", "current"),
      (snap) => callback(snap.exists() ? snap.data() : null),
      (err) => console.warn("[chatter] Firestore を読めませんでした:", err.code),
    );
  } catch (err) {
    console.warn("[chatter] Firebase を読み込めませんでした:", err);
  }
}

// ---------- 閲覧者数 ----------
// 閲覧者数：このブラウザを、1日に1回だけ数える（日付は日本時間）。同じ文書に書きすぎないよう、10個に分けて数える（本部が合計する）。個人を特定するものは送らない
export async function countVisit() {
  if (params.has("demo") || params.has("preview") || ["localhost", "127.0.0.1"].includes(location.hostname)) return;
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date()); // 2026-10-24
  try { if (localStorage.getItem("kosen63-visit") === day) return; } catch { return; }
  try {
    const db = await getDb();
    await fs.setDoc(fs.doc(db, "visit_counts", `${day}-${Math.floor(Math.random() * 10)}`), { n: fs.increment(1) }, { merge: true });
    // どの端末か：スマホ（指でさわる・幅が狭い）／タブレット（指でさわる・幅が広い）／パソコン。同じ端末は1日1回だけ（上と同じ）
    const touch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 1 && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const device = !touch ? "pc" : Math.min(screen.width, screen.height) >= 600 ? "tablet" : "phone";
    await fs.setDoc(fs.doc(db, "visit_devices", `${day}-${device}-${Math.floor(Math.random() * 10)}`), { n: fs.increment(1) }, { merge: true });
    localStorage.setItem("kosen63-visit", day);
  } catch (err) { console.warn("[visit] 数えられませんでした:", err?.code ?? err); }
}
