// Firestore の読み取りを減らす：画面を閉じたまま（別のアプリを見ている・画面を消している）2分たったら、読みとりを止める。戻ったら、続きから読みなおす。
// 止めているあいだ、サーバーで変わった分は、戻ったときに差分だけ読む（しまってあるものがあるので、全部は読みなおさない）。
// 使い方：whileVisible(() => fs.onSnapshot(...))  ← 読みとりをはじめて、止めるための関数を返す
export function whileVisible(start, idleMs = 120000) {
  let stop = null, timer = 0;
  const on = () => { if (!stop) stop = start(); };
  const off = () => { stop?.(); stop = null; };
  on();
  document.addEventListener("visibilitychange", () => {
    clearTimeout(timer);
    if (document.hidden) timer = setTimeout(off, idleMs); else on();
  });
}
