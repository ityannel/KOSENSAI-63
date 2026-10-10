import { initRallyPage } from "./rally.js";

const nowParam = new URLSearchParams(location.search).get("now");
const offset = nowParam && !Number.isNaN(Date.parse(nowParam)) ? Date.parse(nowParam) - Date.now() : 0;
initRallyPage(() => Date.now() + offset);

const sheet = document.querySelector(".mido-full");
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
function close(e) {
  e?.preventDefault();
  const fromSite = document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1;
  let gone = false;
  const go = () => { if (gone) return; gone = true; fromSite ? history.back() : location.assign("./#ennichi"); };
  if (calm) return go();
  sheet.classList.add("is-closing");
  sheet.addEventListener("animationend", go, { once: true });
  setTimeout(go, 600);
}
document.querySelector(".mido-close").addEventListener("click", close);
addEventListener("keydown", (e) => { if (e.key === "Escape" && !e.target.closest?.("input")) close(e); });
addEventListener("pageshow", () => sheet.classList.remove("is-closing"));
