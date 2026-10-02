// 会場ディスプレイ（signage）の模擬店の画面に出す、小さな地図：ディスプレイの場所（?at=）から、そのお店の教室までの道順を、線が伸びていくようにたどる。
// 図は campus.js（建物の形）と assets/map/rooms.json（部屋の四角）、道順は route.js（校内マップと同じ計算）を使う。
import { BUILDINGS, ROOM_FIX } from "./campus.js";
import { findRoute } from "./route.js";
import { MAP } from "./config.js";

let roomsP = null;
const loadRooms = () => (roomsP ??= fetch("assets/map/rooms.json").then((r) => r.json()).then((j) => j.rooms ?? {}).catch(() => ({})));

// 部屋番号 → 場所（findRoute に渡す形）。四角が取れていない部屋は、名前の位置の点にする
function roomPlace(code, R) {
  const fix = ROOM_FIX[code], r = R[code];
  if (!r && !fix) return null;
  const floor = fix?.floor ?? r.floor, rect = fix?.rect ?? r.rect;
  return rect ? { id: code, code, floor, rect } : r?.label ? { id: code, code, floor, at: r.label, kind: "spot" } : null;
}
// ディスプレイの場所（config.js の SIGNAGE の here）：「いまここ」の目印（MAP.spots）か、部屋番号
function spotPlace(key, R) {
  const sp = MAP.spots.find((s) => s.id === key);
  return sp?.at ? { ...sp, kind: "spot" } : roomPlace(key, R);
}
const center = (p) => (p.at ? p.at : [p.rect[0] + p.rect[2] / 2, p.rect[1] + p.rect[3] / 2]);
const pathD = (pts) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
const len = (pts) => pts.reduce((a, p, i) => a + (i ? Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

function buildingsSvg(floor) {
  const out = [];
  for (const b of BUILDINGS) {
    const f = b[floor];
    if (!f || (f.roof && floor !== "1F")) continue;
    const cls = b.connector ? "bd c" : "bd";
    (f.rects ?? []).forEach(([x, y, w, h]) => out.push(`<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5"/>`));
    if (f.poly) out.push(`<polygon class="${cls}" points="${f.poly.map((p) => p.join(",")).join(" ")}"/>`);
  }
  return out.join("");
}

// fromKey：ディスプレイの場所（here）、toRoom：お店の教室の部屋番号。道順が出せなければ null
export async function routeMap(fromKey, toRoom) {
  const R = await loadRooms();
  const from = spotPlace(fromKey, R), to = roomPlace(toRoom, R);
  if (!from || !to) return null;
  let route = null;
  try { route = findRoute(from, to); } catch (e) { console.warn("[signage-map]", e); }
  if (!route?.legs?.length) return null;
  // 見せる範囲：道順の全体＋余白。入れ物（700×340）の縦横比にそろえる
  const pts = route.legs.flatMap((l) => l.pts);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const AR = 700 / 340, pad = Math.max(70, Math.max(x1 - x0, y1 - y0) * 0.25);
  x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  let w = x1 - x0, h = y1 - y0;
  if (w / h < AR) { const nw = h * AR; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / AR; y0 -= (nh - h) / 2; h = nh; }
  const s = w / 700; // 線の太さなどの基準（図の大きさに合わせる）
  const floors = [...new Set([from.floor ?? "1F", ...route.legs.map((l) => l.floor), to.floor])];
  const [fx, fy] = center(from), [tx, ty] = center(to);
  const groups = floors.map((f) => `<g class="mf" data-f="${f}">${f === "1F" ? "" : buildingsSvg("1F").replace(/class="bd/g, 'class="bd g')}${buildingsSvg(f)}
      ${to.floor === f ? (to.rect ? `<rect class="dest" x="${to.rect[0]}" y="${to.rect[1]}" width="${to.rect[2]}" height="${to.rect[3]}" rx="1.5"/>` : `<circle class="dest" cx="${tx}" cy="${ty}" r="${7 * s}"/>`) : ""}</g>`).join("");
  const legs = route.legs.map((l, i) => `<g class="lg" data-f="${l.floor}" data-i="${i}"><path class="rc" d="${pathD(l.pts)}" stroke-width="${9 * s}"/><path class="rl" d="${pathD(l.pts)}" stroke-width="${5.5 * s}"/></g>`).join("");
  const html = `<svg viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      ${groups}${legs}
      <g class="st" data-f="${from.floor ?? "1F"}"><circle class="ring" cx="${fx}" cy="${fy}" r="${9 * s}" style="--r:${26 * s}px"/><circle class="sp" cx="${fx}" cy="${fy}" r="${7 * s}" stroke-width="${3 * s}"/>
        <text x="${fx + 12 * s}" y="${fy - 11 * s}" font-size="${23 * s}" stroke-width="${6 * s}">いまここ</text></g>
      <circle class="dot" r="${6.5 * s}" stroke-width="${3 * s}" cx="${fx}" cy="${fy}"/>
    </svg><span class="fl">${from.floor ?? "1F"}</span><span class="mn">歩いて約${route.minutes}分</span>`;

  // 線をたどる：階が変わるところは少し止めて、階の表示も切りかえる。終わったら少し見せて、またはじめから
  function play(root) {
    const svg = root.querySelector(".mapbox svg");
    if (!svg) return;
    const fl = root.querySelector(".mapbox .fl"), dot = svg.querySelector(".dot");
    const items = [...svg.querySelectorAll(".lg")].map((g, i) => {
      const d = g.querySelector(".rl"), L = d.getTotalLength();
      g.querySelectorAll("path").forEach((p) => { p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
      return { g, d, L, f: g.dataset.f, len: len(route.legs[i].pts) };
    });
    const total = items.reduce((a, x) => a + x.len, 0) || 1;
    const MOVE = 6200, PAUSE = 700, HOLD = 2600;
    const span = MOVE + PAUSE * (items.length - 1);
    const showFloor = (f) => { svg.querySelectorAll(".mf").forEach((g) => g.classList.toggle("on", g.dataset.f === f)); svg.querySelectorAll(".st").forEach((g) => (g.style.opacity = g.dataset.f === f ? 1 : 0)); if (fl) fl.textContent = f; };
    let t0 = performance.now() + 1000;
    const frame = (now) => {
      if (!svg.isConnected) return;
      let t = now - t0;
      if (t > span + HOLD) { t0 = now + 1200; t = -1; }
      if (t < 0) { items.forEach((x) => { x.g.style.display = "none"; x.d.parentNode.querySelectorAll("path").forEach((p) => (p.style.strokeDashoffset = x.L)); }); showFloor(items[0]?.f ?? "1F"); dot.style.opacity = 0; requestAnimationFrame(frame); return; }
      let acc = 0, cur = null;
      for (let i = 0; i < items.length; i++) {
        const dur = (items[i].len / total) * MOVE, start = acc + PAUSE * i;
        if (t >= start) cur = { i, k: Math.min(1, dur ? (t - start) / dur : 1) };
        acc += dur;
      }
      cur ??= { i: 0, k: 0 };
      items.forEach((x, i) => {
        x.g.style.display = i === cur.i ? "" : "none";
        const e = i === cur.i ? 1 - (1 - cur.k) ** 2 : 0;
        x.g.querySelectorAll("path").forEach((p) => (p.style.strokeDashoffset = x.L * (1 - e)));
      });
      const it = items[cur.i], e = 1 - (1 - cur.k) ** 2, pt = it.d.getPointAtLength(it.L * e);
      showFloor(it.f);
      dot.setAttribute("cx", pt.x); dot.setAttribute("cy", pt.y); dot.style.opacity = 1;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  return { html, play, minutes: route.minutes };
}
