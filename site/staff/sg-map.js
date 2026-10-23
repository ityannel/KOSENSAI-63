import { HOME } from "../assets/campus.js";
import { loadMiniMap, baseMapSvg } from "../assets/ai-minimap.js";

const angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const COMPASS = [["北", 270], ["東", 0], ["南", 90], ["西", 180]];
const norm = (a) => ((Math.round(a) % 360) + 360) % 360;
const toDeg = (h) => norm(h + 90);
const fromDeg = (d) => norm(d - 90);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export async function createPicker(root, { onSelect } = {}) {
  await loadMiniMap();
  const [hx, hy, hw, hh] = HOME;
  const st = { id: null, name: "", place: null, heading: 270 };
  let others = [];
  let view = { x: hx, y: hy, w: hw, h: hh };

  root.innerHTML = `<div class="sg-mapwrap"><svg class="sg-svg" tabindex="0" role="application" aria-label="校内の地図。すべての画面の場所が出ます。選んだ画面の板は、動かしたり、まわしたりできます">${baseMapSvg()}<g class="sg-others"></g><g class="sg-board"></g></svg>
      <div class="sg-zoom"><button type="button" data-z="in" aria-label="拡大">＋</button><button type="button" data-z="out" aria-label="縮小">－</button><button type="button" data-z="all" aria-label="全体">全体</button></div></div>
    <div class="sg-tray" id="sg-tray"></div>
    <div class="sg-compass" aria-label="見る人が向いている方向"><b id="sg-active-name"></b><span class="muted small">見る人の向き：</span>${COMPASS.map(([t, a]) => `<button type="button" data-head="${a}">${t}</button>`).join("")}<button type="button" data-head="-1" aria-label="左に15度">⟲15°</button><button type="button" data-head="+1" aria-label="右に15度">⟳15°</button>
      <label class="sg-deg">北から時計まわりに <input type="number" id="sg-deg" min="0" max="359" step="1" inputmode="numeric"> 度</label><button type="button" data-clear class="is-ghost">板を片づける</button></div>
    <p class="muted small sg-hint">板を、ドラッグで動かします。○をドラッグすると、まわせます（Shiftで15度ずつ）。何もない所をクリックすると、板がそこへ動きます。ほかの画面の板を押すと、その画面を選べます。ホイールで拡大・縮小、地図をドラッグで移動。</p>
    <p class="muted small" id="sg-where-txt"></p>`;
  const svg = root.querySelector("svg"), boardG = root.querySelector(".sg-board"), othersG = root.querySelector(".sg-others"), txt = root.querySelector("#sg-where-txt");
  const tray = root.querySelector("#sg-tray"), deg = root.querySelector("#sg-deg"), actName = root.querySelector("#sg-active-name");

  const applyView = () => svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
  const scale = () => (view.w / hw) * 1.25 + 0.15;
  const toMap = (e) => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };

  function boardSvg(p, heading, s, act, label, live) {
    return `<g transform="translate(${p.x} ${p.y}) rotate(${heading - 270}) scale(${s})">
        <polygon class="sg-cone" points="0,10 -62,96 62,96"/>
        <line class="sg-gaze" x1="0" y1="82" x2="0" y2="26"/><polygon class="sg-gazehead" points="0,18 -9,34 9,34"/>
        <rect class="sg-hit" x="-44" y="-16" width="88" height="34" ${act ? "data-body" : ""}/>
        <rect class="sg-board-r${act ? " is-act" : ""}" x="-36" y="-8" width="72" height="14" rx="3"/>
        <rect class="sg-face" x="-36" y="3" width="72" height="3" rx="1.5"/>
        ${act ? '<line class="sg-stalk" x1="0" y1="-8" x2="0" y2="-44"/><circle class="sg-rot" cx="0" cy="-52" r="10" data-rot/><text class="sg-rot-t" x="0" y="-47">↻</text>' : ""}
      </g>
      <text class="sg-lbl${act ? " is-act" : ""}" x="${p.x}" y="${p.y - 30 * s}" font-size="${13 * s}">${live ? "● " : ""}${esc(label)}</text>`;
  }

  function draw() {
    const s = scale();
    othersG.innerHTML = others.filter((o) => o.id !== st.id && o.place).map((o) => `<g class="sg-other" data-pick="${esc(o.id)}">${boardSvg(o.place, o.heading, s * 0.8, false, o.name || o.id, o.live)}</g>`).join("");
    const unplaced = others.filter((o) => !o.place && o.id !== st.id);
    tray.innerHTML = unplaced.length ? `<span class="muted small">まだ地図に置いていない画面：</span>${unplaced.map((o) => `<button type="button" data-put="${esc(o.id)}">${esc(o.name || o.id)}</button>`).join("")}` : "";
    actName.textContent = st.id ? `「${st.name || st.id}」` : "";
    if (!st.id) {
      boardG.innerHTML = "";
      deg.value = ""; deg.disabled = true;
      txt.textContent = "画面を選ぶと、ここで場所と向きを決められます。地図の板や、上の一覧から、選んでください。";
      return;
    }
    deg.disabled = false;
    if (!st.place) {
      boardG.innerHTML = "";
      deg.value = "";
      txt.textContent = "この画面は、まだ地図に置かれていません。地図をクリックして、板を置いてください。";
      return;
    }
    boardG.innerHTML = boardSvg(st.place, st.heading, s, true, st.name || st.id, false);
    if (document.activeElement !== deg) deg.value = toDeg(st.heading);
    const dir = COMPASS.reduce((b, c) => (angDiff(c[1], st.heading) < angDiff(b[1], st.heading) ? c : b));
    txt.textContent = `見る人は、ほぼ${dir[0]}を向いています（北から${toDeg(st.heading)}度）。道案内の矢印は、この向きに合わせて、自動で作ります。`;
  }

  let drag = null;
  svg.addEventListener("pointerdown", (e) => {
    const p = toMap(e);
    svg.focus({ preventScroll: true });
    svg.setPointerCapture?.(e.pointerId);
    if (e.target.closest("[data-rot]") && st.id) { drag = { kind: "rot" }; return; }
    if (e.target.closest("[data-body]") && st.place) { drag = { kind: "move", dx: st.place.x - p.x, dy: st.place.y - p.y }; return; }
    const pk = e.target.closest("[data-pick]");
    if (pk) { drag = { kind: "pick", id: pk.dataset.pick }; return; }
    drag = { kind: "bg", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false, mx: p.x, my: p.y };
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (drag.kind === "rot" && st.place) {
      const p = toMap(e);
      let a = (Math.atan2(p.y - st.place.y, p.x - st.place.x) * 180) / Math.PI;
      if (e.shiftKey) a = Math.round(a / 15) * 15;
      else for (const c of [0, 90, 180, 270, 360]) if (angDiff(a, c) < 4) a = c;
      st.heading = norm(a);
      draw();
    } else if (drag.kind === "move" && st.place) {
      const p = toMap(e);
      st.place = { x: Math.round(p.x + drag.dx), y: Math.round(p.y + drag.dy), floor: "1F" };
      draw();
    } else if (drag.kind === "bg") {
      const r = svg.getBoundingClientRect(), k = view.w / r.width;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      if (drag.moved) { view = { ...view, x: drag.vx - dx * k, y: drag.vy - dy * k }; applyView(); }
    }
  });
  svg.addEventListener("pointerup", (e) => {
    if (drag?.kind === "pick") onSelect?.(drag.id);
    else if (drag?.kind === "bg" && !drag.moved && st.id) {
      st.place = { x: Math.round(drag.mx), y: Math.round(drag.my), floor: "1F" };
      draw();
    }
    drag = null;
    svg.releasePointerCapture?.(e.pointerId);
  });
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomAt(e.deltaY < 0 ? 0.85 : 1 / 0.85, toMap(e));
  }, { passive: false });
  function zoomAt(f, c = { x: view.x + view.w / 2, y: view.y + view.h / 2 }) {
    const w = Math.max(160, Math.min(hw * 1.6, view.w * f)), h = w * (hh / hw);
    view = { x: c.x - ((c.x - view.x) / view.w) * w, y: c.y - ((c.y - view.y) / view.h) * h, w, h };
    applyView();
    draw();
  }
  svg.addEventListener("keydown", (e) => {
    if (!st.place) return;
    const step = e.shiftKey ? 10 : 2;
    const m = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (m) { e.preventDefault(); st.place = { ...st.place, x: st.place.x + m[0], y: st.place.y + m[1] }; draw(); }
    else if (e.key === "[" || e.key === "]") { st.heading = norm(st.heading + (e.key === "]" ? 5 : -5)); draw(); }
  });
  deg.addEventListener("input", () => {
    if (!st.place || deg.value === "") return;
    st.heading = fromDeg(Number(deg.value) || 0);
    draw();
  });

  root.addEventListener("click", (e) => {
    const z = e.target.closest("[data-z]");
    if (z) {
      if (z.dataset.z === "all") { view = { x: hx, y: hy, w: hw, h: hh }; applyView(); draw(); } else zoomAt(z.dataset.z === "in" ? 0.7 : 1 / 0.7);
      return;
    }
    const put = e.target.closest("[data-put]");
    if (put) { onSelect?.(put.dataset.put, true); return; }
    const h = e.target.closest("[data-head]");
    if (h) {
      if (!st.place) return;
      const v = h.dataset.head;
      st.heading = v === "+1" ? norm(st.heading + 15) : v === "-1" ? norm(st.heading - 15) : Number(v);
      draw();
      return;
    }
    if (e.target.closest("[data-clear]") && st.id) { st.place = null; draw(); }
  });

  const api = {
    get: () => ({ place: st.place ? { ...st.place } : null, heading: st.heading }),
    setDevices: (list) => { others = list; draw(); },
    setName: (name) => { st.name = name; draw(); },
    placeCenter: () => {
      if (!st.id || st.place) return;
      st.place = { x: Math.round(view.x + view.w / 2), y: Math.round(view.y + view.h / 2), floor: "1F" };
      draw();
    },
    setActive: (id, { name = "", place = null, heading = 270 } = {}) => {
      st.id = id;
      st.name = name;
      st.heading = Number.isFinite(Number(heading)) ? norm(Number(heading)) : 270;
      st.place = place && typeof place.x === "number" ? { x: place.x, y: place.y, floor: place.floor ?? "1F" } : null;
      view = st.place ? { x: st.place.x - hw / 2, y: st.place.y - hh / 2, w: hw, h: hh } : { x: hx, y: hy, w: hw, h: hh };
      applyView();
      draw();
    },
  };
  applyView();
  draw();
  return api;
}
