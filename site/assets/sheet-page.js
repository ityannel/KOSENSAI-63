import { LEGAL } from "./config.js";

const takedown = document.getElementById("takedown");
if (takedown && LEGAL?.takedownForm) {
  takedown.href = LEGAL.takedownForm; takedown.hidden = false;
  const wait = document.getElementById("takedown-wait");
  if (wait) wait.hidden = true;
}

const sheet = document.querySelector(".mido-full");
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
function close(e) {
  e?.preventDefault();
  const fromSite = document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1;
  let gone = false;
  const go = () => { if (gone) return; gone = true; fromSite ? history.back() : location.assign("./"); };
  if (calm) return go();
  sheet.classList.add("is-closing");
  sheet.addEventListener("animationend", go, { once: true });
  setTimeout(go, 600);
}
document.querySelector(".mido-close")?.addEventListener("click", close);
addEventListener("keydown", (e) => { if (e.key === "Escape") close(e); });
addEventListener("pageshow", () => sheet.classList.remove("is-closing"));
