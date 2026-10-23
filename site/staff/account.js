export const AUTH_MSG = {
  "auth/wrong-password": "いまのパスワードがちがいます。",
  "auth/invalid-credential": "メールアドレスかパスワードがちがいます。",
  "auth/invalid-email": "メールアドレスの形がちがいます。",
  "auth/user-not-found": "このメールアドレスのアカウントが見つかりません。",
  "auth/weak-password": "パスワードが弱すぎます。8文字以上にしてください。",
  "auth/email-already-in-use": "このメールアドレスは、もう登録されています。",
  "auth/too-many-requests": "何回も続けたので、いったん止まっています。しばらく待ってから、もう一度ためしてください。",
  "auth/requires-recent-login": "安全のため、いちどログアウトして、ログインし直してから、やり直してください。",
  "auth/network-request-failed": "電波がつながりません。電波のよい所で、もう一度ためしてください。",
  "auth/missing-email": "メールアドレスを入れてください。",
  "auth/operation-not-allowed": "この方法は、まだ使えません。Firebase の「メール / パスワード」のログインを有効にしてください。",
};
export const authMessage = (err) => AUTH_MSG[err?.code] ?? `うまくいきませんでした（${err?.code ?? err?.message ?? "不明"}）`;

export function initAccount({ auth, a, $, toast }) {
  a.languageCode = "ja";

  const loginMsg = $("#login-msg");
  $("#forgot").addEventListener("click", async () => {
    const email = $("#email").value.trim();
    loginMsg.classList.remove("is-ok");
    if (!email) { loginMsg.textContent = "上のメールアドレスの欄に入れてから、もう一度押してください。"; return; }
    try {
      await auth.sendPasswordResetEmail(a, email);
    } catch (err) {
      if (err?.code !== "auth/user-not-found") { loginMsg.textContent = authMessage(err); return; }
    }
    loginMsg.classList.add("is-ok");
    loginMsg.textContent = `${email} に、パスワードを決め直すメールを送りました。メールのリンクから、新しいパスワードを決めてください。届かないときは、迷惑メールのフォルダも見てください。`;
  });
  $("#login-form").addEventListener("input", () => loginMsg.classList.remove("is-ok"));

  const form = $("#mypw-form"), msg = $("#mypw-msg");
  const say = (text, ok = false) => { msg.textContent = text; msg.classList.toggle("is-ok", ok); };
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = a.currentUser;
    const now = $("#mypw-now").value, next = $("#mypw-new").value, again = $("#mypw-again").value;
    if (!user?.email) return say("ログインし直してください。");
    if (next.length < 8) return say("新しいパスワードは、8文字以上にしてください。");
    if (next !== again) return say("新しいパスワードが、2つの欄で合っていません。");
    if (next === now) return say("いまのパスワードと、同じです。ちがうものにしてください。");
    if (!confirm("パスワードを変えると、ほかの端末は、ログインし直しになります。変えますか？")) return;
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    try {
      await auth.reauthenticateWithCredential(user, auth.EmailAuthProvider.credential(user.email, now));
      await auth.updatePassword(user, next);
      form.reset();
      say("パスワードを変えました。", true);
      toast("パスワードを変えました");
    } catch (err) {
      say(authMessage(err));
    }
    btn.disabled = false;
  });
  $("#mypw-mail").addEventListener("click", async () => {
    const email = a.currentUser?.email;
    if (!email) return say("ログインし直してください。");
    try {
      await auth.sendPasswordResetEmail(a, email);
      say(`${email} に、パスワードを決め直すメールを送りました。`, true);
    } catch (err) {
      say(authMessage(err));
    }
  });
}
