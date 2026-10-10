import { TOP_BLOCKS, TOP_PRESETS, FESTIVAL } from "./config.js";
import { subscribeSiteConfig } from "./live.js";

const KEY = "kosen63-blocks";
const top = document.querySelector(".k-top");
const els = Object.fromEntries(TOP_BLOCKS.map(([id]) => [id, document.querySelector(`[data-block="${id}"]`)]).filter(([, el]) => el));

function orderOf(blocks, base) {
  const list = (Array.isArray(blocks) ? blocks.filter((b) => els[b?.id]) : []).map((b) => ({ id: b.id, show: b.show !== false }));
  const has = (id) => list.some((b) => b.id === id);
  (base ?? []).filter((b) => els[b.id]).forEach(({ id, show }, i, arr) => {
    if (has(id)) return;
    const prev = arr.slice(0, i).reverse().find((b) => has(b.id));
    list.splice(prev ? list.findIndex((b) => b.id === prev.id) + 1 : 0, 0, { id, show });
  });
  return [...list, ...TOP_BLOCKS.filter(([id]) => els[id] && !has(id)).map(([id]) => ({ id, show: true }))];
}

let order = orderOf(null);
function apply(blocks, base) {
  order = orderOf(blocks, base);
  let anchor = top;
  for (const { id, show } of order) {
    const el = els[id];
    if (anchor.nextElementSibling !== el) anchor.after(el);
    anchor = el;
    el.toggleAttribute("data-off", !show);
  }
  const rest = document.querySelector(".sections");
  if (rest && anchor.nextElementSibling !== rest) anchor.after(rest);
  markEdges();
}

function markEdges() {
  const shown = order.map(({ id }) => els[id]).filter((el) => !el.hidden && !el.hasAttribute("data-off"));
  Object.values(els).forEach((el) => { el.classList.toggle("is-first-block", el === shown[0]); el.classList.toggle("is-last-block", el === shown.at(-1)); });
  window.kosenBlocks = order.map(({ id, show }) => ({ id, show, visible: shown.includes(els[id]) }));
  document.dispatchEvent(new CustomEvent("blocks:order", { detail: window.kosenBlocks }));
}
{
  const mo = new MutationObserver(markEdges);
  Object.values(els).forEach((el) => mo.observe(el, { attributes: true, attributeFilter: ["hidden"] }));
}

if (top) new ResizeObserver(([e]) => document.documentElement.style.setProperty("--edge", `${(e.contentRect.width * 20) / 402}px`)).observe(top);

const test = ["localhost", "127.0.0.1"].includes(location.hostname) && new URLSearchParams(location.search).get("blocks");
const nowParam = new URLSearchParams(location.search).get("now");
const now = () => (nowParam ? Date.parse(nowParam.includes("+") ? nowParam : nowParam + "+09:00") : Date.now());
const phase = () => (now() < Date.parse(FESTIVAL.days[0].open) ? "before" : "during");
const which = (cfg) => (cfg?.mode === "before" || cfg?.mode === "during" ? cfg.mode : phase());
const pick = (cfg) => cfg?.presets?.[which(cfg)] ?? TOP_PRESETS[which(cfg)];
const base = (cfg) => TOP_PRESETS[which(cfg)];
let cfg = null;
if (test) apply(test.split(",").map((t) => ({ id: t.replace(/^-/, ""), show: !t.startsWith("-") })));
else try { apply(JSON.parse(localStorage.getItem(KEY) ?? "null") ?? pick(null), base(null)); } catch { apply(pick(null), base(null)); }
if (!test) {
  subscribeSiteConfig((d) => {
    cfg = d ?? null;
    const blocks = pick(cfg);
    apply(blocks, base(cfg));
    try { localStorage.setItem(KEY, JSON.stringify(blocks)); } catch {  }
  });
  setInterval(() => apply(pick(cfg), base(cfg)), 60000);
}
