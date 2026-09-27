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
  stream_url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
  stream_active: true,
  food_reports: [
    { shop: "クレープ（3-J）", text: "生地がもちもち。いちごカスタードが一番人気らしい。", photo: "" },
    { shop: "焼きそば（2-M）", text: "ソースの香りで行列ができてた。量が多くて満足。", photo: "" },
  ],
  photos: [],
};

const params = new URLSearchParams(location.search);

// ?demo=1 のときの混雑サンプル（?now= があればその時刻を基準にする）
const demoNow = params.get("now") ? Date.parse(params.get("now") + (params.get("now").includes("+") ? "" : "+09:00")) : Date.now();
const DEMO_CROWD = {
  gym1: { level: 2, updated_at: demoNow - 3 * 60 * 1000 },
  entrance: { level: 0, updated_at: demoNow - 12 * 60 * 1000 },
  zacros: { level: 1, updated_at: demoNow - 45 * 60 * 1000 },
};
let dbPromise = null;
let fs = null;

// Firebase の読み込みは1回だけ
function getDb() {
  dbPromise ??= (async () => {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
    const [{ initializeApp }, firestore] = await Promise.all([
      import(`${base}/firebase-app.js`),
      import(`${base}/firebase-firestore.js`),
    ]);
    fs = firestore;
    return firestore.getFirestore(initializeApp(firebaseConfig));
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
