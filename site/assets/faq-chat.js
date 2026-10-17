import { FAQ } from "./config.js";
import { fillFaq } from "./faq-text.js";
import { P, FX, MARKS } from "./faq-icons.js";
import { lockScroll, unlockScroll } from "./scroll-lock.js";
import { barHtml } from "./help-bar.js";

const host = document.getElementById("faq-chat");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const fx = (k) => (FX[k] ?? []).map((t, i) => `<i class="vi-fx${t === "×" ? " is-batsu" : ""}" style="--n:${i}" aria-hidden="true">${esc(t)}</i>`).join("");
const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${P[k]}</svg>`;
const logo = (s) => esc(s).replace(/Enistagram\s*/g, '<img class="vi-logo" src="assets/img/enista-puffy.webp" width="666" height="117" alt="Enistagram">');

const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const botBox = (body, mark = "#C8323A") => `<div class="qa-bubble" style="--mark:${mark}">${body}</div>`;
const pick3 = () => FAQ.flatMap((g) => g.items).filter((it) => it.top).slice(0, 3);
const pairs = () => pick3().map((it) => `<div class="qa-pair"><div class="qa-msg is-me" style="--mark:${MARKS[it.icon]}"><div class="qa-bubble"><p>${esc(it.q)}</p></div></div><div class="qa-msg is-bot">${botBox(answerBody(it), MARKS[it.icon])}</div></div>`).join("") + '<button type="button" class="mido-more" data-more><span>ほかの質問を見る</span></button>';

const QSVG = '<svg viewBox="0 0 24 24"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6l-4 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M10 9.3a2 2 0 1 1 2.6 1.9c-.5.2-.6.6-.6 1.1M12 14.1h.01"/></svg>';

const allQuestions = () => `<div class="qa-all">${FAQ.map((g, gi) => `<section class="qa-grp"><p class="qa-label">${esc(g.group)}</p><div class="qa-qs">${g.items.map((it, i) => `<button type="button" class="qa-q" data-gi="${gi}" data-i="${i}" aria-pressed="false">${esc(it.q)}</button>`).join("")}</div></section>`).join("")}</div>`;

let log, intro, sheet, panel, wrap, closeBtn, lastTrigger, locked = false;

function mount() {
  const root = document.createElement("div");
  root.className = "qa-chat";
  root.innerHTML = pairs();
  host.append(root);
  root.addEventListener("click", onChoose);
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((list) => list.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); play(en.target); } }), { threshold: 0.6 });
    root.querySelectorAll(".qa-msg.is-bot").forEach((li) => io.observe(li));
  }

  sheet = document.createElement("div");
  sheet.className = "qa-sheet";
  sheet.hidden = true;
  sheet.innerHTML = `<div class="qa-sheet-back" data-close></div>
    <div class="qa-sheet-wrap"><div class="qa-sheet-panel" role="dialog" aria-modal="true" aria-label="よくある質問の答え" tabindex="-1">
      <button type="button" class="qa-sheet-x" data-close aria-label="とじる"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg></button>
      <div class="qa-sheet-body">
        <div class="qa-intro"><i class="qa-intro-ic" aria-hidden="true">${QSVG}</i><h2>よくある質問</h2><p>知りたいことを、下から選んでください。</p></div>
        <ol class="qa-log" role="log" aria-live="polite" aria-label="よくある質問の答え"></ol>
        <div class="qa-sheet-foot">${allQuestions()}</div>
      </div>
      <div class="qa-sheet-bar">${barHtml("faq")}</div>
    </div></div>`;
  document.body.append(sheet);
  wrap = sheet.querySelector(".qa-sheet-wrap");
  panel = sheet.querySelector(".qa-sheet-body");
  closeBtn = sheet.querySelector(".qa-sheet-x");
  log = sheet.querySelector(".qa-log");
  intro = sheet.querySelector(".qa-intro");
  log.hidden = true;
  sheet.addEventListener("click", onChoose);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) closeSheet(); });
  addEventListener("resize", place);
  document.addEventListener("pagesheet:open", () => closeSheet(true));
  document.addEventListener("faq:open", () => { openSheet(); showDefault(); });
}

function place() {
  if (sheet.hidden) return;
  const r = host.closest(".faq").getBoundingClientRect();
  wrap.style.left = `${r.left}px`;
  wrap.style.width = `${r.width}px`;
}

function openSheet() {
  if (!sheet.hidden) return;
  sheet.hidden = false;
  place();
  if (!locked) { lockScroll(); locked = true; }
  panel.scrollTop = 0;
  requestAnimationFrame(() => { sheet.classList.add("is-open"); closeBtn.focus({ preventScroll: true }); });
}

function closeSheet(quick = false) {
  if (sheet.hidden) return;
  sheet.classList.remove("is-open");
  const done = () => {
    sheet.hidden = true;
    if (locked) { unlockScroll(); locked = false; }
    showDefault();
    if (!quick) lastTrigger?.focus?.({ preventScroll: true });
  };
  if (calm || quick) done(); else setTimeout(done, 330);
}

function addMsg(cls, inner) {
  const li = document.createElement("li");
  li.className = `qa-msg ${cls}`;
  li.innerHTML = inner;
  log.append(li);
  return li;
}

function showDefault() {
  markCurrent(null, null);
  log.replaceChildren();
  log.hidden = true;
  intro.hidden = false;
}

function answerBody(it) {
  const lead = it.say ? `<b class="qa-lead">${logo(it.say)}</b>` : "";
  const ic = it.icon ? `<span class="qa-ic" style="--mark:${MARKS[it.icon]}">${icon(it.icon)}${fx(it.icon)}</span>` : "";
  return `<div class="qa-body${ic ? " has-ic" : ""}">${ic}<p>${lead}${logo(fillFaq(it.a))}</p></div>`;
}

function play(li) {
  const t = li.querySelector(".qa-ic");
  if (calm || !t) return;
  t.classList.add("is-play");
  setTimeout(() => t.classList.remove("is-play"), 1500);
}

function morph(update) {
  const from = (intro.hidden ? log : intro).offsetHeight;
  update();
  if (calm || !log.animate) return;
  const to = log.offsetHeight;
  if (Math.abs(from - to) < 2) return;
  log.style.overflow = "hidden";
  const a = log.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 460, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
  const end = () => { log.style.overflow = ""; };
  a.onfinish = end;
  a.oncancel = end;
  setTimeout(end, 700);
}

function showTop() {
  panel.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" });
  setTimeout(() => { if (panel.scrollTop > 0) panel.scrollTop = 0; }, calm ? 0 : 650);
}

function talk(userText, body, mark) {
  morph(() => {
    log.replaceChildren();
    intro.hidden = true;
    log.hidden = false;
    addMsg("is-me qa-in", `<div class="qa-bubble"><p>${esc(userText)}</p></div>`);
    play(addMsg("is-bot qa-in", botBox(body, mark)));
  });
}

function markCurrent(gi, i) {
  sheet.querySelectorAll(".qa-all .qa-q").forEach((q) => {
    const on = gi !== null && Number(q.dataset.gi) === gi && Number(q.dataset.i) === i;
    q.classList.toggle("is-current", on);
    q.setAttribute("aria-pressed", String(on));
  });
}

function ask(gi, i) {
  const it = FAQ[gi].items[i];
  openSheet();
  markCurrent(gi, i);
  talk(it.q, answerBody(it), MARKS[it.icon]);
  showTop();
}

function onChoose(e) {
  if (e.target.closest("[data-close]")) { closeSheet(); return; }
  const more = e.target.closest("[data-more]");
  if (more) { lastTrigger = more; document.dispatchEvent(new CustomEvent("faq:open")); return; }
  const q = e.target.closest(".qa-q");
  if (q) { if (!sheet.contains(q)) lastTrigger = q; ask(Number(q.dataset.gi), Number(q.dataset.i)); return; }
}

if (host) mount();
