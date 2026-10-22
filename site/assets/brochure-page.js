import { openZoom } from "./zoom.js";

const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

const figs = [...document.querySelectorAll(".pg")];
const chips = [...document.querySelectorAll("#bro-chips a")];
const titleOf = (i) => figs[i - 1]?.querySelector("figcaption")?.textContent.replace(/^\d+ \/ \d+\s+/, "") ?? "";
const srcOf = (i) => `assets/img/brochure/p${String(i).padStart(2, "0")}.webp`;

chips.forEach((a) => a.addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById(`sec-${a.dataset.sec}`)?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
}));

const marks = chips.map((a) => [a, document.getElementById(`sec-${a.dataset.sec}`)]).filter(([, el]) => el);
let ticking = false;
function syncChips() {
  ticking = false;
  const line = innerHeight * 0.4;
  let cur = null;
  for (const [a, el] of marks) if (el.getBoundingClientRect().top < line) cur = a;
  for (const [a] of marks) {
    if (a === cur) {
      if (a.getAttribute("aria-current") !== "true") {
        a.setAttribute("aria-current", "true");
        const bar = a.parentElement;
        bar.scrollTo({ left: a.offsetLeft - (bar.clientWidth - a.offsetWidth) / 2, behavior: calm ? "auto" : "smooth" });
      }
    } else a.removeAttribute("aria-current");
  }
}
addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(syncChips); } }, { passive: true });
syncChips();

const items = figs.map((f, k) => {
  const title = titleOf(k + 1);
  return { src: srcOf(k + 1), title, alt: `パンフレット ${k + 1}ページ目 ${title}` };
});

document.getElementById("bro-list").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-i]");
  if (!b) return;
  const i = Number(b.dataset.i) - 1;
  openZoom(items, i, { opener: b, onChange: (j) => figs[j]?.scrollIntoView({ block: "center" }) });
});
