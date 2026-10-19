import { HOME } from "../assets/campus.js";
import { SIGNAGE } from "../assets/config.js";
import { loadMiniMap, locatePoint, baseMapSvg } from "../assets/ai-minimap.js";

const angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const COMPASS = [["北", 270], ["東", 0], ["南", 90], ["西", 180]];
const norm = (a) => ((Math.round(a) % 360) + 360) % 360;

export async function createPicker(root, onChange) {
  await loadMiniMap();
  const [hx, hy, hw, hh] = HOME;
  const spots = Object.entries(SIGNAGE.spots).map(([key, s]) => ({ key, name: s.name, at: locatePoint(s.here) })).filter((s) => s.at);
  const st = { spot: "", place: null, heading: 270 };
  let view = { x: hx, y: hy, w: hw, h: hh };

  root.innerHTML = `<div class="sg-mapwrap"><svg class="sg-svg" tabindex="0" role="application" aria-label="校内の地図。画面の板を、動かしたり、まわしたりできます">${baseMapSvg()}<g class="sg-ghosts"></g><g class="sg-board"></g></svg>
      <div class="sg-zoom"><button type="button" data-z="in" aria-label="拡大">＋</button><button type="button" data-z="out" aria-label="縮小">－</button><button type="button" data-z="all" aria-label="全体">全体</button></div></div>
    <p class="muted small sg-hint">板（画面）を、ドラッグで動かします。○をドラッグすると、まわせます（Shiftで15度ずつ）。地図の何もない所をクリックすると、板がそこへ動きます。ホイールで拡大・縮小、地図をドラッグで移動。</p>
    <div class="sg-compass" aria-label="見る人が向いている方向"><span class="muted small">見る人の向き：</span>${COMPASS.map(([t, a]) => `<button type="button" data-head="${a}">${t}</button>`).join("")}<button type="button" data-head="-1" aria-label="左に15度">⟲15°</button><button type="button" data-head="+1" aria-label="右に15度">⟳15°</button></div>
    <div class="sg-chips"><span class="muted small">決まった場所：</span>${spots.map((s) => `<button type="button" data-spot="${s.key}">${s.name}</button>`).join("")}<button type="button" data-clear class="is-ghost">置かない</button></div>
    <p class="muted small" id="sg-where-txt"></p>`;
  const svg = root.querySelector("svg"), boardG = root.querySelector(".sg-board"), ghosts = root.querySelector(".sg-ghosts"), txt = root.querySelector("#sg-where-txt");

  const applyView = () => svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
  const scale = () => (view.w / hw) * 1.25 + 0.15;
  const toMap = (e) => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  const emit = () => { draw(); onChange?.(api.get()); };

  function draw() {
    ghosts.innerHTML = spots.map((s) => `<circle class="sg-ghost${st.spot === s.key ? " is-on" : ""}" cx="${s.at[0]}" cy="${s.at[1]}" r="${10 * scale()}"/>`).join("");
    if (!st.place) {
      boardG.innerHTML = "";
      txt.textContent = "まだ、板が置かれていません。地図をクリックするか、「決まった場所」を押してください。";
      return;
    }
    const s = scale(), th = st.heading - 270;
    boardG.innerHTML = `<g transform="translate(${st.place.x} ${st.place.y}) rotate(${th}) scale(${s})">
        <polygon class="sg-cone" points="0,10 -62,96 62,96"/>
        <line class="sg-gaze" x1="0" y1="82" x2="0" y2="26"/><polygon class="sg-gazehead" points="0,18 -9,34 9,34"/>
        <rect class="sg-hit" x="-44" y="-16" width="88" height="34" data-body/>
        <rect class="sg-board-r" x="-36" y="-8" width="72" height="14" rx="3"/>
        <rect class="sg-face" x="-36" y="3" width="72" height="3" rx="1.5"/>
        <line class="sg-stalk" x1="0" y1="-8" x2="0" y2="-44"/>
        <circle class="sg-rot" cx="0" cy="-52" r="10" data-rot/><text class="sg-rot-t" x="0" y="-47">↻</text>
      </g>`;
    const dir = COMPASS.reduce((b, c) => (angDiff(c[1], st.heading) < angDiff(b[1], st.heading) ? c : b));
    txt.textContent = st.spot
      ? `「${SIGNAGE.spots[st.spot].name}」（決まった場所。標準の案内文を使います）`
      : `見る人は、ほぼ${dir[0]}を向いています（${norm(st.heading)}度）。道案内の矢印は、この向きに合わせて、自動で作ります。`;
  }

  let drag = null;
  svg.addEventListener("pointerdown", (e) => {
    const p = toMap(e);
    svg.focus({ preventScroll: true });
    svg.setPointerCapture?.(e.pointerId);
    if (e.target.closest("[data-rot]")) { drag = { kind: "rot" }; return; }
    if (e.target.closest("[data-body]") && st.place) { drag = { kind: "move", dx: st.place.x - p.x, dy: st.place.y - p.y }; return; }
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
      st.spot = "";
      emit();
    } else if (drag.kind === "move" && st.place) {
      const p = toMap(e);
      st.place = { x: Math.round(p.x + drag.dx), y: Math.round(p.y + drag.dy), floor: "1F" };
      st.spot = "";
      emit();
    } else if (drag.kind === "bg") {
      const r = svg.getBoundingClientRect(), k = view.w / r.width;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      if (drag.moved) { view = { ...view, x: drag.vx - dx * k, y: drag.vy - dy * k }; applyView(); }
    }
  });
  svg.addEventListener("pointerup", (e) => {
    if (drag?.kind === "bg" && !drag.moved) {
      st.place = { x: Math.round(drag.mx), y: Math.round(drag.my), floor: "1F" };
      st.spot = "";
      emit();
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
    if (m) { e.preventDefault(); st.place = { ...st.place, x: st.place.x + m[0], y: st.place.y + m[1] }; st.spot = ""; emit(); }
    else if (e.key === "[" || e.key === "]") { st.heading = norm(st.heading + (e.key === "]" ? 5 : -5)); st.spot = ""; emit(); }
  });

  root.addEventListener("click", (e) => {
    const z = e.target.closest("[data-z]");
    if (z) {
      if (z.dataset.z === "all") { view = { x: hx, y: hy, w: hw, h: hh }; applyView(); draw(); } else zoomAt(z.dataset.z === "in" ? 0.7 : 1 / 0.7);
      return;
    }
    const h = e.target.closest("[data-head]");
    if (h) {
      if (!st.place) return;
      const v = h.dataset.head;
      st.heading = v === "+1" ? norm(st.heading + 15) : v === "-1" ? norm(st.heading - 15) : Number(v);
      st.spot = "";
      emit();
      return;
    }
    const sp = e.target.closest("[data-spot]");
    if (sp) {
      const s = spots.find((x) => x.key === sp.dataset.spot);
      st.spot = s.key;
      st.place = { x: Math.round(s.at[0]), y: Math.round(s.at[1]), floor: "1F" };
      view = { ...view, x: s.at[0] - view.w / 2, y: s.at[1] - view.h / 2 };
      applyView();
      emit();
      return;
    }
    if (e.target.closest("[data-clear]")) { st.spot = ""; st.place = null; emit(); }
  });

  const api = {
    get: () => ({ spot: st.spot, place: st.place ? { ...st.place } : null, heading: st.heading }),
    set: ({ spot = "", place = null, heading = 270 } = {}) => {
      st.spot = spot;
      st.heading = Number.isFinite(Number(heading)) ? norm(Number(heading)) : 270;
      const sp = spot ? spots.find((x) => x.key === spot) : null;
      st.place = place && typeof place.x === "number" ? { x: place.x, y: place.y, floor: place.floor ?? "1F" } : sp ? { x: Math.round(sp.at[0]), y: Math.round(sp.at[1]), floor: "1F" } : null;
      view = st.place ? { x: st.place.x - hw / 2, y: st.place.y - hh / 2, w: hw, h: hh } : { x: hx, y: hy, w: hw, h: hh };
      applyView();
      draw();
    },
  };
  applyView();
  draw();
  return api;
}
