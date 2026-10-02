// 電波がなくても開けるようにする（sw.js を登録するだけ）。トップページと地図の両方で読み込む
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  const register = () => navigator.serviceWorker.register(new URL("../sw.js", import.meta.url)).catch((err) => console.warn("[offline] 登録できませんでした:", err));
  // ページを出し終わってから（最初の表示を遅くしない）
  if (document.readyState === "complete") register(); else addEventListener("load", register);
}
