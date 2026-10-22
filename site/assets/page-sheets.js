import { lockScroll, unlockScroll } from "./scroll-lock.js";
import { barHtml } from "./help-bar.js";

const NAMES = ["mido", "rally", "vote", "terms", "faq", "en", "ai", "hq", "brochure"];
const seg = (u) => u.pathname.split("/").pop().replace(/\.html$/, "");
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

let sheet, wrap, panel, frame, loading, bar, locked = false;

const pageOf = (href, base = location.href) => {
  let u;
  try { u = new URL(href, base); } catch { return null; }
  if (u.origin !== location.origin) return null;
  const name = seg(u);
  return NAMES.includes(name) ? `${name}.html${u.search}` : null;
};

const isTop = (href, base = location.href) => {
  let u;
  try { u = new URL(href, base); } catch { return false; }
  const name = seg(u);
  return u.origin === location.origin && (name === "" || name === "index");
};

function build() {
  sheet = document.createElement("div");
  sheet.className = "ps";
  sheet.hidden = true;
  sheet.innerHTML = `<div class="ps-back" data-ps-close></div>
    <div class="ps-wrap"><div class="ps-panel" role="dialog" aria-modal="true" aria-label="ページ">
      <p class="ps-load">読み込み中…</p>
      <iframe class="ps-frame" title="ページ" allow="camera; clipboard-write"></iframe>
      <div class="ps-bar"></div>
    </div></div>`;
  document.body.append(sheet);
  wrap = sheet.querySelector(".ps-wrap");
  panel = sheet.querySelector(".ps-panel");
  bar = sheet.querySelector(".ps-bar");
  frame = sheet.querySelector(".ps-frame");
  loading = sheet.querySelector(".ps-load");
  sheet.querySelector(".ps-back").addEventListener("click", () => requestClose());
  bar.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a) return;
    e.preventDefault();
    const rel = pageOf(a.getAttribute("href"));
    if (rel) open(rel, "replace");
  });
  frame.addEventListener("load", onFrameLoad);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) requestClose(); });
  addEventListener("resize", place);
}

function place() {
  if (!sheet || sheet.hidden) return;
  const col = document.querySelector(".k-top") ?? document.body;
  const r = col.getBoundingClientRect();
  wrap.style.left = `${r.left}px`;
  wrap.style.width = `${r.width}px`;
}

const go = (url) => { try { frame.contentWindow.location.replace(url); } catch { frame.src = url; } };

function setBar(rel) {
  const cur = rel.startsWith("ai.html") ? "ai" : rel.startsWith("hq.html") ? "hq" : null;
  bar.innerHTML = cur ? barHtml(cur) : "";
  panel.classList.toggle("has-bar", !!cur);
}

function open(rel, mode = "push") {
  if (!sheet) build();
  setBar(rel);
  document.dispatchEvent(new CustomEvent("pagesheet:open"));
  loading.hidden = false;
  go(rel);
  if (sheet.hidden) {
    sheet.hidden = false;
    place();
    if (!locked) { lockScroll(); locked = true; }
    requestAnimationFrame(() => sheet.classList.add("is-open"));
  }
  if (mode === "push") history.pushState({ ps: rel }, "", `#/${rel}`);
  else if (mode === "replace") history.replaceState({ ps: rel }, "", `#/${rel}`);
}

function hide() {
  if (!sheet || sheet.hidden) return;
  sheet.classList.remove("is-open");
  const done = () => {
    sheet.hidden = true;
    go("about:blank");
    if (locked) { unlockScroll(); locked = false; }
  };
  if (calm) done(); else setTimeout(done, 330);
}

function requestClose() {
  if (!sheet || sheet.hidden) return;
  if (history.state?.ps) history.back();
  else hide();
}

function onFrameLoad() {
  let win, doc;
  try { win = frame.contentWindow; doc = frame.contentDocument; } catch { return; }
  if (!win || !doc || win.location.href === "about:blank") return;
  if (isTop(win.location.href)) { requestClose(); return; }
  const rel = pageOf(win.location.href);
  if (!rel) { location.href = win.location.href; return; }
  loading.hidden = true;
  setBar(rel);
  if (history.state?.ps && history.state.ps !== rel) history.replaceState({ ps: rel }, "", `#/${rel}`);
  const style = doc.createElement("style");
  style.textContent = ".site-tabs { display: none !important; }";
  doc.head.append(style);
  doc.addEventListener("click", onFrameClick, true);
  win.focus();
}

function onFrameClick(e) {
  const a = e.target.closest?.("a[href]");
  if (!a) return;
  if (a.classList.contains("mido-close")) { e.preventDefault(); e.stopImmediatePropagation(); requestClose(); return; }
  if (a.hasAttribute("data-tk") || a.hasAttribute("data-shop")) return;
  if (a.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const href = a.getAttribute("href") ?? "";
  if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
  const base = frame.contentWindow.location.href;
  if (isTop(href, base)) { e.preventDefault(); e.stopImmediatePropagation(); requestClose(); return; }
  const next = pageOf(href, base);
  if (next) { e.preventDefault(); e.stopImmediatePropagation(); open(next, "replace"); return; }
  let u;
  try { u = new URL(href, base); } catch { return; }
  if (u.origin === location.origin) { e.preventDefault(); e.stopImmediatePropagation(); location.href = u.href; }
}

document.addEventListener("click", (e) => {
  const a = e.target.closest?.("a[href]");
  if (!a || a.closest(".ps")) return;
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank" || a.hasAttribute("download")) return;
  const rel = pageOf(a.getAttribute("href") ?? "");
  if (!rel) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  open(rel);
}, true);

addEventListener("popstate", (e) => {
  const rel = e.state?.ps ?? (location.hash.startsWith("#/") ? location.hash.slice(2) : null);
  if (rel && pageOf(rel)) open(rel, "none");
  else hide();
});

if (location.hash.startsWith("#/")) {
  const rel = location.hash.slice(2);
  if (pageOf(rel)) {
    history.replaceState(null, "", location.pathname + location.search);
    open(rel);
  }
}

document.addEventListener("faq:open", () => { if (sheet && !sheet.hidden) requestClose(); });
