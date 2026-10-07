// 初めてのとき（1日目に開いたとき）だけ、最初の演出を出す。描く前に決めたいので、index.html の中で同期で読む
let seen = false;
try { seen = !!localStorage.getItem("kosen63-intro-seen"); } catch {}
if (!seen) {
  document.body.classList.add("intro");
  setTimeout(() => document.body.classList.remove("intro"), 6000);
}
