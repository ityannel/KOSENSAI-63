import { PATHS, LINKS, BUILDINGS, M_PER_PT } from "./campus.js";

const STAIRS_COST = 40;
const EV_COST = 70;
const OUT_COST = 1.15;
const WALK_M_PER_MIN = 60;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const dist = (a, b) => len(sub(a, b));

function project(p, a, b) {
  const ab = sub(b, a);
  const l2 = ab[0] ** 2 + ab[1] ** 2 || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / l2));
  return { t, pt: [a[0] + ab[0] * t, a[1] + ab[1] * t] };
}

function rectDist(rect, p) {
  const [x, y, w, h] = rect;
  const dx = Math.max(x - p[0], 0, p[0] - (x + w));
  const dy = Math.max(y - p[1], 0, p[1] - (y + h));
  return Math.hypot(dx, dy);
}

function cross(a, b, c, d) {
  const r = sub(b, a), s = sub(d, c);
  const den = r[0] * s[1] - r[1] * s[0];
  const EPS = 1.2;
  if (Math.abs(den) > 1e-9) {
    const q = sub(c, a);
    const t = (q[0] * s[1] - q[1] * s[0]) / den;
    const u = (q[0] * r[1] - q[1] * r[0]) / den;
    const lr = len(r), ls = len(s);
    if (t * lr > -EPS && t * lr < lr + EPS && u * ls > -EPS && u * ls < ls + EPS) {
      return [Math.max(0, Math.min(1, t)), Math.max(0, Math.min(1, u))];
    }
    return null;
  }
  return null;
}

function build() {
  const nodes = [];
  const adj = new Map();
  const edges = [];
  const node = (floor, pt) => {
    const near = nodes.find((n) => n.floor === floor && dist(n.pt, pt) < 0.6);
    if (near) return near.id;
    const id = nodes.length;
    nodes.push({ id, floor, pt });
    adj.set(id, []);
    return id;
  };
  const link = (a, b, w, extra = {}) => {
    adj.get(a).push({ to: b, w, ...extra });
    adj.get(b).push({ to: a, w, ...extra });
  };

  for (const [floor, paths] of Object.entries(PATHS)) {
    const segs = [];
    for (const p of paths) for (let i = 1; i < p.pts.length; i++) segs.push({ a: p.pts[i - 1], b: p.pts[i], out: !!p.out, cuts: [0, 1] });
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const hit = cross(segs[i].a, segs[i].b, segs[j].a, segs[j].b);
        if (hit) { segs[i].cuts.push(hit[0]); segs[j].cuts.push(hit[1]); }
      }
    }
    for (const s of segs) {
      const ts = [...new Set(s.cuts.map((t) => Math.round(t * 1e4) / 1e4))].sort((x, y) => x - y);
      const pts = ts.map((t) => [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t]);
      for (let k = 1; k < pts.length; k++) {
        const a = node(floor, pts[k - 1]), b = node(floor, pts[k]);
        if (a === b) continue;
        const w = dist(nodes[a].pt, nodes[b].pt);
        link(a, b, w * (s.out ? OUT_COST : 1), { out: s.out });
        edges.push({ floor, a, b, out: s.out });
      }
    }
  }

  for (const l of LINKS) {
    const ids = [];
    for (const [floor, at] of Object.entries(l.at)) {
      const near = nearestOnEdges(floor, at, edges, nodes);
      if (!near) continue;
      const p = node(floor, at);
      const q = splitEdge(near, edges, nodes, adj, node, link);
      if (p !== q) link(p, q, dist(at, nodes[q].pt));
      ids.push(p);
      nodes[p].link = l;
    }
    for (let i = 1; i < ids.length; i++) link(ids[i - 1], ids[i], l.kind === "ev" ? EV_COST : STAIRS_COST, { via: l });
  }
  return { nodes, adj, edges };
}

function nearestOnEdges(floor, p, edges, nodes, score = (q) => dist(p, q)) {
  let best = null;
  for (const e of edges) {
    if (e.floor !== floor) continue;
    const { t, pt } = project(p, nodes[e.a].pt, nodes[e.b].pt);
    const d = score(pt, e);
    if (!best || d < best.d) best = { e, t, pt, d };
  }
  return best;
}

function splitEdge(near, edges, nodes, adj, node, link) {
  const { e, pt } = near;
  if (dist(pt, nodes[e.a].pt) < 0.5) return e.a;
  if (dist(pt, nodes[e.b].pt) < 0.5) return e.b;
  const m = node(e.floor, pt);
  const drop = (x, y) => adj.set(x, adj.get(x).filter((n) => n.to !== y));
  drop(e.a, e.b); drop(e.b, e.a);
  const k = e.out ? OUT_COST : 1;
  link(e.a, m, dist(nodes[e.a].pt, pt) * k, { out: e.out });
  link(m, e.b, dist(pt, nodes[e.b].pt) * k, { out: e.out });
  edges.splice(edges.indexOf(e), 1, { floor: e.floor, a: e.a, b: m, out: e.out }, { floor: e.floor, a: m, b: e.b, out: e.out });
  return m;
}

let NET = null;
const net = () => (NET ??= build());

export function doorOf(place) {
  return doorsOf(place)[0] ?? null;
}
function doorsOf(place) {
  const { edges, nodes } = net();
  const c = centerOf(place);
  const outside = place.outdoor || !buildingAt(place.floor, c);
  const home = buildingAt(place.floor, c);
  const same = (e) => !!e.out === outside;
  const crosses = (q) => (outside ? !lineClear(place.floor, c, q) : !lineInside(place.floor, c, q, home));
  const onFloor = edges.filter((e) => e.floor === place.floor);
  const cands = [];
  for (const e of onFloor.some(same) ? onFloor.filter(same) : onFloor) {
    const { pt } = project(c, nodes[e.a].pt, nodes[e.b].pt);
    const rd = place.rect ? rectDist(place.rect, pt) : dist(place.at, pt);
    const stub = dist(c, pt) * 0.3 + rd * 4;
    cands.push({ e, pt, stub });
  }
  cands.sort((x, y) => x.stub - y.stub);
  const out = [];
  for (const d of cands) {
    if (out.length >= 3 || (out.length && d.stub > out[0].stub + 30)) break;
    if (out.some((o) => dist(o.pt, d.pt) < 10)) continue;
    if ((!place.rect || outside) && crosses(d.pt)) continue;
    out.push(d);
  }
  return out.length ? out : cands.slice(0, 1);
}

function lineClear(floor, a, b) {
  const n = Math.ceil(dist(a, b) / 2);
  for (let i = 1; i < n; i++) if (buildingAt(floor, [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n])) return false;
  return true;
}
function lineInside(floor, a, b, home) {
  const n = Math.ceil(dist(a, b) / 2);
  for (let i = 1; i < n; i++) if (buildingAt(floor, [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]) !== home) return false;
  return true;
}

export const centerOf = (place) => {
  if (place.at) return place.at;
  const [x, y, w, h] = place.labelRect ?? place.rect;
  return [x + w / 2, y + h / 2];
};

function between(da, db, opts) {
  const { nodes, adj } = net();
  const starts = [[da.e.a, dist(da.pt, nodes[da.e.a].pt)], [da.e.b, dist(da.pt, nodes[da.e.b].pt)]];
  const goals = new Map([[db.e.a, dist(db.pt, nodes[db.e.a].pt)], [db.e.b, dist(db.pt, nodes[db.e.b].pt)]]);
  const D = new Map(), prev = new Map(), done = new Set();
  const heap = [];
  const push = (id, d) => { heap.push([d, id]); heap.sort((x, y) => x[0] - y[0]); };
  for (const [id, d] of starts) if (d < (D.get(id) ?? Infinity)) { D.set(id, d); push(id, d); }
  let best = Infinity, bestEnd = null;
  if (da.e === db.e) { best = dist(da.pt, db.pt); bestEnd = "direct"; }
  while (heap.length) {
    const [d, id] = heap.shift();
    if (done.has(id) || d >= best) continue;
    done.add(id);
    if (goals.has(id) && d + goals.get(id) < best) { best = d + goals.get(id); bestEnd = id; }
    for (const n of adj.get(id)) {
      if (opts.noStairs && n.via?.kind === "stairs") continue;
      const nd = d + n.w;
      if (nd < (D.get(n.to) ?? Infinity)) { D.set(n.to, nd); prev.set(n.to, { id, via: n.via, out: n.out }); push(n.to, nd); }
    }
  }
  return bestEnd == null ? null : { best, bestEnd, prev };
}

export function findRoute(from, to, opts = {}) {
  const { nodes } = net();
  const a0 = centerOf(from), b0 = centerOf(to);
  if (from.floor === to.floor && (from.outdoor || !buildingAt(from.floor, a0)) && (to.outdoor || !buildingAt(to.floor, b0)) && lineClear(from.floor, a0, b0)) {
    const meters = Math.max(5, Math.round((dist(a0, b0) * M_PER_PT) / 5) * 5);
    return { legs: [{ floor: from.floor, pts: [a0, b0], out: [0] }], meters, minutes: Math.max(1, Math.ceil(meters / WALK_M_PER_MIN)), cost: dist(a0, b0), to, from, door: b0 };
  }
  let pick = null;
  for (const da of doorsOf(from)) {
    for (const db of doorsOf(to)) {
      const r = between(da, db, opts);
      if (!r) continue;
      const total = r.best + da.stub + db.stub;
      if (!pick || total < pick.total) pick = { ...r, da, db, total };
    }
  }
  if (!pick) return null;
  const { best, bestEnd, prev, da, db } = pick;

  const chain = [];
  if (bestEnd !== "direct") {
    let cur = bestEnd;
    while (cur != null) { chain.unshift({ ...(prev.get(cur) ?? {}), id: cur }); cur = prev.get(cur)?.id; }
  }
  const legs = [];
  let leg = { floor: from.floor, pts: [centerOf(from), da.pt], out: [] };
  for (let i = 0; i < chain.length; i++) {
    const n = nodes[chain[i].id];
    const step = chain[i + 1];
    if (n.floor !== leg.floor) {
      const passing = leg.arrivedBy && walkLength([leg]) < 3;
      if (!passing) legs.push(leg);
      leg = { floor: n.floor, fromFloor: passing ? leg.fromFloor : leg.floor, pts: [n.pt], out: [], arrivedBy: chain[i].via };
    } else {
      leg.pts.push(n.pt);
      if (chain[i].out) leg.out.push(leg.pts.length - 2);
    }
    void step;
  }
  leg.pts.push(db.pt, centerOf(to));
  legs.push(leg);
  for (const l of legs) l.pts = dedupe(l.pts);

  const pt = best + dist(centerOf(from), da.pt) + dist(db.pt, centerOf(to));
  const meters = Math.round(walkLength(legs) * M_PER_PT / 5) * 5;
  return { legs, meters: Math.max(5, meters), minutes: Math.max(1, Math.ceil(meters / WALK_M_PER_MIN)), cost: pt, to, from, door: db.pt };
}

const dedupe = (pts) => pts.filter((p, i) => i === 0 || dist(p, pts[i - 1]) > 0.3);
const walkLength = (legs) => legs.reduce((s, l) => s + l.pts.reduce((a, p, i) => a + (i ? dist(p, l.pts[i - 1]) : 0), 0), 0);

export function buildingAt(floor, p) {
  for (const b of BUILDINGS) {
    const f = b[floor];
    if (!f || f.roof || !b.name) continue;
    if ((f.rects ?? []).some(([x, y, w, h]) => p[0] >= x - 1 && p[0] <= x + w + 1 && p[1] >= y - 1 && p[1] <= y + h + 1)) return b;
    if (f.poly && inPoly(p, f.poly)) return b;
  }
  return null;
}
function inPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let far = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = dist(pts[i], project(pts[i], a, b).pt);
    if (d > far) { far = d; idx = i; }
  }
  if (far <= tol) return [a, b];
  return [...simplify(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplify(pts.slice(idx), tol)];
}
const turnOf = (u, v) => ((((Math.atan2(v[1], v[0]) - Math.atan2(u[1], u[0])) * 180) / Math.PI + 540) % 360) - 180;

export function describe(route, names, hints = {}) {
  const steps = [];
  const m = (pt) => `${Math.max(5, Math.round((pt * M_PER_PT) / 5) * 5)}m`;
  const where = (floor, p) => buildingAt(floor, p)?.name ?? "外";
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const lr = (t) => (t > 0 ? "右" : "左");
  route.legs.forEach((leg, li) => {
    const first = li === 0, last = li === route.legs.length - 1;
    const next = route.legs[li + 1];
    const fl = leg.floor;
    if (!first) {
      const via = leg.arrivedBy;
      const up = parseInt(leg.floor) > parseInt(leg.fromFloor);
      steps.push({ icon: via?.kind === "ev" ? "ev" : up ? "up" : "down", text: `${via?.kind === "ev" ? "エレベーター" : "階段"}で${parseInt(leg.floor)}階へ`, sub: up ? "上がる" : "下りる", floor: fl, at: leg.pts[0] });
    }
    const fromRoom = first && route.from.rect, toRoom = last && route.to.rect;
    let raw = leg.pts.slice(fromRoom ? 1 : 0, toRoom ? -1 : undefined);
    if (!raw.length) raw = leg.pts.slice();
    if (raw.length < 2) raw.push(raw[0]);
    const pts = simplify(raw, 4);
    const cum = new Map();
    let acc = 0;
    raw.forEach((p, i) => { if (i) acc += dist(raw[i - 1], p); if (!cum.has(p)) cum.set(p, acc); });
    const total = acc;
    if (first) {
      const out = fromRoom && leg.pts.length > 2 && pts.length > 1 ? turnOf(sub(leg.pts[1], leg.pts[0]), sub(pts[1], pts[0])) : 0;
      const dir = !fromRoom || Math.abs(out) < 30 ? "" : `${lr(out)}へ`;
      steps.push({ icon: "start", text: fromRoom && !route.from.outdoor ? `${names.from}を出て${dir || "まっすぐ"}` : `${names.from}から出発`, sub: where(fl, pts[0]), floor: fl, at: pts[0] });
    }
    const events = [];
    for (let i = 1; i < pts.length - 1; i++) {
      const t = turnOf(sub(pts[i], pts[i - 1]), sub(pts[i + 1], pts[i]));
      if (Math.abs(t) >= 30) events.push({ d: cum.get(pts[i]) ?? 0, kind: "turn", t, at: pts[i], next: pts[i + 1] });
    }
    let wasOut = null;
    for (let i = 0; i < raw.length - 1; i++) {
      if (dist(raw[i], raw[i + 1]) < 0.5) continue;
      const isOut = !buildingAt(fl, mid(raw[i], raw[i + 1]));
      if (wasOut !== null && isOut !== wasOut) {
        const inside = isOut ? mid(raw[Math.max(0, i - 1)], raw[i]) : mid(raw[i], raw[i + 1]);
        events.push({ d: cum.get(raw[i]) ?? 0, kind: isOut ? "exit" : "enter", at: raw[i], bldg: buildingAt(fl, inside)?.name });
      }
      wasOut = isOut;
    }
    events.sort((a, b) => a.d - b.d);
    let lastD = 0, lastLm = null, lastAt = pts[0];
    const go = (run, to, end = "進んで、") => {
      if (run <= 6) return "";
      const road = hints.road?.(fl, lastAt, to);
      return `${road ? `${road}を` : ""}${m(run)}${end}`;
    };
    for (let k = 0; k < events.length; k++) {
      const e = events[k], run = e.d - lastD;
      const pre = go(run, e.at);
      if (e.kind === "turn") {
        let lm = hints.landmark?.(fl, e.at);
        if (lm === lastLm || lm === names.to || lm === names.from) lm = null;
        else lastLm = lm;
        steps.push({ icon: e.t > 0 ? "right" : "left", text: `${pre}${lm ? `${lm}の角を` : ""}${lr(e.t)}へ`, sub: where(fl, e.next ?? e.at), floor: fl, at: e.at });
        lastD = e.d;
        lastAt = e.at;
        continue;
      }
      const door = hints.door?.(fl, e.at) ?? e.bldg ?? "建物";
      let text = `${pre}${door}から${e.kind === "exit" ? "外に出る" : "中に入る"}`;
      lastD = e.d;
      const n = events[k + 1];
      if (n?.kind === "turn" && n.d - e.d < 6) {
        text = `${pre}${door}から${e.kind === "exit" ? "外に出て" : "中に入って"}、${lr(n.t)}へ`;
        lastD = n.d;
        k++;
      }
      lastAt = e.at;
      const after = n?.kind === "turn" && n.d - e.d < 6 ? n.next : e.at;
      steps.push({ icon: e.kind, text, sub: where(fl, after), floor: fl, at: e.at });
    }
    const run = total - lastD;
    if (!last) {
      const kind = next.arrivedBy?.kind === "ev" ? "エレベーター" : "階段";
      steps.push({ icon: "straight", text: `${go(run, pts[pts.length - 1], "進んで")}${kind}へ`, sub: where(fl, pts[pts.length - 1]), floor: fl, at: pts[pts.length - 1] });
    } else {
      const end = pts[pts.length - 1];
      let side = "";
      if (toRoom) {
        const back = pts.length > 1 ? sub(end, pts[pts.length - 2]) : [0, 0];
        const t = turnOf(back, sub(leg.pts[leg.pts.length - 1], end));
        side = Math.abs(t) < 35 ? "正面に" : t > 0 ? "右手に" : "左手に";
      }
      steps.push({ icon: "goal", text: `${go(run, end, "進むと、")}${side}${names.to}`, sub: "到着", floor: fl, at: end });
    }
  });
  return steps;
}

export const _test = { net };
