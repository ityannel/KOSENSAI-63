import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { doc, setDoc, getDoc, updateDoc, writeBatch, serverTimestamp, deleteDoc, increment } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "enishi-test",
  firestore: { rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"), host: "127.0.0.1", port: 8089 },
});
await env.clearFirestore();
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
await t("stranger cannot read staff list", assertFails(getDoc(doc(stranger, "staff/honbu@example.com"))));
const member = (extra = {}) => ({ name: "実行委員", added_by: "honbu@example.com", added_at: serverTimestamp(), ...extra });
await t("staff can add a member", assertSucceeds(setDoc(doc(staff, "staff/new1@example.com"), member())));
await t("stranger cannot add themselves as staff", assertFails(setDoc(doc(stranger, "staff/evil@example.com"), member({ added_by: "evil@example.com" }))));
await t("anonymous cannot add staff", assertFails(setDoc(doc(anon, "staff/anon@example.com"), member({ added_by: null }))));
await t("added_by must be the adder", assertFails(setDoc(doc(staff, "staff/new2@example.com"), member({ added_by: "someone@else.com" }))));
await t("member id must be lowercase", assertFails(setDoc(doc(staff, "staff/New3@Example.com"), member())));
await t("member id must look like an email", assertFails(setDoc(doc(staff, "staff/not-an-email"), member())));
await t("member doc cannot have extra fields", assertFails(setDoc(doc(staff, "staff/new4@example.com"), member({ admin: true }))));
await t("member name is required", assertFails(setDoc(doc(staff, "staff/new5@example.com"), member({ name: "" }))));
await t("added_at must be server time", assertFails(setDoc(doc(staff, "staff/new6@example.com"), member({ added_at: new Date(2020, 0, 1) }))));
await t("existing member cannot be overwritten", assertFails(setDoc(doc(staff, "staff/new1@example.com"), member({ name: "上書き" }))));
await t("stranger cannot remove a member", assertFails(deleteDoc(doc(stranger, "staff/new1@example.com"))));
await t("staff cannot remove themselves", assertFails(deleteDoc(doc(staff, "staff/honbu@example.com"))));
await t("staff can remove another member", assertSucceeds(deleteDoc(doc(staff, "staff/new1@example.com"))));
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
await t("visitor photo post publishes immediately (review off)", assertSucceeds(visitorPost(anon, "p2", { has_photo: true, photo_status: "approved" })));
await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "users_meta/anon1"), { last_post: new Date(Date.now() - 120000) }));
await t("visitor cannot post as official", assertFails(visitorPost(anon, "p3", { official: true })));
await t("visitor photo post is published (approved)", assertSucceeds((() => {
  const b = writeBatch(anon);
  b.set(doc(anon, "posts/p4"), { kind: "post", place: "", shop: null, stars: null, text: "", has_photo: true, photo_status: "approved", uid: "anon1", created_at: serverTimestamp(), reports: 0, hidden: false, reply_to: null });
  b.set(doc(anon, "post_photos/p4"), { data: "data:image/jpeg;base64,AAAA", uid: "anon1" });
  b.set(doc(anon, "users_meta/anon1"), { last_post: serverTimestamp() });
  return b.commit();
})()));
await t("owner can read own pending photo", assertSucceeds(getDoc(doc(anon, "post_photos/p4"))));
const photoPost = (id, data) => {
  const b = writeBatch(anon);
  b.set(doc(anon, `posts/${id}`), { kind: "post", place: "", shop: null, stars: null, text: "", has_photo: true, photo_status: "approved", uid: "anon1", created_at: serverTimestamp(), reports: 0, hidden: false, reply_to: null });
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

await t("staff clears everyone's cache", assertSucceeds(setDoc(doc(staff, "site_live/current"), { cache_reset_at: serverTimestamp(), updated_at: serverTimestamp(), updated_by: "honbu@example.com" }, { merge: true })));
await t("cache reset time cannot be faked", assertFails(setDoc(doc(staff, "site_live/current"), { cache_reset_at: new Date(2030, 0, 1), updated_at: serverTimestamp(), updated_by: "honbu@example.com" }, { merge: true })));
await t("other writes keep the cache reset time", assertSucceeds(setDoc(doc(staff, "site_live/current"), { notice: "y", updated_at: serverTimestamp(), updated_by: "honbu@example.com" }, { merge: true })));
await t("visitor cannot clear everyone's cache", assertFails(setDoc(doc(anon, "site_live/current"), { cache_reset_at: serverTimestamp(), updated_at: serverTimestamp(), updated_by: null }, { merge: true })));

await t("anyone starts a visit counter at 1", assertSucceeds(setDoc(doc(nobody, "visit_counts/2026-10-24-3"), { n: 1 })));
await t("counter goes up by exactly 1", assertSucceeds(setDoc(doc(nobody, "visit_counts/2026-10-24-3"), { n: increment(1) }, { merge: true })));
await t("counter cannot jump", assertFails(setDoc(doc(nobody, "visit_counts/2026-10-24-3"), { n: 50 }, { merge: true })));
await t("counter cannot start above 1", assertFails(setDoc(doc(nobody, "visit_counts/2026-10-24-4"), { n: 9 })));
await t("counter id must be a date and shard", assertFails(setDoc(doc(nobody, "visit_counts/evil"), { n: 1 })));
await t("secret counter starts at 1", assertSucceeds(setDoc(doc(nobody, "secret_counts/all-2"), { n: 1 })));
await t("secret counter goes up by exactly 1", assertSucceeds(setDoc(doc(nobody, "secret_counts/all-2"), { n: increment(1) }, { merge: true })));
await t("secret counter cannot jump", assertFails(setDoc(doc(nobody, "secret_counts/all-2"), { n: 50 }, { merge: true })));
await t("secret counter id must be a known spot and shard", assertFails(setDoc(doc(nobody, "secret_counts/evil-1"), { n: 1 })));
await t("secret counter cannot be read by the public", assertFails(getDoc(doc(nobody, "secret_counts/all-2"))));
await t("counter doc has only n", assertFails(setDoc(doc(nobody, "visit_counts/2026-10-24-5"), { n: 1, x: 1 })));
await t("visitors cannot read counters", assertFails(getDoc(doc(anon, "visit_counts/2026-10-24-3"))));
await t("staff reads counters", assertSucceeds(getDoc(doc(staff, "visit_counts/2026-10-24-3"))));
await t("anyone starts a device counter at 1", assertSucceeds(setDoc(doc(nobody, "visit_devices/2026-10-24-phone-3"), { n: 1 })));
await t("device counter goes up by exactly 1", assertSucceeds(setDoc(doc(nobody, "visit_devices/2026-10-24-phone-3"), { n: increment(1) }, { merge: true })));
await t("device counter cannot jump", assertFails(setDoc(doc(nobody, "visit_devices/2026-10-24-phone-3"), { n: 50 }, { merge: true })));
await t("device counter id must be date-device-shard", assertFails(setDoc(doc(nobody, "visit_devices/2026-10-24-robot-3"), { n: 1 })));
await t("visitors cannot read device counters", assertFails(getDoc(doc(anon, "visit_devices/2026-10-24-phone-3"))));
await t("staff reads device counters", assertSucceeds(getDoc(doc(staff, "visit_devices/2026-10-24-phone-3"))));
await t("anyone starts an hour counter at 1", assertSucceeds(setDoc(doc(nobody, "visit_hours/2026-10-24-13-1"), { n: 1 })));
await t("hour counter goes up by exactly 1", assertSucceeds(setDoc(doc(nobody, "visit_hours/2026-10-24-13-1"), { n: increment(1) }, { merge: true })));
await t("hour counter cannot jump", assertFails(setDoc(doc(nobody, "visit_hours/2026-10-24-13-1"), { n: 50 }, { merge: true })));
await t("anyone starts a page-view counter at 1", assertSucceeds(setDoc(doc(nobody, "view_counts/2026-10-24-13-7"), { n: 1 })));
await t("page-view counter goes up by exactly 1", assertSucceeds(setDoc(doc(nobody, "view_counts/2026-10-24-13-7"), { n: increment(1) }, { merge: true })));
await t("page-view counter cannot jump", assertFails(setDoc(doc(nobody, "view_counts/2026-10-24-13-7"), { n: 99 }, { merge: true })));
await t("page-view counter cannot start above 1", assertFails(setDoc(doc(nobody, "view_counts/2026-10-24-14-0"), { n: 5 })));
await t("page-view counter id must be date-hour-shard", assertFails(setDoc(doc(nobody, "view_counts/2026-10-24-25-0"), { n: 1 })));
await t("page-view counter has only n", assertFails(setDoc(doc(nobody, "view_counts/2026-10-24-15-0"), { n: 1, x: 1 })));
await t("visitors cannot read page-view counters", assertFails(getDoc(doc(anon, "view_counts/2026-10-24-13-7"))));
await t("staff reads page-view counters", assertSucceeds(getDoc(doc(staff, "view_counts/2026-10-24-13-7"))));
await t("hour counter id must be date-hour-shard", assertFails(setDoc(doc(nobody, "visit_hours/2026-10-24-25-1"), { n: 1 })));
await t("hour counter shard is 0-2", assertFails(setDoc(doc(nobody, "visit_hours/2026-10-24-13-7"), { n: 1 })));
await t("visitors cannot read hour counters", assertFails(getDoc(doc(anon, "visit_hours/2026-10-24-13-1"))));
await t("staff reads hour counters", assertSucceeds(getDoc(doc(staff, "visit_hours/2026-10-24-13-1"))));

await t("staff replies officially to a post", assertSucceeds(setDoc(doc(staff, "posts/reply1"), { kind: "post", place: "", shop: null, stars: null, text: "ありがとう！", has_photo: false, photo_status: "none", uid: "staff1", created_at: serverTimestamp(), reports: 0, hidden: false, reply_to: "other", official: true })));
await t("staff likes a post (one like per login)", assertSucceeds((async () => { const b = writeBatch(staff); b.set(doc(staff, "post_likes/other_staff1"), { post: "other", uid: "staff1", at: serverTimestamp() }); b.update(doc(staff, "posts/other"), { likes: increment(1) }); return b.commit(); })()));
await t("staff cannot like the same post twice", assertFails((async () => { const b = writeBatch(staff); b.set(doc(staff, "post_likes/other_staff1"), { post: "other", uid: "staff1", at: serverTimestamp() }); b.update(doc(staff, "posts/other"), { likes: increment(1) }); return b.commit(); })()));
await t("staff unlikes", assertSucceeds((async () => { const b = writeBatch(staff); b.delete(doc(staff, "post_likes/other_staff1")); b.update(doc(staff, "posts/other"), { likes: increment(-1) }); return b.commit(); })()));

const photoPostStatus = (id, status) => {
  const b = writeBatch(anon);
  b.set(doc(anon, `posts/${id}`), { kind: "post", place: "", shop: null, stars: null, text: "", has_photo: true, photo_status: status, uid: "anon1", created_at: serverTimestamp(), reports: 0, hidden: false, reply_to: null });
  b.set(doc(anon, `post_photos/${id}`), { data: "data:image/jpeg;base64,AAAA", uid: "anon1" });
  b.set(doc(anon, "users_meta/anon1"), { last_post: serverTimestamp() });
  return b.commit();
};

const resetCool = () => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "users_meta/anon1"), { last_post: new Date(Date.now() - 120000) }));
const setReview = (on) => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "site_live/current"), { photo_review: on, updated_at: new Date(), updated_by: "x" }, { merge: true }));
await setReview(true); await resetCool();
await t("review on: approved photo post is rejected", assertFails(photoPostStatus("r1", "approved")));
await t("review on: pending photo post is accepted", assertSucceeds(photoPostStatus("r2", "pending")));
await setReview(false); await resetCool();
await t("review off: pending photo post is rejected", assertFails(photoPostStatus("r3", "pending")));
await t("review off: approved photo post is accepted", assertSucceeds(photoPostStatus("r4", "approved")));
await t("staff can switch photo review", assertSucceeds(setDoc(doc(staff, "site_live/current"), { photo_review: true, updated_at: serverTimestamp(), updated_by: "honbu@example.com" }, { merge: true })));
await t("visitors cannot switch photo review", assertFails(setDoc(doc(anon, "site_live/current"), { photo_review: false, updated_at: serverTimestamp(), updated_by: null }, { merge: true })));
await setReview(false);

await t("staff can delete crowd (unset)", assertSucceeds(deleteDoc(doc(staff, "crowd/gym2"))));
await t("anonymous cannot delete crowd", assertFails(deleteDoc(doc(anon, "crowd/entrance"))));
const sched = { changes: { a202610241215: { start: "2026-10-24T12:25:00+09:00", end: "2026-10-24T12:45:00+09:00" } }, updated_at: serverTimestamp(), updated_by: "honbu@example.com" };
await t("staff can write schedule changes", assertSucceeds(setDoc(doc(staff, "site_schedule/current"), sched)));
await t("anonymous can read schedule changes", assertSucceeds(getDoc(doc(anon, "site_schedule/current"))));
await t("anonymous cannot write schedule changes", assertFails(setDoc(doc(anon, "site_schedule/current"), { ...sched, updated_by: null })));
await t("schedule rejects extra fields", assertFails(setDoc(doc(staff, "site_schedule/current"), { ...sched, secret: 1 })));
await t("schedule rejects non-map changes", assertFails(setDoc(doc(staff, "site_schedule/current"), { ...sched, changes: "x" })));


await t("ATTACK: post pretending to be someone else's uid", assertFails(visitorPost(anon, "atk1", { uid: "someone_else" })));
await t("ATTACK: unauthenticated cannot post at all", assertFails(visitorPost(nobody, "atk2")));

await resetCool();
await t("post after cooldown elapsed (baseline)", assertSucceeds(visitorPost(anon, "atk3a")));
await t("ATTACK: spam-posting right after, within 60s cooldown", assertFails(visitorPost(anon, "atk3b")));

await t("ATTACK: cannot update someone else's rate-limit record", assertFails(setDoc(doc(anon, "users_meta/someone_else"), { last_post: serverTimestamp() })));

await resetCool();
await t("ATTACK: post containing a banned word is rejected", assertFails(visitorPost(anon, "atk4", { text: "死ね" })));

await t("ATTACK: counter increment forged as huge jump", assertFails(setDoc(doc(nobody, "visit_counts/2026-10-24-3"), { n: increment(50) }, { merge: true })));
await t("ATTACK: counter forged negative to deflate stats", assertFails(setDoc(doc(nobody, "visit_counts/2026-10-24-3"), { n: increment(-1) }, { merge: true })));
await t("ATTACK: counter id path traversal", assertFails(setDoc(doc(nobody, "visit_counts/../staff/honbu@example.com"), { n: 1 })));

await t("ATTACK: write stamps into someone else's rally_logs", assertFails(setDoc(doc(anon, "rally_logs/someone_else"), { stamps: { takoyaki: 1 }, updated_at: serverTimestamp() })));
await t("ATTACK: forge updated_at (not server time)", assertFails(setDoc(doc(anon, "rally_logs/anon1"), { stamps: {}, updated_at: new Date(2020, 0, 1) })));
const bigStamps = Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`shop${i}`, Date.now()]));
await t("ATTACK: oversized stamps map rejected (over the 100 cap)", assertFails(setDoc(doc(anon, "rally_logs/anon1"), { stamps: bigStamps, updated_at: serverTimestamp() })));
await t("VULN: stamps content is not verified against real QR scans — fabricated stamp accepted", assertSucceeds(setDoc(doc(anon, "rally_logs/anon1"), { stamps: { takoyaki: Date.now(), never_scanned_shop: Date.now() }, updated_at: serverTimestamp() })));
await t("VULN: claimed_at can be set without collecting any stamps", assertSucceeds(setDoc(doc(anon, "rally_logs/anon1"), { stamps: {}, claimed_at: Date.now(), updated_at: serverTimestamp() })));
await t("ATTACK: read someone else's stamp history", assertFails(getDoc(doc(stranger, "rally_logs/anon1"))));

await t("ATTACK: delete someone else's like to deflate count", assertFails(deleteDoc(doc(stranger, "post_likes/other_staff1"))));
await t("ATTACK: like via update without creating post_likes record", assertFails(updateDoc(doc(anon, "posts/other"), { likes: increment(1) })));

await t("ATTACK: shop member edits a different shop without its code", assertFails(updateDoc(doc(anon, "shops/other_shop"), { status: "soldout", updated_at: serverTimestamp() })));
await t("ATTACK: visitor deletes a shop", assertFails(deleteDoc(doc(anon, "shops/takoyaki"))));
await t("ATTACK: self-registered stranger escalates to staff-only write", assertFails(setDoc(doc(stranger, "crowd/gym2"), { level: 0, updated_at: serverTimestamp() })));

await t("ATTACK: bump reports without creating a post_reports record", assertFails(updateDoc(doc(anon, "posts/other"), { reports: increment(1) })));
await t("ATTACK: report id must match reporter's own uid", assertFails(setDoc(doc(anon, "post_reports/other_someone_else"), { post: "other", uid: "anon1", at: serverTimestamp() })));

const noticeSt = (db, style, extra = {}) => setDoc(doc(db, "site_live/current"), { notice: "テスト", notice_level: "info", notice_style: style, updated_at: serverTimestamp(), updated_by: "honbu@example.com", ...extra }, { merge: true });
await t("staff saves a full notice style", assertSucceeds(noticeSt(staff, { font: "round", size: "l", bg: "#2F6FB8", fg: "#FFFFFF", icon: "mega", link_label: "くわしく", link_url: "https://example.com/a", from: 1790000000000, until: 1790003600000, where: ["top", "signage"] })));
await t("unknown font rejected", assertFails(noticeSt(staff, { font: "comic" })));
await t("bad color rejected", assertFails(noticeSt(staff, { bg: "red" })));
await t("javascript: link rejected", assertFails(noticeSt(staff, { link_url: "javascript:alert(1)" })));
await t("http (not https) link rejected", assertFails(noticeSt(staff, { link_url: "http://example.com/" })));
await t("unknown style key rejected", assertFails(noticeSt(staff, { font: "round", extra: 1 })));
await t("unknown where rejected", assertFails(noticeSt(staff, { where: ["top", "elsewhere"] })));
await t("visitors cannot set a notice style", assertFails(setDoc(doc(anon, "site_live/current"), { notice_style: { font: "round" }, updated_at: serverTimestamp(), updated_by: null }, { merge: true })));

const cfg = (db, extra = {}) => setDoc(doc(db, "ai_config/current"), { enabled: true, extra: "落とし物は本部へ", faq: [{ q: "q", a: "a" }], limit_device_10m: 8, limit_device_day: 30, global_day: 1300, updated_at: serverTimestamp(), updated_by: "honbu@example.com", ...extra });
await t("anyone can read ai_config", assertSucceeds(getDoc(doc(nobody, "ai_config/current"))));
await t("staff can write ai_config", assertSucceeds(cfg(staff)));
await t("visitors cannot write ai_config", assertFails(cfg(anon)));
await t("ai_config limit out of range rejected", assertFails(cfg(staff, { limit_device_10m: 999 })));
await t("ai_config extra too long rejected", assertFails(cfg(staff, { extra: "あ".repeat(1501) })));
await t("ai_config unknown key rejected", assertFails(cfg(staff, { admin: true })));
const logOf = (db, extra = {}) => setDoc(doc(db, "ai_logs/l1"), { q: "トイレは？", a: "H棟だぜ", sid: "abcd1234", at: serverTimestamp(), ...extra });
await t("visitor can create an ai_log", assertSucceeds(logOf(anon)));
await t("ai_log with a fake time rejected", assertFails(setDoc(doc(anon, "ai_logs/l2"), { q: "x", a: "y", sid: "abcd1234", at: new Date(2020, 0, 1) })));
await t("ai_log with extra field rejected", assertFails(logOf(anon, { uid: "x" })));
await t("visitor cannot read ai_logs", assertFails(getDoc(doc(anon, "ai_logs/l1"))));
await t("staff can read and delete ai_logs", assertSucceeds(getDoc(doc(staff, "ai_logs/l1")).then(() => deleteDoc(doc(staff, "ai_logs/l1")))));
const newChat = (db, uid, extra = {}) => { const b = writeBatch(db); b.set(doc(db, `hq_chats/${uid}`), { uid, place: "体育館", name: "", status: "open", urgent: true, unread_staff: true, unread_visitor: false, last_text: "迷子です", last_from: "visitor", last_at: serverTimestamp(), created_at: serverTimestamp(), ...extra }); b.set(doc(db, `hq_chats/${uid}/msgs/m1`), { from: "visitor", text: "迷子です", at: serverTimestamp() }); return b.commit(); };
await t("visitor can start a chat with HQ", assertSucceeds(newChat(anon, "anon1")));
await t("visitor cannot start a chat under another uid", assertFails(newChat(anon, "someoneelse")));
await t("visitor can read own chat", assertSucceeds(getDoc(doc(anon, "hq_chats/anon1"))));
await t("visitor cannot read another chat", assertFails(getDoc(doc(anon, "hq_chats/other-chat"))));
await t("staff can read any chat", assertSucceeds(getDoc(doc(staff, "hq_chats/anon1"))));
await t("visitor message without chat update is rejected", assertFails(setDoc(doc(anon, "hq_chats/anon1/msgs/m2"), { from: "visitor", text: "もう1通", at: serverTimestamp() })));
await t("visitor cannot post as staff", assertFails(setDoc(doc(anon, "hq_chats/anon1/msgs/m3"), { from: "staff", text: "なりすまし", at: serverTimestamp(), by: "x" })));
await t("visitor can mark the reply as read", assertSucceeds(updateDoc(doc(anon, "hq_chats/anon1"), { unread_visitor: false })));
await t("visitor cannot edit status of another chat", assertFails(updateDoc(doc(anon, "hq_chats/other-chat"), { unread_visitor: false })));
await t("staff can reply (message + chat update)", assertSucceeds((() => { const b = writeBatch(staff); b.set(doc(staff, "hq_chats/anon1/msgs/r1"), { from: "staff", text: "向かいます", at: serverTimestamp(), by: "honbu@example.com" }); b.update(doc(staff, "hq_chats/anon1"), { last_text: "向かいます", last_from: "staff", last_at: serverTimestamp(), unread_staff: false, unread_visitor: true }); return b.commit(); })()));
await t("staff cannot forge the sender email", assertFails(setDoc(doc(staff, "hq_chats/anon1/msgs/r2"), { from: "staff", text: "x", at: serverTimestamp(), by: "someone@else" })));
await t("staff can close a chat", assertSucceeds(updateDoc(doc(staff, "hq_chats/anon1"), { status: "closed", urgent: false })));
await t("visitor can save a push endpoint", assertSucceeds(updateDoc(doc(anon, "hq_chats/anon1"), { push: "https://fcm.googleapis.com/fcm/send/abc" })));
await t("push endpoint too long rejected", assertFails(updateDoc(doc(anon, "hq_chats/anon1"), { push: "https://fcm.googleapis.com/" + "a".repeat(701) })));
await t("another visitor cannot set a push endpoint", assertFails(updateDoc(doc(anon, "hq_chats/other-chat"), { push: "https://fcm.googleapis.com/x" })));
await t("staff cannot change the push endpoint", assertFails(updateDoc(doc(staff, "hq_chats/anon1"), { push: "https://fcm.googleapis.com/y" })));
await t("visitor cannot delete a chat", assertFails(deleteDoc(doc(anon, "hq_chats/anon1"))));
await t("staff can delete a chat", assertSucceeds(deleteDoc(doc(staff, "hq_chats/anon1"))));

const sgDev = (db, id = "sg-abc123", extra = {}) => setDoc(doc(db, `signage_devices/${id}`), { name: "玄関ホール", spot: "", place: { x: 400, y: 440, floor: "1F" }, heading: 270, orient: "auto", facing: 0, slides: [], only: "", only_until: 0, banner: "", banner_until: 0, note: "", updated_at: serverTimestamp(), updated_by: "honbu@example.com", ...extra });
await t("anyone can read signage_devices", assertSucceeds(getDoc(doc(nobody, "signage_devices/sg-abc123"))));
await t("staff can register a signage device", assertSucceeds(sgDev(staff)));
await t("visitors cannot register a signage device", assertFails(sgDev(anon, "sg-zzz999")));
await t("signage device with a bad orientation rejected", assertFails(sgDev(staff, "sg-bad001", { orient: "diagonal" })));
await t("signage device with an unknown key rejected", assertFails(sgDev(staff, "sg-bad002", { admin: true })));
await t("signage device with a long banner rejected", assertFails(sgDev(staff, "sg-bad003", { banner: "あ".repeat(121) })));
const sgSeen = (db, id = "sg-abc123", extra = {}) => setDoc(doc(db, `signage_seen/${id}`), { seen: serverTimestamp(), w: 1920, h: 1080, o: "landscape", path: "/signage.html", ...extra });
await t("a signage screen can report that it is alive", assertSucceeds(sgSeen(anon)));
await t("a heartbeat with a fake time is rejected", assertFails(sgSeen(anon, "sg-abc123", { seen: new Date(2020, 0, 1) })));
await t("a heartbeat with an extra field is rejected", assertFails(sgSeen(anon, "sg-abc123", { admin: true })));
await t("visitors cannot read signage_seen", assertFails(getDoc(doc(anon, "signage_seen/sg-abc123"))));
await t("staff can read signage_seen", assertSucceeds(getDoc(doc(staff, "signage_seen/sg-abc123"))));
await t("staff can delete a signage device", assertSucceeds(deleteDoc(doc(staff, "signage_devices/sg-abc123"))));

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
