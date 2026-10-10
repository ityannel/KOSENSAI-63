import { whileVisible } from "./idle-listen.js";

export const FIREBASE_VERSION = "10.12.2";
export const firebaseConfig = {
  apiKey: "AIzaSyCpFQ5nFnW6O0Ful2pAD3nGM-N-qxhS-04",
  authDomain: "enishi-7f43f.firebaseapp.com",
  projectId: "enishi-7f43f",
  storageBucket: "enishi-7f43f.firebasestorage.app",
  messagingSenderId: "799252125591",
  appId: "1:799252125591:web:2ff3274c2d7e1fef8bd6d2",
};

const DEMO = {
  notice: "【デモ】14:00から体育館で抽選会の整理券を配布します",
  notice_level: new URLSearchParams(location.search).has("urgent") ? "urgent" : "info",
  notice_style: (() => { try { return JSON.parse(new URLSearchParams(location.search).get("ntstyle") ?? "null") ?? undefined; } catch { return undefined; } })(),
  stream_url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
  stream_active: true,
  food_reports: [
    { shop: "クレープ（3-J）", text: "生地がもちもち。いちごカスタードが一番人気らしい。", photo: "" },
    { shop: "焼きそば（2-M）", text: "ソースの香りで行列ができてた。量が多くて満足。", photo: "" },
  ],
  photos: [],
};

const params = new URLSearchParams(location.search);

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

const demoNow = params.get("now") ? Date.parse(params.get("now") + (params.get("now").includes("+") ? "" : "+09:00")) : Date.now();
const DEMO_CROWD = {
  gym2: { level: 2, updated_at: demoNow - 3 * 60 * 1000 },
  entrance: { level: 0, updated_at: demoNow - 12 * 60 * 1000 },
  zacros: { level: 1, updated_at: demoNow - 45 * 60 * 1000 },
};
let dbPromise = null;
let fs = null;

export function firestoreFor(firestore, app) {
  if (app.__kosenDb) return app.__kosenDb;
  let db;
  try {
    db = firestore.initializeFirestore(app, { localCache: firestore.persistentLocalCache({ tabManager: firestore.persistentMultipleTabManager() }) });
  } catch {
    db = firestore.getFirestore(app);
  }
  app.__kosenDb = db;
  return db;
}

function getDb() {
  dbPromise ??= (async () => {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
    const [{ initializeApp, getApps }, firestore] = await Promise.all([
      import(`${base}/firebase-app.js`),
      import(`${base}/firebase-firestore.js`),
    ]);
    fs = firestore;
    const db = firestoreFor(firestore, getApps().find((a) => a.name === "[DEFAULT]") ?? initializeApp(firebaseConfig));
    connectEmulators({ fs: firestore, db });
    return db;
  })();
  return dbPromise;
}

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
    whileVisible(() => fs.onSnapshot(
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
    ));
  } catch (err) {
    console.warn("[shops] Firebase を読み込めませんでした:", err);
  }
}

export async function subscribeRally(callback) {
  try {
    const db = await getDb();
    fs.onSnapshot(
      fs.doc(db, "rally", "current"),
      { includeMetadataChanges: true },
      (snap) => { if (!snap.exists() && snap.metadata.fromCache) return; callback(snap.exists() ? snap.data() : null); },
      (err) => console.warn("[rally] Firestore を読めませんでした:", err.code),
    );
  } catch (err) {
    console.warn("[rally] Firebase を読み込めませんでした:", err);
  }
}

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

export async function subscribeSchedule(callback) {
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

export function countVisit({ isOff = () => false } = {}) {
  if (params.has("demo") || params.has("preview") || ["localhost", "127.0.0.1"].includes(location.hostname)) return;
  const KEY = "kosen63-beat", DAY_KEY = "kosen63-visit", WIN = 5 * 60000;
  try { localStorage.setItem("kosen63-t", "1"); localStorage.removeItem("kosen63-t"); } catch { return; }
  const inc = { n: fs.increment(1) }, merge = { merge: true }, pick = (n) => Math.floor(Math.random() * n);
  let busy = false;
  const beat = async () => {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const now = new Date();
      const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now);
      const hour = `${day}-${new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", hourCycle: "h23" }).format(now).slice(0, 2)}`;
      const win = String(Math.floor(now.getTime() / WIN));
      let last = {};
      try { last = JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {}; } catch {  }
      const done = (patch) => { Object.assign(last, patch); localStorage.setItem(KEY, JSON.stringify(last)); };
      const needDay = localStorage.getItem(DAY_KEY) !== day;
      const needDevice = needDay || last.dev === "";
      const needHour = last.hour !== hour, needNow = last.win !== win && !isOff();
      if (!needDay && !needDevice && !needHour && !needNow) return;
      const db = await getDb();
      if (needDay) {
        await fs.setDoc(fs.doc(db, "visit_counts", `${day}-${pick(10)}`), inc, merge);
        localStorage.setItem(DAY_KEY, day);
        done({ dev: "" });
      }
      if (needDevice) {
        const touch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 1 && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
        const device = !touch ? "pc" : Math.min(screen.width, screen.height) >= 600 ? "tablet" : "phone";
        await fs.setDoc(fs.doc(db, "visit_devices", `${day}-${device}-${pick(10)}`), inc, merge);
        done({ dev: day });
      }
      if (needHour) { await fs.setDoc(fs.doc(db, "visit_hours", `${hour}-${pick(3)}`), inc, merge); done({ hour }); }
      if (needNow) { await fs.setDoc(fs.doc(db, "presence", win), inc, merge); done({ win }); }
    } catch (err) {
      console.warn("[visit] 数えられませんでした:", err?.code ?? err);
    } finally {
      busy = false;
    }
  };
  beat();
  setInterval(beat, 30000 + Math.random() * 10000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) beat(); });
}
