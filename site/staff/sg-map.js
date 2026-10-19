import { HOME } from "../assets/campus.js";
import { SIGNAGE } from "../assets/config.js";
import { loadMiniMap, locatePoint, baseMapSvg } from "../assets/ai-minimap.js";

const angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const COMPASS = [["北", 270], ["東", 0], ["南", 90], ["西", 180]];

export async function createPicker(root, onChange) {
  await loadMiniMap();
  const [vx, vy, vw, vh] = HOME;
  const spots = Object.entries(SIGNAGE.spots).map(([key, s]) => ({ key, name: s.name, at: locatePoint(s.here) })).filter((s) => s.at);
  const st = { spot: "", place: null, heading: 270, mode: "place" };

  root.innerHTML = `<svg class="sg-svg" viewBox="${vx} ${vy} ${vw} ${vh}" role="img" aria-label="校内の地図。タップして、画面を置く場所を選びます">${baseMapSvg()}<g class="sg-ghosts"></g><g class="sg-me"></g></svg>
    <div class="sg-mapbar">
      <button type="button" data-mode="place" aria-pressed="true">① 場所をえらぶ（地図をタップ）</button>
      <button type="button" data-mode="head" aria-pressed="false">② 見る人の向きをえらぶ</button>
    </div>
    <div class="sg-compass" aria-label="見る人が向いている方向">${COMPASS.map(([t, a]) => `<button type="button" data-head="${a}">${t}</button>`).join("")}<span class="muted small">画面を見る人が、どちらを向いているか（地図の上が北）</span></div>
    <div class="sg-chips">${spots.map((s) => `<button type="button" data-spot="${s.key}">${s.name}</button>`).join("")}</div>
    <p class="muted small" id="sg-where-txt"></p>`;
  const svg = root.querySelector("svg"), me = root.querySelector(".sg-me"), ghosts = root.querySelector(".sg-ghosts"), txt = root.querySelector("#sg-where-txt");

  const draw = () => {
    ghosts.innerHTML = spots.map((s) => `<circle class="sg-ghost${st.spot === s.key ? " is-on" : ""}" cx="${s.at[0]}" cy="${s.at[1]}" r="11"/>`).join("");
    if (!st.place) { me.innerHTML = ""; txt.textContent = "まだ、場所が決まっていません。地図をタップするか、下の「決まった場所」を押してください。"; return; }
    const { x, y } = st.place, a = (st.heading * Math.PI) / 180, L = 78;
    const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L;
    const hx = (k) => x + Math.cos(a + k) * (L - 22), hy = (k) => y + Math.sin(a + k) * (L - 22);
    me.innerHTML = `<line class="sg-arrow" x1="${x}" y1="${y}" x2="${ex}" y2="${ey}"/><polygon class="sg-head" points="${ex},${ey} ${hx(0.5)},${hy(0.5)} ${hx(-0.5)},${hy(-0.5)}"/><circle class="sg-pin" cx="${x}" cy="${y}" r="17"/><text class="sg-pin-t" x="${x}" y="${y + 5}">画</text>`;
    const dir = COMPASS.reduce((b, c) => (angDiff(c[1], st.heading) < angDiff(b[1], st.heading) ? c : b));
    txt.textContent = st.spot ? `「${SIGNAGE.spots[st.spot].name}」（決まった場所。標準の案内文を使います）` : `この場所に置きます。見る人は、ほぼ${dir[0]}を向いています。道案内の矢印は、この向きに合わせて、自動で作ります。`;
  };
  const paintMode = () => root.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === st.mode)));
  const toMap = (e) => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  const emit = () => { draw(); onChange?.({ ...st, place: st.place ? { ...st.place } : null }); };
  let drag = false;
  const aim = (e) => {
    if (!st.place) return;
    const p = toMap(e);
    st.heading = Math.round((Math.atan2(p.y - st.place.y, p.x - st.place.x) * 180) / Math.PI + 360) % 360;
    st.spot = "";
    emit();
  };
  svg.addEventListener("pointerdown", (e) => {
    if (st.mode === "head") { drag = true; svg.setPointerCapture?.(e.pointerId); aim(e); return; }
    const p = toMap(e);
    st.place = { x: Math.round(p.x), y: Math.round(p.y), floor: "1F" };
    st.spot = "";
    st.mode = "head";
    paintMode();
    emit();
  });
  svg.addEventListener("pointermove", (e) => { if (drag) aim(e); });
  svg.addEventListener("pointerup", () => { drag = false; });
  root.addEventListener("click", (e) => {
    const m = e.target.closest("[data-mode]");
    if (m) { st.mode = m.dataset.mode; paintMode(); return; }
    const h = e.target.closest("[data-head]");
    if (h && st.place) { st.heading = Number(h.dataset.head); st.spot = ""; emit(); return; }
    const sp = e.target.closest("[data-spot]");
    if (sp) {
      const s = spots.find((x) => x.key === sp.dataset.spot);
      st.spot = s.key;
      st.place = { x: Math.round(s.at[0]), y: Math.round(s.at[1]), floor: "1F" };
      emit();
    }
  });
  draw();
  return {
    get: () => ({ ...st, place: st.place ? { ...st.place } : null }),
    set: ({ spot = "", place = null, heading = 270 } = {}) => {
      st.spot = spot;
      st.heading = Number.isFinite(Number(heading)) ? Number(heading) : 270;
      st.place = place && typeof place.x === "number" ? { x: place.x, y: place.y, floor: place.floor ?? "1F" }
        : spot && spots.find((x) => x.key === spot) ? { x: spots.find((x) => x.key === spot).at[0], y: spots.find((x) => x.key === spot).at[1], floor: "1F" } : null;
      st.mode = "place";
      paintMode();
      draw();
    },
  };
}
