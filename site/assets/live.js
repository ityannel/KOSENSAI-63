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
//
// 混雑状況は別のコレクション crowd/{会場ID}（本部が staff/crowd.html から書き込む）
// 模擬店の待ち時間は shops/{id}（模擬店スタッフが app/shop-manager.html から書き込む）
//
// Firebase に繋がらなくてもページは config.js の内容だけで表示される。

export const FIREBASE_VERSION = "10.12.2";
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
    const db = firestore.getFirestore(getApps().find((a) => a.name === "[DEFAULT]") ?? initializeApp(firebaseConfig));
    connectEmulators({ fs: firestore, db });
    return db;
  })();
  return dbPromise;
}

export async function subscribeLive(callback) {
  if (params.has("demo")) return callback(DEMO);
  try {
    const db = await getDb();
    fs.onSnapshot(
      fs.doc(db, "site_live", "current"),
      (snap) => callback(snap.exists() ? snap.data() : null),
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
  { id: "d1", name: "め～どちゅろす", status: "10min" },
  { id: "d2", name: "5SE たこ焼き", status: "20min" },
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
          list.push({ id: d.id, name: String(v.name ?? ""), status: v.status ? String(v.status) : null, map: v.map ? String(v.map) : null, updated_at: v.updated_at?.toMillis?.() ?? null });
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

// 本部の管理画面で変えた文章と書体（site-text.js が使う）
export async function subscribeSiteText(callback) {
  try {
    const db = await getDb();
    fs.onSnapshot(
      fs.doc(db, "site_text", "current"),
      (snap) => callback(snap.exists() ? snap.data() : null),
      (err) => console.warn("[site_text] Firestore を読めませんでした:", err.code),
    );
  } catch (err) {
    console.warn("[site_text] Firebase を読み込めませんでした:", err);
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

// ---------- 今この絵を見ている人の数 ----------
// 5分ごとの「窓」ごとに presence/{窓の番号} = { n } を +1 する（開いている人が窓ごとに1回だけ）。
// 表示するのは「前の窓」と「今の窓」の多いほう。書き込みも読み込みも1人5分に数回で済む。
// 見ていない（別のタブにいる）間は数えない。isOff() が true になったら止まる（本部からの停止スイッチ）。
export async function startPresence(callback, { windowMinutes = 5, isOff = () => false } = {}) {
  if (params.has("demo")) return callback(23);
  const windowMs = windowMinutes * 60 * 1000;
  let db;
  try {
    db = await getDb();
  } catch {
    return;
  }
  const countOf = async (w) => {
    try {
      const snap = await fs.getDoc(fs.doc(db, "presence", String(w)));
      return snap.exists() ? snap.data().n ?? 0 : 0;
    } catch {
      return 0;
    }
  };
  let counted = null;
  let lastRead = 0;
  const beat = async () => {
    if (isOff() || document.hidden) return;
    const w = Math.floor(Date.now() / windowMs);
    if (counted === w && Date.now() - lastRead < 60000) return; // タブを行き来しても読みすぎない
    lastRead = Date.now();
    if (counted !== w) {
      counted = w;
      try {
        await fs.setDoc(fs.doc(db, "presence", String(w)), { n: fs.increment(1) }, { merge: true });
      } catch (err) {
        console.warn("[presence] 数えられませんでした:", err.code);
        return;
      }
    }
    const [prev, now] = await Promise.all([countOf(w - 1), countOf(w)]);
    callback(Math.max(prev, now, 1));
  };
  beat();
  // 窓の切り替わりに合わせて。全員が同時に書かないよう、少しずらす
  const schedule = () => {
    const wait = windowMs - (Date.now() % windowMs) + Math.random() * 20000;
    setTimeout(() => { beat(); schedule(); }, wait);
  };
  schedule();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) beat(); });
}
