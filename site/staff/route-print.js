import { BUILDINGS, SITE, ROOM_FIX, ROOM_NAMES, NORTH, FLOORS, LINKS } from "../assets/campus.js";
import { findRoute, describe, centerOf, buildingAt } from "../assets/route.js";
import { MAP, SHOPS, HOMEROOMS, FESTIVAL } from "../assets/config.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const n1 = (v) => Math.round(v * 10) / 10;
const bbox = (rects) => {
  const x0 = Math.min(...rects.map((r) => r[0])), y0 = Math.min(...rects.map((r) => r[1]));
  const x1 = Math.max(...rects.map((r) => r[0] + r[2])), y1 = Math.max(...rects.map((r) => r[1] + r[3]));
  return [x0, y0, x1 - x0, y1 - y0];
};
const polyBox = (poly) => bbox(poly.map(([x, y]) => [x, y, 0, 0]));
const floorNo = (f) => `${parseInt(f)}階`;

let roomsP = null;
const loadRooms = () => (roomsP ??= fetch(new URL("../assets/map/rooms.json", import.meta.url)).then((r) => r.json()).then((j) => j.rooms ?? {}));

const TOILET = [[/多目的WC|HCWC/, "toilet-hc", "多目的トイレ"], [/WC男/, "toilet-m", "男子トイレ"], [/WC女/, "toilet-f", "女子トイレ"], [/WC/, "toilet", "トイレ"]];
const GROUP_OF = { venue: "会場", exhibit: "学科展示", hq: "本部", room: "そのほか" };
export const GROUPS = ["本部", "会場", "学科展示", "模擬店", "そのほか", "トイレ", "出入口・屋外"];

function roomOf(code, R) {
  const fix = ROOM_FIX[code], r = R[code];
  const rect = fix?.rect ?? r?.rect;
  if (!rect) return null;
  const rects = [rect, ...(fix?.extra ?? [])];
  return { code, floor: fix?.floor ?? r.floor, rect: bbox(rects), rects, name: ROOM_NAMES[code] ?? code };
}
export const whereOf = (p) => {
  if (p.outdoor || p.kind === "spot") return p.sub || "屋外";
  const b = buildingAt(p.floor, centerOf(p));
  return b && !b.connector ? `${b.name} ${floorNo(p.floor)}` : floorNo(p.floor);
};

let CAT = null;
export async function catalog() {
  if (CAT) return CAT;
  const R = await loadRooms();
  const list = [];
  const byId = new Map();
  const add = (p) => { list.push(p); byId.set(p.id, p); };
  for (const p of MAP.places) {
    if (p.kind === "shops") continue;
    const rs = [p.room ?? []].flat().map((c) => roomOf(c, R)).filter(Boolean);
    const rects = [...(p.area ? [p.area] : rs.flatMap((r) => r.rects)), ...(p.extra ?? [])];
    if (!rects.length) continue;
    add({ id: p.id, group: GROUP_OF[p.kind] ?? "会場", name: p.name, sub: p.sub ?? "", floor: p.floor ?? rs[0].floor, rect: bbox(rects), rects, labelRect: p.labelRect });
  }
  const placeGeo = (id) => {
    const p = MAP.places.find((x) => x.id === id);
    if (!p) return null;
    const rs = [p.room ?? []].flat().map((c) => roomOf(c, R)).filter(Boolean);
    const rects = [...(p.area ? [p.area] : rs.flatMap((r) => r.rects)), ...(p.extra ?? [])];
    return rects.length ? { floor: p.floor ?? rs[0]?.floor ?? "1F", rect: bbox(rects), rects } : null;
  };
  SHOPS.forEach((s, i) => {
    const code = s.room ?? HOMEROOMS[s.cls];
    const geo = s.place ? placeGeo(s.place) : code ? roomOf(code, R) : null;
    if (!geo) return;
    add({ id: `shop-${i}`, group: "模擬店", name: String(s.name).replace(/\n/g, " "), sub: s.group ?? "", floor: geo.floor, rect: geo.rect, rects: geo.rects ?? [geo.rect] });
  });
  const codes = new Set([...Object.keys(R), ...Object.keys(ROOM_FIX)]);
  for (const code of codes) {
    const name = ROOM_NAMES[code] ?? "";
    const t = TOILET.find(([re]) => re.test(name));
    const r = t && roomOf(code, R);
    if (r) add({ id: `wc-${code}`, group: "トイレ", toilet: t[1], name: t[2], sub: code, floor: r.floor, rect: r.rect, rects: r.rects, small: true });
  }
  for (const sp of MAP.spots) add({ id: sp.id, group: "出入口・屋外", kind: "spot", name: sp.name, sub: "", floor: sp.floor ?? "1F", at: sp.at });
  for (const a of SITE.areas) add({ id: a.id, group: "出入口・屋外", outdoor: true, name: a.name, sub: a.sub ?? "", floor: "1F", rect: a.rect ?? polyBox(a.poly), poly: a.poly, small: true });
  add({ id: "@wc", group: "トイレ", name: "いちばん近いトイレ", nearest: ["toilet-m", "toilet-f", "toilet", "toilet-hc"], virtual: true });
  add({ id: "@wc-hc", group: "トイレ", name: "いちばん近い多目的トイレ", nearest: ["toilet-hc"], virtual: true });
  let no = 0;
  for (const f of FLOORS) {
    list.filter((p) => !p.virtual && !p.small && p.group !== "出入口・屋外" && p.floor === f)
      .sort((x, y) => GROUPS.indexOf(x.group) - GROUPS.indexOf(y.group) || centerOf(x)[0] - centerOf(y)[0])
      .forEach((p) => { p.no = ++no; });
  }
  CAT = { list, byId };
  return CAT;
}

function bestRoute(from, to, opts) {
  const split = (p) => (p.rects?.length > 1 ? p.rects.map((r) => ({ ...p, rect: r, labelRect: r })) : [p]);
  let best = null;
  for (const a of split(from)) for (const b of split(to)) {
    let r = null;
    try { r = findRoute(a, b, opts); } catch (e) { console.warn("[route-print]", e); }
    if (r && (!best || r.cost < best.cost)) best = r;
  }
  return best;
}
export async function planRoute(fromId, toId, { noStairs = false } = {}) {
  const { list, byId } = await catalog();
  const from = byId.get(fromId);
  let to = byId.get(toId);
  if (!from || !to) return null;
  const opts = noStairs ? { noStairs: true } : {};
  let route = null;
  if (to.virtual) {
    for (const t of list.filter((p) => to.nearest.includes(p.toilet))) {
      const r = bestRoute(from, t, opts);
      if (r && (!route || r.cost < route.cost)) { route = r; to = t; }
    }
  } else {
    route = bestRoute(from, to, opts);
  }
  if (!route) return null;
  const steps = describe(route, { from: from.name, to: to.name });
  return { from, to, route, steps };
}

function frame(pts, ar, minW, padMin = 40) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = Math.max(padMin, Math.max(x1 - x0, y1 - y0) * (padMin < 40 ? 0.02 : 0.18));
  x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  let w = x1 - x0, h = y1 - y0;
  if (w < minW) { x0 -= (minW - w) / 2; w = minW; }
  if (w / h < ar) { const nw = h * ar; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / ar; y0 -= (nh - h) / 2; h = nh; }
  return [x0, y0, w, h];
}
const rectSvg = ([x, y, w, h], cls, extra = "") => `<rect class="${cls}" x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}"${extra}/>`;
const polySvg = (poly, cls) => `<polygon class="${cls}" points="${poly.map((p) => p.map(n1).join(",")).join(" ")}"/>`;
const pathD = (pts) => pts.map(([x, y], i) => `${i ? "L" : "M"}${n1(x)} ${n1(y)}`).join(" ");

async function baseLayer(floor, u) {
  const R = await loadRooms();
  const out = [];
  if (floor === "1F") {
    for (const a of SITE.areas) out.push(a.poly ? polySvg(a.poly, "rp-area") : rectSvg(a.rect, "rp-area"));
  } else {
    for (const b of BUILDINGS) for (const r of b["1F"]?.rects ?? []) out.push(rectSvg(r, "rp-ghost"));
  }
  for (const b of BUILDINGS) {
    const f = b[floor];
    if (!f || (f.roof && floor !== "1F")) continue;
    for (const r of f.rects ?? []) out.push(rectSvg(r, b.connector ? "rp-bd rp-conn" : "rp-bd"));
    if (f.poly) out.push(polySvg(f.poly, b.connector ? "rp-bd rp-conn" : "rp-bd"));
  }
  for (const [code, r] of Object.entries(R)) {
    const fix = ROOM_FIX[code];
    if ((fix?.floor ?? r.floor) !== floor) continue;
    const rect = fix?.rect ?? r.rect;
    if (rect) out.push(rectSvg(rect, /WC/.test(ROOM_NAMES[code] ?? "") ? "rp-rm rp-wc" : "rp-rm"));
  }
  if (floor === "1F") {
    for (const a of SITE.areas) {
      const c = a.label ?? (a.rect ? [a.rect[0] + a.rect[2] / 2, a.rect[1] + a.rect[3] / 2] : null);
      if (c) out.push(`<text class="rp-alabel" x="${n1(c[0])}" y="${n1(c[1])}" font-size="${n1(2.6 * u)}">${esc(a.name)}</text>`);
    }
  }
  for (const b of BUILDINGS) {
    if (!b.name || b.connector || !b.label || !b[floor] || (b[floor].roof && floor !== "1F")) continue;
    out.push(`<text class="rp-blabel" x="${n1(b.label[0])}" y="${n1(b.label[1])}" font-size="${n1(3.4 * u)}" stroke-width="${n1(0.9 * u)}">${esc(b.name)}</text>`);
  }
  for (const l of LINKS) {
    const at = l.at[floor];
    if (at && l.kind === "ev") out.push(`<text class="rp-ev" x="${n1(at[0])}" y="${n1(at[1])}" font-size="${n1(2.2 * u)}" stroke-width="${n1(0.7 * u)}">EV</text>`);
  }
  return out.join("");
}
const compass = (x, y, u) => `<g class="rp-compass" transform="translate(${n1(x)} ${n1(y)}) rotate(${NORTH})"><circle r="${n1(5 * u)}"/><path d="M0 ${n1(-4.2 * u)}L${n1(1.8 * u)} ${n1(1.6 * u)}L0 ${n1(0.6 * u)}L${n1(-1.8 * u)} ${n1(1.6 * u)}Z"/><text y="${n1(-5.8 * u)}" font-size="${n1(3 * u)}" transform="rotate(${-NORTH} 0 ${n1(-6.6 * u)})">北</text></g>`;
const marker = ([x, y], label, u, cls = "") => `<g class="rp-mk ${cls}"><circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(2.7 * u)}" stroke-width="${n1(0.45 * u)}"/><text x="${n1(x)}" y="${n1(y)}" font-size="${n1((String(label).length > 2 ? 2.4 : 3) * u)}">${esc(label)}</text></g>`;
const hatch = () => `fill="url(#rp-hatch-${hatchNo})"`;
const destShape = (p, u) => (p.at
  ? `<circle class="rp-dest" ${hatch()} cx="${n1(p.at[0])}" cy="${n1(p.at[1])}" r="${n1(3 * u)}" stroke-width="${n1(0.6 * u)}"/>`
  : (p.rects ?? [p.rect]).map((r) => rectSvg(r, "rp-dest", ` ${hatch()} stroke-width="${n1(0.6 * u)}"`)).join(""));

let hatchNo = 0;
const PATTERN = (u) => `<defs><pattern id="rp-hatch-${++hatchNo}" width="${n1(1.6 * u)}" height="${n1(1.6 * u)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${n1(0.7 * u)}" height="${n1(1.6 * u)}" fill="#000"/></pattern></defs>`;

async function routeFloorSvg(plan, floor, mmW, mmH, stepNo) {
  const legs = plan.route.legs.filter((l) => l.floor === floor);
  const pts = legs.flatMap((l) => l.pts);
  if (plan.to.floor === floor) pts.push(centerOf(plan.to));
  const [x0, y0, w, h] = frame(pts, mmW / mmH, 180);
  const u = w / mmW;
  const lines = legs.map((l) => `<path class="rp-case" d="${pathD(l.pts)}" stroke-width="${n1(3.4 * u)}"/><path class="rp-line" d="${pathD(l.pts)}" stroke-width="${n1(1.5 * u)}"/>`).join("");
  const marks = plan.steps.map((s, i) => (s.floor === floor && s.at ? marker(s.at, stepNo[i], u, s.icon === "goal" ? "is-goal" : s.icon === "start" ? "is-start" : "") : "")).join("");
  return `<svg class="rp-map" viewBox="${n1(x0)} ${n1(y0)} ${n1(w)} ${n1(h)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${floorNo(floor)}の地図">${PATTERN(u)}
    ${await baseLayer(floor, u)}${plan.to.floor === floor ? destShape(plan.to, u) : ""}${lines}${marks}${compass(x0 + w - 8 * u, y0 + 9 * u, u)}</svg>`;
}

const ICON_WORD = { start: "出発", goal: "到着", up: "上へ", down: "下へ", ev: "EV" };
const today = () => new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
export async function routeSheetHtml(plan, { noStairs = false } = {}) {
  const floors = [...new Set(plan.route.legs.map((l) => l.floor))];
  const stepNo = plan.steps.map((_, i) => i + 1);
  const mapH = Math.max(42, Math.min(150, (228 - plan.steps.length * 7.4) / floors.length - 7));
  const maps = [];
  for (const f of floors) maps.push(`<figure class="rp-fig"><figcaption>${floorNo(f)}${f === plan.to.floor ? "（行き先のある階）" : ""}</figcaption><div class="rp-box" style="height:${n1(mapH)}mm">${await routeFloorSvg(plan, f, 184, mapH, stepNo)}</div></figure>`);
  const toWhere = whereOf(plan.to);
  return `<section class="sheet rp rp-route">
    <header class="rp-head"><small>第${FESTIVAL.edition}回 函館高専祭「${esc(FESTIVAL.theme)}」 道案内</small>
      <h2><span>${esc(plan.to.name)}</span>への行き方</h2>
      <p>${esc(toWhere)}${plan.to.sub && plan.to.group !== "トイレ" ? `・${esc(plan.to.sub)}` : ""}</p>
      <p class="rp-meta"><b>出発：${esc(plan.from.name)}</b>　歩いて<b>約${plan.route.minutes}分</b>（${plan.route.meters}m）${noStairs ? "　<b>階段を使わない道</b>" : ""}</p></header>
    ${maps.join("")}
    <ol class="rp-steps">${plan.steps.map((s, i) => `<li class="${s.icon === "goal" ? "is-goal" : ""}"><i>${stepNo[i]}</i><span>${esc(s.text)}${s.sub && s.icon !== "goal" ? `<small>${esc(s.sub)}</small>` : ""}</span>${ICON_WORD[s.icon] ? `<em>${ICON_WORD[s.icon]}</em>` : ""}</li>`).join("")}</ol>
    <footer class="rp-foot">太い線が通る道、●の数字が上の手順の番号です。迷ったら、近くのスタッフに声をかけてください（本部：玄関ホール）。<span>${esc(today())} 印刷</span></footer>
  </section>`;
}

export async function overviewSheetsHtml() {
  const { list } = await catalog();
  const sheets = [];
  for (const f of FLOORS) {
    const items = list.filter((p) => p.floor === f && p.no);
    const wcs = list.filter((p) => p.floor === f && p.toilet);
    const bds = BUILDINGS.flatMap((b) => (b[f] && !(b[f].roof && f !== "1F") ? b[f].rects ?? [] : []));
    if (!items.length && !bds.length) continue;
    const box = bbox([...bds, ...items.map((p) => p.rect ?? [p.at[0], p.at[1], 0, 0])]);
    const [x0, y0, w, h] = frame([[box[0], box[1]], [box[0] + box[2], box[1] + box[3]]], 273 / 134, 300, 12);
    const u = w / 273;
    const mk = items.map((p) => marker(centerOf(p), p.no, u, p.group === "本部" ? "is-goal" : "")).join("");
    const wc = wcs.map((p) => { const [cx, cy] = centerOf(p); return `<text class="rp-wcl" x="${n1(cx)}" y="${n1(cy)}" font-size="${n1((p.toilet === "toilet-hc" ? 1.6 : 1.9) * u)}">${p.toilet === "toilet-hc" ? "多目的" : "WC"}</text>`; }).join("");
    const svg = `<svg class="rp-map" viewBox="${n1(x0)} ${n1(y0)} ${n1(w)} ${n1(h)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${floorNo(f)}の全体地図">${PATTERN(u)}${await baseLayer(f, u)}${wc}${mk}${compass(x0 + w - 8 * u, y0 + 9 * u, u)}</svg>`;
    const groups = GROUPS.filter((g) => items.some((p) => p.group === g));
    const index = groups.map((g) => `<div class="rp-ig"><b>${esc(g)}</b><ol>${items.filter((p) => p.group === g).sort((x, y) => x.no - y.no).map((p) => `<li><i>${p.no}</i>${esc(p.name)}${p.group === "模擬店" && p.sub ? `<small>${esc(p.sub)}</small>` : ""}</li>`).join("")}</ol></div>`).join("");
    sheets.push(`<section class="sheet rp rp-land rp-all">
      <header class="rp-head rp-head-row"><h2>校内マップ　<span>${floorNo(f)}</span></h2><small>第${FESTIVAL.edition}回 函館高専祭「${esc(FESTIVAL.theme)}」　数字は下の一覧の番号・WC はトイレ・EV はエレベーター</small></header>
      <div class="rp-box" style="height:134mm">${svg}</div>
      <div class="rp-index">${index || '<p class="rp-none">この階に、企画やお店はありません。</p>'}</div>
    </section>`);
  }
  return sheets.join("");
}

export async function overviewSvg(floor, selectedId) {
  const { list } = await catalog();
  const items = list.filter((p) => p.floor === floor && p.no);
  const wcs = list.filter((p) => p.floor === floor && p.toilet);
  const bds = BUILDINGS.flatMap((b) => (b[floor] && !(b[floor].roof && floor !== "1F") ? b[floor].rects ?? [] : []));
  const box = bbox([...bds, ...items.map((p) => p.rect ?? [p.at[0], p.at[1], 0, 0])]);
  const [x0, y0, w, h] = frame([[box[0], box[1]], [box[0] + box[2], box[1] + box[3]]], 16 / 9, 300, 12);
  const u = w / 200;
  const sel = list.find((p) => p.id === selectedId && p.floor === floor);
  const mk = items.map((p) => `<g data-rp-pick="${esc(p.id)}" role="button" aria-label="${esc(p.name)}">${marker(centerOf(p), p.no, u, p.id === selectedId ? "is-goal" : "")}</g>`).join("");
  const wc = wcs.map((p) => { const [cx, cy] = centerOf(p); return `<g data-rp-pick="${esc(p.id)}"><text class="rp-wcl" x="${n1(cx)}" y="${n1(cy)}" font-size="${n1(1.9 * u)}">${p.toilet === "toilet-hc" ? "多" : "WC"}</text></g>`; }).join("");
  return `<svg class="rp-map" viewBox="${n1(x0)} ${n1(y0)} ${n1(w)} ${n1(h)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${floorNo(floor)}の地図">${PATTERN(u)}${await baseLayer(floor, u)}${sel ? destShape(sel, u) : ""}${wc}${mk}${compass(x0 + w - 8 * u, y0 + 9 * u, u)}</svg>`;
}
