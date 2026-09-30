// みんなの声（レビュー・投稿）。書くとすぐ出る。良くない言葉ははじき、報告が3件たまると自動で隠し、本部が staff/posts.html で消せる。
//
// Firestore：
//   posts/{id}              = { kind: "review" | "post", place, shop, stars, text, has_photo, uid, created_at, reports, hidden, reply_to }
//                             place は "" なら場所なし。reply_to は返信先の投稿の id（返信でなければ null）。likes はいいねの数
//   post_photos/{id}        = { data: "data:image/jpeg;base64,…", uid }   写真（スマホの中で小さくしてから入れる。Storage は使わない）
//   post_reports/{id}_{uid} = { post, uid, at }                          報告（1人1回）
//   post_likes/{id}_{uid}   = { post, uid, at }                          いいね（1人1回。もう一度押すと取り消し）。posts の likes が数
//   users_meta/{uid}        = { last_post }                              続けて投稿できないようにする（60秒）
// 書くには匿名ログインが要る（Firebase コンソール → Authentication → ログイン方法 → 匿名 を有効にする）。
// 読み書きのルールは KOSENSAI-63/firestore.rules。
import { FIREBASE_VERSION, firebaseConfig } from "./live.js";

export const MAX_TEXT = 140;       // 文字数
// 投稿した人の名前（ログインの印 uid から作る。本当の名前は集めないので、同じ人は同じ名前になるだけ）
export function handleOf(uid) {
  let h = 2166136261;
  for (const c of String(uid ?? "")) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return `enishi_${(h >>> 0).toString(36).slice(-4).padStart(4, "0")}`;
}
export const REPORT_HIDE = 3;      // 報告がこの数になったら隠す
export const COOLDOWN_SEC = 60;    // 次に書けるまでの秒数
const PHOTO_MAX = 700 * 1000;      // 写真のデータの大きさ（Firestore の1件は1MBまで）

// 書かせない言葉（ひらがな・カタカナ・全角半角・記号の違いはそろえて調べる）。firestore.rules にも同じものがある
const NG = ["死ね", "しね", "殺す", "ころす", "きもい", "きしょい", "うざい", "ブス", "ぶす", "デブ", "でぶ", "バカ", "ばか", "あほ", "消えろ", "きえろ",
  "ガイジ", "がいじ", "ちんこ", "まんこ", "セックス", "せっくす", "レイプ", "れいぷ", "fuck", "shit"];
const fold = (s) => String(s ?? "").normalize("NFKC").toLowerCase()
  .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
  .replace(/[\s\-ー_.・,、。!！?？*＊~〜]/g, "");
export function ngWord(text) {
  const t = fold(text);
  return NG.find((w) => t.includes(fold(w))) ?? null;
}
// 個人情報っぽいもの（電話番号・メール・SNS のID）
export function looksPersonal(text) {
  const t = String(text ?? "").normalize("NFKC");
  return /\d{2,4}-?\d{2,4}-?\d{3,4}/.test(t) || /[\w.+-]+@[\w-]+\.[\w.]+/.test(t) || /@[A-Za-z0-9_]{3,}/.test(t) || /line\s*id/i.test(t);
}

let kitP = null;
function kit() {
  kitP ??= (async () => {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
    const [appMod, fs, auth] = await Promise.all([import(`${base}/firebase-app.js`), import(`${base}/firebase-firestore.js`), import(`${base}/firebase-auth.js`)]);
    const app = appMod.getApps().find((a) => a.name === "[DEFAULT]") ?? appMod.initializeApp(firebaseConfig);
    return { fs, auth, db: fs.getFirestore(app), a: auth.getAuth(app) };
  })();
  return kitP;
}
async function signedIn() {
  const k = await kit();
  if (!k.a.currentUser) await k.auth.signInAnonymously(k.a);
  return k;
}

// ?demo=1 のときの見本
const params = new URLSearchParams(location.search);
const DEMO = [
  { id: "demo1", uid: "demo-a", kind: "review", place: "H107", shop: "め～どちゅろす", stars: 5, text: "【デモ】メイドさんの接客がかわいかった！チュロスも熱々。", has_photo: false, created_at: Date.now() - 5 * 60000, reports: 0, hidden: false, likes: 12 },
  { id: "demo2", uid: "demo-b", kind: "post", place: "gym2", shop: null, stars: null, text: "【デモ】ステージめっちゃ盛り上がってる！", has_photo: false, created_at: Date.now() - 12 * 60000, reports: 0, hidden: false, likes: 4 },
  { id: "demo3", uid: "demo-c", kind: "post", place: "", shop: null, stars: null, text: "【デモ】今年の縁、いい感じ！（場所なしの投稿）", has_photo: false, created_at: Date.now() - 30 * 60000, reports: 0, hidden: false, likes: 1 },
  { id: "demo4", uid: "demo-b", kind: "post", place: "H107", shop: null, stars: null, text: "【デモ】わかる！また行きたい", has_photo: false, created_at: Date.now() - 3 * 60000, reports: 0, hidden: false, likes: 2, reply_to: "demo1" },
];

// 新しい順に150件。隠したもの・報告が多いものは visible:false
export async function subscribePosts(callback) {
  if (params.has("demo")) return callback(DEMO.map((p) => ({ reply_to: null, ...p, author: handleOf(p.uid), visible: true })));
  try {
    const { fs, db } = await kit();
    fs.onSnapshot(
      fs.query(fs.collection(db, "posts"), fs.orderBy("created_at", "desc"), fs.limit(150)),
      (snap) => {
        const list = [];
        snap.forEach((d) => {
          const v = d.data();
          const reports = Number(v.reports ?? 0);
          list.push({ id: d.id, kind: v.kind, place: v.place, shop: v.shop ?? null, stars: v.stars ?? null, text: String(v.text ?? ""),
            has_photo: !!v.has_photo, created_at: v.created_at?.toMillis?.() ?? Date.now(), reports, hidden: !!v.hidden, likes: Number(v.likes ?? 0), reply_to: v.reply_to ?? null, author: handleOf(v.uid),
            visible: !v.hidden && reports < REPORT_HIDE });
        });
        callback(list);
      },
      (err) => { console.warn("[posts] Firestore を読めませんでした:", err.code); callback(null, err); },
    );
  } catch (err) {
    console.warn("[posts] Firebase を読み込めませんでした:", err);
    callback(null, err);
  }
}

// 写真（あとから読む。1回読んだら覚えておく）
const photoCache = new Map();
export const cachedPhoto = (id) => photoCache.get(id) ?? null;
export async function loadPhoto(id) {
  if (photoCache.has(id)) return photoCache.get(id);
  const { fs, db } = await kit();
  const snap = await fs.getDoc(fs.doc(db, "post_photos", id));
  const data = snap.exists() ? snap.data().data : null;
  photoCache.set(id, data);
  return data;
}

// 写真を小さくする（長い辺 960px の JPEG。大きすぎたら画質を下げる）。向き（EXIF）はそろえ、位置情報などは残らない
async function shrink(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 960 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
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

// 書く。うまくいかなければ Error（message をそのまま画面に出せる）
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
  const ref = fs.doc(fs.collection(db, "posts"));
  const b = fs.writeBatch(db);
  b.set(ref, { kind, place: place ?? "", shop: kind === "review" ? shop : null, stars: kind === "review" ? stars : null, text, has_photo: !!photo, uid,
    created_at: fs.serverTimestamp(), reports: 0, hidden: false, reply_to: replyTo ?? null });
  if (photo) b.set(fs.doc(db, "post_photos", ref.id), { data: photo, uid });
  b.set(fs.doc(db, "users_meta", uid), { last_post: fs.serverTimestamp() });
  try {
    await b.commit();
  } catch (err) {
    console.warn("[posts] 書けませんでした:", err.code);
    throw new Error(err.code === "permission-denied" ? "いまは書けません（少し待つか、言葉を変えてください）" : "送れませんでした。電波のよい所でもう一度");
  }
  try { localStorage.setItem(COOL_KEY, String(Date.now())); } catch { /* 保存できないブラウザ */ }
  if (photo) photoCache.set(ref.id, photo);
  return ref.id;
}

// 報告（1人1回）
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
  try { localStorage.setItem(REP_KEY, JSON.stringify([...JSON.parse(localStorage.getItem(REP_KEY) ?? "[]"), id].slice(-200))); } catch { /* 保存できないブラウザ */ }
}

// いいね（1人1回。もう一度押すと取り消し）。押したものはこのスマホに覚えておく
const LIKE_KEY = "kosen63-liked";
const likedList = () => { try { return JSON.parse(localStorage.getItem(LIKE_KEY) ?? "[]"); } catch { return []; } };
export const liked = (id) => likedList().includes(id);
const setLiked = (id, v) => {
  try { const l = likedList().filter((x) => x !== id); localStorage.setItem(LIKE_KEY, JSON.stringify(v ? [...l, id].slice(-500) : l)); } catch { /* 保存できないブラウザ */ }
};
export async function toggleLike(id) {
  const on = !liked(id);
  setLiked(id, on); // 先に覚える（すぐ来る描き直しで♡が戻らないように）
  if (params.has("demo")) return on; // デモはこのスマホの中だけ
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
    setLiked(id, !on); // 送れなかったら元にもどす
    throw err;
  }
  return on;
}
