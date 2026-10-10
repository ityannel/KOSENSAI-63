import { whileVisible } from "./idle-listen.js";
import { FIREBASE_VERSION, firebaseConfig, connectEmulators, firestoreFor } from "./live.js";

export const MAX_TEXT = 140;
export const NAME_GROUPS = {
  cat: "kitten lynx tiger lion cub leopard cheetah jaguar fox kitsune cougar ocelot serval bobcat panther tabby calico siamese persian ragdoll sphynx manx".split(" "),
  rabbit: "bunny hare hamster mouse gerbil guineapig chinchilla squirrel chipmunk dormouse jerboa pika rabbit cavy vole lemming".split(" "),
  bear: "bear panda koala raccoon otter beaver badger wolverine hedgehog wombat sloth capybara quokka tanuki meerkat lemur walrus seal weasel ferret mole armadillo anteater orangutan gorilla monkey macaque gibbon marmoset tamarin".split(" "),
  sheep: "sheep lamb alpaca llama goat donkey pony foal calf deer fawn zebra giraffe camel piglet yak bison reindeer moose antelope gazelle kangaroo joey wallaby".split(" "),
  dog: "puppy husky corgi poodle beagle shiba dachshund pug terrier spaniel labrador collie maltese pomeranian bulldog akita retriever chihuahua samoyed papillon dalmatian schnauzer".split(" "),
  bird: "chick duckling owlet gosling cygnet owl swan robin sparrow parrot flamingo pelican toucan peacock canary finch wren dove pigeon crane heron stork ibis kiwi cockatoo lovebird budgie hummingbird bluebird magpie swallow starling lark nightingale quail pheasant seagull".split(" "),
  penguin: "penguin puffin".split(" "),
  frog: "frog tadpole gecko chameleon iguana newt salamander turtle tortoise lizard toad axolotl".split(" "),
  fish: "goldfish clownfish seahorse starfish jellyfish octopus squid crab lobster shrimp shark ray koi trout salmon tuna pufferfish angelfish guppy dolphin whale porpoise narwhal manatee".split(" "),
  bug: "snail ladybug butterfly bee dragonfly firefly cricket caterpillar ant beetle moth cicada grasshopper".split(" "),
};
export const NAMES = Object.values(NAME_GROUPS).flat();
export function handleOf(uid) {
  let h = 2166136261;
  for (const c of String(uid ?? "")) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return NAMES[(h >>> 0) % NAMES.length];
}
export const REPORT_HIDE = 3;
export const COOLDOWN_SEC = 60;
const PHOTO_MAX = 700 * 1000;

const NG = ["死ね", "しね", "殺す", "ころす", "きもい", "きしょい", "うざい", "ブス", "ぶす", "デブ", "でぶ", "バカ", "ばか", "あほ", "消えろ", "きえろ",
  "ガイジ", "がいじ", "ちんこ", "まんこ", "セックス", "せっくす", "レイプ", "れいぷ", "fuck", "shit"];
const fold = (s) => String(s ?? "").normalize("NFKC").toLowerCase()
  .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
  .replace(/[\s\-ー_.・,、。!！?？*＊~〜]/g, "");
export function ngWord(text) {
  const t = fold(text);
  return NG.find((w) => t.includes(fold(w))) ?? null;
}
export function looksPersonal(text) {
  const t = String(text ?? "").normalize("NFKC");
  return /\d{2,4}-?\d{2,4}-?\d{3,4}/.test(t) || /[\w.+-]+@[\w-]+\.[\w.]+/.test(t) || /@[A-Za-z0-9_]{3,}/.test(t) || /line\s*id/i.test(t);
}

const BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
let dbKitP = null;
function dbKit() {
  dbKitP ??= (async () => {
    const [appMod, fs] = await Promise.all([import(`${BASE}/firebase-app.js`), import(`${BASE}/firebase-firestore.js`)]);
    const app = appMod.getApps().find((a) => a.name === "[DEFAULT]") ?? appMod.initializeApp(firebaseConfig);
    const k = { fs, app, db: firestoreFor(fs, app) };
    connectEmulators({ fs, db: k.db });
    return k;
  })();
  return dbKitP;
}
let kitP = null;
function kit() {
  kitP ??= (async () => {
    const [k, auth] = await Promise.all([dbKit(), import(`${BASE}/firebase-auth.js`)]);
    const full = { ...k, auth, a: auth.getAuth(k.app) };
    connectEmulators({ auth, a: full.a });
    return full;
  })();
  return kitP;
}
async function signedIn() {
  const k = await kit();
  if (!k.a.currentUser) await k.auth.signInAnonymously(k.a);
  return k;
}

const params = new URLSearchParams(location.search);
const DEMO = [
  { id: "demo1", uid: "demo-a", kind: "review", place: "H107", shop: "めぇ～どちゅろす", stars: 5, text: "【デモ】メイドさんの接客がかわいかった！チュロスも熱々。", has_photo: false, created_at: Date.now() - 5 * 60000, reports: 0, hidden: false, likes: 12 },
  { id: "demo2", uid: "demo-b", kind: "post", place: "gym2", shop: null, stars: null, text: "【デモ】ステージめっちゃ盛り上がってる！", has_photo: false, created_at: Date.now() - 12 * 60000, reports: 0, hidden: false, likes: 4 },
  { id: "demo3", uid: "demo-c", kind: "post", place: "", shop: null, stars: null, text: "【デモ】今年の縁、いい感じ！（場所なしの投稿）", has_photo: false, created_at: Date.now() - 30 * 60000, reports: 0, hidden: false, likes: 1 },
  { id: "demo4", uid: "demo-b", kind: "post", place: "H107", shop: null, stars: null, text: "【デモ】わかる！また行きたい", has_photo: false, created_at: Date.now() - 3 * 60000, reports: 0, hidden: false, likes: 2, reply_to: "demo1" },
];

const MINE_KEY = "kosen63-my-posts";
const myPosts = () => { try { return JSON.parse(localStorage.getItem(MINE_KEY) ?? "[]"); } catch { return []; } };
const rememberMine = (id) => { try { localStorage.setItem(MINE_KEY, JSON.stringify([...myPosts(), id].slice(-100))); } catch {  } };

function photoState(v, mine) {
  if (!v.has_photo) return { has_photo: false, pending: false };
  const status = v.photo_status ?? "pending";
  if (status === "approved") return { has_photo: true, pending: false };
  if (status === "pending" && mine) return { has_photo: true, pending: true };
  return { has_photo: false, pending: status === "pending" };
}

export async function subscribePosts(callback) {
  if (params.has("demo")) return callback(DEMO.map((p) => ({ reply_to: null, ...p, author: handleOf(p.uid), visible: true })));
  try {
    const { fs, db } = await dbKit();
    if (myPosts().length) kit().catch(() => {});
    let slow = null;
    whileVisible(() => fs.onSnapshot(
      fs.query(fs.collection(db, "posts"), fs.orderBy("created_at", "desc"), fs.limit(60)),
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.empty && snap.metadata.fromCache) { slow ??= setTimeout(() => callback(null, new Error("offline")), 8000); return; }
        clearTimeout(slow); slow = null;
        const list = [];
        const mine = new Set(myPosts());
        snap.forEach((d) => {
          const v = d.data();
          const reports = Number(v.reports ?? 0);
          const photo = photoState(v, mine.has(d.id));
          const text = String(v.text ?? "");
          const empty = !photo.has_photo && !text.trim();
          list.push({ id: d.id, kind: v.kind, place: v.place, shop: v.shop ?? null, stars: v.stars ?? null, text,
            has_photo: photo.has_photo, photo_pending: photo.pending && mine.has(d.id), official: !!v.official,
            created_at: v.created_at?.toMillis?.() ?? Date.now(), reports, hidden: !!v.hidden, likes: Number(v.likes ?? 0), reply_to: v.reply_to ?? null,
            author: v.official ? "enishi" : handleOf(v.uid),
            visible: !v.hidden && reports < REPORT_HIDE && !empty });
        });
        callback(list);
      },
      (err) => { console.warn("[posts] Firestore を読めませんでした:", err.code); callback(null, err); },
    ));
  } catch (err) {
    console.warn("[posts] Firebase を読み込めませんでした:", err);
    callback(null, err);
  }
}

const photoCache = new Map();
export const cachedPhoto = (id) => photoCache.get(id) ?? null;
const IDB = "kosen63-photos", KEEP = 200;
let idbP = null;
function idb() {
  idbP ??= new Promise((ok) => {
    try {
      const r = indexedDB.open(IDB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore("p", { keyPath: "id" }).createIndex("at", "at");
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
    } catch { ok(null); }
  });
  return idbP;
}
async function idbGet(id) {
  const d = await idb();
  if (!d) return null;
  return new Promise((ok) => {
    try { const r = d.transaction("p").objectStore("p").get(id); r.onsuccess = () => ok(r.result?.data ?? null); r.onerror = () => ok(null); } catch { ok(null); }
  });
}
async function idbPut(id, data) {
  const d = await idb();
  if (!d) return;
  try {
    const st = d.transaction("p", "readwrite").objectStore("p");
    st.put({ id, data, at: Date.now() });
    const c = st.count();
    c.onsuccess = () => {
      let over = c.result - KEEP;
      if (over <= 0) return;
      st.index("at").openCursor().onsuccess = (e) => { const cur = e.target.result; if (cur && over-- > 0) { cur.delete(); cur.continue(); } };
    };
  } catch {  }
}
const loading = new Map();
export function loadPhoto(id) {
  if (photoCache.has(id)) return Promise.resolve(photoCache.get(id));
  if (loading.has(id)) return loading.get(id);
  const p = (async () => {
    const saved = await idbGet(id);
    if (saved) { photoCache.set(id, saved); return saved; }
    const mine = myPosts().includes(id);
    const { fs, db } = mine ? await kit() : await dbKit();
    if (mine) await (await kit()).a.authStateReady?.();
    const snap = await fs.getDoc(fs.doc(db, "post_photos", id));
    const data = snap.exists() ? snap.data().data : null;
    photoCache.set(id, data);
    if (data && !mine) idbPut(id, data);
    return data;
  })();
  loading.set(id, p);
  p.finally(() => loading.delete(id));
  return p;
}
let io = null;
const onMiss = new WeakMap();
export function observePhotos(root, missing = (img) => img.remove()) {
  const imgs = root.querySelectorAll("img[data-photo]:not([src])");
  const show = (img) => {
    loadPhoto(img.dataset.photo).then((src) => { if (src) img.src = src; else (onMiss.get(img) ?? missing)(img); }).catch(() => (onMiss.get(img) ?? missing)(img));
  };
  if (!("IntersectionObserver" in window)) return imgs.forEach(show);
  io ??= new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); show(e.target); }
  }, { rootMargin: "800px 0px" });
  imgs.forEach((img) => { img.decoding = "async"; onMiss.set(img, missing); io.observe(img); });
}

export async function shrink(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 960 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const webp = c.toDataURL("image/webp", 0.72);
  if (webp.startsWith("data:image/webp") && webp.length < PHOTO_MAX) return webp;
  for (let q = 0.75; q >= 0.35; q -= 0.1) {
    const url = c.toDataURL("image/jpeg", q);
    if (url.length < PHOTO_MAX) return url;
  }
  throw new Error("写真が大きすぎます");
}

const COOL_KEY = "kosen63-post-at";
export function cooldownLeft() {
  try { return Math.max(0, COOLDOWN_SEC - Math.floor((Date.now() - Number(localStorage.getItem(COOL_KEY) ?? 0)) / 1000)); } catch { return 0; }
}

export async function submitPost({ kind, place = "", shop = null, stars = null, text, file = null, replyTo = null }) {
  text = String(text ?? "").trim();
  if (!text && !file) throw new Error("ひとことか写真を入れてください");
  if (text.length > MAX_TEXT) throw new Error(`${MAX_TEXT}文字までです`);
  if (ngWord(text)) throw new Error("使えない言葉が入っています");
  if (looksPersonal(text)) throw new Error("電話番号・メール・SNS のIDなどは書けません");
  if (kind === "review" && !(stars >= 1 && stars <= 5)) throw new Error("★をえらんでください");
  const wait = cooldownLeft();
  if (wait) throw new Error(`続けて書くときは、あと${wait}秒待ってください`);
  if (params.has("demo")) throw new Error("デモでは書けません");
  let photo = null;
  if (file) {
    try { photo = await shrink(file); } catch { throw new Error("この写真は使えません。ほかの写真をえらんでください"); }
  }
  const { fs, db, a } = await signedIn();
  const uid = a.currentUser.uid;
  let review = false;
  if (photo) { try { review = (await fs.getDoc(fs.doc(db, "site_live", "current"))).data()?.photo_review === true; } catch {  } }
  const ref = fs.doc(fs.collection(db, "posts"));
  const b = fs.writeBatch(db);
  b.set(ref, { kind, place: place ?? "", shop: kind === "review" ? shop : null, stars: kind === "review" ? stars : null, text, has_photo: !!photo, uid,
    photo_status: photo ? (review ? "pending" : "approved") : "none",
    created_at: fs.serverTimestamp(), reports: 0, hidden: false, reply_to: replyTo ?? null });
  if (photo) b.set(fs.doc(db, "post_photos", ref.id), { data: photo, uid });
  b.set(fs.doc(db, "users_meta", uid), { last_post: fs.serverTimestamp() });
  try {
    await b.commit();
  } catch (err) {
    console.warn("[posts] 書けませんでした:", err.code);
    throw new Error(err.code === "permission-denied" ? "いまは書けません（少し待つか、言葉を変えてください）" : "送れませんでした。電波のよい所でもう一度");
  }
  try { localStorage.setItem(COOL_KEY, String(Date.now())); } catch {  }
  if (photo) photoCache.set(ref.id, photo);
  rememberMine(ref.id);
  return ref.id;
}

const REP_KEY = "kosen63-reported";
export function reported(id) {
  try { return JSON.parse(localStorage.getItem(REP_KEY) ?? "[]").includes(id); } catch { return false; }
}
export async function reportPost(id) {
  if (reported(id) || params.has("demo")) return;
  const { fs, db, a } = await signedIn();
  const uid = a.currentUser.uid;
  const b = fs.writeBatch(db);
  b.set(fs.doc(db, "post_reports", `${id}_${uid}`), { post: id, uid, at: fs.serverTimestamp() });
  b.update(fs.doc(db, "posts", id), { reports: fs.increment(1) });
  await b.commit();
  try { localStorage.setItem(REP_KEY, JSON.stringify([...JSON.parse(localStorage.getItem(REP_KEY) ?? "[]"), id].slice(-200))); } catch {  }
}

const LIKE_KEY = "kosen63-liked";
const likedList = () => { try { return JSON.parse(localStorage.getItem(LIKE_KEY) ?? "[]"); } catch { return []; } };
export const liked = (id) => likedList().includes(id);
const setLiked = (id, v) => {
  try { const l = likedList().filter((x) => x !== id); localStorage.setItem(LIKE_KEY, JSON.stringify(v ? [...l, id].slice(-500) : l)); } catch {  }
};
export async function toggleLike(id) {
  const on = !liked(id);
  setLiked(id, on);
  if (params.has("demo")) return on;
  try {
    const { fs, db, a } = await signedIn();
    const uid = a.currentUser.uid;
    const b = fs.writeBatch(db);
    const likeRef = fs.doc(db, "post_likes", `${id}_${uid}`);
    if (on) b.set(likeRef, { post: id, uid, at: fs.serverTimestamp() });
    else b.delete(likeRef);
    b.update(fs.doc(db, "posts", id), { likes: fs.increment(on ? 1 : -1) });
    await b.commit();
  } catch (err) {
    setLiked(id, !on);
    throw err;
  }
  return on;
}
