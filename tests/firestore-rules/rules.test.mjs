// firestore.rules のテスト。Java が要る。
//   cd tests/firestore-rules && npm install && npm test
// 本部（staff の名簿）・来場者（匿名）・模擬店の人・ログインなし、それぞれができること／できないことを確かめる
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { doc, setDoc, getDoc, updateDoc, writeBatch, serverTimestamp, deleteDoc } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "enishi-test",
  firestore: { rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"), host: "127.0.0.1", port: 8089 },
});
await env.clearFirestore(); // 前に動かしたときのデータを消してから
let pass = 0, fail = 0;
async function t(name, p) {
  try { await p; pass++; console.log("PASS", name); } catch (e) { fail++; console.log("FAIL", name, "-", e.message.split("\n")[0]); }
}
const staffTok = { email: "honbu@example.com", firebase: { sign_in_provider: "password" } };
const strangerTok = { email: "evil@example.com", firebase: { sign_in_provider: "password" } };
const anonTok = { firebase: { sign_in_provider: "anonymous" } };
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, "staff/honbu@example.com"), { name: "本部" });
  await setDoc(doc(db, "shops/takoyaki"), { name: "たこ焼き", status: "normal" });
  await setDoc(doc(db, "shop_codes/CODE123456789"), { shop: "takoyaki" });
  await setDoc(doc(db, "posts/other"), { kind: "post", place: "", shop: null, stars: null, text: "x", has_photo: true, photo_status: "pending", uid: "anon2", reports: 0, hidden: false, reply_to: null });
  await setDoc(doc(db, "post_photos/other"), { data: "data:image/jpeg;base64,AAAA", uid: "anon2" });
});
const staff = env.authenticatedContext("staff1", staffTok).firestore();
const stranger = env.authenticatedContext("evil1", strangerTok).firestore();
const anon = env.authenticatedContext("anon1", anonTok).firestore();
const nobody = env.unauthenticatedContext().firestore();
const live = (db, email) => setDoc(doc(db, "site_live/current"), { notice: "テスト", notice_level: "urgent", stream_url: "https://youtu.be/abc", stream_active: true, updated_at: serverTimestamp(), updated_by: email });

await t("self-registered password user is NOT staff", assertFails(live(stranger, "evil@example.com")));
await t("anonymous cannot write site_live", assertFails(live(anon, null)));
await t("listed staff can write site_live", assertSucceeds(live(staff, "honbu@example.com")));
await t("staff cannot forge updated_by", assertFails(live(staff, "someone@else")));
await t("bad notice_level rejected", assertFails(setDoc(doc(staff, "site_live/current"), { notice_level: "panic", updated_at: serverTimestamp(), updated_by: "honbu@example.com" })));
await t("staff fires fireworks now", assertSucceeds(setDoc(doc(staff, "site_live/current"), { fireworks_at: serverTimestamp(), sky_override: "night", weather_override: "snow", wind_override: 12, ...{ updated_at: serverTimestamp(), updated_by: "honbu@example.com" } }, { merge: true })));
await t("other writes keep old fireworks_at", assertSucceeds(setDoc(doc(staff, "site_live/current"), { notice: "x", updated_at: serverTimestamp(), updated_by: "honbu@example.com" }, { merge: true })));
await t("fireworks time cannot be faked", assertFails(setDoc(doc(staff, "site_live/current"), { fireworks_at: new Date(2030, 0, 1), updated_at: serverTimestamp(), updated_by: "honbu@example.com" }, { merge: true })));
await t("unknown weather rejected", assertFails(setDoc(doc(staff, "site_live/current"), { weather_override: "tornado", updated_at: serverTimestamp(), updated_by: "honbu@example.com" }, { merge: true })));
await t("staff can mark prizes out", assertSucceeds(setDoc(doc(staff, "site_live/current"), { prize_out: true, updated_at: serverTimestamp(), updated_by: "honbu@example.com" }, { merge: true })));
await t("prize_out must be a boolean", assertFails(setDoc(doc(staff, "site_live/current"), { prize_out: "yes", updated_at: serverTimestamp(), updated_by: "honbu@example.com" }, { merge: true })));
await t("visitors cannot mark prizes out", assertFails(setDoc(doc(anon, "site_live/current"), { prize_out: true, updated_at: serverTimestamp(), updated_by: null }, { merge: true })));
await t("anyone can read site_live", assertSucceeds(getDoc(doc(nobody, "site_live/current"))));
await t("staff writes site_text", assertSucceeds(setDoc(doc(staff, "site_text/current"), { texts: { about: ["a"] }, fonts: { text: "zenmaru" }, updated_at: serverTimestamp(), updated_by: "honbu@example.com" })));
await t("stranger cannot write site_text", assertFails(setDoc(doc(stranger, "site_text/current"), { texts: {}, fonts: {}, updated_at: serverTimestamp(), updated_by: "evil@example.com" })));
await t("stranger cannot read staff list", assertFails(getDoc(doc(stranger, "staff/honbu@example.com"))));
await t("staff can write crowd", assertSucceeds(setDoc(doc(staff, "crowd/gym2"), { level: 2, updated_at: serverTimestamp() })));
await t("anonymous cannot write crowd", assertFails(setDoc(doc(anon, "crowd/gym2"), { level: 2, updated_at: serverTimestamp() })));

function visitorPost(db, id, extra = {}) {
  const b = writeBatch(db);
  b.set(doc(db, "posts", id), { kind: "post", place: "", shop: null, stars: null, text: "たのしい", has_photo: false, photo_status: "none", uid: "anon1", created_at: serverTimestamp(), reports: 0, hidden: false, reply_to: null, ...extra });
  b.set(doc(db, "users_meta/anon1"), { last_post: serverTimestamp() });
  return b.commit();
}
await t("visitor text post", assertSucceeds(visitorPost(anon, "p1")));
await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "users_meta/anon1"), { last_post: new Date(Date.now() - 120000) }));
await t("visitor cannot self-approve photo", assertFails(visitorPost(anon, "p2", { has_photo: true, photo_status: "approved" })));
await t("visitor cannot post as official", assertFails(visitorPost(anon, "p3", { official: true })));
await t("visitor photo post starts pending", assertSucceeds((() => {
  const b = writeBatch(anon);
  b.set(doc(anon, "posts/p4"), { kind: "post", place: "", shop: null, stars: null, text: "", has_photo: true, photo_status: "pending", uid: "anon1", created_at: serverTimestamp(), reports: 0, hidden: false, reply_to: null });
  b.set(doc(anon, "post_photos/p4"), { data: "data:image/jpeg;base64,AAAA", uid: "anon1" });
  b.set(doc(anon, "users_meta/anon1"), { last_post: serverTimestamp() });
  return b.commit();
})()));
await t("owner can read own pending photo", assertSucceeds(getDoc(doc(anon, "post_photos/p4"))));
const photoPost = (id, data) => {
  const b = writeBatch(anon);
  b.set(doc(anon, `posts/${id}`), { kind: "post", place: "", shop: null, stars: null, text: "", has_photo: true, photo_status: "pending", uid: "anon1", created_at: serverTimestamp(), reports: 0, hidden: false, reply_to: null });
  b.set(doc(anon, `post_photos/${id}`), { data, uid: "anon1" });
  b.set(doc(anon, "users_meta/anon1"), { last_post: serverTimestamp() });
  return b.commit();
};
await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "users_meta/anon1"), { last_post: new Date(Date.now() - 120000) }));
await t("png photo rejected", assertFails(photoPost("p5", "data:image/png;base64,AAAA")));
await t("webp photo accepted", assertSucceeds(photoPost("p6", "data:image/webp;base64,AAAA")));
await t("others cannot read pending photo", assertFails(getDoc(doc(nobody, "post_photos/other"))));
await t("staff can read pending photo", assertSucceeds(getDoc(doc(staff, "post_photos/other"))));
await t("visitor cannot approve photo", assertFails(updateDoc(doc(anon, "posts/other"), { photo_status: "approved" })));
await t("staff approves photo", assertSucceeds(updateDoc(doc(staff, "posts/other"), { photo_status: "approved" })));
await t("everyone reads approved photo", assertSucceeds(getDoc(doc(nobody, "post_photos/other"))));
await t("staff official post", assertSucceeds(setDoc(doc(staff, "posts/official1"), { kind: "post", place: "", shop: null, stars: null, text: "本部からのお知らせ", has_photo: false, photo_status: "none", uid: "staff1", created_at: serverTimestamp(), reports: 0, hidden: false, reply_to: null, official: true })));
await t("stranger cannot delete post", assertFails(deleteDoc(doc(stranger, "posts/p1"))));

const setStatus = (db) => updateDoc(doc(db, "shops/takoyaki"), { status: "soldout", updated_at: serverTimestamp() });
await t("anonymous cannot change shop without code", assertFails(setStatus(anon)));
await t("wrong shop code rejected", assertFails(setDoc(doc(anon, "shop_members/anon1"), { shop: "takoyaki", code: "WRONG", at: serverTimestamp() })));
await t("shop code joins shop", assertSucceeds(setDoc(doc(anon, "shop_members/anon1"), { shop: "takoyaki", code: "CODE123456789", at: serverTimestamp() })));
await t("shop member changes own status", assertSucceeds(setStatus(anon)));
await t("shop member can set closed", assertSucceeds(updateDoc(doc(anon, "shops/takoyaki"), { status: "closed", updated_at: serverTimestamp() })));
await t("shop member can post a message", assertSucceeds(updateDoc(doc(anon, "shops/takoyaki"), { message: "焼きたてあります！", message_at: serverTimestamp() })));
await t("message over 40 chars rejected", assertFails(updateDoc(doc(anon, "shops/takoyaki"), { message: "あ".repeat(41), message_at: serverTimestamp() })));
await t("message with other fields rejected", assertFails(updateDoc(doc(anon, "shops/takoyaki"), { message: "x", message_at: serverTimestamp(), name: "y" })));
await t("unknown status rejected", assertFails(updateDoc(doc(anon, "shops/takoyaki"), { status: "party", updated_at: serverTimestamp() })));
await t("staff can post a message for a shop", assertSucceeds(updateDoc(doc(staff, "shops/takoyaki"), { message: "本部より", message_at: serverTimestamp() })));
await t("shop member cannot rename shop", assertFails(updateDoc(doc(anon, "shops/takoyaki"), { name: "x", updated_at: serverTimestamp() })));
await t("visitors cannot list shop codes", assertFails(getDoc(doc(anon, "shop_codes/CODE123456789"))));
await t("staff can manage shop codes", assertSucceeds(setDoc(doc(staff, "shop_codes/NEWCODE"), { shop: "takoyaki" })));
await t("staff cannot re-add pass field", assertFails(updateDoc(doc(staff, "shops/takoyaki"), { pass: "1234" })));

await t("staff publishes rally shops", assertSucceeds(setDoc(doc(staff, "rally/current"), { shops: [{ id: "takoyaki", name: "たこ焼き", codes: { "2026-10-24": "abc" } }], staffPin: { salt: "00", iterations: 300000, hash: "ff" }, updated_at: serverTimestamp(), updated_by: "honbu@example.com" })));
await t("anyone reads rally shops", assertSucceeds(getDoc(doc(nobody, "rally/current"))));
await t("visitor cannot change rally", assertFails(setDoc(doc(anon, "rally/current"), { shops: [], updated_at: serverTimestamp(), updated_by: null })));
await t("staff keeps QR keys", assertSucceeds(setDoc(doc(staff, "rally_keys/takoyaki"), { keys: { "2026-10-24": "secret" } })));
await t("QR keys are not public", assertFails(getDoc(doc(nobody, "rally_keys/takoyaki"))));
await t("visitors cannot read QR keys", assertFails(getDoc(doc(anon, "rally_keys/takoyaki"))));
await t("anyone cannot hijack quiz", assertFails(setDoc(doc(nobody, "quiz_control/current"), { is_active: true })));
await t("quiz answers not public", assertFails(getDoc(doc(nobody, "quiz_answers/a"))));
await t("presence ok in current window", assertSucceeds(setDoc(doc(nobody, `presence/${Math.floor(Date.now() / 300000)}`), { n: 1 })));
await t("presence rejects far window", assertFails(setDoc(doc(nobody, "presence/1"), { n: 1 })));

// 模擬店総選挙：スタンプを押した模擬店にだけ、自分の1票。全員分を読めるのは本部だけ
await t("visitor logs stamps", assertSucceeds(setDoc(doc(anon, "rally_logs/anon1"), { stamps: { takoyaki: 1 }, claimed_at: null, updated_at: serverTimestamp() })));
await t("vote for a stamped shop", assertSucceeds(setDoc(doc(anon, "votes/anon1"), { shop: "takoyaki", updated_at: serverTimestamp() })));
await t("changing the vote is allowed (still one doc)", assertSucceeds(setDoc(doc(anon, "rally_logs/anon1"), { stamps: { takoyaki: 1, udon: 2 }, claimed_at: null, updated_at: serverTimestamp() }).then(() => setDoc(doc(anon, "votes/anon1"), { shop: "udon", updated_at: serverTimestamp() }))));
await t("cannot vote for a shop without a stamp", assertFails(setDoc(doc(anon, "votes/anon1"), { shop: "curry", updated_at: serverTimestamp() })));
await t("cannot vote under someone else's id", assertFails(setDoc(doc(anon, "votes/anon2"), { shop: "takoyaki", updated_at: serverTimestamp() })));
await t("cannot vote without any stamp log", assertFails(setDoc(doc(env.authenticatedContext("anon9", anonTok).firestore(), "votes/anon9"), { shop: "takoyaki", updated_at: serverTimestamp() })));
await t("vote cannot carry extra fields", assertFails(setDoc(doc(anon, "votes/anon1"), { shop: "udon", weight: 100, updated_at: serverTimestamp() })));
await t("vote time cannot be faked", assertFails(setDoc(doc(anon, "votes/anon1"), { shop: "udon", updated_at: new Date(2030, 0, 1) })));
await t("logged-out cannot vote", assertFails(setDoc(doc(nobody, "votes/anon1"), { shop: "udon", updated_at: serverTimestamp() })));
await t("visitor reads own vote", assertSucceeds(getDoc(doc(anon, "votes/anon1"))));
await t("visitor cannot read others' votes", assertFails(getDoc(doc(anon, "votes/anon2"))));
await t("visitor cannot delete own vote", assertFails(deleteDoc(doc(anon, "votes/anon1"))));
await t("staff reads all votes", assertSucceeds(getDoc(doc(staff, "votes/anon1"))));
await t("staff resets votes", assertSucceeds(deleteDoc(doc(staff, "votes/anon1"))));

// 本部の公式の投稿に画像：本部だけが、確認なしで公開できる
const jpg = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
const officialPost = (db, extra = {}) => ({ kind: "post", place: "", shop: null, stars: null, text: "写真つき", has_photo: true, photo_status: "approved", uid: db === staff ? "staff1" : "anon1", created_at: serverTimestamp(), reports: 0, hidden: false, reply_to: null, official: true, ...extra });
async function officialWithPhoto(db, id, postExtra, photo) {
  const b = writeBatch(db);
  b.set(doc(db, `posts/${id}`), officialPost(db, postExtra));
  b.set(doc(db, `post_photos/${id}`), { data: photo, uid: db === staff ? "staff1" : "anon1" });
  return b.commit();
}
await t("staff posts officially with a photo", assertSucceeds(officialWithPhoto(staff, "op1", {}, jpg)));
await t("staff photo-only official post (no text)", assertSucceeds(officialWithPhoto(staff, "op2", { text: "" }, jpg)));
await t("official post cannot be photo_status pending", assertFails(officialWithPhoto(staff, "op3", { photo_status: "pending" }, jpg)));
await t("official photo must be jpeg/webp data", assertFails(officialWithPhoto(staff, "op4", {}, "data:image/png;base64,AAAA")));
await t("visitor cannot post as official with a photo", assertFails(officialWithPhoto(anon, "op5", {}, jpg)));
await t("empty official post without photo rejected", assertFails(setDoc(doc(staff, "posts/op6"), officialPost(staff, { text: "", has_photo: false, photo_status: "none" }))));
await t("everyone reads the official photo", assertSucceeds(getDoc(doc(nobody, "post_photos/op1"))));

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
