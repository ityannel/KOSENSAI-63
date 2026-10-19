import { deviceId, listDevices } from "./signage-device.js";

const ID = "kosen63-sg-id";
const params = new URLSearchParams(location.search);
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {  } };

export const needSetup = () => params.has("setup");
let offered = false;
export const offerSetup = (registered) => {
  if (offered || registered || params.has("d") || params.has("at") || params.has("only") || params.has("now")) return;
  offered = true;
  openSetup(90000);
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function openSetup(autoCloseMs = 0) {
  if (document.getElementById("sg-setup")) return;
  const box = document.createElement("div");
  box.id = "sg-setup";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "この画面の場所を選ぶ");
  const cur = { id: get(ID) || deviceId };
  let devices = [];
  const paint = () => {
    const regs = devices.filter((d) => d.name || d.place);
    box.innerHTML = `<div class="ss-card">
      <h1>この画面は、どこに置きますか？</h1>
      <p>設置した場所に合わせて、道案内などが変わります。あとから変えるときは、キーボードの S か、画面の左上を、3回すばやくタップしてください。</p>
      ${regs.length ? `<h2>本部に登録されている画面</h2><div class="ss-list">${regs.map((d) => `<button type="button" data-dev="${esc(d.id)}"${cur.id === d.id ? ' class="is-on"' : ""}><b>${esc(d.name || d.id)}</b><small>${d.place ? "場所・向きが登録済み" : "場所は未設定"}${d.orient === "portrait" ? "・縦" : d.orient === "landscape" ? "・横" : ""}</small></button>`).join("")}</div>` : ""}
      ${regs.length ? "" : '<p class="ss-empty">まだ、本部に登録された画面がありません。本部コンソールの「サイネージ」で、画面を登録してください。登録しなくても、このまま使えます。</p>'}
      <div class="ss-list"><button type="button" data-none><b>場所を決めずに、使う</b><small>道案内のページは出ません</small></button></div>
      <p class="ss-id">この画面のID：<code>${esc(deviceId)}</code>　本部コンソールの「サイネージ」に、このIDで出ます。登録して、地図で場所と向きを決めることもできます。</p>
      <button type="button" class="ss-close" data-close>閉じる</button>
    </div>`;
  };
  const done = (reload) => { clearTimeout(timer); if (reload) location.replace(new URL(location.pathname + location.search.replace(/[?&]setup=1/, "").replace(/^&/, "?"), location.href).href); else box.remove(); };
  box.addEventListener("click", (e) => {
    const dev = e.target.closest("[data-dev]");
    if (dev) { put(ID, dev.dataset.dev); done(true); return; }
    if (e.target.closest("[data-none]")) { done(false); return; }
    if (e.target.closest("[data-close]")) { clearTimeout(timer); box.remove(); }
  });
  const timer = autoCloseMs ? setTimeout(() => box.remove(), autoCloseMs) : 0;
  document.body.append(box);
  paint();
  listDevices((list) => { devices = list; if (box.isConnected) paint(); });
}

let taps = [];
export function wireSetupTriggers() {
  addEventListener("keydown", (e) => { if ((e.key === "s" || e.key === "S") && !e.ctrlKey && !e.metaKey) openSetup(); });
  addEventListener("pointerdown", (e) => {
    if (e.clientX > innerWidth * 0.12 || e.clientY > innerHeight * 0.18) { taps = []; return; }
    const now = Date.now();
    taps = [...taps.filter((t) => now - t < 1500), now];
    if (taps.length >= 3) { taps = []; openSetup(); }
  });
}
