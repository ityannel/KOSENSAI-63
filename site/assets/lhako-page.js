import { LHAKO } from "./config.js";
import { pullDown } from "./pulldown.js";
import { lhakoSlots, freeSeats, freeResId, firestoreStore, demoStore, MAX_RES } from "./lhako.js";

const params = new URLSearchParams(location.search);
const nowParam = params.get("now");
const nowAt = nowParam ? Date.parse(nowParam.includes("+") ? nowParam : `${nowParam}+09:00`) : NaN;
const offset = Number.isNaN(nowAt) ? 0 : nowAt - Date.now();
const now = () => Date.now() + offset;

const NAME_KEY = "kosen63-lhako-name";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const slots = lhakoSlots();
const byId = new Map(slots.map((s) => [s.id, s]));
const store = params.has("demo") ? demoStore(slots) : firestoreStore();

const state = { day: null, taken: new Set(), mine: [], loaded: false, failed: false, open: null, busy: false, confirm: null };
const dayOfNow = () => LHAKO.days.find((d) => now() < Date.parse(`${d.date}T${d.end}:00+09:00`)) ?? LHAKO.days.at(-1);
state.day = dayOfNow().id;

const readName = () => { try { return localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; } };
const saveName = (v) => { try { localStorage.setItem(NAME_KEY, v); } catch { } };
const dayLabel = (id) => LHAKO.days.find((d) => d.id === id)?.label.replace(/\(.\)/, "") ?? "";
const isDone = (r) => (byId.get(r.slot)?.end ?? 0) <= now();

let msgTimer = null;
function message(text, kind = "info") {
  const m = $("#lh-msg");
  m.textContent = text;
  m.dataset.kind = kind;
  clearTimeout(msgTimer);
  if (text) msgTimer = setTimeout(() => { m.textContent = ""; }, 7000);
}

$("#lhako-lead").innerHTML = `${esc(LHAKO.place)}で、${LHAKO.acts.map((a) => `<b>${esc(a)}</b>`).join("・")}が体験できます。<br>1回${LHAKO.minutes}分、1回に${LHAKO.seats}人まで。時間を選んで、予約してください。`;

function drawTabs() {
  $("#lh-days").innerHTML = LHAKO.days.map((d) => `<button type="button" role="tab" class="lh-tab" data-day="${d.id}" aria-selected="${d.id === state.day}">${esc(d.label)}<small>${d.start}〜${d.end}</small></button>`).join("");
}

function drawMine() {
  const box = $("#lh-mine");
  const list = state.mine.filter((r) => byId.has(r.slot)).sort((a, b) => byId.get(a.slot).start - byId.get(b.slot).start);
  box.hidden = !list.length;
  if (!list.length) return;
  box.innerHTML = `<h2 class="lh-sub">あなたの予約</h2><ul class="lh-mine-list">${list.map((r) => {
    const s = byId.get(r.slot), done = isDone(r), asking = state.confirm === r.id;
    return `<li class="lh-mine-row${done ? " is-done" : ""}">
      <div><b>${esc(dayLabel(s.day))} ${s.hm}–${s.endHm}</b><small>${esc(r.name)}さん・${r.seats.length}人${done ? "・おわりました" : ""}</small></div>
      <button type="button" class="lh-x${asking ? " is-ask" : ""}" data-cancel="${esc(r.id)}">${done ? "消す" : asking ? "本当に取り消す" : "取り消す"}</button>
    </li>`;
  }).join("")}</ul>`;
}

function seatDots(n) {
  return `<span class="lh-seats" role="img" aria-label="あと${n}人">${[...Array(LHAKO.seats).keys()].map((i) => `<i class="${i < n ? "is-free" : ""}"></i>`).join("")}<em>${n ? `あと${n}人` : "満席"}</em></span>`;
}

function draw() {
  drawMine();
  const list = $("#lh-list"), form = $("#lh-form");
  if (!form.hidden && form.contains(document.activeElement)) return;
  list.after(form);
  form.hidden = true;
  if (state.failed && !state.loaded) { list.innerHTML = ""; return; }
  if (!state.loaded) { list.innerHTML = '<li class="lh-empty">よみこみ中…</li>'; return; }
  const rows = slots.filter((s) => s.day === state.day && s.start > now());
  if (!rows.length) { state.open = null; list.innerHTML = `<li class="lh-empty">この日の予約できる時間は、もうありません。</li>`; return; }
  const mineSlots = new Set(state.mine.map((r) => r.slot));
  list.innerHTML = rows.map((s) => {
    const left = freeSeats(state.taken, s.id).length, had = mineSlots.has(s.id);
    const label = had ? "予約ずみ" : left ? "予約する" : "満席";
    return `<li class="lh-row${left ? "" : " is-full"}" data-slot="${s.id}">
      <div class="lh-time"><b>${s.hm}</b><span>–${s.endHm}</span></div>
      <div class="lh-info">${seatDots(left)}</div>
      <button type="button" class="lh-go" data-slot="${s.id}" ${had || !left ? "disabled" : ""}>${label}</button>
    </li>`;
  }).join("");
  if (state.open) {
    const row = list.querySelector(`[data-slot="${state.open}"]`);
    if (row) { row.append(form); form.hidden = false; drawCount(); } else state.open = null;
  }
}

function drawCount() {
  const left = freeSeats(state.taken, state.open).length;
  const cur = Number(document.querySelector('input[name="count"]:checked')?.value ?? 1);
  const pick = Math.min(cur, left) || 1;
  $("#lh-count").innerHTML = [...Array(Math.min(LHAKO.seats, left)).keys()].map((i) => `<label class="lh-radio"><input type="radio" name="count" value="${i + 1}" ${i + 1 === pick ? "checked" : ""}><span>${i + 1}人</span></label>`).join("");
}

function openForm(slotId) {
  const s = byId.get(slotId);
  state.open = slotId;
  $("#lh-form-title").textContent = `${dayLabel(s.day)} ${s.hm}–${s.endHm}`;
  const name = $("#lh-name");
  if (!name.value) name.value = readName();
  draw();
  $("#lh-form").scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  if (!name.value) name.focus({ preventScroll: true });
}
function closeForm() {
  state.open = null;
  const form = $("#lh-form");
  form.hidden = true;
  $("#lh-list").after(form);
}

$("#lh-days").addEventListener("click", (e) => {
  const b = e.target.closest("[data-day]");
  if (!b) return;
  state.day = b.dataset.day; state.open = null; closeForm(); drawTabs(); draw();
});
$("#lh-list").addEventListener("click", (e) => {
  const b = e.target.closest(".lh-go");
  if (b && !b.disabled) openForm(b.dataset.slot);
});
$("#lh-cancel").addEventListener("click", () => { closeForm(); draw(); });

$("#lh-mine").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-cancel]");
  if (!b || state.busy) return;
  const r = state.mine.find((x) => x.id === b.dataset.cancel);
  if (!r) return;
  if (!isDone(r) && state.confirm !== r.id) {
    state.confirm = r.id; drawMine();
    setTimeout(() => { if (state.confirm === r.id) { state.confirm = null; drawMine(); } }, 4000);
    return;
  }
  state.confirm = null; state.busy = true;
  try {
    await store.cancel({ rid: r.id, slot: r.slot, seats: r.seats });
    message(isDone(r) ? "" : "予約を取り消しました。", "ok");
  } catch (err) {
    console.warn("[lhako]", err?.code ?? err);
    message("取り消せませんでした。電波のよい所で、もう一度ためしてください。", "warn");
  }
  state.busy = false;
});

$("#lh-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (state.busy || !state.open) return;
  const slotId = state.open, s = byId.get(slotId);
  const name = $("#lh-name").value.trim().slice(0, 20);
  const count = Number(document.querySelector('input[name="count"]:checked')?.value ?? 0);
  if (!name) return message("お名前（ニックネームでOK）を書いてください。", "warn");
  const seats = freeSeats(state.taken, slotId).slice(0, count);
  if (!count || seats.length < count) { draw(); return message("ちょうど席がうまりました。ほかの時間を選んでください。", "warn"); }
  if (s.start <= now()) { closeForm(); draw(); return message("この時間は、もう予約できません。", "warn"); }
  state.busy = true;
  const submit = $("#lh-submit");
  submit.disabled = true;
  try {
    let mine = state.mine;
    if (mine.length >= MAX_RES) {
      const done = mine.find(isDone);
      if (!done) throw Object.assign(new Error("limit"), { code: "limit" });
      await store.cancel({ rid: done.id, slot: done.slot, seats: done.seats });
      mine = mine.filter((r) => r.id !== done.id);
    }
    const uid = store.uid();
    if (!uid) throw Object.assign(new Error("not ready"), { code: "not-ready" });
    await store.book({ rid: freeResId(mine, uid), slotId, seats, name });
    saveName(name);
    closeForm();
    message(`予約しました！ ${dayLabel(s.day)} ${s.hm} に、${LHAKO.place}へ来てください。`, "ok");
    $("#lh-msg").scrollIntoView({ block: "center", behavior: "smooth" });
  } catch (err) {
    console.warn("[lhako]", err?.code ?? err);
    if (err?.code === "limit") message(`予約は${MAX_RES}件までです。いらない予約を取り消してください。`, "warn");
    else if (err?.code === "permission-denied") message("ちょうど、ほかの人が先に予約しました。ほかの時間を選んでください。", "warn");
    else message("予約できませんでした。電波のよい所で、もう一度ためしてください。", "warn");
  }
  state.busy = false;
  submit.disabled = false;
  draw();
});

store.watch({
  seats: (set) => { state.taken = set; state.loaded = true; state.failed = false; draw(); },
  mine: (list) => { state.mine = list; draw(); },
  error: (err) => {
    console.warn("[lhako]", err?.code ?? err);
    if (!state.loaded) { state.failed = true; $("#lh-list").innerHTML = '<li class="lh-empty">いま、予約を読みこめません。電波のよい所で、もう一度開いてください。</li>'; }
  },
});
setInterval(draw, 30000);
drawTabs();
draw();

const sheet = document.querySelector(".mido-full");
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fromSite = document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1;
let gone = false;
const go = () => { if (gone) return; gone = true; fromSite ? history.back() : location.assign("./"); };
function close(e) {
  e?.preventDefault();
  if (calm) return go();
  sheet.classList.add("is-closing");
  sheet.addEventListener("animationend", go, { once: true });
  setTimeout(go, 600);
}
pullDown(sheet, go, { page: true });
document.querySelector(".mido-close").addEventListener("click", close);
addEventListener("keydown", (e) => { if (e.key === "Escape" && !e.target.closest?.("input")) close(e); });
addEventListener("pageshow", () => sheet.classList.remove("is-closing"));
