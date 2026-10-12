import { BUILDINGS, ROOM_FIX, SITE } from "./campus.js";
import { MAP } from "./config.js";
import { esc } from "./ai-core.js";

let rooms = null;
let loading = null;
export const loadMiniMap = () => (loading ??= fetch("assets/map/rooms.json").then((r) => r.json()).then((j) => { rooms = j.rooms ?? {}; }).catch(() => { rooms = {}; }));

const bbox = (rects) => {
  const x0 = Math.min(...rects.map((r) => r[0])), y0 = Math.min(...rects.map((r) => r[1]));
  const x1 = Math.max(...rects.map((r) => r[0] + r[2])), y1 = Math.max(...rects.map((r) => r[1] + r[3]));
  return [x0, y0, x1 - x0, y1 - y0];
};

function roomRect(code) {
  const fix = ROOM_FIX[code], r = rooms?.[code];
  const rect = fix?.rect ?? r?.rect;
  return rect ? { floor: fix?.floor ?? r.floor, rects: [rect, ...(fix?.extra ?? [])] } : null;
}

function locate(id) {
  const sp = MAP.spots.find((s) => s.id === id);
  if (sp?.at) return { floor: sp.floor ?? "1F", at: sp.at };
  const a = [...SITE.aed, ...SITE.vending].find((x) => x.id === id);
  if (a) return { floor: a.floor ?? "1F", at: a.at };
  const area = SITE.areas.find((x) => x.id === id);
  if (area) return { floor: "1F", rects: [area.rect ?? bbox(area.poly.map(([x, y]) => [x, y, 0, 0]))] };
  const p = MAP.places.find((x) => x.id === id);
  if (p) {
    const rs = [p.room ?? []].flat().map(roomRect).filter(Boolean);
    const rects = [...(p.area ? [p.area] : rs.flatMap((r) => r.rects)), ...(p.extra ?? [])];
    return rects.length ? { floor: p.floor ?? rs[0]?.floor ?? "1F", rects } : null;
  }
  return roomRect(id);
}

const centerOf = (loc) => {
  if (loc.at) return loc.at;
  const [x, y, w, h] = bbox(loc.rects);
  return [x + w / 2, y + h / 2];
};

function buildingsSvg() {
  const out = [];
  for (const b of BUILDINGS) {
    const f = b["1F"];
    if (!f) continue;
    const cls = b.connector ? "bd c" : "bd";
    (f.rects ?? []).forEach(([x, y, w, h]) => out.push(`<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5"/>`));
    if (f.poly) out.push(`<polygon class="${cls}" points="${f.poly.map((p) => p.join(",")).join(" ")}"/>`);
  }
  return out.join("");
}

function areasSvg() {
  return SITE.areas.map((a) => (a.poly
    ? `<polygon class="ar" points="${a.poly.map((p) => p.join(",")).join(" ")}"/>`
    : a.rect ? `<rect class="ar" x="${a.rect[0]}" y="${a.rect[1]}" width="${a.rect[2]}" height="${a.rect[3]}"/>` : "")).join("");
}

export function miniMapHtml(items) {
  if (!rooms) return "";
  const pins = items.map((it) => ({ ...it, loc: locate(it.id) })).filter((p) => p.loc).map((p) => ({ ...p, c: centerOf(p.loc) }));
  if (!pins.length) return "";
  const ext = pins.map((p) => (p.loc.rects ? bbox(p.loc.rects) : [p.c[0], p.c[1], 0, 0]));
  const xs = ext.flatMap((r) => [r[0], r[0] + r[2]]), ys = ext.flatMap((r) => [r[1], r[1] + r[3]]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const AR = 1.7;
  const pad = Math.max(60, Math.max(x1 - x0, y1 - y0) * 0.2);
  x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  let w = x1 - x0, h = y1 - y0;
  if (w < 280) { x0 -= (280 - w) / 2; w = 280; }
  if (w / h < AR) { const nw = h * AR; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / AR; y0 -= (nh - h) / 2; h = nh; }
  const s = w / 330;
  const marks = pins.map((p, i) => {
    const rects = (p.loc.rects ?? []).map(([x, y, rw, rh]) => `<rect class="dest" x="${x}" y="${y}" width="${rw}" height="${rh}" rx="1.5" stroke-width="${1.6 * s}"/>`).join("");
    const [cx, cy] = p.c;
    return `${rects}<g class="pin"><circle cx="${cx}" cy="${cy}" r="${10 * s}" stroke-width="${2.4 * s}"/><text x="${cx}" y="${cy + 4 * s}" font-size="${13 * s}">${i + 1}</text></g>`;
  }).join("");
  const svg = `<svg viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="地図">${areasSvg()}${buildingsSvg()}${marks}</svg>`;
  const ids = pins.map((p) => p.id);
  const legend = pins.map((p, i) => `<a href="map.html#${encodeURIComponent(p.id)}"><b>${i + 1}</b><span>${esc(p.label)}</span>${p.loc.floor && p.loc.floor !== "1F" ? `<em>${esc(p.loc.floor)}</em>` : ""}<i aria-hidden="true">›</i></a>`).join("");
  const open = ids.length > 1 ? `map.html?pins=${ids.map(encodeURIComponent).join(",")}` : `map.html#${encodeURIComponent(ids[0])}`;
  return `<div class="ai-minimap"><a class="ai-mm-map" href="${open}" aria-label="大きい地図で見る">${svg}<span class="ai-mm-open">大きい地図で見る ›</span></a><div class="ai-mm-list">${legend}</div></div>`;
}
