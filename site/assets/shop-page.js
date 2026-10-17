import { FIREBASE_VERSION, firebaseConfig, connectEmulators } from "./live.js";

const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
const [appMod, auth, fs] = await Promise.all([
  import(`${base}/firebase-app.js`), import(`${base}/firebase-auth.js`), import(`${base}/firebase-firestore.js`),
]);
const app = appMod.getApps().find((x) => x.name === "[DEFAULT]") ?? appMod.initializeApp(firebaseConfig);
const a = auth.getAuth(app);
const db = fs.getFirestore(app);
connectEmulators({ fs, db, auth, a });
const $ = (s) => document.querySelector(s);
const LABEL = { normal: "すぐ買える", "10min": "10分くらい待つ", "20min": "20分以上待つ", soldout: "完売", closed: "休業中" };
const COLOR = { normal: "#1e8e3e", "10min": "#e8a317", "20min": "#d93025", soldout: "#6b6b6b", closed: "#4b5a8a" };
const fontChars = new Set();
function loadFont(text) {
  const before = fontChars.size;
  for (const ch of String(text).replace(/\s+/g, "")) fontChars.add(ch);
  if (fontChars.size === before) return;
  $("#wdxl").href = `https://fonts.googleapis.com/css2?family=WDXL+Lubrifont+JP+N&display=swap&text=${encodeURIComponent([...fontChars].join(""))}`;
}
loadFont(`${Object.values(LABEL).join("")}10分くらい待つ20分以上待つ完売しました—お店のQRを読んでください読みこみ中…`);

await a.authStateReady();
if (!a.currentUser) await auth.signInAnonymously(a);
const uid = a.currentUser.uid;

const params = new URLSearchParams(location.search);
if (params.get("code") && params.get("shop")) {
  try {
    await fs.setDoc(fs.doc(db, "shop_members", uid), { shop: params.get("shop"), code: params.get("code"), at: fs.serverTimestamp() });
  } catch {
    $("#msg").textContent = "この QR は使えません（取り消されたかもしれません）。本部に聞いてください。";
  }
  history.replaceState(null, "", location.pathname);
}

let shopId = null;
try {
  const me = await fs.getDoc(fs.doc(db, "shop_members", uid));
  shopId = me.exists() ? me.data().shop : null;
} catch { }

if (!shopId) {
  $("#shop-name").textContent = "お店の QR を読んでください";
  $("#need-code").hidden = false;
} else {
  $("#panel").hidden = false;
  fs.onSnapshot(fs.doc(db, "shops", shopId), (snap) => {
    const s = snap.data() ?? {};
    $("#shop-name").textContent = s.name ?? shopId;
    loadFont(s.name ?? shopId);
    $("#now").textContent = LABEL[s.status] ?? "—";
    $("#now-box").style.setProperty("--now", COLOR[s.status] ?? "transparent");
    const t = s.updated_at?.toDate?.();
    $("#updated").textContent = t ? `${t.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} に更新` : "";
    document.querySelectorAll("[data-status]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.status === s.status)));
    const cur = typeof s.message === "string" ? s.message : "";
    if (document.activeElement !== $("#note-text") && !noteDirty) { $("#note-text").value = cur; countNote(); }
    const at = s.message_at?.toDate?.();
    $("#note-state").textContent = cur ? `いま出ています${at ? `（${at.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}）` : ""}` : "いまは何も出ていません";
  });
  let noteDirty = false;
  const countNote = () => { $("#note-count").textContent = `${[...$("#note-text").value].length} / 40`; };
  $("#note-text").addEventListener("input", () => { noteDirty = true; countNote(); });
  const saveNote = async (text) => {
    const bs = document.querySelectorAll("#note-form button");
    bs.forEach((x) => (x.disabled = true));
    try {
      await fs.updateDoc(fs.doc(db, "shops", shopId), { message: text, message_at: fs.serverTimestamp() });
      noteDirty = false;
      $("#msg").textContent = text ? "ひとことをのせました" : "ひとことを消しました";
    } catch {
      $("#msg").textContent = "のせられませんでした。コードが取り消されたかもしれません。本部に聞いてください。";
    } finally {
      bs.forEach((x) => (x.disabled = false));
    }
  };
  $("#note-form").addEventListener("submit", (e) => { e.preventDefault(); saveNote($("#note-text").value.trim().slice(0, 40)); });
  $("#note-clear").addEventListener("click", () => { if (confirm("ひとことを消しますか？")) { $("#note-text").value = ""; countNote(); saveNote(""); } });
  $("#panel").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-status]");
    if (!b) return;
    const buttons = document.querySelectorAll("button[data-status]");
    buttons.forEach((x) => (x.disabled = true));
    try {
      await fs.updateDoc(fs.doc(db, "shops", shopId), { status: b.dataset.status, updated_at: fs.serverTimestamp() });
      $("#msg").textContent = `「${LABEL[b.dataset.status]}」にしました`;
    } catch {
      $("#msg").textContent = "変えられませんでした。コードが取り消されたかもしれません。本部に聞いてください。";
    } finally {
      buttons.forEach((x) => (x.disabled = false));
    }
  });
}
