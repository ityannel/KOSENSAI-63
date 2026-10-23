const EMAIL = /^[^@\s/]+@[^@\s/]+[.][^@\s/]+$/;
const PW_CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newPassword = () => [...crypto.getRandomValues(new Uint8Array(12))].map((n) => PW_CHARS[n % PW_CHARS.length]).join("");

export function initMembers({ fs, db, a, auth, appMod, firebaseConfig, connectEmulators, $, esc, toast, write, listen, time }) {
  let members = [];
  let maker = null;
  const makerAuth = () => {
    if (maker) return maker;
    const app = appMod.getApps().find((x) => x.name === "member-maker") ?? appMod.initializeApp(firebaseConfig, "member-maker");
    maker = auth.initializeAuth(app, { persistence: auth.inMemoryPersistence });
    connectEmulators({ auth, a: maker });
    return maker;
  };
  const ms = (v) => v?.toMillis?.() ?? 0;

  function paint() {
    const me = a.currentUser?.email;
    $("#mb-state").textContent = `${members.length}人`;
    $("#mb-list").innerHTML = members.length ? members.map((m) => `
      <li><div><b>${esc(m.name || "（名前なし）")}${m.id === me ? ' <i class="tag tag-ok">あなた</i>' : ""}</b><small>${esc(m.id)}${m.added_by ? `・${esc(m.added_by)} が ${esc(time(ms(m.added_at)))} に足した` : ""}</small></div>
        <span class="row mb-acts"><button class="btn btn-ghost btn-sm" type="button" data-mb-reset="${esc(m.id)}">パスワードのメール</button>${m.id === me ? "" : `<button class="btn btn-ghost btn-sm btn-danger" type="button" data-mb-del="${esc(m.id)}">外す</button>`}</span></li>`).join("")
      : '<li><div><b>読みこんでいます…</b></div></li>';
  }
  listen(fs.collection(db, "staff"), (snap) => {
    members = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y) => String(x.name || x.id).localeCompare(String(y.name || y.id), "ja"));
    paint();
  });

  $("#mb-gen").addEventListener("click", () => { $("#mb-pw").value = newPassword(); });
  $("#mb-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#mb-name").value.trim(), email = $("#mb-email").value.trim().toLowerCase(), pw = $("#mb-pw").value;
    if (!name) return toast("名前を入れてください", true);
    if (!EMAIL.test(email)) return toast("メールアドレスの形が、ちがいます", true);
    if (members.some((m) => m.id === email)) return toast("その人は、もう名簿にのっています", true);
    if (pw.length < 8) return toast("最初のパスワードは、8文字以上にしてください", true);
    if (!confirm(`${name}（${email}）を、本部のメンバーに足しますか？\nこの人は、本部コンソールで、すべての変更ができるようになります。`)) return;
    $("#mb-submit").disabled = true;
    try {
      let made = true;
      try {
        await auth.createUserWithEmailAndPassword(makerAuth(), email, pw);
        await auth.signOut(makerAuth());
      } catch (err) {
        if (err.code !== "auth/email-already-in-use") throw err;
        if (!confirm(`${email} のアカウントは、もうあります。名簿にだけ足しますか？\n（パスワードは、その人がいま使っているもののままです）`)) return;
        made = false;
      }
      const ok = await write(`${name}を、本部のメンバーに足しました`, () => fs.setDoc(fs.doc(db, "staff", email), { name, added_by: a.currentUser.email, added_at: fs.serverTimestamp() }));
      if (!ok) return;
      e.target.reset();
      $("#mb-done-text").textContent = [`本部コンソール：${new URL("./", location.href).href}`, `メールアドレス：${email}`, made ? `パスワード：${pw}` : "パスワード：いま使っているもの（忘れたら、ログイン画面の「パスワードを忘れたとき」）"].join("\n");
      $("#mb-done").hidden = false;
    } catch (err) {
      console.warn(err);
      const m = { "auth/invalid-email": "メールアドレスの形が、ちがいます", "auth/weak-password": "パスワードが短すぎます", "auth/operation-not-allowed": "Firebase で、メールとパスワードのログインが止まっています", "auth/too-many-requests": "回数が多すぎます。少し待ってから", "auth/network-request-failed": "つながりませんでした。電波のよい所で、もう一度" }[err.code];
      toast(m ?? `足せませんでした（${err.code ?? err.message}）`, true);
    } finally {
      $("#mb-submit").disabled = false;
    }
  });
  $("#mb-copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("#mb-done-text").textContent); toast("コピーしました"); } catch { toast("コピーできませんでした。文字を選んでコピーしてください", true); }
  });
  $("#mb-done-close").addEventListener("click", () => { $("#mb-done").hidden = true; $("#mb-done-text").textContent = ""; });
  $("#mb-list").addEventListener("click", async (e) => {
    const del = e.target.closest("[data-mb-del]"), reset = e.target.closest("[data-mb-reset]");
    if (del) {
      const m = members.find((x) => x.id === del.dataset.mbDel);
      if (!m || !confirm(`${m.name || m.id}（${m.id}）を、本部のメンバーから外しますか？\nこの人は、コンソールで何も変えられなくなります。`)) return;
      write(`${m.name || m.id}を、メンバーから外しました`, () => fs.deleteDoc(fs.doc(db, "staff", m.id)));
    }
    if (reset) {
      const email = reset.dataset.mbReset;
      if (!confirm(`${email} に、パスワードを決め直すメールを送りますか？`)) return;
      try { await auth.sendPasswordResetEmail(a, email); toast("メールを送りました"); } catch (err) { toast(`送れませんでした（${err.code ?? err.message}）`, true); }
    }
  });
  paint();
}
