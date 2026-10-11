import { isLocal, esc, HQ_FLAG, loadChat } from "./ai-core.js";
import { VAPID_PUBLIC } from "./push-config.js";

const $ = (s) => document.querySelector(s);
const demo = isLocal;
const scroller = $("#hq-scroll"), log = $("#hq-log"), intro = $("#hq-intro"), form = $("#hq-form"), box = $("#hq-q"), send = $("#hq-send"), cards = $("#hq-reasons"), closedNote = $("#hq-closed"), urgentNote = $("#hq-urgent");
const REASONS = [
  { key: "missing", label: "迷子", urgent: true, hint: "だれが、はぐれましたか？", sub: "はぐれた・見つからない" },
  { key: "sick", label: "体調不良・けが", urgent: true, hint: "どんな様子ですか？", sub: "気分が悪い・けがをした" },
  { key: "lost", label: "落とし物・忘れ物", urgent: false, hint: "何を、どこで落としましたか？", sub: "なくした・見つけた" },
  { key: "other", label: "そのほか", urgent: false, hint: "本部へのメッセージ", sub: "困りごと・ご意見" },
];
const UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
send.innerHTML = UP;

const AI_TAG = "【AIくんとの会話】";
const aiTalk = () => {
  const m = loadChat().slice(-4);
  if (!m.length) return "";
  return (AI_TAG + m.map((x) => `${x.role === "user" ? "Q" : "A"}:${String(x.text).replace(/\[\[[^\]]*\]\]/g, "").replace(/\s+/g, " ").trim()}`).join(" / ")).slice(0, 400);
};
let reason = null, kit = null, uid = "", chat = null, msgs = [], sending = false, coolUntil = 0;
const hhmm = (ms) => (ms ? new Date(ms).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }) : "");

function pick(r) {
  reason = r;
  cards.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(!!r && x.dataset.key === r.key)));
  urgentNote.hidden = !r?.urgent;
  box.placeholder = r?.hint ?? "本部へのメッセージ";
}

for (const r of REASONS) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `hq-reason${r.urgent ? " is-urgent" : ""}`;
  b.dataset.key = r.key;
  b.innerHTML = `<b>${r.label}</b><small>${r.sub}</small>`;
  b.setAttribute("aria-pressed", "false");
  b.addEventListener("click", () => {
    pick(reason?.key === r.key ? null : r);
    box.focus(); sync();
  });
  cards.append(b);
}
const pre = REASONS.find((r) => r.key === new URLSearchParams(location.search).get("r"));
if (pre) pick(pre);

const seenIdx = () => {
  const last = msgs.map((m) => m.from).lastIndexOf("staff");
  const lastVisitor = msgs.map((m) => m.from).lastIndexOf("visitor");
  return chat?.unread_staff === false ? lastVisitor : last;
};
const nearBottom = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
let stick = true;
scroller.addEventListener("scroll", () => { stick = nearBottom(); }, { passive: true });
const toBottom = () => scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
function fit() { box.style.height = "auto"; box.style.height = `${Math.min(box.scrollHeight, 132)}px`; }
function sync() { send.disabled = sending || !box.value.trim() || Date.now() < coolUntil; }

function paint() {
  const has = msgs.length > 0;
  intro.hidden = has;
  closedNote.hidden = !(chat?.status === "closed");
  const seen = seenIdx();
  log.innerHTML = msgs.map((m, i) => ({ m, i })).filter(({ m }) => !m.text.startsWith(AI_TAG)).map(({ m, i }) => m.from === "visitor"
    ? `<div class="ai-user">${esc(m.text)}</div><span class="hq-msg-time ai-user-time">${esc(hhmm(m.at))} <i class="hq-tick${i <= seen ? " is-seen" : ""}" aria-label="${i <= seen ? "本部が確認しました" : "送りました"}">${i <= seen ? "✓✓" : "✓"}</i></span>`
    : `<div class="ai-row"><i class="ai-av" aria-hidden="true"><svg viewBox="0 0 24 24" class="hq-ic"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6l-4 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg></i><div class="ai-body"><p class="hq-from">本部</p><p>${esc(m.text).replace(/\n/g, "<br>")}</p></div></div><span class="hq-msg-time">${esc(hhmm(m.at))}</span>`).join("");
  $("#hq-share-row").hidden = !!chat || !aiTalk();
  if (stick) toBottom();
}

const pushOk = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const iosBrowser = /iP(hone|ad|od)/.test(navigator.userAgent) && !matchMedia("(display-mode: standalone)").matches && !navigator.standalone;
const keyBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));

async function currentSub() {
  if (!pushOk) return null;
  try { return await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription(); } catch { return null; }
}

async function paintPush() {
  const row = $("#hq-push-row"), btn = $("#hq-push"), hint = $("#hq-push-hint");
  if (demo || !chat) { row.hidden = true; return; }
  row.hidden = false;
  if (iosBrowser) { btn.hidden = true; hint.textContent = "iPhone で通知を受け取るには、共有ボタンから「ホーム画面に追加」して、そこから開き直してください。"; return; }
  if (!pushOk) { btn.hidden = true; hint.textContent = "このブラウザでは、通知を使えません。このページを開いたままにしてください。"; return; }
  if (Notification.permission === "denied") { btn.hidden = true; hint.textContent = "通知が、ブラウザで止められています。設定で許可すると、返事を通知で知らせます。"; return; }
  const sub = await currentSub();
  const on = !!sub && chat.push === sub.endpoint && Notification.permission === "granted";
  btn.hidden = on;
  hint.textContent = on ? "通知はオンです。本部から返事が来ると、知らせます。" : "";
}

$("#hq-push").addEventListener("click", async () => {
  const btn = $("#hq-push"), hint = $("#hq-push-hint");
  btn.disabled = true;
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { hint.textContent = "通知は、許可されませんでした。このページを開いたままにしてください。"; return; }
    const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register(new URL("../sw.js", import.meta.url)));
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) }));
    await kit.fs.updateDoc(kit.fs.doc(kit.db, "hq_chats", uid), { push: sub.endpoint });
    await paintPush();
  } catch {
    hint.textContent = "通知を、オンにできませんでした。このページを開いたままにしてください。";
  } finally {
    btn.disabled = false;
  }
});

async function startReal() {
  const { signedInKit } = await import("./posts.js");
  kit = await signedInKit();
  const { fs, db, a } = kit;
  uid = a.currentUser.uid;
  const chatRef = fs.doc(db, "hq_chats", uid);
  fs.onSnapshot(chatRef, (s) => {
    chat = s.exists() ? s.data() : null;
    if (chat) { try { localStorage.setItem(HQ_FLAG, "1"); } catch {  } }
    if (chat?.unread_visitor && !document.hidden) fs.updateDoc(chatRef, { unread_visitor: false }).catch(() => {});
    paint();
    paintPush();
  });
  fs.onSnapshot(fs.query(fs.collection(db, "hq_chats", uid, "msgs"), fs.orderBy("at")), (s) => {
    msgs = s.docs.map((d) => { const v = d.data(); return { id: d.id, from: v.from, text: v.text, at: v.at?.toMillis?.() ?? Date.now() }; });
    paint();
    if (chat?.unread_visitor && !document.hidden) fs.updateDoc(chatRef, { unread_visitor: false }).catch(() => {});
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && chat?.unread_visitor) fs.updateDoc(chatRef, { unread_visitor: false }).catch(() => {});
  });
}

async function sendReal(text) {
  const { fs, db } = kit;
  const chatRef = fs.doc(db, "hq_chats", uid);
  const msgRef = fs.doc(fs.collection(db, "hq_chats", uid, "msgs"));
  const urgent = !!(reason?.urgent || chat?.urgent);
  const place = "";
  const batch = fs.writeBatch(db);
  const last = text.slice(0, 120);
  if (!chat) {
    batch.set(chatRef, { uid, place, name: "", status: "open", urgent, unread_staff: true, unread_visitor: false, last_text: last, last_from: "visitor", last_at: fs.serverTimestamp(), created_at: fs.serverTimestamp() });
  } else {
    batch.update(chatRef, { place, name: chat.name ?? "", status: "open", urgent, unread_staff: true, unread_visitor: false, last_text: last, last_from: "visitor", last_at: fs.serverTimestamp() });
  }
  batch.set(msgRef, { from: "visitor", text, at: fs.serverTimestamp() });
  const talk = !chat && $("#hq-share").checked ? aiTalk() : "";
  if (talk) batch.set(fs.doc(fs.collection(db, "hq_chats", uid, "msgs")), { from: "visitor", text: talk, at: fs.serverTimestamp() });
  await batch.commit();
}

function sendDemo(text) {
  msgs.push({ id: String(Date.now()), from: "visitor", text, at: Date.now() });
  chat = { status: "open", place: "", unread_staff: true };
  paint();
  setTimeout(() => { chat.unread_staff = false; paint(); }, 900);
  setTimeout(() => { msgs.push({ id: String(Date.now()), from: "staff", text: "（デモ）本部です。確認しました。すぐに向かいます。", at: Date.now() }); paint(); }, 2400);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const typed = box.value.trim();
  if (!typed || sending || Date.now() < coolUntil) return;
  const text = reason && !typed.startsWith("【") ? `【${reason.label}】${typed}` : typed;
  sending = true; sync();
  try {
    if (demo) sendDemo(text); else await sendReal(text);
    box.value = ""; fit(); stick = true;
    pick(null);
    coolUntil = Date.now() + 3500;
    setTimeout(sync, 3600);
  } catch (err) {
    const t = document.createElement("p");
    t.className = "ai-err";
    t.textContent = err?.code === "permission-denied" ? "少し待ってから、もう一度送ってください。" : "送れませんでした。電波のいい所で、もう一度。急ぎなら、近くのスタッフに声をかけてください。";
    log.append(t); setTimeout(() => t.remove(), 6000);
  } finally {
    sending = false; sync();
  }
});
box.addEventListener("input", () => { fit(); sync(); });
box.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.shiftKey || e.isComposing || matchMedia("(pointer: coarse)").matches) return;
  e.preventDefault();
  form.requestSubmit();
});

if (!demo) startReal().catch(() => {
  const t = document.createElement("p");
  t.className = "ai-err";
  t.textContent = "つながりませんでした。電波のいい所で、開き直してください。";
  intro.append(t);
});
sync();
