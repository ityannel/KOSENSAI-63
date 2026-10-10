if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  const register = () => navigator.serviceWorker.register(new URL("../sw.js", import.meta.url)).catch((err) => console.warn("[offline] 登録できませんでした:", err));
  if (document.readyState === "complete") register(); else addEventListener("load", register);
}
