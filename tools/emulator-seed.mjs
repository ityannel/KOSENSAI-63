const P = "enishi-7f43f";
const FS = `http://127.0.0.1:8089/v1/projects/${P}/databases/(default)/documents`;
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator";
const EMAIL = "honbu@example.com", PASSWORD = "testpass123";
const v = (x) => x === null ? { nullValue: null } : typeof x === "boolean" ? { booleanValue: x } : typeof x === "number" ? { integerValue: String(x) } : typeof x === "string" ? { stringValue: x } : x instanceof Date ? { timestampValue: x.toISOString() } : Array.isArray(x) ? { arrayValue: { values: x.map(v) } } : { mapValue: { fields: Object.fromEntries(Object.entries(x).map(([k, y]) => [k, v(y)])) } };
const put = async (path, data) => {
  const r = await fetch(`${FS}/${path}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer owner" }, body: JSON.stringify({ fields: v(data).mapValue.fields }) });
  if (!r.ok) throw new Error(`${path}: ${await r.text()}`);
};
try {
  await fetch(AUTH, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }) });
  await put(`staff/${EMAIL}`, { name: "本部（テスト）" });
  await put("site_live/current", { notice: "これはエミュレーターのテストです", notice_level: "info" });
  const now = new Date();
  await put("posts/demo-1", { kind: "post", place: "", text: "たのしい！（テストの投稿）", has_photo: false, photo_status: "none", uid: "demo1", created_at: now, reports: 0, hidden: false, reply_to: null });
  await put("posts/demo-2", { kind: "post", place: "", text: "報告されたテストの投稿", has_photo: false, photo_status: "none", uid: "demo2", created_at: now, reports: 1, hidden: false, reply_to: null });
} catch (err) {
  console.error("エミュレーターにつながりません。先に emulators:start を動かしてください。", err.message);
  process.exit(1);
}
console.log(`入れました。http://localhost:5173/staff/?emulator=1 を開いて、${EMAIL} / ${PASSWORD} でログインしてください。`);
