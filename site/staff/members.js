import { FIREBASE_VERSION, firebaseConfig, connectEmulators } from "../assets/live.js";
import { authMessage } from "./account.js";

const MAKER = "member-maker";
const CHARS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function initMembers({ fs, db, a, $, esc, toast, write, listen, time, auth }) {
  const listBox = $("#members-list"), form = $("#member-form"), result = $("#member-result"), msg = $("#member-msg");
  let members = [];

  const say = (text) => { msg.textContent = text; };
  const password = () => {
    const bytes = crypto.getRandomValues(new Uint32Array(12));
    return [...bytes].map((n) => CHARS[n % CHARS.length]).join("");
  };

  function paint() {
    const me = a.currentUser?.email;
    listBox.innerHTML = members.length
      ? members.map((m) => `<li class="member-row">
          <div><b>${esc(m.name || "（名前なし）")}</b>${m.id === me ? ' <span class="pill">あなた</span>' : ""}<small>${esc(m.id)}</small><small>${m.added_by ? `${esc(m.added_by)} が ${esc(time(m.added_at?.toMillis?.()))} に足した` : "はじめから名簿にいる"}</small></div>
          ${m.id === me ? "" : `<button type="button" class="btn btn-ghost btn-sm btn-danger" data-remove="${esc(m.id)}">外す</button>`}
        </li>`).join("")
      : '<li class="muted small">まだいません</li>';
  }

  async function maker() {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
    const appMod = await import(`${base}/firebase-app.js`);
    const app = appMod.getApps().find((x) => x.name === MAKER) ?? appMod.initializeApp(firebaseConfig, MAKER);
    let makerAuth;
    try {
      makerAuth = auth.initializeAuth(app, { persistence: auth.inMemoryPersistence });
    } catch {
      makerAuth = auth.getAuth(app);
    }
    connectEmulators({ auth, a: makerAuth });
    return makerAuth;
  }

  function showResult(email, pw) {
    const url = new URL("./", location.href).href;
    const text = `本部コンソール：${url}\nメール：${email}\nパスワード：${pw ?? "（前からあるアカウントなので、変わっていません）"}`;
    result.hidden = false;
    result.innerHTML = `<p class="muted small">足しました。この3つを、本人に渡してください。パスワードは、この画面を閉じると見られなくなります。本人には、ログインしたあと「サイトの設定」で、自分のパスワードに変えてもらってください。</p>
      <pre class="member-pre">${esc(text)}</pre>
      <button type="button" class="btn btn-ghost btn-sm" id="member-copy">コピーする</button>`;
    $("#member-copy").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(text); toast("コピーしました"); } catch { toast("コピーできませんでした。文字を選んで、コピーしてください", true); }
    });
  }

  $("#member-gen").addEventListener("click", () => { $("#member-pw").value = password(); $("#member-pw").type = "text"; });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    say(""); result.hidden = true;
    const name = $("#member-name").value.trim().slice(0, 40);
    const email = $("#member-email").value.trim().toLowerCase();
    const pw = $("#member-pw").value;
    if (!name) return say("名前を入れてください。");
    if (!/^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/.test(email)) return say("メールアドレスの形がちがいます。");
    if (members.some((m) => m.id === email)) return say("この人は、もう名簿にいます。");
    if (pw.length < 8) return say("最初のパスワードは、8文字以上にしてください（「作る」で自動で作れます）。");
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    let made = true;
    try {
      const makerAuth = await maker();
      try {
        await auth.createUserWithEmailAndPassword(makerAuth, email, pw);
      } catch (err) {
        if (err?.code !== "auth/email-already-in-use") throw err;
        if (!confirm(`${email} のアカウントは、もうあります。名簿にだけ足しますか？（パスワードは変わりません）`)) { btn.disabled = false; return; }
        made = false;
      } finally {
        await auth.signOut(makerAuth).catch(() => {});
      }
      const ok = await write("名簿に足しました", () => fs.setDoc(fs.doc(db, "staff", email), { name, added_by: a.currentUser.email, added_at: fs.serverTimestamp() }));
      if (ok) {
        showResult(email, made ? pw : null);
        form.reset();
        $("#member-pw").type = "password";
      }
    } catch (err) {
      console.warn("[members]", err?.code ?? err);
      say(authMessage(err));
    }
    btn.disabled = false;
  });

  listBox.addEventListener("click", (e) => {
    const b = e.target.closest("[data-remove]");
    const id = b?.dataset.remove;
    if (!id || id === a.currentUser?.email) return;
    if (!confirm(`${id} を、本部の名簿から外しますか？（ログインはできなくなります。Firebase のアカウントは残ります）`)) return;
    write("名簿から外しました", () => fs.deleteDoc(fs.doc(db, "staff", id)));
  });

  listen(fs.collection(db, "staff"), (snap) => {
    members = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y) => x.id.localeCompare(y.id));
    paint();
  });
}
