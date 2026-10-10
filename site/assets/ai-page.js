import { STAGE, EVENTS, VENUES } from "./config.js";

const $ = (s) => document.querySelector(s);
const API = ["localhost", "127.0.0.1"].includes(location.hostname) || location.hostname.endsWith("pages.dev") ? "" : "https://hakodate-kosensai.pages.dev";
const mock = ["localhost", "127.0.0.1"].includes(location.hostname) && new URLSearchParams(location.search).has("mock");

const log = $("#ai-log"), form = $("#ai-form"), box = $("#ai-q"), send = $("#ai-send"), chips = $("#ai-chips");
const history = [];
let busy = false;

const hm = (iso) => new Date(iso).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
const day = (iso) => new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" });
const venue = (id) => VENUES.find((v) => v.id === id)?.name ?? id;

function liveInfo() {
  const now = new Date();
  const items = [
    ...STAGE.acts.map((a) => ({ n: a.name, d: day(a.start), t: `${hm(a.start)}〜${hm(a.end)}`, w: venue(STAGE.venue), k: a.kind ?? "ステージ" })),
    ...EVENTS.filter((e) => !e.stage).map((e) => ({ n: e.title, d: day(e.start), t: `${hm(e.start)}〜${hm(e.end)}`, w: venue(e.venue), k: e.kind ?? "企画" })),
  ];
  return { now: now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }), schedule: items.slice(0, 60) };
}

function add(role, text, extra = "") {
  const el = document.createElement("div");
  el.className = `ai-msg is-${role}${extra}`;
  el.textContent = text;
  if (role === "ai" && !extra) el.insertAdjacentHTML("beforeend", "<small>AIの返事です。まちがうことがあります。</small>");
  log.append(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

async function ask(q) {
  if (busy || !q.trim()) return;
  busy = true; send.disabled = true;
  chips.hidden = true;
  add("user", q);
  history.push({ role: "user", text: q });
  const wait = add("ai", "……ちょっと待ってな。", " is-wait");
  try {
    let text;
    if (mock) {
      await new Promise((r) => setTimeout(r, 600));
      text = "おう、これは見た目を確かめるための、ニセの返事だぜ。";
    } else {
      const res = await fetch(`${API}/api/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history.slice(-8), live: liveInfo() }) });
      if (res.status === 429) throw new Error("rate");
      if (!res.ok) throw new Error("fail");
      text = (await res.json()).text;
    }
    wait.remove();
    add("ai", text);
    history.push({ role: "ai", text });
  } catch (e) {
    wait.remove();
    add("ai", e.message === "rate" ? "すまねえ、今ちょっと混み合ってるぜ。少し待ってから、また聞いてくれ。" : "すまねえ、うまくつながらなかった。電波のいい所で、もう一度頼む。急ぎなら、近くのスタッフか本部へ。", " is-wait");
  } finally {
    busy = false; send.disabled = false; box.focus();
  }
}

add("ai", "おう、いらっしゃい！ 高専祭のことなら、任せとけ。何が知りてえ？");
for (const q of ["いまやってるステージは？", "トイレはどこ？", "おすすめの食べ物は？", "車で行ってもいい？", "Is there anything in English?"]) {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = q;
  b.addEventListener("click", () => ask(q));
  chips.append(b);
}
form.addEventListener("submit", (e) => { e.preventDefault(); const q = box.value.trim(); box.value = ""; box.style.height = ""; ask(q); });
box.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
box.addEventListener("input", () => { box.style.height = "auto"; box.style.height = `${Math.min(box.scrollHeight, 110)}px`; });
