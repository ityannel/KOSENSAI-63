// 校内マップ（map.html）。Google マップのように、動かす・拡大する・探す・道案内する。
//
// - 図：campus.js（建物・道・階段）と assets/map/rooms.json（部屋の四角）。お祭りの会場は config.js の MAP
// - いまここ：校内の QR（map.html?here=ID）から来ると、その場所を少しのあいだ（40秒）出す。歩くと場所が変わるので、そのあとは消す
// - 道案内：「いまここ」（なければ選んだ出発地）から、選んだ場所まで。曲がり角ごとの説明つき
// - その場で変わるもの：会場の混雑（色）、いまやっている企画（NOW）、スタンプを押したお店
// - 模擬店：config.js の SHOPS。教室の部屋番号（HOMEROOMS）がわかるまでは「L棟1階の模擬店」のように階までを案内する
// - 屋外：campus.js の SITE（正門・グラウンド・寮など。構内通行経路図から写したもの）
// - URL：map.html#ID でその場所を開く。map.html?from=ID&to=ID で道案内を開く（共有ボタンが作る）
import { MAP, EVENTS, STAGE, CROWD, RALLY, PICKUP_SHOPS, PICKUP_EVENTS, SHOPS, HOMEROOMS, HOMEROOMS_CONFIRMED, GENRES, DECOS, ELECTION, DEPT_EXHIBITS } from "./config.js";
import { VIEW, HOME, NORTH, FLOORS, BUILDINGS, PATHS, LINKS, SITE, ROOM_FIX, ROOM_NAMES, ENTRANCES } from "./campus.js";
import { avatar, VERIFIED } from "./avatar.js";
import { tStart, tPlain } from "./schedule.js";
import { findRoute, describe, centerOf, buildingAt } from "./route.js";
import { submitPost, reportPost, reported, observePhotos, cachedPhoto, MAX_TEXT, cooldownLeft, liked, toggleLike } from "./posts.js";

const HERE_KEY = "kosen63-here";
const HERE_SEC = 40; // QR を読んでから「いまここ」を出しておく秒数
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const hhmm = (iso) => new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
const md = (iso) => new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" });
const $ = (s) => document.querySelector(s);
const SEARCH_PH = "場所・お店をさがす";

let getState = () => ({});
const places = new Map();   // id → 場所
const byRoom = new Map();   // 部屋番号 → お祭りの場所の id
let floor = "1F";
let selected = null;        // 選んでいる場所の id
let here = null;            // いまここ（場所の id）
let hereAt = 0;             // QR を読んだ時刻
let hereT = 0;              // いまここを消すタイマー
// いまここを消す（QR を読んでから時間がたったら。歩いて場所が変わっているので）
function forgetHere() {
  if (!here) return;
  here = null;
  clearTimeout(hereT);
  try { sessionStorage.removeItem(HERE_KEY); } catch { /* 保存できないブラウザ */ }
  $("#m-locate").classList.remove("has-here");
  renderMap();
  if (mode !== "route") renderSheet(); // 道案内の途中なら、出発地はそのまま
}
// いまここを決める（QR を読んだとき）。HERE_SEC 秒たったら消す
function setHere(id, at = Date.now()) {
  here = id;
  hereAt = at;
  try { sessionStorage.setItem(HERE_KEY, JSON.stringify({ id, t: at })); } catch { /* 保存できないブラウザ */ }
  clearTimeout(hereT);
  hereT = setTimeout(forgetHere, Math.max(0, at + HERE_SEC * 1000 - Date.now()));
  $("#m-locate").classList.add("has-here");
}
// 道案内の行き先を覚えておく（スマホのカメラで QR を読むと新しい画面で開くので、そこで続きを出す）
const ROUTE_KEY = "kosen63-route";
const ROUTE_KEEP_MIN = 30;
function saveRoute() {
  try {
    if (mode === "route" && rt.to) localStorage.setItem(ROUTE_KEY, JSON.stringify({ to: rt.to, noStairs: rt.noStairs, t: Date.now() }));
    else localStorage.removeItem(ROUTE_KEY);
  } catch { /* 保存できないブラウザ */ }
}
function savedRoute() {
  try {
    const r = JSON.parse(localStorage.getItem(ROUTE_KEY) ?? "null");
    return r && Date.now() - r.t < ROUTE_KEEP_MIN * 60000 && place(r.to) ? r : null;
  } catch { return null; }
}
let mode = "home";          // home / place / route / list
let listKind = null;        // 一覧で出している種類
let sheetBack = [];         // 前のシート（× で戻る）。{ mode, selected, listKind, rt }
let restoring = false;      // 戻している途中（履歴に積まない）
// いまのシートを履歴に積む（最初の画面は積まない。同じものが続くときも積まない）
function pushSheet() {
  if (restoring || mode === "home") return;
  const cur = { mode, selected, listKind, rt: { ...rt } };
  const top = sheetBack[sheetBack.length - 1];
  if (top && top.mode === cur.mode && top.selected === cur.selected && top.listKind === cur.listKind) return;
  sheetBack.push(cur);
  if (sheetBack.length > 20) sheetBack.shift();
}
let toiletFilter = "all";   // トイレの一覧：all / f / m / hc
let rt = { from: null, to: null, noStairs: false, result: null, steps: [], active: -1 };
let picking = null;         // 検索で「出発地」「目的地」を選んでいるとき "from" / "to"

// ---------- 場所 ----------
const GENERIC = /^(講義室|教員室|倉庫|準備室|器具庫|書庫|機械室|事務室|空室|WC|[A-Z]\d{3})/;
const CLASSROOM = /講義室|多目的室/;
const isToilet = (p) => !!p?.kind?.startsWith("toilet");
function kindOf(code, name) {
  if (/多目的WC|HCWC/.test(name)) return "toilet-hc";
  if (/WC男/.test(name)) return "toilet-m";
  if (/WC女/.test(name)) return "toilet-f";
  if (/WC/.test(name)) return "toilet";
  if (code.startsWith("Z")) return "shed";
  return "room";
}
const TOILET_NAME = { "toilet-hc": "多目的トイレ", "toilet-m": "男子トイレ", "toilet-f": "女子トイレ", toilet: "トイレ" };
export function titleOf(p) {
  if (!p) return "";
  if (isToilet(p)) return TOILET_NAME[p.kind];
  if (p.fest || ["spot", "aed", "vending", "deco", "stairs", "ev", "door"].includes(p.kind) || p.outdoor) return p.name;
  return GENERIC.test(p.name) ? `${p.code} ${p.name === p.code ? "" : p.name}`.trim() : p.name;
}
// 建物と階の短い書き方：「B棟」の1階 → B-1F（棟の名前でない建物は「体育館・武道場 1F」）
function whereOf(b, floor) {
  if (!b) return floor;
  return /^[A-Z]+棟$/.test(b.name) ? `${b.name.replace("棟", "")}-${floor}` : `${b.name} ${floor}`;
}
function subOf(p) {
  if (p.kind === "aed" || p.kind === "vending") return `${p.sub}・${p.floor}`;
  if (p.kind === "deco") return `${p.sub}・${whereOf(buildingAt(p.floor, p.at), p.floor)}`;
  if (p.kind === "stairs" || p.kind === "ev") return whereOf(buildingAt(p.floor, p.at), p.floor);
  if (p.kind === "door") return "建物の出入口";
  if (p.outdoor || (p.kind === "spot" && !buildingAt(p.floor, centerOf(p)))) return p.sub || ""; // 屋外は書かなくてもわかる
  const b = buildingAt(p.floor, centerOf(p));
  const parts = [];
  if (p.fest && p.sub) parts.push(p.sub);
  if (b && !b.connector) parts.push(whereOf(b, p.floor)); // 建物の外（中庭など）は棟も階も書かない
  // 部屋番号・クラスは出さない（来場者には意味がないので。検索では部屋番号・クラスでも見つかる）
  return parts.join("　");
}
const CLASS_OF = Object.fromEntries(Object.entries(HOMEROOMS).map(([c, r]) => [r, c])); // 部屋番号 → クラス
const bbox = (rects) => {
  const x0 = Math.min(...rects.map((r) => r[0])), y0 = Math.min(...rects.map((r) => r[1]));
  const x1 = Math.max(...rects.map((r) => r[0] + r[2])), y1 = Math.max(...rects.map((r) => r[1] + r[3]));
  return [x0, y0, x1 - x0, y1 - y0];
};
const polyBox = (poly) => bbox(poly.map(([x, y]) => [x, y, 0, 0]));

// 出入口と同じ場所にある目印（QR を貼る場所）
function doorSpot(e) { return MAP.spots.find((sp) => sp.at && sp.floor === "1F" && Math.hypot(sp.at[0] - e.at[0], sp.at[1] - e.at[1]) < 8) ?? null; }
function buildPlaces(rooms) {
  const add = (code, floorId, rect) => {
    const name = ROOM_NAMES[code] ?? code;
    places.set(code, { id: code, code, floor: floorId, rect, name, kind: kindOf(code, name) });
  };
  for (const [code, r] of Object.entries(rooms)) {
    const fix = ROOM_FIX[code];
    if (fix?.rect ?? r.rect) add(code, fix?.floor ?? r.floor, fix?.rect ?? r.rect);
  }
  for (const [code, fix] of Object.entries(ROOM_FIX)) if (!places.has(code)) add(code, fix.floor, fix.rect);
  fillGaps();
  evenToilets();
  // 四角1つでは表せない部屋（L字など）
  for (const [code, fix] of Object.entries(ROOM_FIX)) {
    const p = places.get(code);
    if (p && fix.extra) Object.assign(p, { rects: [p.rect, ...fix.extra], rect: bbox([p.rect, ...fix.extra]) });
  }
  // お祭りの場所（部屋1つ・いくつかの部屋・部屋ではない広い場所）
  for (const p of MAP.places) {
    const codes = [p.room ?? []].flat();
    const rs = codes.map((c) => places.get(c)).filter(Boolean);
    if (!rs.length && !p.area) continue;
    const rects = [...(p.area ? [p.area] : rs.flatMap((r) => r.rects ?? [r.rect])), ...(p.extra ?? [])];
    places.set(p.id, { ...p, fest: true, code: codes[0] ?? null, codes, floor: p.floor ?? rs[0].floor, rect: bbox(rects), rects, roomName: rs.map((r) => r.name).join("・") || null });
    codes.forEach((c) => byRoom.set(c, p.id));
  }
  // 入口・目印（QR を貼る場所）と正門
  if (!MAP.spots.some((sp) => sp.id === "gate")) places.set("gate", { id: "gate", kind: "spot", floor: "1F", at: SITE.gate.at, name: SITE.gate.name });
  for (const sp of MAP.spots) places.set(sp.id, { ...sp, kind: "spot" });
  // 屋外（グラウンド・寮など）
  for (const a of SITE.aed) places.set(a.id, { ...a, kind: "aed" });
  for (const v of SITE.vending ?? []) places.set(v.id, { ...v, kind: "vending" });
  // 階段・エレベーター（階ごと）。地図の印を押すと、その場所のシートが開く
  for (const l of LINKS) for (const [f, at] of Object.entries(l.at)) {
    places.set(`${l.id}@${f}`, { id: `${l.id}@${f}`, kind: l.kind === "ev" ? "ev" : "stairs", floor: f, at, name: l.kind === "ev" ? "エレベーター" : "階段" });
  }
  // 建物の出入口（「いまここ」QR の目印と同じ場所なら、そちらを使う）
  ENTRANCES.forEach((e, i) => { if (!doorSpot(e)) places.set(`door-${i}`, { id: `door-${i}`, kind: "door", floor: "1F", at: e.at, name: e.name }); });
  // 校内装飾の撮影スポット（点の場所）
  for (const d of DECOS.spots) {
    const grade = Number(d.cls[0]);
    places.set(`deco-${d.cls}`, { id: `deco-${d.cls}`, kind: "deco", floor: d.floor, at: d.at, grade, cls: d.cls,
      name: d.title ? `${d.title}（${d.cls}）` : `${d.cls} の撮影スポット`, sub: `${grade}年生「${DECOS.themes[grade]}」` });
  }
  for (const a of SITE.areas) places.set(a.id, { id: a.id, kind: "outdoor", outdoor: true, floor: "1F", name: a.name, rect: a.rect ?? polyBox(a.poly), sub: a.sub ?? "" });
  for (const f of [...(SITE.footways ?? []), ...(SITE.bikeways ?? []), ...(SITE.roadNames ?? [])]) {
    const r = bbox(f.pts.map(([x, y]) => [x - 5, y, 10, 0]));
    places.set(f.id, { id: f.id, kind: "outdoor", outdoor: true, floor: "1F", name: f.name, sub: f.sub, rect: r, line: f.pts }); // line：選ぶと道全体に線を引く
  }
  for (const b of SITE.buildings) if (b.name) places.set(b.id, { id: b.id, kind: "outdoor", outdoor: true, floor: "1F", name: b.name, sub: b.sub ?? "", rect: bbox(b.rects), rects: b.rects });
  attachShops();
  attachRally();
  // L字などは、名前とピンを中に入るいちばん大きい四角に出す（config の labelRect があればそちら）
  for (const p of places.values()) if (!p.zone && !p.labelRect && p.rects?.length > 1) p.labelRect = innerRect(p.rects);
  // 会場の中にある小さな部屋（学食の厨房・売店・トイレなど）は会場の一部にする（地図に出さず、探すと会場が出る）
  const fests = [...places.values()].filter((f) => f.fest && !f.zone && f.rects && f.kind !== "hq");
  for (const p of [...places.values()]) {
    if (p.fest || !p.code || !p.rect || byRoom.has(p.id)) continue;
    const [x, y] = centerOf(p);
    const f = fests.find((f) => f.floor === p.floor && f.rects.some(([rx, ry, rw, rh]) => x > rx && x < rx + rw && y > ry && y < ry + rh));
    if (f) byRoom.set(p.id, f.id);
  }
}

// 図面から取った部屋のあいだには壁の厚みぶんの細い隙間がある。となりの部屋と真ん中で合わせて埋める
const GAP = 2.6;
function fillGaps() {
  for (const fl of FLOORS) {
    const rs = [...places.values()].filter((p) => p.floor === fl && p.rect);
    // 辺ごとに合わせる先を集めてから（元の形で計算して）まとめて動かす。辺は [左, 上, 右, 下]
    const moves = new Map(rs.map((p) => [p, [[], [], [], []]]));
    for (const ax of [0, 1]) { // 0 なら左右にとなり合う、1 なら上下
      const o = 1 - ax;
      for (const a of rs) {
        for (const b of rs) {
          const A = a.rect, B = b.rect;
          const gap = B[ax] - (A[ax] + A[ax + 2]);
          if (a === b || gap <= 0 || gap > GAP) continue;
          const lap = Math.min(A[o] + A[o + 2], B[o] + B[o + 2]) - Math.max(A[o], B[o]);
          if (lap < Math.min(A[o + 2], B[o + 2]) * 0.4) continue; // 角でかすっているだけのものは合わせない
          const mid = A[ax] + A[ax + 2] + gap / 2;
          moves.get(a)[ax + 2].push(mid);
          moves.get(b)[ax].push(mid);
        }
      }
    }
    // 建物の外壁との隙間も詰める（外壁＝その外側がどの建物の中でもない辺）
    const walls = BUILDINGS.flatMap((b) => (b[fl] && !b[fl].roof ? b[fl].rects ?? [] : []));
    const inside = (x, y) => walls.some(([bx, by, bw, bh]) => x > bx && x < bx + bw && y > by && y < by + bh);
    for (const p of rs) {
      const R = p.rect, m = moves.get(p);
      for (const W of walls) {
        for (const [side, ax, dir] of [[0, 0, -1], [1, 1, -1], [2, 0, 1], [3, 1, 1]]) {
          if (m[side].length) continue; // となりの部屋と合わせる方を先に
          const o = 1 - ax;
          const edge = dir < 0 ? R[ax] : R[ax] + R[ax + 2];
          const wall = dir < 0 ? W[ax] : W[ax] + W[ax + 2];
          const gap = (wall - edge) * dir;
          if (gap <= 0 || gap > GAP) continue;
          const lap = Math.min(R[o] + R[o + 2], W[o] + W[o + 2]) - Math.max(R[o], W[o]);
          if (lap < R[o + 2] * 0.6) continue;
          const mid = Math.max(R[o], W[o]) + lap / 2;
          const out = ax === 0 ? inside(wall + dir * 0.5, mid) : inside(mid, wall + dir * 0.5);
          if (!out) m[side].push(wall);
        }
      }
    }
    const avg = (v, list) => (list.length ? list.reduce((s, x) => s + x, 0) / list.length : v);
    for (const [p, m] of moves) {
      const [x, y, w, h] = p.rect;
      const l = avg(x, m[0]), t = avg(y, m[1]), r = avg(x + w, m[2]), btm = avg(y + h, m[3]);
      p.rect = [l, t, r - l, btm - t];
    }
  }
}

// となり合った男子・女子トイレは、2つ合わせた広さを半分ずつにする（図面の読み取りで大きさがばらつくため）
function evenToilets() {
  const wc = [...places.values()].filter((p) => p.rect && (p.kind === "toilet-m" || p.kind === "toilet-f"));
  for (const a of wc) {
    for (const b of wc) {
      if (a === b || a.floor !== b.floor || a.kind === b.kind) continue;
      for (const ax of [0, 1]) { // 0 なら左右に、1 なら上下に並んでいる（a が左・上）
        const o = 1 - ax, A = a.rect, B = b.rect;
        if (Math.abs(A[ax] + A[ax + 2] - B[ax]) > 0.6) continue;
        if (Math.abs(A[o] - B[o]) > 1.5 || Math.abs(A[o] + A[o + 2] - B[o] - B[o + 2]) > 1.5) continue;
        const mid = (A[ax] + B[ax] + B[ax + 2]) / 2;
        A[ax + 2] = mid - A[ax];
        B[ax + 2] = B[ax] + B[ax + 2] - mid;
        B[ax] = mid;
      }
    }
  }
}

// 模擬店を場所につなぐ。教室がわからないものは「〇棟〇階の模擬店」（その階の教室まとめ）にする
// スタンプラリーの場所（RALLY.shops の place か room）を、その場所に結びつける（地図に印、シートに一覧）
function attachRally() {
  for (const p of places.values()) delete p.shops;
  for (const x of RALLY.shops) {
    const p = x.place ? places.get(x.place) : x.room ? place(x.room) : null;
    if (p && !(p.shops ?? []).includes(x.id)) p.shops = [...(p.shops ?? []), x.id];
  }
}
// スタンプラリーの場所が Firestore から届いた・変わったとき（地図は待たずに先に出しておき、あとから印を足す）
export function refreshRally() {
  if (!places.size) return;
  attachRally();
  buildIndex();
  // 地図をもう描いてあれば、いまの階を描き直す（まだなら最初の描画で入る）。
  // floorLayer を空にするだけだと renderMap が何もしなくなり、そのあと建物を押してもシートが変わらなくなる
  if (floorLayer) drawFloor();
  renderMap();
}
function attachShops() {
  for (const sh of SHOPS) {
    const code = sh.room ?? HOMEROOMS[sh.cls];
    let p = sh.place ? places.get(sh.place) : code ? place(code) : null;
    if (!p && sh.bldg) p = zoneFor(sh.bldg, sh.floor);
    if (!p) continue;
    if (!p.fest) Object.assign(p, { fest: true, roomName: p.name, kind: "shops", rects: p.rects ?? [p.rect] }); // ふつうの部屋がお店になる
    if (!sh.room && !sh.place && code && !HOMEROOMS_CONFIRMED) p.roomGuess = true; // 教室の場所がまだ仮
    (p.shopList ??= []).push(sh);
  }
  for (const p of places.values()) if (p.kind === "shops" && !p.zone && p.shopList.length === 1) p.name = p.shopList[0].name;
}
function zoneFor(bldg, fl) {
  const id = `shops-${bldg}${fl}`;
  if (!places.has(id)) {
    const rs = [...places.values()].filter((r) => r.code?.[0] === bldg && r.floor === fl && !r.fest && CLASSROOM.test(r.name) && !byRoom.has(r.id));
    if (!rs.length) return null;
    const rects = rs.map((r) => r.rect);
    places.set(id, { id, kind: "shops", zone: true, fest: true, floor: fl, rects, rect: bbox(rects), codes: rs.map((r) => r.code), name: `${bldg}棟${parseInt(fl)}階の模擬店`, shopList: [] });
    rs.forEach((r) => byRoom.set(r.id, id));
  }
  return places.get(id);
}
const place = (id) => places.get(byRoom.get(id) ?? id) ?? pointPlace(id);
// 地図で選んだ点（部屋ではない所）。id は "pt-1F-420-600" のように階と座標
function pointPlace(id) {
  const m = /^pt-(\dF)-(-?\d+)-(-?\d+)$/.exec(id ?? "");
  if (!m || !FLOORS.includes(m[1])) return null;
  const p = { id, kind: "spot", floor: m[1], at: [Number(m[2]), Number(m[3])], name: "地図で選んだ場所", sub: "", point: true };
  places.set(id, p);
  return p;
}

// いくつかの部屋に分かれている場所は、いちばん近い部屋までの道順にする
function bestRoute(from, to, opts) {
  const split = (p) => (p.rects?.length > 1 ? p.rects.map((r) => ({ ...p, rect: r, labelRect: r })) : [p]);
  let best = null;
  for (const a of split(from)) for (const b of split(to)) {
    const r = findRoute(a, b, opts);
    if (r && (!best || r.cost < best.cost)) best = r;
  }
  return best;
}

// ---------- 地図の見え方（拡大・移動・回転・傾き） ----------
const svg = () => $("#map-svg");
let view = { x: 0, y: 0, k: 1 };   // svg の左上の地図座標と、1pt が何ピクセルか
let size = { w: 1, h: 1 };         // svg の大きさ（回転・傾きのときは画面より大きくして、すみが空かないようにする）
let screen = { w: 1, h: 1 };       // 地図の枠（画面）の大きさ
let offset = { x: 0, y: 0 };       // 地図の枠の左上から見た svg の左上
let cam = { bearing: 0, tilt: 0 }; // 回転（度。時計回り）と傾き（度。0 が真上から）
let camM = null;                   // svg の点 → 地図の枠の点（null なら回転も傾きもない）
let kMin = 0.2;
const K_MAX = 9, TILT_MAX = 45, TILT_ON = 40;

function measure() {
  const r = $("#m-canvas").getBoundingClientRect();
  screen = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
  kMin = Math.min(screen.w / VIEW[2], screen.h / VIEW[3]) * 0.9;
  layoutCam();
}
// 回転と傾きを svg に当てる（画面の真ん中を中心に回し、奥へ倒す）
function layoutCam() {
  const flat = !cam.bearing && !cam.tilt;
  const P = screen.h * 1.1; // 目の高さ（遠近の強さ）
  let w = screen.w, h = screen.h;
  if (!flat && !cam.tilt) {
    // 回すだけ：画面の対角線の正方形（どう回してもすみまで地図がある）
    w = h = Math.ceil(Math.hypot(screen.w, screen.h)) + 4;
  } else if (!flat) {
    // いちばん傾けても画面のすみまで地図があるように、正方形で大きく描く
    const s = Math.sin((TILT_MAX * Math.PI) / 180), c = Math.cos((TILT_MAX * Math.PI) / 180);
    const far = ((screen.h / 2) * P) / (P * c - (screen.h / 2) * s);
    const side = (screen.w / 2) * (1 + (far * s) / P);
    w = h = Math.ceil(2 * Math.hypot(side, far) + 40);
  }
  // 見ている真ん中は変えない
  const cx = view.x + size.w / view.k / 2, cy = view.y + size.h / view.k / 2;
  size = { w, h };
  offset = { x: (screen.w - w) / 2, y: (screen.h - h) / 2 };
  view.x = cx - w / view.k / 2;
  view.y = cy - h / view.k / 2;
  const el = svg();
  Object.assign(el.style, { width: `${w}px`, height: `${h}px`, left: `${offset.x}px`, top: `${offset.y}px` });
  if (flat) {
    camM = null;
    el.style.transform = "";
  } else {
    camM = new DOMMatrix().translate(w / 2, h / 2)
      .multiply(new DOMMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1 / P, 0, 0, 0, 1]))
      .rotateAxisAngle(1, 0, 0, cam.tilt)
      .rotateAxisAngle(0, 0, 1, cam.bearing)
      .translate(-w / 2, -h / 2);
    el.style.transform = camM.toString();
  }
  el.style.setProperty("--brg", `${-cam.bearing}deg`); // 字と印は回さない（いつも読める向き）
  el.classList.toggle("is-3d", !flat);
  $("#m-compass")?.style.setProperty("--north", `${NORTH + cam.bearing}deg`);
  $("#m-compass")?.toggleAttribute("data-rotated", Math.abs(normDeg(NORTH + cam.bearing)) > 1); // 北が上でなくなったときだけ、北のボタンを出す
  $("#m-tilt")?.setAttribute("aria-pressed", String(cam.tilt > 0));
}
// 地図の枠の点 → svg の点（傾いた面との交わりを解く）
function toLocal(sx, sy) {
  const qx = sx - offset.x, qy = sy - offset.y;
  if (!camM) return [qx, qy];
  const m = camM;
  const a = m.m11 - qx * m.m14, b = m.m21 - qx * m.m24, c = qx * m.m44 - m.m41;
  const d = m.m12 - qy * m.m14, e = m.m22 - qy * m.m24, f = qy * m.m44 - m.m42;
  const det = a * e - b * d || 1e-9;
  return [(c * e - b * f) / det, (a * f - c * d) / det];
}
const normDeg = (b) => ((((b + 180) % 360) + 360) % 360) - 180;
function setCam(bearing, tilt) {
  cam = { bearing: normDeg(bearing), tilt: Math.max(0, Math.min(TILT_MAX, tilt)) };
  layoutCam();
  clampView();
  applyView();
}
let camAnim = 0;
function animateCam(b1, t1, ms = 380) {
  cancelAnimationFrame(camAnim);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) ms = 1;
  const b0 = cam.bearing, t0 = cam.tilt, db = normDeg(b1 - b0), s0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - s0) / ms), e = 1 - Math.pow(1 - t, 3);
    setCam(t < 1 ? b0 + db * e : b1, t0 + (t1 - t0) * e);
    camAnim = t < 1 ? requestAnimationFrame(step) : 0;
  };
  camAnim = requestAnimationFrame(step);
}

// ---------- 向き（スマホの方位センサー） ----------
// いまここの点に向いている方向の扇形を出し、「向きに合わせる」ボタンで地図を自分の向きに回し続ける。
// iPhone は押したときに許可を聞く。センサーのないパソコンなどでは使えない
const DECL = -9;            // 函館の磁気の偏角（磁北は真北より約9°西）。センサーの北を地図の北（真北）に直す
let heading = null;         // 向いている方位（度。真北が 0、時計回り）
let headingOn = false;      // センサーを読んでいる
let follow = false;         // 地図を自分の向きに合わせて回し続けている
let headingRaf = 0;
const bearingFor = (h) => -(NORTH + h); // 向いている方向が画面の上になる地図の回転
function onOrient(e) {
  let h = null;
  if (typeof e.webkitCompassHeading === "number") h = e.webkitCompassHeading;          // iPhone（磁北から時計回り）
  else if (e.absolute && typeof e.alpha === "number") h = 360 - e.alpha;               // Android（反時計回り）
  if (h == null || Number.isNaN(h)) return;
  h += DECL + (window.screen.orientation?.angle ?? window.orientation ?? 0);           // 横向きに持っているとき
  heading = heading == null ? normDeg(h) : normDeg(heading + normDeg(h - heading) * 0.25); // 少しなめらかに
  if (headingRaf) return;
  headingRaf = requestAnimationFrame(() => {
    headingRaf = 0;
    const cone = document.querySelector("#m-marks .mk-cone");
    if (cone) cone.style.transform = coneTransform(cone.dataset.x, cone.dataset.y);
    else if (here && place(here)?.floor === floor) drawMarks();
    // 回すアニメの途中はセンサーで回さない（2つの向きが取り合ってがたつくので）
    if (follow && !camAnim && Math.abs(normDeg(bearingFor(heading) - cam.bearing)) > 1.5) setCam(bearingFor(heading), cam.tilt);
  });
}
const coneTransform = (x, y) => `translate(${x}px, ${y}px) scale(var(--u)) rotate(${NORTH + heading}deg)`;
async function startHeading() {
  if (headingOn) return true;
  const DOE = window.DeviceOrientationEvent;
  if (!DOE) return false;
  // iPhone は許可を聞く。断られても、向きが届くかどうかはあとで確かめる（許可を聞けるが聞かなくても届くブラウザがある）
  if (typeof DOE.requestPermission === "function") {
    try { await DOE.requestPermission(); } catch { /* 聞けなかった */ }
  }
  addEventListener("ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation", onOrient);
  headingOn = true;
  return true;
}
function setFollow(on) {
  if (follow === on) return;
  follow = on;
  $("#m-heading")?.setAttribute("aria-pressed", String(on));
  if (on && heading != null) animateCam(bearingFor(heading), cam.tilt);
}
async function toggleFollow() {
  if (follow) { setFollow(false); return; }
  if (!(await startHeading())) { toast("向きのセンサーが使えません"); return; }
  setFollow(true);
  // しばらくたっても向きがわからない（センサーがない）ときはやめる
  setTimeout(() => { if (follow && heading == null) { setFollow(false); toast("向きがわかりませんでした（センサーがないか、許可されていません）"); } }, 1500);
}

// 見ている範囲を当てる。動かすだけ（拡大率が同じ）ならすぐ全部。
// 拡大・縮小が続いているあいだは、地図の範囲だけ毎コマ動かし、字の大きさ（--u）・字の出し入れは 0.16 秒に1回と、止まったあとに（スマホで重くならないように）
let settleT = 0, settledK = 0, settledAt = 0;
function applyView() {
  const k = view.k;
  svg().setAttribute("viewBox", `${view.x} ${view.y} ${size.w / k} ${size.h / k}`);
  clearTimeout(settleT);
  if (k === settledK || performance.now() - settledAt > 160) settleView();
  else settleT = setTimeout(settleView, 110);
}
function settleView() {
  const k = view.k;
  settledK = k;
  settledAt = performance.now();
  svg().style.setProperty("--u", (1 / k).toFixed(5));
  const far = svg().classList.contains("is-far");
  svg().classList.toggle("is-far", k < (far ? 1.15 : 1.05)); // 遠くから見ているときは小さな印を出さない（境目でちらつかないように少しずらす）
  updateLabels();
}
// 札の列は、名前の字（見えている行）のいちばん上のすぐ上へ。名前が出ていないとき（部屋が画面で小さい）は札も出さない
const labelTop = new Map();    // 場所の id → 名前の字のいちばん上（名前の真ん中から、画面のピクセル。上がマイナス）
const labelBottom = new Map(); // 場所の id → 名前の字のいちばん下（印をつけた場所は、札を名前の下に出す）
let badgeIds = new Set();      // 札の列がある場所（名前を少し上げて、名前と札をまとめて真ん中に）
// 札の列がその場所の部屋に入るか（名前を上げるかどうか）。名前2行＋札でだいたい 70px の高さ
function badgeFits(id, k, b) {
  if (svg().classList.contains("is-far")) return false; // 遠くから見ているとき札は出ない（map.css）。名前も下げない
  const g = document.querySelector(`#m-live .ic-badges[data-for="${CSS.escape(id)}"]`);
  if (!g) return false;
  const side = Math.abs(Math.sin((b * Math.PI) / 180)) > 0.7;
  const need = markedIds.has(id) ? 120 : 70; // 印（ピン）がある場所は、ピン＋名前＋札の高さ
  return Number(side ? g.dataset.h : g.dataset.w) * k >= Number(g.dataset.rw) + 8 && Number(side ? g.dataset.w : g.dataset.h) * k >= need;
}
function updateBadges() {
  document.querySelectorAll("#m-live .ic-badges").forEach((g) => {
    const b = labelTop.get(g.dataset.for);
    // 部屋が画面で、札の列と名前が入る大きさのときだけ出す（となりにはみ出さないように）
    const fits = b != null && badgeFits(g.dataset.for, view.k, cam.bearing);
    g.classList.toggle("is-hidden", !fits);
    // ふだんは名前の上。印（ピン・いまここ）をつけた場所は、印が上にあるので名前の下（札の高さの半分 8 ＋すきま 4）
    const y = markedIds.has(g.dataset.for) ? labelBottom.get(g.dataset.for) + 12 : b - 12;
    if (fits) g.querySelector(".row").setAttribute("transform", `translate(0 ${y.toFixed(1)})`);
  });
}
function clampView() {
  view.k = Math.max(kMin, Math.min(K_MAX, view.k));
  const vw = size.w / view.k, vh = size.h / view.k;
  const cx = Math.max(VIEW[0], Math.min(VIEW[0] + VIEW[2], view.x + vw / 2));
  const cy = Math.max(VIEW[1], Math.min(VIEW[1] + VIEW[3], view.y + vh / 2));
  view.x = cx - vw / 2;
  view.y = cy - vh / 2;
}
// 画面の中で、上の検索と下のシートに隠れていない部分（地図の枠の座標）
function safeArea() {
  const top = ($(".m-top")?.getBoundingClientRect().bottom ?? 0) + 8;
  const shown = !$("#m-sheet").hidden;
  const sheet = $("#m-sheet").getBoundingClientRect();
  const tabsTop = $("#m-tabs")?.getBoundingClientRect().top ?? screen.h;
  const limit = tabsTop - 16; // 下のタブより上
  // シートが広がり・縮みの途中でも、止まったあとの高さで計算する（42dvh・78dvh は map.css の max-height）
  const sh = $("#m-sheet");
  const capTop = tabsTop - (sh.classList.contains("is-min") ? 30 : innerHeight * (sh.classList.contains("is-open") ? 0.78 : 0.42));
  const bottom = !shown ? limit : Math.min(limit, Math.max(sheet.top, capTop) - 12); // PC でもスマホと同じ縦長の画面（map.css）
  return { left: 12, top, right: screen.w - 70, bottom: Math.max(top + 80, bottom) };
}
function viewFor(rect, maxK = 4) {
  const a = safeArea();
  const [x, y, w, h] = rect;
  // 回っているときは回したあとの外枠で、傾いているときは縦を長めに見て入れる
  const r = (cam.bearing * Math.PI) / 180, cs = Math.abs(Math.cos(r)), sn = Math.abs(Math.sin(r));
  const bw = w * cs + h * sn, bh = (w * sn + h * cs) / Math.cos((cam.tilt * Math.PI) / 180);
  const k = Math.max(kMin, Math.min(maxK, (a.right - a.left) / Math.max(bw, 1), (a.bottom - a.top) / Math.max(bh, 1)));
  const [lx, ly] = toLocal((a.left + a.right) / 2, (a.top + a.bottom) / 2);
  return { k, x: x + w / 2 - lx / k, y: y + h / 2 - ly / k };
}
let anim = 0;
function animateTo(target, ms = 420) {
  cancelAnimationFrame(anim);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) ms = 0;
  const from = { ...view }, t0 = performance.now();
  if (ms) ms = Math.min(700, Math.max(300, ms * (0.7 + 0.25 * Math.abs(Math.log(target.k / from.k))))); // 遠いほど少し長く
  // 拡大率は対数で、位置は画面の中心で補間する（Google マップのような動き）
  const c0 = { x: from.x + size.w / from.k / 2, y: from.y + size.h / from.k / 2 };
  const c1 = { x: target.x + size.w / target.k / 2, y: target.y + size.h / target.k / 2 };
  const step = (now) => {
    const t = ms ? Math.min(1, (now - t0) / ms) : 1;
    const e = 1 - Math.pow(1 - t, 3);
    const k = Math.exp(Math.log(from.k) + (Math.log(target.k) - Math.log(from.k)) * e);
    const cx = c0.x + (c1.x - c0.x) * e, cy = c0.y + (c1.y - c0.y) * e;
    view = { k, x: cx - size.w / k / 2, y: cy - size.h / k / 2 };
    applyView();
    if (t < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}
// 全体ボタン：校舎 → 敷地全体 → 校舎 …と切りかえる
let wholeSite = false;
const fitAll = () => { wholeSite = !wholeSite; animateTo(viewFor(wholeSite ? VIEW : HOME, 1.2)); };
// svg の点 (sx, sy) を動かさずに拡大・縮小
function zoomAt(sx, sy, f) {
  const k = Math.max(kMin, Math.min(K_MAX, view.k * f));
  const wx = view.x + sx / view.k, wy = view.y + sy / view.k;
  view = { k, x: wx - sx / k, y: wy - sy / k };
  clampView();
  applyView();
}
// 点 (sx, sy) を動かさずに、なめらかに拡大・縮小（ダブルタップ・キーボード）
function animateZoomAt(sx, sy, f, ms = 260) {
  cancelAnimationFrame(anim);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { zoomAt(sx, sy, f); return; }
  const v0 = { ...view }, t0 = performance.now(), k1 = Math.max(kMin, Math.min(K_MAX, v0.k * f));
  const wx = v0.x + sx / v0.k, wy = v0.y + sy / v0.k;
  const step = (now) => {
    const t = Math.min(1, (now - t0) / ms), k = v0.k * Math.pow(k1 / v0.k, 1 - Math.pow(1 - t, 3));
    view = { k, x: wx - sx / k, y: wy - sy / k };
    clampView();
    applyView();
    if (t < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}
// 指を離したあとも少しすべらせる（慣性。vx, vy は指の速さ px/ms）
function fling(vx, vy) {
  cancelAnimationFrame(anim);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let last = performance.now();
  const step = (now) => {
    const dt = Math.min(32, now - last);
    last = now;
    const f = Math.exp(-dt / 325);
    vx *= f;
    vy *= f;
    panScreen(-vx * dt, -vy * dt);
    if (Math.hypot(vx, vy) > 0.02) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}
// 画面の向きで dx, dy ピクセル動かす（回転・傾きしていても見た目どおりに動く）
function panScreen(dx, dy) {
  const [ax, ay] = toLocal(screen.w / 2, screen.h / 2), [bx, by] = toLocal(screen.w / 2 + dx, screen.h / 2 + dy);
  view.x += (bx - ax) / view.k;
  view.y += (by - ay) / view.k;
  clampView();
  applyView();
}

function initGestures() {
  const el = svg(), box = $("#m-canvas");
  const pts = new Map();
  let start = null, two = null, moved = false, lastTap = 0, lastTapAt = [0, 0], tapT = 0;
  const scr = (e) => { const r = box.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const oneFinger = (s, target = null, turn = false) => ({ s, p: toLocal(...s), view: { ...view }, cam: { ...cam }, target, turn });
  // 操作は地図の枠で受ける（傾けたとき、何もない所をつかんでも動かせるように）
  box.addEventListener("contextmenu", (e) => e.preventDefault());
  box.addEventListener("pointerdown", (e) => {
    cancelAnimationFrame(anim);
    cancelAnimationFrame(camAnim);
    box.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, scr(e));
    if (pts.size === 1) {
      moved = false;
      // パソコン：右ボタンか Ctrl・Shift を押しながらドラッグすると、回転（左右）と傾き（上下）
      start = oneFinger(scr(e), e.target, e.button === 2 || e.ctrlKey || e.shiftKey || e.metaKey);
    }
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const [lx, ly] = toLocal(...mid);
      two = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, ang: Math.atan2(b[1] - a[1], b[0] - a[0]), mid, k: view.k, cam: { ...cam },
        world: [view.x + lx / view.k, view.y + ly / view.k], mode: null, rot: 0 };
      moved = true;
    }
  });
  box.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, scr(e));
    if (pts.size >= 2 && two) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const dAng = normDeg(((Math.atan2(b[1] - a[1], b[0] - a[0]) - two.ang) * 180) / Math.PI);
      const dy = mid[1] - two.mid[1];
      // はじめの動きで決める：2本指でそろって上下＝傾き、それ以外（開く・閉じる・ひねる）＝拡大と回転
      if (!two.mode) {
        if (Math.abs(Math.log(d / two.d)) > 0.06 || Math.abs(dAng) > 10) two.mode = "zoom";
        else if (Math.abs(dy) > 12) two.mode = "tilt";
        else return;
      }
      if (two.mode === "tilt") { setCam(two.cam.bearing, two.cam.tilt - dy * 0.3); return; }
      // ひねりは少し回してから効かせる（拡大だけのつもりで回ってしまわないように）
      if (!two.rot && Math.abs(dAng) > 12) { two.rot = dAng; setFollow(false); } // 自分で回したら、向きに合わせるのをやめる
      if (two.rot) { cam = { ...cam, bearing: normDeg(two.cam.bearing + dAng - two.rot) }; layoutCam(); }
      const k = Math.max(kMin, Math.min(K_MAX, (two.k * d) / two.d));
      const [lx, ly] = toLocal(...mid);
      view = { k, x: two.world[0] - lx / k, y: two.world[1] - ly / k };
      clampView();
      applyView();
    } else if (start) {
      const s = scr(e);
      const dx = s[0] - start.s[0], dy = s[1] - start.s[1];
      if (!moved && Math.hypot(dx, dy) < 7) return;
      moved = true;
      el.classList.add("is-dragging");
      if (start.turn) { setFollow(false); setCam(start.cam.bearing + dx * 0.4, start.cam.tilt - dy * 0.3); return; }
      // 指の速さ（px/ms）をなめらかに記録（離したあとの慣性に使う）
      const lt = start.lt ?? e.timeStamp, dtm = e.timeStamp - lt;
      if (dtm > 0) start.v = [0, 1].map((i) => 0.8 * ((s[i] - (start.ls ?? start.s)[i]) / dtm) + 0.2 * (start.v?.[i] ?? 0));
      start.ls = s;
      start.lt = e.timeStamp;
      const p = toLocal(...s);
      view = { k: start.view.k, x: start.view.x - (p[0] - start.p[0]) / start.view.k, y: start.view.y - (p[1] - start.p[1]) / start.view.k };
      clampView();
      applyView();
    }
  });
  const end = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    el.classList.remove("is-dragging");
    if (pts.size === 1 && two) {           // 2本指の片方を離したら、残りの指で動かし続ける
      start = oneFinger([...pts.values()][0]);
      two = null;
      return;
    }
    if (pts.size === 0) {
      if (!moved && start && e.type === "pointerup") {
        const now = Date.now(), at = scr(e);
        const near = Math.hypot(at[0] - lastTapAt[0], at[1] - lastTapAt[1]) < 30;
        if (now - lastTap < 300 && near) { clearTimeout(tapT); animateZoomAt(...toLocal(...at), 2); lastTap = 0; }   // ダブルタップで拡大
        else {
          lastTap = now;
          lastTapAt = at;
          const tg = start.target, lp = toLocal(...at);
          clearTimeout(tapT);
          if (mode === "route" && !mapPicking) tapT = setTimeout(() => tap(tg, lp), 300); else tap(tg, lp);
        }
      } else if (moved && !two && start?.v && !start.turn && e.timeStamp - start.lt < 60) {
        fling(...start.v); // 払ったら、少しすべる
      }
      // 校内図の向き・北が上に近ければ、ぴったり合わせる（真上に近ければ傾きも戻す）
      const snapB = follow ? cam.bearing : Math.abs(cam.bearing) < 4 ? 0 : Math.abs(normDeg(NORTH + cam.bearing)) < 4 ? -NORTH : cam.bearing;
      if (snapB !== cam.bearing || (cam.tilt && cam.tilt < 3)) animateCam(snapB, cam.tilt < 3 ? 0 : cam.tilt, 180);
      start = null;
      two = null;
    }
  };
  box.addEventListener("pointerup", end);
  box.addEventListener("pointercancel", end);
  let wheelF = 1, wheelAt = null, wheelRaf = 0;
  box.addEventListener("wheel", (e) => {
    e.preventDefault();
    cancelAnimationFrame(anim); // 飛んでいる途中・すべっている途中でもすぐ効く
    cancelAnimationFrame(camAnim);
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; // 行単位のマウス
    wheelF *= Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018));
    wheelAt = toLocal(...scr(e));
    wheelRaf ||= requestAnimationFrame(() => { wheelRaf = 0; zoomAt(...wheelAt, wheelF); wheelF = 1; }); // 1フレームに1回
  }, { passive: false });
  // キーボード：矢印で移動、Shift＋矢印で回転・傾き、+ − で拡大縮小
  el.tabIndex = 0;
  el.addEventListener("keydown", (e) => {
    const moves = { ArrowLeft: [-60, 0], ArrowRight: [60, 0], ArrowUp: [0, -60], ArrowDown: [0, 60] };
    if (moves[e.key] && e.shiftKey) {
      const [mx, my] = moves[e.key];
      if (mx) setFollow(false);
      setCam(cam.bearing + mx / 4, cam.tilt - my / 6);
      e.preventDefault();
    } else if (moves[e.key]) { panScreen(...moves[e.key]); e.preventDefault(); }
    if (e.key === "+" || e.key === "=") animateZoomAt(size.w / 2, size.h / 2, 1.4);
    if (e.key === "-") animateZoomAt(size.w / 2, size.h / 2, 1 / 1.4);
  });
  addEventListener("resize", () => { measure(); clampView(); applyView(); });
}

function tap(target, [lx, ly] = [0, 0]) {
  const f = target?.closest?.("[data-floor-go]");
  if (f) {
    // 道案内の「3Fへ ›」：その階の最初の案内（階段・エレベーターを出たところ）へ
    const i = rt.steps.findIndex((st) => st.floor === f.dataset.floorGo);
    if (i >= 0) focusStep(i); else setFloor(f.dataset.floorGo);
    return;
  }
  // 投稿の場所を選んでいるとき：部屋や会場を押したらそこ、それ以外（廊下・道・グラウンド）はその点。どこでもよい
  if (postPick) {
    const id = target?.closest?.("[data-id]")?.dataset.id;
    const p = id && place(id);
    if (p && !p.outdoor) { endPostPick(p.id); return; }
    const x = Math.round(view.x + lx / view.k), y = Math.round(view.y + ly / view.k);
    endPostPick(pointPlace(`pt-${floor}-${x}-${y}`).id);
    return;
  }
  // 地図で出発地・目的地を選んでいるとき：部屋や会場を押したらそこ、それ以外（廊下・道・グラウンド）はその点
  if (mapPicking) {
    const id = target?.closest?.("[data-id]")?.dataset.id;
    const p = id && place(id);
    if (p && !p.outdoor) { finishPick(p.id); return; }
    const x = Math.round(view.x + lx / view.k), y = Math.round(view.y + ly / view.k);
    finishPick(pointPlace(`pt-${floor}-${x}-${y}`).id);
    return;
  }
  const r = target?.closest?.("[data-id]");
  if (r) select(r.dataset.id);
  else if (mode === "place" || mode === "list") closeSheet();
}

// ---------- 描く ----------
// 折り返し階段の形。at の近くの外壁（20pt 以内）に長い辺をつける。約3m×4.5m
// box は [x, y, w, h] か、階ごとの { "1F": [...] }（ない階は 1F の形）
const boxOf = (l, fl) => (Array.isArray(l.box) ? l.box : l.box ? l.box[fl] ?? l.box["1F"] : null);
const STAIR_W = 11, STAIR_L = 16, LANDING_D = 4.5, TREAD = 1.6;
function stairShape(at, fl, link = {}) {
  const walls = BUILDINGS.flatMap((b) => (b[fl] && !b[fl].roof ? b[fl].rects ?? [] : []));
  const inside = (x, y) => walls.some(([bx, by, bw, bh]) => x > bx && x < bx + bw && y > by && y < by + bh);
  const [x, y] = at;
  const home = walls.find(([bx, by, bw, bh]) => x >= bx && x <= bx + bw && y >= by && y <= by + bh);
  // 壁の候補（外側が建物でない辺）。[壁の座標, 縦の壁か, 外の向き]
  let best = null;
  if (home) {
    const [bx, by, bw, bh] = home;
    for (const [pos, vert, dir] of [[bx, true, -1], [bx + bw, true, 1], [by, false, -1], [by + bh, false, 1]]) {
      const d = Math.abs((vert ? x : y) - pos);
      const out = vert ? !inside(pos + dir * 0.5, y) : !inside(x, pos + dir * 0.5);
      if (out && d <= 20 && (!best || d < best.d)) best = { pos, vert, dir, d };
    }
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  let r, vert, landStart;
  const box = boxOf(link, fl);
  if (box) {
    // 形を決めてある階段：ほかの階では stick の壁に合わせて動かす（その階の box があればそのまま）
    r = [...box];
    const c = [r[0] + r[2] / 2, r[1] + r[3] / 2];
    const h = walls.find(([bx, by, bw, bh]) => c[0] >= bx && c[0] <= bx + bw && c[1] >= by && c[1] <= by + bh);
    if (h && !link.box[fl]) for (const s of link.stick ?? []) {
      if (s === "top") r[1] = h[1];
      if (s === "bottom") r[1] = h[1] + h[3] - r[3];
      if (s === "left") r[0] = h[0];
      if (s === "right") r[0] = h[0] + h[2] - r[2];
    }
    if (link.shape === "L") return stairL(r, link.corner ?? "bl", link.flight ?? 9);
    vert = link.land === "top" || link.land === "bottom";
    landStart = link.land === "top" || link.land === "left";
    return stairDraw(r, vert, landStart, link.landing);
  }
  if (best) {
    vert = best.vert; // 縦の壁なら、段は縦に上り下りする
    const [bx, by, bw, bh] = home;
    if (vert) {
      const sx = best.dir < 0 ? best.pos : best.pos - STAIR_W;
      r = [sx, clamp(y - STAIR_L / 2, by, by + bh - STAIR_L), STAIR_W, STAIR_L];
    } else {
      const sy = best.dir < 0 ? best.pos : best.pos - STAIR_W;
      r = [clamp(x - STAIR_L / 2, bx, bx + bw - STAIR_L), sy, STAIR_L, STAIR_W];
    }
  } else {
    vert = true;
    r = [x - STAIR_W / 2, y - STAIR_L / 2, STAIR_W, STAIR_L];
  }
  // 踊り場は建物の端に近い方のはし
  const [rx0, ry0, rw0, rh0] = r;
  const mid = home ? (vert ? home[1] + home[3] / 2 : home[0] + home[2] / 2) : (vert ? y : x);
  landStart = vert ? ry0 + rh0 / 2 < mid : rx0 + rw0 / 2 < mid; // true なら踊り場は上（左）
  return stairDraw(r, vert, landStart);
}
// 90°に曲がる階段：box の2辺にそって段が並び、corner（tl・tr・bl・br）のすみが踊り場。t は段の幅
function stairL([x, y, w, h], corner, t) {
  const left = corner[1] === "l", top = corner[0] === "t";
  const land = [left ? x : x + w - t, top ? y : y + h - t, t, t];                  // 踊り場
  const up = [land[0], top ? y + t : y, t, h - t];                                 // たての段
  const side = [left ? x + t : x, land[1], w - t, t];                              // よこの段
  const lines = [];
  for (let v = up[1]; v <= up[1] + up[3] + 0.01; v += TREAD) lines.push(`M${up[0]} ${v}h${t}`);
  for (let v = side[0]; v <= side[0] + side[2] + 0.01; v += TREAD) lines.push(`M${v} ${side[1]}v${t}`);
  const svg = [land, up, side].map((r) => rectEl(...r, "stair-area")).join("") + `<path class="stair-steps" d="${lines.join("")}"/>`;
  return { svg, center: [land[0] + t / 2, land[1] + t / 2] };
}
function stairDraw(r, vert, landFar, LANDING = LANDING_D) {
  const [rx, ry, rw, rh] = r;
  const lines = [];
  if (vert) {
    const f0 = landFar ? ry + LANDING : ry, f1 = landFar ? ry + rh : ry + rh - LANDING;
    for (let t = f0; t <= f1 + 0.01; t += TREAD) lines.push(`M${rx} ${t}h${rw}`);
    lines.push(`M${rx + rw / 2} ${f0}V${f1}`);
  } else {
    const f0 = landFar ? rx + LANDING : rx, f1 = landFar ? rx + rw : rx + rw - LANDING;
    for (let t = f0; t <= f1 + 0.01; t += TREAD) lines.push(`M${t} ${ry}v${rh}`);
    lines.push(`M${f0} ${ry + rh / 2}H${f1}`);
  }
  const svg = rectEl(...r, "stair-area") + `<path class="stair-steps" d="${lines.join("")}"/>`;
  return { svg, center: [rx + rw / 2, ry + rh / 2] };
}

const rectEl = (x, y, w, h, cls, extra = "") => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}"${extra}/>`;
// いくつかの四角でできた場所（L字など）は、つなぎ目の線を出さずに外側の輪郭1本で描く
function shapeEl(rects, cls, extra = "") {
  if (rects.length === 1) return rectEl(...rects[0], cls, extra);
  return `<path class="${cls}" fill-rule="evenodd" d="${outline(rects)}"${extra}/>`;
}
// 四角をマス目に分ける（xs・ys が線、on(i, j) がそのマスが中か）
function grid(rects) {
  // 1pt 以内でずれている座標はそろえる（細い段差を作らない）
  const snap = (vals) => {
    const out = [];
    for (const v of [...new Set(vals)].sort((a, b) => a - b)) if (!out.length || v - out[out.length - 1] > 1) out.push(v);
    return (v) => out.reduce((b, o) => (Math.abs(o - v) < Math.abs(b - v) ? o : b));
  };
  const sx = snap(rects.flatMap(([x, , w]) => [x, x + w])), sy = snap(rects.flatMap(([, y, , h]) => [y, y + h]));
  const rs = rects.map(([x, y, w, h]) => [sx(x), sy(y), sx(x + w), sy(y + h)]);
  const xs = [...new Set(rs.flatMap((r) => [r[0], r[2]]))].sort((a, b) => a - b);
  const ys = [...new Set(rs.flatMap((r) => [r[1], r[3]]))].sort((a, b) => a - b);
  const on = (i, j) => {
    if (i < 0 || j < 0 || i >= xs.length - 1 || j >= ys.length - 1) return false;
    const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
    return rs.some((r) => cx > r[0] && cx < r[2] && cy > r[1] && cy < r[3]);
  };
  return { xs, ys, on };
}
// L字などの中に入る、いちばん大きい四角（名前やピンはここの真ん中に出す）
function innerRect(rects) {
  if (rects.length === 1) return rects[0];
  const { xs, ys, on } = grid(rects);
  let best = null;
  for (let i0 = 0; i0 < xs.length - 1; i0++) for (let j0 = 0; j0 < ys.length - 1; j0++) {
    for (let i1 = i0; i1 < xs.length - 1; i1++) for (let j1 = j0; j1 < ys.length - 1; j1++) {
      let full = true;
      for (let i = i0; i <= i1 && full; i++) for (let j = j0; j <= j1 && full; j++) full = on(i, j);
      if (!full) continue;
      const r = [xs[i0], ys[j0], xs[i1 + 1] - xs[i0], ys[j1 + 1] - ys[j0]];
      // 細長いものより、字が入りやすい形を少しだけ好む
      const score = r[2] * r[3] * Math.min(1, Math.min(r[2], r[3]) / 20);
      if (!best || score > best.score) best = { r, score };
    }
  }
  return best.r;
}
function outline(rects) {
  const { xs, ys, on } = grid(rects);
  // 塗ってあるマスと塗っていないマスの境目を、時計回りの向きの辺として集める
  const from = new Map();
  const add = (a, b) => { const k = a.join(); (from.get(k) ?? from.set(k, []).get(k)).push(b); };
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      if (!on(i, j)) continue;
      const [x0, x1, y0, y1] = [xs[i], xs[i + 1], ys[j], ys[j + 1]];
      if (!on(i, j - 1)) add([x0, y0], [x1, y0]);
      if (!on(i + 1, j)) add([x1, y0], [x1, y1]);
      if (!on(i, j + 1)) add([x1, y1], [x0, y1]);
      if (!on(i - 1, j)) add([x0, y1], [x0, y0]);
    }
  }
  // 辺をつないで輪にする（まっすぐ続く点は省く）
  let d = "";
  for (const [k, list] of from) {
    while (list.length) {
      const start = k.split(",").map(Number);
      const loop = [start];
      let cur = list.pop();
      while (cur.join() !== k) {
        loop.push(cur);
        const next = from.get(cur.join());
        if (!next?.length) break;
        cur = next.pop();
      }
      const pts = loop.filter((p, i) => {
        const a = loop[(i - 1 + loop.length) % loop.length], b = loop[(i + 1) % loop.length];
        return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]));
      });
      d += `M${pts.map((p) => p.join(" ")).join("L")}Z`;
    }
  }
  return d;
}
const icon = (x, y, cls, inner) => `<g class="ic ${cls}" style="transform: translate(${x}px, ${y}px) scale(var(--u)) rotate(var(--brg, 0deg))">${inner}</g>`;
// トイレは男女の人の形、多目的トイレは車いす
const MAN = '<circle cx="0" cy="-4.2" r="1.7"/><path d="M-2.6-1.8h5.2v4.4h-1.3v4.2h-2.6V2.6h-1.3z"/>';
const WOMAN = '<circle cx="0" cy="-4.2" r="1.7"/><path d="M-1.6-1.8H1.6L3.6 3.2H1.4V6.8H0.3V3.2H-0.3V6.8H-1.4V3.2H-3.6z"/>'; // 左右そろったスカートと足
const WHEEL = '<circle cx="-0.3" cy="-4.7" r="1.4"/><path class="ln" d="M-0.9-2.7v3.6h3.4l1.6 3.6"/><circle class="ln" cx="-0.7" cy="2.7" r="3.4"/>'; // 上下左右の真ん中に
// 男女の形は頭（-5.9）から足（6.8）までなので、0.45 上げて札の真ん中に
const person = (x, cls, inner, id = null) => `<g transform="translate(${x} 0)"${id ? ` data-id="${id}" style="cursor:pointer"` : ""}><rect class="bg ${cls}" x="-6.5" y="-7.5" width="13" height="15" rx="3"/><g class="fig"${cls === "hc" ? "" : ' transform="translate(0 -0.45)"'}>${inner}</g></g>`;
const ICON = {
  ev: '<rect class="bg" x="-7.5" y="-7.5" width="15" height="15" rx="3"/><text>EV</text>',
  st: '<rect class="bg" x="-7.5" y="-7.5" width="15" height="15" rx="3"/><path class="steps" d="M-4.5 4.5V1.5H-1.5V-1.5H1.5V-4.5H4.5V4.5z"/>', // ぬりつぶした3段
  door: '<rect class="bg" x="-7.5" y="-7.5" width="15" height="15" rx="3"/><path d="M-3 4.5V-4.5h6v9M-5 4.5h10"/><circle cx="1.4" cy="0.6" r="0.9"/>',
  // 駐輪場：自転車
  bike: '<rect class="bg" x="-8.5" y="-8.5" width="17" height="17" rx="3.5"/><g class="fg"><circle cx="-3.7" cy="2" r="2.7"/><circle cx="3.7" cy="2" r="2.7"/><path d="M-3.7 2L-1.3-2.2H2.3M-1.3-2.2L0.4 2L2.3-2.2L3.7 2M-2.4-3.8H-0.3M2.3-2.2L1.9-4.2H3.3"/></g>',
  // 撮影スポット：カメラ
  deco: '<rect class="bg" x="-8.5" y="-8.5" width="17" height="17" rx="4.5"/><g class="fg"><rect x="-5" y="-2.6" width="10" height="7" rx="1.4"/><circle cx="0" cy="0.9" r="1.9"/><path d="M-1.8-2.6l.8-1.5h2l.8 1.5"/></g>',
  // 自動販売機：箱に取り出し口と、上に並んだ飲み物
  vend: '<rect class="bg" x="-7.5" y="-7.5" width="15" height="15" rx="3"/><rect class="fg" x="-4.5" y="-5" width="9" height="10" rx="1"/><path d="M-3-3v2.5M0-3v2.5M3-3v2.5M-3 3h6"/>',
};

// 名前の字（部屋の幅に入るくらい拡大したときだけ出す）
const shortName = (n) => n.replace(/（.*?）|\(.*?\)/g, "").trim() || n;
const textW = (s, px) => [...s].reduce((a, c) => a + (c.charCodeAt(0) < 0x2000 ? px * 0.6 : px), 0);
function roomLabel(p, rect = p.labelRect ?? p.rect, text = null) {
  if (isToilet(p)) return "";
  const [x, y, w, h] = rect;
  const cx = x + w / 2, cy = y + h / 2;
  const name = text ?? (p.fest ? p.name : shortName(p.name));
  const code = p.code && !p.fest && p.kind !== "shed" && name !== p.code ? p.code : null;
  // 字が部屋に入る拡大率。kr は地図を 90° 回したとき（部屋の幅と高さが入れかわる）
  const ks = (w, h) => {
    const k1 = Math.max((textW(name, p.fest ? 13 : 12) + 6) / Math.max(4, w), 18 / Math.max(4, h), p.fest ? 0 : 1.1);
    return [k1, code ? Math.max(k1, 34 / Math.max(4, h), (textW(code, 9.5) + 6) / w) : Infinity];
  };
  const [k1, k2] = ks(w, h), [k1r, k2r] = ks(h, w);
  return `<text class="${p.fest ? "lb-fest" : ""}" x="${cx}" y="${cy}" data-for="${esc(p.id)}" data-k="${k1.toFixed(2)}" data-kr="${k1r.toFixed(2)}" data-k2="${k2}" data-k2r="${k2r}" data-dy="-6">${esc(name)}</text>` +
    (code ? `<text class="lb-code" x="${cx}" y="${cy}" data-for="${esc(p.id)}" data-k="${k2.toFixed(2)}" data-kr="${k2r.toFixed(2)}" data-dy="7">${esc(code)}</text>` : "");
}
// 模擬店は、お店の名前（大きく）と団体名（小さく）を並べて出す。
// 教室がまだわからないもの（その階の教室まとめ）は、まとめた範囲の真ん中に並べる
function shopLabels(p) {
  const [x, y, w, h] = p.labelRect ?? p.rect;
  const cx = x + w / 2, cy = y + h / 2;
  const lines = [];
  if (p.kind !== "shops") lines.push({ cls: "lb-fest", text: p.name, px: 13 });   // 会場（中庭・食堂など）の名前
  for (const x of p.shopList) {
    lines.push({ cls: "lb-shop", text: x.name, px: 12 });
    if (x.group && x.group !== x.name) lines.push({ cls: "lb-group", text: x.group, px: 8.5, tight: true });
  }
  const lh = (l) => (l.tight ? l.px + 3 : l.px + 6);
  const total = lines.reduce((a, l) => a + lh(l), 0);
  const maxW = Math.max(...lines.map((l) => textW(l.text, l.px)));
  // 横は少しはみ出してもよい（名前が見えるほうが大事）
  const ks = (w, h) => Math.max(p.zone ? 1.2 : 0.9, (total + 4) / Math.max(4, h), (maxW * 0.6) / Math.max(w, 50));
  const k = ks(w, h), kr = ks(h, w);
  let dy = -total / 2;
  return lines.map((l) => {
    const out = `<text class="${l.cls}" x="${cx}" y="${cy}" data-for="${esc(p.id)}" data-k="${k.toFixed(2)}" data-kr="${kr.toFixed(2)}" data-fix data-dy="${(dy + lh(l) / 2).toFixed(1)}">${esc(l.text)}</text>`;
    dy += lh(l);
    return out;
  }).join("");
}
// 学科展示は、学科の色（トップの学科のボタンと同じ）で塗る。色は --dc で渡す
const deptStyle = (p) => { const c = DEPT_EXHIBITS.find((d) => d.dept === p.dept)?.color; return c ? ` style="--dc:${c}"` : ""; };
// 学科展示：上に学科の名前（学科の色のぷっくりしたラベル）、その下に展示のタイトル
function deptLabels(p) {
  const [x, y, w, h] = p.labelRect ?? p.rect;
  const cx = x + w / 2, cy = y + h / 2;
  const ks = (w, h) => Math.max(0.8, 34 / Math.max(4, h), (Math.max(textW(p.name, 14), textW(p.dept, 10)) * 0.7) / Math.max(w, 30));
  const kk = `data-k="${ks(w, h).toFixed(2)}" data-kr="${ks(h, w).toFixed(2)}"`;
  return `<text class="lb-dept-sub"${deptStyle(p)} x="${cx}" y="${cy}" data-for="${esc(p.id)}" ${kk} data-fix data-dy="-6">${esc(p.dept)}</text>` +
    `<text class="lb-dept" x="${cx}" y="${cy}" data-for="${esc(p.id)}" ${kk} data-fix data-dy="11">${esc(p.name)}</text>`;
}
const festLabels = (p) => [p.shopList?.length ? shopLabels(p) : p.dept ? deptLabels(p) : roomLabel(p)];

// 屋外（敷地・道路・グラウンド・寮など）。どの階でも下に薄く描く（2階より上は薄く、押せない）
function siteSvg() {
  const out = [`<polygon class="site-bound" points="${SITE.boundary.join(" ")}"/>`];
  for (const pv of SITE.paved ?? []) out.push(`<polygon class="paved" points="${pv.join(" ")}"/>`);
  for (const pk of SITE.parking ?? []) out.push(`<polygon class="parking" points="${pk.join(" ")}"/>`);
  for (const r of SITE.publicRoads) out.push(`<polyline class="road-public" points="${r.pts.join(" ")}"/>`);
  // 名前のある道は、白い道の両ふちに色をつける（下に少し太い色の線を引いてから白い道をのせる）
  for (const r of SITE.roadNames ?? []) out.push(`<polyline class="road road-named" data-id="${r.id}" style="stroke:${r.color}" points="${r.pts.join(" ")}"/>`);
  for (const r of SITE.roads) out.push(`<polyline class="road" points="${r.join(" ")}"/>`);
  const flabels = [], fways = [];
  // 道の名前：道の上に、道の向きに沿わせる（地図と一緒に回る。逆さになるときだけ裏返す）。
  // 字は道幅に入る大きさで地図と一緒に拡大縮小し、読めないほど小さいときは出さない（kmin）
  const roadText = (cls, name, [x, y], [[x0, y0], [x1, y1]], kmin = 1.3, style = "") =>
    `<text class="lb-road ${cls}" x="${x}" y="${y}" data-k="${kmin}"${style ? ` style="${style}"` : ""} data-along="${((Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI).toFixed(1)}">${esc(name)}</text>`;
  for (const bw of SITE.bikeways ?? []) {
    out.push(`<polyline class="bikeway" data-id="${bw.id}" points="${bw.pts.join(" ")}"/>`);
    flabels.push(roadText("lb-bike", bw.name, bw.label, [[bw.label[0], 0], [bw.label[0], 1]]));
  }
  for (const f of SITE.footways ?? []) {
    fways.push(`<polyline class="footway" data-id="${f.id}" points="${f.pts.join(" ")}"/>`);
    flabels.push(roadText("lb-foot", f.name, f.label, f.along ?? [f.pts[0], f.pts[f.pts.length - 1]], 1.8));
  }
  for (const r of SITE.roadNames ?? []) flabels.push(roadText("", r.name, r.at, r.along, 1.3, `fill:${r.ink}`));
  const labels = [];
  for (const a of SITE.areas) {
    const shape = a.poly ? `<polygon class="area k-${a.kind}" data-id="${a.id}" points="${a.poly.join(" ")}"/>` : rectEl(...a.rect, `area k-${a.kind}`, ` data-id="${a.id}"`);
    out.push(shape);
    if (a.track) { const [x, y, w, h] = a.track; out.push(`<rect class="track" x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/>`); }
    if (a.icon) labels.push(`<g data-id="${a.id}" style="cursor:pointer">${icon(...a.label, `ic-${a.icon}`, `<title>${esc(a.name)}</title>${ICON[a.icon]}`)}</g>`); // 名前のかわりに印（駐輪場）
    else if (!a.hideLabel) labels.push(`<text class="lb-area k-${a.kind}" x="${a.label[0]}" y="${a.label[1]}" data-for="${a.id}">${esc(a.name)}</text>`); // hideLabel: 地図に名前を出さない（探せる）
  }
  out.push(...fways); // 歩行者専用の道はグラウンドなどの上に
  for (const b of SITE.buildings) {
    b.rects.forEach((r) => out.push(rectEl(...r, "bldg-edge")));
    b.rects.forEach((r) => out.push(rectEl(...r, "bldg-fill obldg", b.name ? ` data-id="${b.id}"` : "")));
    // 「〇棟」の名前は出さない（学生寮などはそのまま）
    if (b.name && !/棟$/.test(b.name)) labels.push(`<text class="lb-bldg" x="${b.label[0]}" y="${b.label[1]}" data-kmax="3.5">${esc(b.name)}</text>`);
  }
  labels.push(...flabels);
  const [gx, gy] = SITE.gate.at;
  labels.push(`<g data-id="gate" style="cursor:pointer">${icon(gx, gy, "ic-gate", `<rect class="bg" x="-17" y="-9" width="34" height="18" rx="9"/><text>${esc(SITE.gate.name)}</text>`)}</g>`);
  return { shapes: out.join(""), labels: labels.join("") };
}

let floorLayer = null;
function drawFloor() {
  const edges = [], fills = [], roofs = [], voids = [], labels = [];
  for (const b of BUILDINGS) {
    const f = b[floor];
    if (!f) continue;
    const shapes = f.rects ?? [];
    const poly = f.poly ? f.poly.join(" ") : null;
    if (f.roof) {
      shapes.forEach((r) => roofs.push(rectEl(...r, "bldg-roof")));
      if (poly) roofs.push(`<polygon class="bldg-roof" points="${poly}"/>`);
      continue;
    }
    // 輪郭を先に全部描いてから中を塗る → いくつかの四角が1つの建物に見える
    shapes.forEach((r) => { edges.push(rectEl(...r, "bldg-edge")); fills.push(rectEl(...r, "bldg-fill")); });
    if (poly) { edges.push(`<polygon class="bldg-edge" points="${poly}"/>`); fills.push(`<polygon class="bldg-fill" points="${poly}"/>`); }
    (f.voids ?? []).forEach((r) => voids.push(rectEl(...r, "bldg-void")));
  }
  const outLine = (p) => `<polyline class="out-path" points="${p.pts.join(" ")}"/>`;
  const outs = (PATHS[floor] ?? []).filter((p) => p.out && !p.over).map(outLine);
  const overs = (PATHS[floor] ?? []).filter((p) => p.over).map(outLine); // 中庭など、屋外の会場の中を通る道
  // 部屋（広いものから描いて、小さい部屋が上に来るように）。会場になっている部屋は会場として描く
  const rooms = [...places.values()].filter((p) => p.floor === floor && p.rect && !p.fest && !p.outdoor && p.kind !== "spot" && p.kind !== "aed" && p.kind !== "vending" && !byRoom.has(p.id))
    .sort((a, b) => b.rect[2] * b.rect[3] - a.rect[2] * a.rect[3]);
  const fest = [...places.values()].filter((p) => p.floor === floor && p.fest);
  const roomEls = rooms.map((p) => shapeEl(p.rects ?? [p.rect], `room k-${p.kind}`, ` data-id="${p.id}"`));
  // まとめた模擬店（〇棟〇階）は離れた教室の集まりなので、1部屋ずつ描く
  const festEls = fest.flatMap((p) => p.poly ? [`<polygon class="room k-${p.kind}" points="${p.poly.join(" ")}" data-id="${p.id}"${deptStyle(p)}/>`] : (p.zone ? p.rects.map((r) => [r]) : [p.rects ?? [p.rect]]).map((rs) => shapeEl(rs, `room k-${p.kind}${p.zone ? " is-zone" : ""}`, ` data-id="${p.id}"${deptStyle(p)}`)));
  const roomLabels = [...rooms.map((p) => roomLabel(p)), ...fest.flatMap(festLabels)];
  const site = siteSvg();
  // 印：トイレ・エレベーター・階段
  const icons = [];
  // 男女のトイレが並んでいるところは印を1つにまとめる
  const groups = [];
  for (const p of rooms.filter(isToilet)) {
    const c = centerOf(p);
    const hc = p.kind === "toilet-hc";
    const g = groups.find((g) => g.hc === hc && Math.hypot(g.x - c[0], g.y - c[1]) < 18);
    const kinds = p.kind === "toilet" ? ["toilet-m", "toilet-f"] : [p.kind];
    const ids = Object.fromEntries(kinds.map((k) => [k.replace("toilet-", ""), p.id])); // 印を押すと、そのトイレ
    if (g) { g.n++; g.x += (c[0] - g.x) / g.n; g.y += (c[1] - g.y) / g.n; kinds.forEach((k) => g.kinds.add(k)); g.ids = { ...ids, ...g.ids }; }
    else groups.push({ hc, x: c[0], y: c[1], n: 1, kinds: new Set(kinds), ids });
  }
  for (const g of groups) {
    if (g.hc) { icons.push(icon(g.x, g.y, "ic-wc", person(0, "hc", WHEEL, g.ids.hc))); continue; }
    const figs = [g.kinds.has("toilet-m") && ["m", MAN], g.kinds.has("toilet-f") && ["f", WOMAN]].filter(Boolean);
    icons.push(icon(g.x, g.y, "ic-wc", figs.map(([c, f], i) => person((i - (figs.length - 1) / 2) * 14, c, f, g.ids[c])).join("")));
  }
  const tapIcon = (id, html) => `<g data-id="${esc(id)}" style="cursor:pointer">${html}</g>`; // 押せる印
  if (floor === "1F") ENTRANCES.forEach((e, i) => icons.push(tapIcon(doorSpot(e)?.id ?? `door-${i}`, icon(...e.at, "ic-door", `<title>${esc(e.name)}</title>${ICON.door}`))));
  // 階段：折り返し階段（2本の段が並び、はしに踊り場）を、いちばん近い外の壁にくっつけて描く。印もその真ん中に出す
  const stairs = [];
  for (const l of LINKS) {
    if (!l.at[floor]) continue;
    if (l.kind === "ev") {
      // エレベーター：かごの四角に×（図面の記号）
      const [ex, ey, ew, eh] = boxOf(l, floor) ?? [l.at[floor][0] - 3.5, l.at[floor][1] - 3.5, 7, 7];
      stairs.push(rectEl(ex, ey, ew, eh, "ev-area") + `<path class="ev-cross" d="M${ex} ${ey}l${ew} ${eh}M${ex + ew} ${ey}l${-ew} ${eh}"/>`);
      icons.push(tapIcon(`${l.id}@${floor}`, icon(ex + ew / 2, ey + eh / 2, "ic-ev", ICON.ev)));
      continue;
    }
    const s = stairShape(l.at[floor], floor, l);
    stairs.push(s.svg);
    icons.push(tapIcon(`${l.id}@${floor}`, icon(...s.center, "ic-st", ICON.st)));
  }

  svg().innerHTML = `
    <defs><linearGradient id="e-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3d86f0"/><stop offset=".35" stop-color="#1361cc"/><stop offset=".65" stop-color="#0d5881"/><stop offset="1" stop-color="#ff5253"/></linearGradient><pattern id="m-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#ece7de"/><line x1="0" y1="0" x2="0" y2="6" stroke="#d6cfc2" stroke-width="2"/></pattern></defs>
    <rect class="ground" x="-2000" y="-2000" width="5000" height="5000"/>
    <g class="site${floor === "1F" ? "" : " is-dim"}">${site.shapes}</g>
    <g>${outs.join("")}</g>
    <g>${roofs.join("")}</g>
    <g>${edges.join("")}${fills.join("")}</g>
    <g>${voids.join("")}</g>
    <g id="m-rooms">${roomEls.join("")}${festEls.join("")}</g>
    <g class="stairs-layer">${stairs.join("")}</g>
    <g>${overs.join("")}</g>
    <g id="m-sel"></g>
    <g id="m-hl"></g>
    <g id="m-route"></g>
    <g id="m-labels"><g class="site-labels${floor === "1F" ? "" : " is-dim"}">${site.labels}</g>${labels.join("")}${roomLabels.join("")}</g>
    <g id="m-icons">${icons.join("")}</g>
    <g id="m-live"></g>
    <g id="m-deco">${[...places.values()].filter((p) => p.kind === "deco" && p.floor === floor).map((p) => `<g data-id="${p.id}" style="cursor:pointer">${icon(...p.at, `ic-deco g${p.grade}`, `<title>${esc(p.name)}</title>${ICON.deco}`)}</g>`).join("")}</g>
    <g id="m-vend">${(SITE.vending ?? []).filter((v) => v.floor === floor).map((v) => `<g data-id="${v.id}" style="cursor:pointer">${icon(...v.at, "ic-vend", `<title>${esc(v.name)}</title>${ICON.vend}`)}</g>`).join("")}</g>
    <g id="m-aed">${SITE.aed.filter((a) => a.floor === floor).map((a) => `<g data-id="${a.id}" style="cursor:pointer">${icon(...a.at, "ic-aed", '<rect class="bg" x="-12" y="-8" width="24" height="16" rx="4"/><text>AED</text>')}</g>`).join("")}</g>
    <g id="m-marks"></g>`;
  floorLayer = floor;
  labelKey = ""; // 字を描き直したので、次は必ず出し直す
  document.querySelectorAll(".m-floor").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.floor === floor)));
  applyView();
}

// 拡大率に合わせて字を出す・消す（名前と番号を2行で出せるときは上下にずらす）
let labelKey = ""; // 前に字を出したときの拡大率・向き・印（同じなら何もしない）
function updateLabels() {
  const k = view.k, b = cam.bearing;
  const key = `${k}|${b}|${[...markedIds].join()}|${[...badgeIds].join()}`;
  if (key === labelKey) return;
  labelKey = key;
  labelTop.clear();
  labelBottom.clear();
  // 横向き近く（90° 前後）まで回しているときは、部屋の幅と高さを入れかえた拡大率（kr）で字を出す
  const side = Math.abs(Math.sin((b * Math.PI) / 180)) > 0.7;
  const kOf = (t) => Number((side && t.dataset.kr) || t.dataset.k || 0);
  const isTwo = (t) => t.classList.contains("lb-code") || t.hasAttribute("data-fix") || k >= Number((side && t.dataset.k2r) || t.dataset.k2);
  // 印（いまここの点・ピン）をつけた場所の名前は、いちばん上の行が印の下に来るまでずらす（画面のピクセル）
  const shiftFor = new Map();
  for (const id of markedIds) {
    let top = Infinity;
    document.querySelectorAll(`#m-labels text[data-for="${CSS.escape(id)}"]`).forEach((t) => {
      if (k < kOf(t)) return; // 出ていない字
      top = Math.min(top, (isTwo(t) ? Number(t.dataset.dy) : 0) - 7);
    });
    if (top < Infinity) shiftFor.set(id, Math.max(0, 12 - top));
  }
  for (const id of badgeIds) if (!shiftFor.has(id) && badgeFits(id, k, b)) shiftFor.set(id, 10); // 札の分だけ名前を下げて、札と名前をまとめて部屋の真ん中に
  document.querySelectorAll("#m-labels text").forEach((t) => {
    if (t.dataset.kmax) t.classList.toggle("is-hidden", k > Number(t.dataset.kmax));
    else if (t.dataset.k) t.classList.toggle("is-hidden", k < kOf(t) / (t.classList.contains("is-hidden") ? 1 : 1.06)); // 出ている字は少し小さくなるまで消さない
    if (!t.hasAttribute("x") || !t.hasAttribute("y")) return; // アイコンの中の字（アイコンごと回している）
    if (t.dataset.along) {
      // 道の名前は道に沿ったまま地図と一緒に回る。画面で逆さになるときだけ 180° 返す
      let a = Number(t.dataset.along);
      if (Math.abs(normDeg(a + b)) > 90) a += 180;
      t.setAttribute("transform", `rotate(${normDeg(a)} ${t.getAttribute("x")} ${t.getAttribute("y")})`);
      return;
    }
    if (t.dataset.t0 == null) t.dataset.t0 = t.getAttribute("transform") ?? "";
    const two = t.dataset.k && isTwo(t);
    const dyPx = (two ? Number(t.dataset.dy) : 0) + (shiftFor.get(t.dataset.for) ?? 0), dy = dyPx / k;
    if (t.dataset.for && !t.classList.contains("is-hidden")) { // 札の列の位置
      const half = t.classList.contains("lb-code") ? 5 : 7;
      labelTop.set(t.dataset.for, Math.min(labelTop.get(t.dataset.for) ?? Infinity, dyPx - half));
      labelBottom.set(t.dataset.for, Math.max(labelBottom.get(t.dataset.for) ?? -Infinity, dyPx + half));
    }
    if (!b && !dy && !t.dataset.t0) { t.removeAttribute("transform"); return; }
    // 地図を回したぶん字を逆に回す（字の位置を中心に）。2行のずらしは回したあとの上下
    const x = t.getAttribute("x"), y = t.getAttribute("y");
    t.setAttribute("transform", `${b ? `rotate(${-b} ${x} ${y}) ` : ""}${dy ? `translate(0 ${dy}) ` : ""}${t.dataset.t0}`.trim());
  });
  updateBadges(); // 札の列を名前の下へ
}

// その場で変わるもの（混雑・NOW・スタンプ・道順・印）
export function renderMap() {
  if (!floorLayer) return;
  if (floorLayer !== floor) drawFloor();
  const s = getState();
  document.querySelectorAll("#m-rooms .room").forEach((el) => {
    const id = el.dataset.id;
    const lv = CROWD.venues.includes(id) ? CROWD.levels[s.crowd?.[id]?.level] : null;
    el.classList.toggle("has-crowd", !!lv);
    if (lv) el.style.setProperty("--lv", lv.color); else el.style.removeProperty("--lv");
    el.classList.toggle("is-selected", mode === "place" && id === selected);
  });
  const live = [];
  const rowIds = new Set();
  // 小さな札（NOW・待ち時間・Enistagram の数・スタンプ）は、名前（店名）のすぐ上に1列に並べる（名前に付いている感じ）。
  // 札の列は名前の真ん中に置き、下へずらす量は updateBadges で名前の行の数に合わせて決める。札は地図を回しても読める向き
  for (const p of places.values()) {
    if (!p.fest || p.floor !== floor) continue;
    const items = []; // [幅, 中身]
    if (s.phase === "during" && s.running?.some((e) => e.venue === p.id)) items.push([32, '<rect class="bg" x="-16" y="-8" width="32" height="16" rx="8"/><text>NOW</text>', "ic-now"]);
    const wt = worstWait(p, s); // 模擬店の待ち時間・売り切れ
    if (wt?.short) items.push([34, `<rect class="bg" x="-17" y="-8" width="34" height="16" rx="8"/><text>${wt.short}</text>`, `ic-wait ${wt.cls}`]);
    const nv = topPosts(s).filter((v) => v.place === p.id).length; // Enistagram の投稿の数（返信は数えない）
    if (nv) items.push([16, `<circle class="bg" r="8"/><text>${nv > 9 ? "9+" : nv}</text>`, "ic-voice"]); // ただの丸に数字
    const shops = p.shops ?? [];
    if (shops.length) {
      const done = shops.filter((id) => s.stamps?.includes(id)).length;
      items.push([16, `<circle class="bg" r="8"/><text>${done ? "縁" : shops.length}</text>`, "ic-stamp"]);
    }
    if (!items.length) continue;
    rowIds.add(p.id);
    const gap = 4, total = items.reduce((a, [w]) => a + w, 0) + gap * (items.length - 1);
    let x = -total / 2;
    const row = items.map(([w, inner, cls]) => { const g = `<g class="${cls}" transform="translate(${x + w / 2} 0)">${inner}</g>`; x += w + gap; return g; }).join("");
    const [lx, ly, lw, lh] = p.labelRect ?? p.rect;
    const [, , rw, rh] = p.rect; // 部屋の大きさ（札の列が部屋に入るときだけ出す）
    live.push(icon(lx + lw / 2, ly + lh / 2, "ic-badges", `<g class="row">${row}</g>`).replace('<g class="ic ', `<g data-for="${esc(p.id)}" data-id="${esc(p.id)}" style="cursor:pointer" data-rw="${total}" data-w="${rw}" data-h="${rh}" class="ic `));
  }
  badgeIds = rowIds;
  $("#m-live").innerHTML = live.join("");
  updateBadges();
  drawRoute();
  drawMarks();
  document.querySelectorAll(".m-floor").forEach((b) => {
    const other = rt.result?.legs.some((l) => l.floor === b.dataset.floor) && b.dataset.floor !== floor;
    b.querySelector(".dot").hidden = !other;
  });
  if ((mode === "place" || mode === "home") && !writing($("#m-sheet-body"))) renderSheet();
  renderFeed();
}

function drawRoute() {
  const g = $("#m-route");
  const r = rt.result;
  if (!r) { g.innerHTML = g._html = ""; return; }
  const parts = [];
  r.legs.forEach((leg, i) => {
    if (leg.floor !== floor) return;
    const pts = leg.pts.map((p) => p.join(",")).join(" ");
    parts.push(`<polyline class="rt-case" points="${pts}"/><polyline class="rt-line" points="${pts}"/><polyline class="rt-flow" points="${pts}"/>`);
    // 階段・エレベーターで別の階へ：押すとその階を出す
    const next = r.legs[i + 1], prev = r.legs[i - 1];
    if (next) parts.push(icon(...leg.pts[leg.pts.length - 1], "ic-floor", `<g data-floor-go="${next.floor}"><rect class="hit" x="-32" y="-38" width="64" height="40"/><rect class="bg" x="-22" y="-26" width="44" height="17" rx="8.5"/><text y="-17.5">${next.floor}へ ›</text></g>`));
    if (prev) parts.push(icon(...leg.pts[0], "ic-floor", `<g data-floor-go="${prev.floor}"><rect class="hit" x="-34" y="0" width="68" height="40"/><rect class="bg" x="-24" y="10" width="48" height="17" rx="8.5"/><text y="18.5">‹ ${prev.floor}から</text></g>`));
  });
  // 変わっていなければ描き直さない（流れる動きが 30 秒ごとに最初に戻らないように）
  const html = parts.join("");
  if (g._html !== html) g.innerHTML = g._html = html;
}

// 目印の位置（点の場所はその点、ほかは場所の真ん中）
const markPoint = (p) => (p.at ? p.at : centerOf(p));
let markedIds = new Set(); // 名前をずらす場所（今は使わない：名前は動かさない）
// 部屋・会場・グラウンドなど形のある場所は、ピンや点を置かずに輪郭の色で示す（名前の字を動かさない）。
// 点の場所（入口・AED・自販機・地図で選んだ点）だけ、ピンや点を置く
const hasShape = (p) => !p.at && !p.line;
function drawMarks() {
  const out = [], hl = [], shapes = new Map(); // shapes: 場所の id → 輪郭の印（is-here / is-start / is-dest）
  markedIds = new Set(); // 名前をずらす場所（もう使わない。名前は動かさない）
  const hp = here && place(here);
  if (hp && hp.floor === floor) {
    const [x, y] = markPoint(hp);
    // 向いている方向（扇形）。地図と一緒に回る（字や印のように逆には回さない）
    if (heading != null) out.push(`<g class="ic mk-cone" data-x="${x}" data-y="${y}" style="transform: ${coneTransform(x, y)}"><path d="M0 0L-15-38A41 41 0 0 1 15-38Z"/></g>`);
    if (hasShape(hp)) shapes.set(hp.id, "is-here");
    else out.push(icon(x, y, "mk-here", '<circle class="halo" r="16"/><circle class="dot" r="7"/>'));
  }
  const from = rt.result?.from;
  if (from && from.id !== hp?.id && from.floor === floor) {
    if (hasShape(from)) shapes.set(from.id, "is-start");
    else out.push(icon(...markPoint(from), "mk-start", '<circle class="dot" r="6"/>'));
  }
  const dest = rt.result ? rt.result.to : mode === "place" ? place(selected) : mode === "route" && rt.to ? place(rt.to) : null; // 道順がまだ（出発地をえらんでいる・同じ場所）でも目的地に印
  if (dest && dest.floor === floor) {
    // 通り（道）は、ピンではなく道全体に線を引く（道案内のときは着く所にピンも）
    if (dest.line) hl.push(`<polyline class="hl-case" points="${dest.line.join(" ")}"/><polyline class="hl-line" points="${dest.line.join(" ")}"/>`);
    if (dest.line && rt.result) out.push(icon(...rt.result.legs.at(-1).pts.at(-1), "mk-pin", PIN));
    else if (hasShape(dest)) shapes.set(dest.id, "is-dest");
    else if (!dest.line) out.push(icon(...markPoint(dest), "mk-pin", PIN));
  }
  const st = mode === "route" && rt.steps[rt.active];
  if (st && st.floor === floor) out.push(icon(...st.at, "mk-step", '<circle r="7"/>'));
  // 変わっていなければ描き直さない（ピンが落ちる動き・いまここの波が、描き直しのたびに最初に戻らないように）
  const hlHtml = hl.join(""), mkHtml = out.join(""), hlEl = $("#m-hl"), mkEl = $("#m-marks");
  if (hlEl._html !== hlHtml) hlEl.innerHTML = hlEl._html = hlHtml;
  if (mkEl._html !== mkHtml) mkEl.innerHTML = mkEl._html = mkHtml;
  // 輪郭の印をつけ直す
  document.querySelectorAll("#map-svg :is(.is-here, .is-start, .is-dest)").forEach((el) => el.classList.remove("is-here", "is-start", "is-dest"));
  for (const [id, cls] of shapes) document.querySelectorAll(`#map-svg :is(.room, .area, .obldg)[data-id="${CSS.escape(id)}"]`).forEach((el) => el.classList.add(cls));
  drawSelection([...shapes].filter(([, cls]) => cls === "is-dest").map(([id]) => id));
  updateLabels();
}
// 選んだ場所（行き先）：部屋の形を上に重ねて、色をのせる。出てきたときだけ、輪郭がすっと締まって波紋が1回広がる。
// 重ねは「glow（外のぼかし）→ tint（色）→ ripple（波紋）→ line（輪郭）」の順。止まったあとは動かさない（地図を描き直し続けないように）
function drawSelection(ids) {
  const g = $("#m-sel");
  if (!g) return;
  const key = ids.join();
  if (g._key === key) return; // 同じ場所のままなら描き直さない（動きが最初に戻らないように）
  g._key = key;
  const layers = { "sel-glow": [], "sel-tint": [], "sel-ripple": [], "sel-line": [] };
  for (const id of ids) {
    document.querySelectorAll(`#map-svg :is(.room, .area, .obldg)[data-id="${CSS.escape(id)}"]`).forEach((el) => {
      const c = el.cloneNode(false);
      for (const a of ["class", "data-id", "style", "id"]) c.removeAttribute(a);
      for (const [cls, list] of Object.entries(layers)) { const n = c.cloneNode(false); n.setAttribute("class", cls); list.push(n.outerHTML); }
    });
  }
  g.innerHTML = Object.values(layers).flat().join("");
}
const PIN = '<path d="M0 0C-3-7-11-11-11-19a11 11 0 0 1 22 0c0 8-8 12-11 19z"/><circle cy="-19" r="4"/>';

function setFloor(f) {
  if (f === floor) return;
  floor = f;
  drawFloor();
  renderMap();
}

// ---------- 下のシート ----------
const sheet = () => $("#m-sheet");
function setSheet(open) {
  sheet().classList.remove("is-min");
  sheet().classList.toggle("is-open", open);
  if (!open) $("#m-sheet-body").scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); // 半分ではスクロールできないので上へ
  $("#m-grip").setAttribute("aria-label", open ? "たたむ" : "広げる");
}
// シートをしまう（つまみだけ残す）
function minimizeSheet() {
  sheet().classList.remove("is-open");
  sheet().classList.add("is-min");
  $("#m-grip").setAttribute("aria-label", "広げる");
}
function closeSheet() {
  if (mapPicking) { endMapPick(); picking = null; }
  sheetBack = [];
  mode = "home";
  selected = null;
  listKind = null;
  syncUrl();
  updateChips();
  renderSheet();
  renderMap();
  setSheet(false);
}

// 模擬店の待ち時間（app/shop-manager.html でお店の人が入れる shops/{id}）
const WAIT = {
  normal: { label: "待ちなし", short: "", cls: "w0", rank: 0 },
  "10min": { label: "10分待ち", short: "10分", cls: "w10", rank: 1 },
  "20min": { label: "20分以上待ち", short: "20分+", cls: "w20", rank: 2 },
  soldout: { label: "売り切れ", short: "売切", cls: "sold", rank: 3 },
  closed: { label: "休業中", short: "休業", cls: "closed", rank: 3 },
};
// shops の1件が、地図のどのお店（SHOPS）のことか。map があればそれ（お店の名前・クラス・部屋番号）、なければ名前で
function shopDocFor(sh, list) {
  const n = norm(sh.name), room = sh.room ?? HOMEROOMS[sh.cls];
  return (list ?? []).find((d) => {
    if (d.map) return [sh.name, sh.cls, room].filter(Boolean).some((v) => norm(v) === norm(d.map));
    const dn = norm(d.name);
    return dn.length >= 2 && (dn === n || dn.includes(n) || n.includes(dn));
  }) ?? null;
}
function waitOf(sh, s) {
  const d = shopDocFor(sh, s.shops);
  const w = WAIT[d?.status];
  if (!w || !w.rank) return null; // 待ちなし（すぐ買える）は、何も出さない（情報がないときと同じ見た目）
  return { ...w, ago: d.updated_at ? s.agoText(d.updated_at) : "" };
}
// お店のひとこと（お店の人が書いたもの）
function msgHtml(sh, s) {
  const d = sh && shopDocFor(sh, s.shops);
  if (!d?.message) return "";
  return `<p class="sh-msg"><b>お店から</b>${esc(d.message)}${d.message_at ? `<small>${esc(s.agoText(d.message_at))}</small>` : ""}</p>`;
}
// 待ち時間・混雑の札：「待ちなし」の横に、いつの情報か（細い字）。会場の混雑も同じ形（ラベルは混みぐあい）
const statusPill = (x) => x ? `<span class="wait ${x.cls}${x.stale ? " is-stale" : ""}">${esc(x.label)}${x.ago ? `<small>${esc(x.ago)}</small>` : ""}</span>` : "";
// 場所の中のお店でいちばん待つもの（地図の印に使う）
function worstWait(p, s) {
  let w = null;
  for (const sh of p.shopList ?? []) { const x = waitOf(sh, s); if (x && (!w || x.rank > w.rank)) w = x; }
  return w;
}

const CROWD_CLS = ["w0", "w10", "w20", "sold"]; // 混雑の4段階を、模擬店の札と同じ色に（空いている 緑・ふつう 黄・混雑 赤・入場制限 灰）
function crowdOf(id, s) {
  if (!CROWD.venues.includes(id)) return null;
  const c = s.crowd?.[id];
  const lv = CROWD.levels[c?.level];
  if (!lv) return null;
  const stale = c.updated_at && s.now - c.updated_at > CROWD.staleMinutes * 60000;
  return { ...lv, cls: CROWD_CLS[c.level], ago: c.updated_at ? s.agoText(c.updated_at) : "", stale };
}

// 模擬店総選挙の投票フォーム（受付中でなければ null）。prefill があれば、そのお店を選んだ状態で開く
function voteUrl(shop, now) {
  const e = ELECTION;
  if (!e?.form || !shop || now < Date.parse(e.opens) || now >= Date.parse(e.closes)) return null;
  return e.prefill ? e.prefill.replace("{shop}", encodeURIComponent(shop.name)) : e.form;
}
const I = {
  vote: '<svg viewBox="0 0 24 24"><path d="M4 13h16v8H4zM8 13l-2-2 7-7 5 5-4 4"/><path d="M10.5 9.5l2 2 3-3"/></svg>',
  route: '<svg viewBox="0 0 24 24"><path d="M5 19c0-6 6-5 6-10V5M8 8l3-3 3 3M19 19V9"/></svg>',
  start: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5M5 13v6h14v-6"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  swap: '<svg viewBox="0 0 24 24"><path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4"/></svg>',
  start2: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="M6 20v-8a4 4 0 0 1 4-4h8M14 4l4 4-4 4"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="M18 20v-8a4 4 0 0 0-4-4H6M10 4L6 8l4 4"/></svg>',
  straight: '<svg viewBox="0 0 24 24"><path d="M12 20V4M7 9l5-5 5 5"/></svg>',
  exit: '<svg viewBox="0 0 24 24"><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/></svg>',
  enter: '<svg viewBox="0 0 24 24"><path d="M14 4h5v16h-5M9 8l4 4-4 4M13 12H3"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M4 20h5v-5h5v-5h6M16 4h4v4"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M4 8h5v5h5v5h6M16 20h4v-4"/></svg>',
  ev: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 10l3-3 3 3M9 14l3 3 3-3"/></svg>',
  goal: '<svg viewBox="0 0 24 24"><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  // ポスト：口をあけて話しているパックマン（口の中に「…」）
  post: '<svg viewBox="0 0 24 24"><path d="M16.6 5.2A9 9 0 1 0 16.6 18.8L9.5 12z"/><circle cx="9" cy="7.2" r="1.1" fill="currentColor" stroke="none"/><circle cx="13.3" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="17.3" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="21.3" cy="12" r="1.35" fill="currentColor" stroke="none"/></svg>',
  comment: '<svg viewBox="0 0 24 24"><path d="M20.5 11.5a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.4A8.5 8.5 0 1 1 20.5 11.5z"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="M21.5 3L10 14.5M21.5 3l-7 18-4.5-6.5L3.5 10z"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/></svg>',
  reply: '<svg viewBox="0 0 24 24"><path d="M10 7L4 12l6 5M4 12h9a7 7 0 0 1 7 7"/></svg>',
  walk: '<svg viewBox="0 0 24 24"><circle cx="13" cy="4.5" r="2"/><path d="M10 21l2.5-6.5L15 17v4M12.5 14.5l-1-5 3.5 2.5 3 1M11.5 9.5L8 11.5 7 15"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s6-5.6 6-11a6 6 0 0 0-12 0c0 5.4 6 11 6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5zM9 4v13.5M15 6.5V20"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="14" rx="2.5"/><circle cx="12" cy="13" r="3.5"/><path d="M8.5 6l1.5-2.5h4L15.5 6"/></svg>',
  pen: '<svg viewBox="0 0 24 24"><path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3"/></svg>',
  qr: '<svg viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/></svg>',
  // バリアフリー（車いすの人のマーク）
  access: '<svg viewBox="0 0 24 24"><circle cx="11" cy="4" r="1.7"/><path d="M11 7.5v5.5h5l2.5 5.5 1.8-.6M11 10h4.5M8.3 11.3A5 5 0 1 0 14.9 16.9"/></svg>',
};

let sheetKey = ""; // いま出しているシートの種類（切りかわったら上から出す）
function renderSheet() {
  const body = $("#m-sheet-body");
  const key = `${mode}|${selected}|${listKind}|${compose?.id}`;
  if (key !== sheetKey) { body.scrollTop = 0; body._html = ""; sheetKey = key; }
  sheet().classList.toggle("is-home", mode === "home");
  sheet().hidden = mode === "home"; // 最初（何も選んでいないとき）はシートを出さない
  const s = getState();
  if (mode === "route") return renderRouteSheet(body, s);
  if (mode === "compose") return renderCompose(body);
  if (mode === "list") return renderListSheet(body);
  const p = mode === "place" && place(selected);
  if (!p) return renderHome(body, s);
  const crowd = crowdOf(p.id, s);
  const events = EVENTS.filter((e) => e.venue === p.id).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const shops = (p.shops ?? []).map((id) => RALLY.shops.find((x) => x.id === id)).filter(Boolean);
  const picks = [...PICKUP_SHOPS, ...PICKUP_EVENTS].filter((x) => x.venue === p.id);
  const now = s.phase === "during" && s.running?.find((e) => e.venue === p.id);
  const hp = here && place(here);
  const isHere = hp?.id === p.id;
  const dist = hp && !isHere ? bestRoute(hp, p) : null;
  const one = p.shopList?.length === 1 && p.shopList[0].name === p.name ? p.shopList[0] : null; // お店1つだけの場所
  const oneWait = one && waitOf(one, s);
  const html = `
    ${p.tentative || p.roomGuess ? `<p class="sh-kind">${p.tentative ? "【場所は仮】" : "【教室は仮】"}</p>` : ""}
    <h2 class="sh-title">${esc(titleOf(p))}${statusPill(oneWait)}${statusPill(crowd)}</h2>
    <p class="sh-sub">${esc(subOf(p))}</p>
    ${one ? `<p class="sh-sub">${esc([one.group, one.food ? "食べもの" : ""].filter(Boolean).join("・"))}${genreTags(one)}</p>${msgHtml(one, s)}` : ""}
    <div class="sh-row">
      ${isHere ? `<span class="sh-badge is-here">${I.pin}いまここ</span>` : ""}
      ${now ? `<span class="sh-badge is-now">NOW ${esc(now.title)}</span>` : ""}
      ${dist ? `<span class="sh-badge">${I.walk}${dist.minutes}分・${dist.meters}m</span>` : ""}
      ${p.kind === "toilet-hc" ? '<span class="sh-badge">車いす・おむつ替え</span>' : ""}
    </div>
    ${p.desc || one?.note ? `<p class="sh-desc">${esc(p.desc || one.note)}</p>` : ""}
    <div class="sh-actions">
      ${isHere ? "" : `<button type="button" class="sh-btn primary" data-act="route">${I.route}経路</button>`}
      ${isHere ? "" : `<button type="button" class="sh-btn" data-act="from">${I.start}ここから</button>`}
      <button type="button" class="sh-btn is-icon" data-act="share" aria-label="共有" title="共有">${I.share}</button>
      ${p.kind === "deco" && DECOS.vote?.[p.grade] ? `<a class="sh-btn" href="${esc(DECOS.vote[p.grade])}" target="_blank" rel="noopener">投票する</a>` : ""}
      ${one && voteUrl(one, s.now) ? `<a class="sh-btn vote" href="${esc(voteUrl(one, s.now))}" target="_blank" rel="noopener">${I.vote}模擬店総選挙に投票</a>` : ""}
      ${canPost(p) ? `<button type="button" class="sh-btn e-post" data-act="post"><img src="assets/img/enistagram.webp" width="640" height="114" alt="Enistagram">にポスト</button>` : ""}
    </div>
    ${events.length ? `<h3 class="sh-h">企画</h3><ul class="sh-events">${events.map((e) => {
      const on = Date.parse(e.start) <= s.now && s.now < Date.parse(e.end);
      const past = Date.parse(e.end) <= s.now;
      return `<li class="${past ? "is-past" : ""}"><time>${md(e.start)} ${tStart(e)}</time>${esc(e.title)}${e.internal ? "（学内のみ）" : ""}${on ? "<em>NOW</em>" : ""}</li>`;
    }).join("")}</ul>` : ""}
    ${p.shopList?.length && !one ? `<h3 class="sh-h">模擬店${p.shopList.length > 1 ? `（${p.shopList.length}）` : ""}</h3><ul class="sh-shops">${p.shopList.map((x) => `<li>${voteUrl(x, s.now) ? `<a class="sh-vote" href="${esc(voteUrl(x, s.now))}" target="_blank" rel="noopener">${I.vote}投票</a>` : ""}<b>${esc(x.name)}</b>${(() => { const w = waitOf(x, s); return w ? ` ${statusPill(w)}` : ""; })()}<small>${esc(x.group)}${x.food ? "・食べもの" : ""}</small>${genreTags(x)}${msgHtml(x, s)}${x.note ? `<p>${esc(x.note)}</p>` : ""}</li>`).join("")}</ul>` : ""}
    ${p.zone ? `<p class="sh-hint">この階の教室（${esc(p.codes.join("・"))}）のどれかです。どの教室かは、当日は教室の入口の看板を見てください。</p>` : ""}
    ${shops.length ? `<h3 class="sh-h">スタンプラリー</h3><ul class="sh-events">${shops.map((x) => `<li><span class="mini-hanko${s.stamps?.includes(x.id) ? " on" : ""}">${s.stamps?.includes(x.id) ? "縁" : ""}</span>${esc(x.name)}</li>`).join("")}</ul>` : ""}
    ${picks.length ? `<h3 class="sh-h">みどころ</h3><ul class="sh-events">${picks.map((x) => `<li>${esc(x.name)}${x.note ? `<small>　${esc(x.note)}</small>` : ""}</li>`).join("")}</ul>` : ""}
    ${voiceSection(p, s)}`;
  if (body._html === html) return; // 変わっていなければ描き直さない（読んでいる所・押している所がそのまま）
  body.innerHTML = body._html = html;
  fillPhotos(body);
}

function renderHome(body, s) {
  const hp = here && place(here);
  const venues = MAP.places.map((v) => place(v.id)).filter((p) => p && (p.kind === "venue" || p.kind === "hq"));
  body.innerHTML = `
    ${hp ? `<p class="sh-kind">いまここ</p><h2 class="sh-title">${esc(titleOf(hp))}</h2><p class="sh-sub">${esc(subOf(hp))}</p>`
      : `<h2 class="sh-title">どこへ行く？</h2><p class="sh-hint">校内の入口や廊下にある「いまここ」QR をスマホのカメラで読むと、いまいる場所から道案内できます。</p>`}
    <div class="sh-venues">${venues.map((p) => {
      const c = crowdOf(p.id, s);
      const now = s.phase === "during" && s.running?.some((e) => e.venue === p.id);
      return `<button type="button" class="sh-venue${now ? " is-now" : ""}" data-go="${p.id}"><b>${esc(p.name)}</b><small>${c ? statusPill(c) : esc(p.floor)}${now ? "・NOW" : ""}</small></button>`;
    }).join("")}</div>`;
}

// 種類の一覧（トイレなど）。いまここがあれば近い順
const TOILET_FILTERS = [["all", "すべて"], ["f", "女性"], ["m", "男性"], ["hc", "多目的"]]; // 多目的は車いすの絵をつける
function toiletOk(p) {
  if (toiletFilter === "all") return true;
  if (toiletFilter === "hc") return p.kind === "toilet-hc";
  return p.kind === `toilet-${toiletFilter}` || p.kind === "toilet";
}
function renderListSheet(body) {
  if (listKind === "now") return renderNowSheet(body, getState());
  if (listKind === "stamp") return renderStampSheet(body, getState());
  const chip = CHIPS.find((c) => c.id === listKind);
  const hp = here && place(here);
  const items = [...places.values()].filter(chip.match).filter((p) => listKind !== "toilet" || toiletOk(p))
    .filter((p) => listKind !== "food" || genreFilter === "all" || p.shopList.some((x) => x.genre?.includes(genreFilter)))
    .map((p) => ({ p, r: hp && hp.id !== p.id ? bestRoute(hp, p) : null }))
    .sort((a, b) => (a.r?.cost ?? (a.p.floor === floor ? 0 : 1e6)) - (b.r?.cost ?? (b.p.floor === floor ? 0 : 1e6)));
  body.innerHTML = `
    ${hp ? '<p class="sh-kind">いまここから近い順</p>' : ""}
    <h2 class="sh-title">${esc(chip.label)}</h2>
    ${listKind === "food" ? `<div class="rt-opts g-filter">${[["all", "すべて"], ...GENRES.map((g) => [g.id, g.id])].map(([id, l]) => `<button type="button" class="rt-opt" data-gf="${esc(id)}" aria-pressed="${genreFilter === id}"${id === "all" ? "" : ` style="--g:${genreColor(id)}"`}>${esc(l)}</button>`).join("")}</div>` : ""}
    ${listKind === "toilet" ? `<div class="rt-opts">${TOILET_FILTERS.map(([id, l]) => `<button type="button" class="rt-opt" data-tf="${id}" aria-pressed="${toiletFilter === id}">${id === "hc" ? I.access : ""}${l}</button>`).join("")}</div>` : ""}
    <ul class="m-list">${items.map((it) => itemHtml({ ...it, sub: it.p.shopList?.length ? shopsSub(it.p) : undefined })).join("")}</ul>`;
}
// ---------- みんなの声（SNS：ポスト・★のレビュー・返信・いいね） ----------
// 書く入口は「ポスト」1つ。お店の場所では★をつけるとレビューになる（つけなくてもよい）
const stars = (n) => (n ? `<span class="v-stars" aria-label="★${n}">${"★".repeat(n)}${"☆".repeat(5 - n)}</span>` : "");
const topPosts = (s) => (s.posts ?? []).filter((x) => x.visible && !x.reply_to);
const repliesOf = (s, id) => (s.posts ?? []).filter((x) => x.visible && x.reply_to === id).sort((a, b) => a.created_at - b.created_at);
// いいねを押した直後は、Firestore の数が変わるまで ±1 して見せる
const likeAdj = new Map(); // id → { base, d }
const liking = new Set();  // 送っている途中のいいね（2回送らない）
const popAt = new Map();   // ハートがぽんと動いた時刻（描き直しで動きが切れないように）
function likeCount(x) {
  const a = likeAdj.get(x.id);
  if (a && a.base !== x.likes) likeAdj.delete(x.id);
  return (x.likes ?? 0) + (likeAdj.get(x.id)?.d ?? 0);
}
// Instagram のように：名前の丸いアイコン・四角い写真（写真がなければ文字のカード）・♡ 💬 ↗・いいね！n件・コメント
const openCmts = new Set(); // 「コメントをすべて見る」を開いた投稿
function postHtml(x, s, { withPlace = false, reply = false } = {}) {
  const on = liked(x.id), n = likeCount(x);
  const who = x.author ?? "enishi_guest";
  const heart = `<button type="button" class="v-act v-like${on ? " is-on" : ""}${Date.now() - (popAt.get(x.id) ?? 0) < 400 ? " is-pop" : ""}" data-like="${esc(x.id)}" aria-pressed="${on}" aria-label="いいね">${I.heart}`;
  if (reply) {
    // コメント：名前・本文・時間、右に小さな ♡
    return `<li class="v-post is-reply" data-post="${esc(x.id)}">${avatar(who, true)}
      <p class="ig-cmt"><b>${esc(who)}${x.official ? VERIFIED : ""}</b> ${esc(x.text)}<small><time>${esc(s.agoText(x.created_at))}</time>${n ? `<span data-likes-of="${esc(x.id)}">いいね！${n}件</span>` : `<span data-likes-of="${esc(x.id)}"></span>`}${x.official ? "" : `<button type="button" class="ig-report" data-report="${esc(x.id)}"${reported(x.id) ? " disabled" : ""}>${reported(x.id) ? "報告しました" : "報告"}</button>`}</small></p>
      ${heart}</button></li>`;
  }
  const p = withPlace && x.place && (place(x.place) ?? pointPlace(x.place));
  const reps = repliesOf(s, x.id);
  const review = x.kind === "review" && x.stars ? `${stars(x.stars)}${x.shop && titleOf(place(x.place)) !== x.shop ? `<b class="ig-shop">${esc(x.shop)}</b>` : ""}` : "";
  const len = [...(x.text ?? "")].length;
  // 写真、なければ文字のカード（ロゴの色のグラデーション）
  const shopTag = x.kind === "review" && x.shop && titleOf(place(x.place)) !== x.shop ? `<b class="ig-shop">${esc(x.shop)}</b>` : "";
  const media = x.has_photo
    ? `<div class="ig-media" data-dbl="${esc(x.id)}"><img class="v-photo" data-photo="${esc(x.id)}" alt="投稿の写真"${cachedPhoto(x.id) ? ` src="${cachedPhoto(x.id)}"` : ""}><span class="ig-burst" aria-hidden="true">${I.heart}</span>${x.photo_pending ? '<span class="ig-pending">本部で確認中（あなたにだけ見えています）</span>' : ""}</div>`
    : `<div class="tw-body">${x.kind === "review" && x.stars ? `<p class="tw-review">${stars(x.stars)}${shopTag}</p>` : ""}<p class="tw-text${len <= 25 ? " is-short" : ""}">${esc(x.text ?? "")}</p></div>`;
  const shown = openCmts.has(x.id) ? reps : reps.slice(-2);
  // キャプション：写真のときは★と本文。文字のカードのときは本文がカードにあるので、店名だけ（なければ出さない）
  const cap = x.has_photo ? `${review}${esc(x.text ?? "")}` : ""; // 文字だけの投稿は本文が上にあるので、キャプションは出さない
  return `<li class="v-post ig-post${x.has_photo ? "" : " is-text"}" data-post="${esc(x.id)}">
    <header class="ig-head">${avatar(who)}
      <div class="ig-who"><b>${esc(who)}${x.official ? VERIFIED : ""}</b>${p ? `<button type="button" class="ig-loc" data-go="${esc(p.id)}">${esc(titleOf(p))}</button>` : ""}</div>
      ${x.official ? "" : `<button type="button" class="ig-more" data-report="${esc(x.id)}" aria-label="この投稿を本部に報告"${reported(x.id) ? " disabled" : ""}>${I.more}</button>`}
    </header>
    ${media}
    <div class="ig-acts">
      ${heart}</button>
      <button type="button" class="v-act" data-reply="${esc(x.id)}" aria-label="コメントする" aria-expanded="false">${I.comment}</button>
      <button type="button" class="v-act" data-share-post="${esc(x.id)}" aria-label="シェア">${I.send}</button>
    </div>
    <p class="ig-likes" data-likes-of="${esc(x.id)}">${n ? `「いいね！」${n}件` : ""}</p>
    ${cap ? `<p class="ig-cap"><b>${esc(who)}</b> ${cap}</p>` : ""}
    ${reps.length > 2 && !openCmts.has(x.id) ? `<button type="button" class="ig-allc" data-allc="${esc(x.id)}">コメント${reps.length}件をすべて見る</button>` : ""}
    ${shown.length ? `<ul class="v-replies">${shown.map((r) => postHtml(r, s, { reply: true })).join("")}</ul>` : ""}
    <time class="ig-time">${esc(s.agoText(x.created_at))}</time>
    <div class="v-replybox" data-replybox="${esc(x.id)}" hidden></div>
  </li>`;
}
// ポストできる場所：お祭りの場所だけ（会場・学科展示・模擬店・撮影スポット）。ふつうの部屋・トイレ・本部などには出さない
const canPost = (p) => !!p && (p.fest || p.shopList?.length > 0 || p.kind === "deco") && p.kind !== "hq";
function voiceSection(p, s) {
  if (!canPost(p)) return "";
  const list = topPosts(s).filter((x) => x.place === p.id);
  if (!list.length) return "";
  const revs = list.filter((x) => x.kind === "review" && x.stars);
  const avg = revs.length ? revs.reduce((a, x) => a + x.stars, 0) / revs.length : 0;
  // Enistagram からの引用（埋め込み）の形：ロゴ「より」の枠の中に投稿を並べ、下から Enistagram を開ける
  return `<figure class="e-embed">
    <figcaption class="e-embed-head"><img src="assets/img/enistagram.webp" width="640" height="114" alt="Enistagram"><span>より・${list.length}件</span>${revs.length ? `<span class="v-avg">★${avg.toFixed(1)}</span>` : ""}</figcaption>
    <ul class="v-list">${list.slice(0, 20).map((x) => postHtml(x, s)).join("")}</ul>
    <button type="button" class="e-embed-more" data-feed-open>Enistagram で見る ›</button>
  </figure>`;
}
// 写真はあとから読む（1回読んだら覚えておく）
function fillPhotos(root) {
  observePhotos(root, (img) => img.closest(".f-cell")?.remove() ?? img.remove());
}
// 書く画面（どこでも同じ）。placeId：その場所に書く／pickPlace：場所をえらべる（なくてもよい）／replyTo：コメント（返信）
// Instagram の新規投稿のように：上に「キャンセル・新規投稿・シェア」、大きな四角で写真、キャプション、「場所を追加」
function composeForm(root, { placeId = null, replyTo = null, pickPlace = false, draft = null, onPickPlace, onDone, onCancel }) {
  const parent = replyTo && (getState().posts ?? []).find((x) => x.id === replyTo);
  let pid = draft?.place ?? placeId ?? parent?.place ?? "";
  let starsVal = 0, file = null;
  const hp = here && place(here);
  if (replyTo) {
    // コメント：Instagram のコメント欄のように1行
    root.innerHTML = `<form class="v-form ig-cform">${avatar("enishi_me", true)}
      <textarea name="text" maxlength="${MAX_TEXT}" rows="1" placeholder="${esc(parent?.author ?? "")} さんにコメントを追加…"></textarea>
      <button type="submit" class="ig-post-btn" value="send">投稿する</button>
      <p class="v-msg" role="status"></p></form>`;
  } else {
    root.innerHTML = `<form class="v-form ig-form">
      <header class="ig-fhead"><button type="button" class="ig-fbtn is-icon" data-cancel aria-label="キャンセル">${I.close}</button><b>新規投稿</b><button type="submit" class="ig-fbtn is-share is-icon" value="send" aria-label="シェア">${I.send}</button></header>
      <label class="ig-pick"><input type="file" name="photo" accept="image/*">
        <span class="ig-pick-empty">${I.camera}<b>写真を追加</b></span>
        <img class="v-preview" alt="えらんだ写真" hidden></label>
      <button type="button" class="v-unphoto" aria-label="写真を外す" hidden>×</button>
      <div class="ig-caprow">${avatar("enishi_me", true)}<textarea name="text" maxlength="${MAX_TEXT}" rows="3" placeholder="キャプションを入力…"></textarea></div>
      <small class="v-count">0 / ${MAX_TEXT}</small>
      ${pickPlace ? `<div class="ig-row ig-placerow"><button type="button" class="ig-placebtn" data-pickplace>${I.pin}<span>${pid ? esc(titleOf(place(pid))) : "場所を追加"}</span></button>${pid ? `<button type="button" class="ig-placeclear" aria-label="場所を外す">${I.close}</button>` : ""}</div>`
        : `<p class="ig-row">${I.pin}<span>${esc(titleOf(place(pid)))}</span></p>`}
      <div class="v-shopbox"></div>
      <p class="v-rule">顔や名札が写らないように。悪口・個人情報は書かないでください。すぐ公開され、本部が消すことがあります。</p>
      <p class="v-msg" role="status"></p>
    </form>`;
  }
  const f = root.querySelector("form"), msg = root.querySelector(".v-msg"), box = root.querySelector(".v-shopbox");
  // お店の場所なら、お店と★（★をつけるとレビュー。もう一度押すと外せる）
  const drawShops = () => {
    if (!box) return;
    const shops = place(pid)?.shopList ?? [];
    starsVal = 0;
    box.innerHTML = shops.length ? `${shops.length > 1 ? `<label class="ig-row"><span>お店</span><select name="shop">${shops.map((x) => `<option>${esc(x.name)}</option>`).join("")}</select></label>` : ""}
      <div class="ig-row"><span>${shops.length > 1 ? "" : `${esc(shops[0].name)}・`}★で評価（なくてもOK）</span>
      <span class="v-starpick" role="radiogroup" aria-label="★の数">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" aria-label="★${n}">☆</button>`).join("")}</span></div>` : "";
    box.querySelectorAll("[data-star]").forEach((b) => b.addEventListener("click", () => {
      const n = Number(b.dataset.star);
      starsVal = starsVal === n ? 0 : n;
      box.querySelectorAll("[data-star]").forEach((x) => (x.textContent = Number(x.dataset.star) <= starsVal ? "★" : "☆"));
    }));
  };
  drawShops();
  if (draft?.stars && box?.querySelector("[data-star]")) { starsVal = draft.stars; box.querySelectorAll("[data-star]").forEach((x) => (x.textContent = Number(x.dataset.star) <= starsVal ? "★" : "☆")); }
  if (draft?.shop && f.shop) f.shop.value = draft.shop;
  if (draft?.text) f.text.value = draft.text;
  // 場所を追加：地図へ移って、地図で場所を選ぶ（書いた文・写真・★はそのまま持っていく）
  root.querySelector("[data-pickplace]")?.addEventListener("click", () => onPickPlace?.({ text: f.text.value, file, place: pid, stars: starsVal, shop: f.shop?.value ?? null }));
  root.querySelector(".ig-placeclear")?.addEventListener("click", () => onPickPlace?.({ text: f.text.value, file, place: "", stars: 0, shop: null }, { reopen: true }));
  const count = root.querySelector(".v-count");
  f.text.addEventListener("input", () => {
    if (replyTo) { f.text.style.height = "auto"; f.text.style.height = `${Math.min(120, f.text.scrollHeight)}px`; } // コメント欄は書いた分だけのびる
    if (!count) return;
    count.textContent = `${f.text.value.length} / ${MAX_TEXT}`;
    count.classList.toggle("is-near", f.text.value.length >= MAX_TEXT - 10); // あと少しで書けなくなる
  });
  const pv = root.querySelector(".v-preview"), un = root.querySelector(".v-unphoto"), empty = root.querySelector(".ig-pick-empty");
  const showPhoto = (fl) => {
    file = fl;
    if (pv?.src) URL.revokeObjectURL(pv.src);
    if (pv) pv.hidden = !file;
    if (un) un.hidden = !file;
    if (empty) empty.hidden = !!file;
    if (file) pv.src = URL.createObjectURL(file); else pv?.removeAttribute("src");
  };
  f.photo?.addEventListener("change", () => showPhoto(f.photo.files[0] ?? null));
  if (draft?.file) showPhoto(draft.file);
  if (draft?.text && count) count.textContent = `${f.text.value.length} / ${MAX_TEXT}`;
  un?.addEventListener("click", () => { f.photo.value = ""; showPhoto(null); });
  root.querySelector("[data-cancel]")?.addEventListener("click", () => onCancel?.());
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const send = f.querySelector('[value="send"]'), cancel = root.querySelector("[data-cancel]");
    send.disabled = true;
    if (cancel) cancel.disabled = true;
    msg.textContent = "送っています…";
    const shops = place(pid)?.shopList ?? [];
    try {
      await submitPost({ kind: starsVal ? "review" : "post", place: pid, shop: starsVal ? (f.shop?.value ?? shops[0]?.name ?? null) : null,
        stars: starsVal || null, text: f.text.value, file, replyTo });
      if (f.isConnected) onDone?.(); else toast("公開しました");
    } catch (err) {
      msg.textContent = err.message;
      send.disabled = false;
      if (cancel) cancel.disabled = false;
    }
  });
  const left = cooldownLeft();
  if (left) msg.textContent = `続けて書くときは、あと${left}秒待ってください`;
  return f;
}
// 場所のシートの「ポスト」：シートを上まで広げて、その中で書く
let compose = null; // { id: 場所の id }
function openCompose(p) {
  pushSheet();
  mode = "compose";
  compose = { id: p.id };
  renderSheet();
  setSheet(true);
}
const closeCompose = () => $("#m-sheet-x").click(); // 前のシート（その場所）に戻る
function renderCompose(body) {
  // 書いている途中に地図の更新などで描き直さない（書いた字が消えないように）
  if (body.querySelector(`[data-compose="${CSS.escape(compose.id)}"]`)) return;
  const p = place(compose.id);
  body.innerHTML = `<div data-compose="${esc(p.id)}"><div class="v-box"></div></div>`;
  composeForm(body.querySelector(".v-box"), { placeId: p.id, onDone: () => { closeCompose(); toast("ありがとう！公開しました"); }, onCancel: closeCompose });
}
// いいね・返信・報告（場所のシートとタイムラインで共通）。扱ったら true
// 「いいね！n件」を出し直す（投稿とコメント）
function showLikes(id, x) {
  const n = x ? likeCount(x) : 0;
  document.querySelectorAll(`[data-likes-of="${CSS.escape(id)}"]`).forEach((el) => (el.textContent = n ? (el.classList.contains("ig-likes") ? `「いいね！」${n}件` : `いいね！${n}件`) : ""));
}
let lastMediaTap = { id: null, t: 0 };
function voiceClick(e) {
  // 写真（文字のカード）をダブルタップ：いいね（大きなハートがぽん）
  const md = e.target.closest("[data-dbl]");
  if (md) {
    const id = md.dataset.dbl, now = Date.now();
    if (lastMediaTap.id === id && now - lastMediaTap.t < 350) {
      lastMediaTap = { id: null, t: 0 };
      md.classList.remove("is-burst");
      void md.offsetWidth;
      md.classList.add("is-burst");
      const lk = md.closest(".v-post").querySelector(`.ig-acts [data-like]`);
      if (lk && !lk.classList.contains("is-on")) lk.click();
    } else lastMediaTap = { id, t: now };
    return true;
  }
  const all = e.target.closest("[data-allc]");
  if (all) { openCmts.add(all.dataset.allc); renderMap(); renderFeed(true); return true; }
  const sp = e.target.closest("[data-share-post]");
  if (sp) {
    const x = (getState().posts ?? []).find((y) => y.id === sp.dataset.sharePost);
    const url = new URL("map.html?tab=feed", location.href).href;
    const text = `${x?.text ? `「${x.text.slice(0, 40)}」` : "写真"}（Enistagram・函館高専祭）`;
    (navigator.share ? navigator.share({ title: "Enistagram", text, url }) : navigator.clipboard.writeText(url).then(() => toast("リンクをコピーしました"))).catch(() => {});
    return true;
  }
  const lk = e.target.closest("[data-like]");
  if (lk) {
    const id = lk.dataset.like, x = (getState().posts ?? []).find((y) => y.id === id);
    if (liking.has(id)) return true; // 送っている途中
    liking.add(id);
    const on = !lk.classList.contains("is-on");
    if (on) { popAt.set(id, Date.now()); lk.classList.remove("is-pop"); void lk.offsetWidth; lk.classList.add("is-pop"); }
    const a = likeAdj.get(id) ?? { base: x?.likes ?? 0, d: 0 };
    likeAdj.set(id, { base: a.base, d: a.d + (on ? 1 : -1) });
    lk.classList.toggle("is-on", on);
    lk.setAttribute("aria-pressed", String(on));
    showLikes(id, x);
    toggleLike(id).catch(() => {
      const b = likeAdj.get(id);
      if (b) likeAdj.set(id, { base: b.base, d: b.d - (on ? 1 : -1) });
      lk.classList.toggle("is-on", !on);
      showLikes(id, x);
      toast("いいねできませんでした");
    }).finally(() => liking.delete(id));
    return true;
  }
  const rp = e.target.closest("[data-reply]");
  if (rp) {
    const id = rp.dataset.reply;
    const box = rp.closest(".v-post").querySelector(`[data-replybox="${CSS.escape(id)}"]`);
    const close = () => { box.hidden = true; box.innerHTML = ""; rp.setAttribute("aria-expanded", "false"); if (rp.isConnected) rp.focus(); };
    if (!box.hidden) { close(); return true; }
    box.hidden = false;
    rp.setAttribute("aria-expanded", "true");
    composeForm(box, { replyTo: id, onDone: () => { close(); renderMap(); toast("返信しました"); }, onCancel: close }).text.focus();
    return true;
  }
  const rep = e.target.closest("[data-report]");
  if (rep) {
    if (!confirm("この投稿を本部に報告しますか？（悪口・個人情報・関係ない内容など）")) return true;
    rep.disabled = true;
    reportPost(rep.dataset.report).then(() => { if (!rep.classList.contains("ig-more")) rep.textContent = "報告しました"; toast("報告しました。ありがとうございます"); })
      .catch(() => { rep.disabled = false; toast("報告できませんでした"); });
    return true;
  }
  return false;
}
// 返信を書いている途中か（そのあいだは描き直さない）
const writing = (root) => !!root?.querySelector(".v-replybox:not([hidden]), [data-compose]");

// ---------- みんなの声タブ（タイムライン・写真） ----------
let settingTabFromPick = false;
let tab = "map";           // map / feed
let feedView = "timeline"; // timeline / photos
function setTab(t) {
  if (postPick && t === "feed" && !settingTabFromPick) { settingTabFromPick = true; endPostPick(undefined); settingTabFromPick = false; return; }
  tab = t;
  document.body.classList.toggle("is-feed", t === "feed");
  $("#m-feed").hidden = t !== "feed";
  document.querySelectorAll("#m-tabs [data-tab]").forEach((b) => { b.setAttribute("aria-selected", String(b.dataset.tab === t)); if (b.dataset.tab === t) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  if (t === "feed") { closeResults(); renderFeed(true); }
}
let feedHtml = ""; // いま出しているタイムラインの中身（同じなら描き直さない）
function renderFeed(force = false) {
  const list = $("#m-feed-list");
  if (tab !== "feed" || (!force && writing(list))) return;
  const s = getState();
  document.querySelectorAll("#m-feed [data-fv]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.fv === feedView)));
  let html;
  if (!s.posts) {
    html = `<p class="f-empty">${s.postsErr ? "つながりにくいようです。電波のよい所で開き直してください" : "読みこみ中…"}</p>`;
  } else {
    const posts = topPosts(s).sort((a, b) => b.created_at - a.created_at);
    if (feedView === "photos") {
      const pics = posts.filter((x) => x.has_photo);
      html = pics.length ? `<div class="f-grid">${pics.map((x) => `<button type="button" class="f-cell" data-open="${esc(x.id)}" aria-label="写真の投稿を見る"><img data-photo="${esc(x.id)}" alt=""${cachedPhoto(x.id) ? ` src="${cachedPhoto(x.id)}"` : ""}></button>`).join("")}</div>`
        : '<p class="f-empty">写真つきの投稿はまだありません</p>';
    } else {
      html = posts.length ? `<ul class="v-list">${posts.map((x) => postHtml(x, s, { withPlace: true })).join("")}</ul>`
        : '<p class="f-empty">まだ投稿はありません。<br>右下の「ポスト」から、最初のひとことをどうぞ</p>';
    }
  }
  if (!force && html === feedHtml) return; // 変わっていなければ描き直さない（読んでいる所・フォーカスがそのまま）
  // 読んでいる投稿が、新しい投稿が上に入ってもずれないように
  const sc = $("#m-feed"), top = sc.getBoundingClientRect().top + 70;
  const a = [...list.querySelectorAll(".v-list > .v-post")].find((li) => li.getBoundingClientRect().bottom > top);
  const aid = a?.dataset.post, ay = a?.getBoundingClientRect().top;
  list.innerHTML = feedHtml = html;
  const b = aid && sc.scrollTop > 0 && list.querySelector(`[data-post="${CSS.escape(aid)}"]`);
  if (b) sc.scrollTop += b.getBoundingClientRect().top - ay;
  fillPhotos(list);
}
function openFeedCompose(draft = null) {
  const box = $("#m-feed-compose");
  const close = () => { box.hidden = true; box.innerHTML = ""; $("#m-feed-post").hidden = false; };
  box.hidden = false;
  $("#m-feed-post").hidden = true;
  composeForm(box, { pickPlace: true, draft, onPickPlace: (d, o) => (o?.reopen ? (close(), openFeedCompose(d)) : startPostPick(d)), onDone: () => { close(); feedView = "timeline"; renderFeed(true); toast("ありがとう！公開しました"); }, onCancel: close });
  box.scrollTop = 0;
}

// ---------- 投稿の「場所を追加」：地図に移って、地図で選ぶ ----------
let postPick = null; // { draft }：地図で場所を選んでいるあいだ
function startPostPick(draft) {
  postPick = { draft };
  const box = $("#m-feed-compose");
  box.hidden = true; box.innerHTML = ""; $("#m-feed-post").hidden = false;
  setTab("map");
  let bar = $("#m-postpick");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "m-postpick";
    bar.className = "m-postpick";
    bar.setAttribute("role", "status");
    bar.innerHTML = `<span>${I.pin}投稿する場所を、地図でえらんでください</span><button type="button" data-pp="none">場所なし</button><button type="button" class="is-x" data-pp="cancel" aria-label="やめる">${I.close}</button>`;
    bar.addEventListener("click", (e) => {
      const b = e.target.closest("[data-pp]");
      if (b) endPostPick(b.dataset.pp === "none" ? "" : undefined);
    });
    (document.querySelector(".app-frame") ?? document.body).append(bar);
  }
  bar.hidden = false;
  document.body.classList.add("is-postpick");
  closeResults();
}
// id：えらんだ場所（"" は場所なし）／undefined は、やめる（場所はそのまま）。みんなの声に戻って、書いていた続きを開く
function endPostPick(id) {
  if (!postPick) return;
  const draft = { ...postPick.draft };
  if (id !== undefined) draft.place = id;
  postPick = null;
  $("#m-postpick") && ($("#m-postpick").hidden = true);
  document.body.classList.remove("is-postpick");
  setTab("feed");
  openFeedCompose(draft);
}

// 開催中：いまやっている企画と、このあと1時間に始まる企画（会場の混み具合つき）。待ち時間の長いお店も
function renderNowSheet(body, s) {
  const venueItem = (e, when, now) => {
    const p = place(e.venue);
    const c = p && crowdOf(p.id, s);
    return `<li><button type="button" class="m-item" ${p ? `data-go="${esc(p.id)}"` : "disabled"}><span class="ico k-venue">${now ? LIST_ICON.now : LIST_ICON.next}</span>
      <span class="txt"><b>${esc(e.title)}</b><small>${e.internal ? "学内のみ・" : ""}${esc(p ? titleOf(p) : "")}${when ? `・${esc(when)}` : ""}${c ? `・${esc(c.label)}` : ""}</small></span>
      ${now ? '<span class="sh-badge is-now">NOW</span>' : ""}</button></li>`;
  };
  if (s.phase !== "during") {
    body.innerHTML = `<p class="sh-kind">開催状況</p><h2 class="sh-title">開催中</h2>
      <p class="sh-hint">${s.phase === "before" ? "まだ始まっていません。当日はここに、いまやっている企画と待ち時間の長いお店が出ます。" : "今年の高専祭は終わりました。ありがとうございました！"}</p>`;
    return;
  }
  const t = s.now;
  const soon = EVENTS.filter((e) => Date.parse(e.start) > t && Date.parse(e.start) - t <= 3600000).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const busy = [...places.values()].filter((p) => p.shopList?.length).map((p) => ({ p, w: worstWait(p, s) })).filter((x) => x.w && x.w.rank >= 2)
    .sort((a, b) => b.w.rank - a.w.rank);
  body.innerHTML = `<p class="sh-kind">開催状況（リアルタイム）</p><h2 class="sh-title">開催中</h2>
    ${s.running?.length ? `<ul class="m-list">${s.running.map((e) => venueItem(e, e.end ? `〜${hhmm(e.end)}` : "", true)).join("")}</ul>` : '<p class="sh-hint">いまやっている企画はありません。</p>'}
    ${soon.length ? `<h3 class="sh-h">このあと1時間</h3><ul class="m-list">${soon.map((e) => venueItem(e, `${tPlain(e)}〜`, false)).join("")}</ul>` : ""}
    ${busy.length ? `<h3 class="sh-h">混んでいる・売り切れ・休業中のお店</h3><ul class="m-list">${busy.map(({ p, w }) => itemHtml({ p, sub: `${w.label}・${p.shopList.map((x) => x.name).join("・")}` })).join("")}</ul>` : ""}`;
}
// スタンプ：スタンプラリーのお店と、押したかどうか
function renderStampSheet(body, s) {
  const n = s.stamps?.length ?? 0;
  const list = RALLY.shops.map((x) => ({ x, p: [...places.values()].find((p) => p.shops?.includes(x.id)) ?? null, on: s.stamps?.includes(x.id) }));
  body.innerHTML = `<p class="sh-kind">スタンプラリー</p><h2 class="sh-title">スタンプ ${n} / ${Math.min(RALLY.goal, RALLY.shops.length || RALLY.goal)}</h2>
    ${list.length ? `<ul class="m-list">${list.map(({ x, p, on }) => `<li><button type="button" class="m-item" ${p ? `data-go="${esc(p.id)}"` : "disabled"}>
      <span class="mini-hanko${on ? " on" : ""}">${on ? "縁" : ""}</span><span class="txt"><b>${esc(x.name)}</b><small>${p ? esc(titleOf(p)) : "場所はお店で確認してください"}${on ? "・押した" : ""}</small></span></button></li>`).join("")}</ul>`
      : '<p class="sh-hint">対象のお店は決まりしだいここに出ます。</p>'}
    <div class="sh-actions"><a class="sh-btn primary" href="rally.html">スタンプカードを開く</a></div>`;
}
// 食べもののジャンルの札（しょっぱい系・甘い系…）
const genreColor = (g) => GENRES.find((x) => x.id === g)?.color ?? "#6b6b6b";
const genreTags = (x) => (x?.genre?.length ? `<span class="g-tags">${x.genre.map((g) => `<span class="g-tag" style="--g:${genreColor(g)}">${esc(g)}</span>`).join("")}</span>` : "");
let genreFilter = "all"; // 模擬店の一覧の絞りこみ
const shopsSub = (p) => { const w = worstWait(p, getState()); return `${w && w.rank ? `${w.label}・` : ""}${subOf(p)}　${p.shopList.map((x) => x.name).join("・")}`; };
const li = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const fig = (inner, vb = "-8 -8 16 16") => `<svg viewBox="${vb}" class="fig" aria-hidden="true">${inner}</svg>`;
const LIST_ICON = {
  venue: li('<path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/>'),        // 会場：マイク
  exhibit: li('<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.4 15h9.2"/>'),                // 学科展示：フラスコ
  hq: li('<path d="M5.5 21V3.5M5.5 4h11l-2.5 4 2.5 4h-11"/>'),                                                          // 本部：旗
  shop: li('<path d="M3.5 9L5 4h14l1.5 5M3.5 9h17M3.5 9a2.8 2.8 0 0 0 5.6 0 2.9 2.9 0 0 0 5.8 0 2.8 2.8 0 0 0 5.6 0M5 12v8h14v-8M10 20v-5h4v5"/>'), // 模擬店：屋台
  event: li('<path d="M12 3.5l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.5l-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>'),                         // 企画：星
  spot: li('<path d="M12 21s6-5.6 6-11a6 6 0 0 0-12 0c0 5.4 6 11 6 11z"/><circle cx="12" cy="10" r="2.2"/>'),              // 目印：ピン
  shed: li('<path d="M4 21V9l8-5 8 5v12M9.5 21v-6h5v6"/>'),                                                             // 建物
  outdoor: li('<path d="M12 3l5.5 7.5h-3.5l4.5 6.5H5.5l4.5-6.5H6.5zM12 17v4"/>'),                                          // 屋外：木
  aed: li('<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/><path d="M12.8 9.5l-2.3 3.4h3l-2.3 3.4"/>'), // AED：ハートにいなずま
  vending: li('<rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M9 7v3M12 7v3M15 7v3M9 16.5h6"/>'),             // 自動販売機
  now: li('<circle cx="12" cy="12" r="2.5"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>'), // いま：電波
  next: li('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),                                                // このあと：時計
  "toilet-m": fig(MAN),
  "toilet-f": fig(WOMAN),
  "toilet-hc": fig(WHEEL),
  toilet: fig(`<g transform="translate(-5 0)">${MAN}</g><g transform="translate(5 0)">${WOMAN}</g>`, "-12 -8 24 16"),
};
LIST_ICON.shops = LIST_ICON.shop;
LIST_ICON.stairs = li('<path d="M4 20h4v-4h4v-4h4V8h4"/>');                                        // 階段
LIST_ICON.ev = li('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 10l3-3 3 3M9 14l3 3 3-3"/>'); // エレベーター
LIST_ICON.door = li('<path d="M6 21V4h12v17M3 21h18"/><circle cx="14.5" cy="12.5" r="1" fill="currentColor"/>'); // 出入口
LIST_ICON.stamp = li('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><path d="M12 9.5v5M9.5 12h5"/>'); // スタンプ：はんこ
LIST_ICON.bike = li('<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l3.5-7h6M9.5 9L12 16l3.5-7L18 16M8 6.5h3M15.5 9l-.8-3h2.3"/>'); // 駐輪場：自転車
LIST_ICON.deco = li('<rect x="3" y="7" width="18" height="13" rx="2.5"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/>'); // 撮影スポット：カメラ
function itemHtml({ p, r, label, sub, kind }) {
  const k = kind ?? p.kind;
  const ic = LIST_ICON[k] ?? (k === "room" ? esc(p.code?.[0] ?? "") : ""); // 部屋は棟の文字（H・L…）、ほかは絵
  return `<li><button type="button" class="m-item" data-go="${esc(p.id)}"><span class="ico k-${k}${p.grade ? ` g${p.grade}` : ""}">${ic}</span>
    <span class="txt"><b>${esc(label ?? titleOf(p))}</b><small>${esc(sub ?? subOf(p))}</small></span>
    ${r ? `<span class="dist"><b>${r.minutes}分</b><br>${r.meters}m</span>` : ""}</button></li>`;
}

function renderRouteSheet(body, s) {
  const from = place(rt.from), to = place(rt.to);
  const r = rt.result;
  const floors = r ? [...new Set(r.legs.map((l) => l.floor))] : [];
  const crowd = to && crowdOf(to.id, s);
  const hp = here && place(here);
  body.innerHTML = `
    <div class="rt-ends">
      <span class="rail" aria-hidden="true"></span>
      <button type="button" class="rt-end${from ? "" : " is-empty"}" data-pick="from">${from ? esc(titleOf(from)) + (from.id === hp?.id ? "（いまここ）" : "") : "出発地を選ぶ"}</button>
      <button type="button" class="rt-swap" data-act="swap" aria-label="出発地と目的地を入れかえる">${I.swap}</button>
      <button type="button" class="rt-end${to ? "" : " is-empty"}" data-pick="to">${to ? esc(titleOf(to)) : "目的地を選ぶ"}</button>
    </div>
    ${!from ? `<p class="sh-hint">地図で出発地をタップするか、近くの「いまここ」QR を読んでください。</p>
      <div class="sh-actions"><button type="button" class="sh-btn qr-btn" data-act="scan">${I.qr}「いまここ」QRを読む</button></div>
      <ul class="m-list">${MAP.spots.map((sp) => itemHtml({ p: place(sp.id), kind: "spot" })).join("")}</ul>` : ""}
    ${from && to && from.id !== to.id ? `<div class="rt-sum"><button type="button" class="rt-bf" data-act="nostairs" aria-pressed="${rt.noStairs}"
        aria-label="バリアフリー（階段を使わず、エレベーターで行く）" title="バリアフリー">${I.access}</button>
      ${r ? `<b>${r.minutes}分</b><span>${r.meters}m・${floors.map((f) => f.replace("F", "階")).join(" → ")}</span>`
        : '<span class="rt-warn">道が見つかりませんでした。</span>'}</div>`
      : from && to ? '<p class="rt-sum"><b>ここ</b><span>出発地と目的地が同じ場所です</span></p>' : ""}
    ${r ? `<div class="rt-opts"><button type="button" class="rt-opt qr-btn" data-act="scan">${I.qr}「いまここ」QRを読む</button>
      <button type="button" class="rt-opt is-icon" data-act="share" aria-label="道順を共有" title="道順を共有">${I.share}</button></div>` : ""}
    ${crowd && crowd.label !== CROWD.levels[0].label ? `<p class="rt-warn">${esc(to.name)}はいま「${esc(crowd.label)}」です${crowd.ago ? `（${esc(crowd.ago)}）` : ""}</p>` : ""}
    ${r ? `<ol class="rt-steps">${rt.steps.map((st, i) => `<li class="${["up", "down", "ev"].includes(st.icon) ? "is-floor" : ""}${st.icon === "goal" ? " is-goal" : ""}${i === rt.active ? " is-active" : ""}">
      <button type="button" data-step="${i}"><span class="si">${I[st.icon] ?? I.start2}</span><span><b>${esc(st.text)}</b><small>${esc(st.sub ?? "")}・${st.floor}</small></span></button></li>`).join("")}</ol>` : ""}`;
}

// ---------- 選ぶ・道案内 ----------
// 道案内の文の目印（曲がり角のそばの部屋・会場、出入口の名前、通る道の名前）
const ptRectDist = ([x, y, w, h], [px, py]) => Math.hypot(Math.max(x - px, 0, px - (x + w)), Math.max(y - py, 0, py - (y + h)));
const ptLineDist = (pts, q) => Math.min(...pts.slice(1).map((b, i) => {
  const a = pts[i], ab = [b[0] - a[0], b[1] - a[1]], l2 = ab[0] ** 2 + ab[1] ** 2 || 1;
  const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * ab[0] + (q[1] - a[1]) * ab[1]) / l2));
  return Math.hypot(q[0] - (a[0] + ab[0] * t), q[1] - (a[1] + ab[1] * t));
}));
const ROUTE_HINTS = {
  // 曲がり角から 10pt（約3m）以内の部屋・会場（角がその中にあるものは除く）。会場やお店を先に、同じ名前が多い部屋（講義室など）は部屋番号で
  landmark(fl, pt) {
    let best = null;
    for (const p of places.values()) {
      if (p.floor !== fl || !p.rect || p.outdoor || p.point || p.zone || byRoom.has(p.id)) continue;
      const d = Math.min(...(p.rects ?? [p.rect]).map((r) => ptRectDist(r, pt)));
      if (d > 10 || d < 0.5) continue; // 角のそば（中にいる場所は目印にしない）
      const s = d - (p.fest ? 3 : 0) + (GENERIC.test(p.name) ? 3 : 0);
      if (!best || s < best.s) best = { p, s };
    }
    if (!best) return null;
    const p = best.p;
    return isToilet(p) ? "トイレ" : p.fest ? titleOf(p) : GENERIC.test(p.name) ? p.code ?? shortName(p.name) : shortName(p.name);
  },
  // 出入口の名前（地図の入口の印から 14pt 以内）
  door(fl, pt) {
    if (fl !== "1F") return null;
    const e = ENTRANCES.find((x) => Math.hypot(x.at[0] - pt[0], x.at[1] - pt[1]) < 14);
    return e ? e.name : null;
  },
  // a→b が名前のある道（〇〇ロード）を通るなら、その名前
  road(fl, a, b) {
    if (fl !== "1F" || !a || !b) return null;
    const q = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const r = [...(SITE.roadNames ?? []), ...(SITE.footways ?? []), ...(SITE.bikeways ?? [])].find((x) => ptLineDist(x.pts, q) < 9 && ptLineDist(x.pts, b) < 9);
    return r ? r.name : null;
  },
};
function select(id, { fly = true } = {}) {
  const p = place(id);
  if (!p) return;
  if (postPick) { endPostPick(p.id); return; }
  if (picking) { finishPick(p.id); return; }
  if (mode === "route") {       // 道案内中に部屋を押したら、出発地がまだならそこを出発地に、決まっていれば目的地にする
    if (!rt.from) rt.from = p.id; else rt.to = p.id;
    endMapPick();
    picking = null;
    computeRoute();
    return;
  }
  if (!(mode === "place" && selected === p.id)) pushSheet();
  selected = p.id;
  mode = "place";
  listKind = null;
  updateChips();
  if (p.floor !== floor) { floor = p.floor; drawFloor(); }
  syncUrl();
  renderMap();
  setSheet(false);
  if (fly) animateTo(p.rect ? viewFor(p.rect, 3.2) : viewFor([p.at[0] - 45, p.at[1] - 45, 90, 90], 2.4)); // 点の場所はまわりも見えるように
}

function startRoute(toId, fromId) {
  pushSheet();
  rt.to = toId ?? rt.to;
  rt.from = fromId ?? (here && place(here) ? place(here).id : rt.from);
  mode = "route";
  listKind = null;
  updateChips();
  computeRoute();
  // 出発地がまだ決まっていない（いまここがない）：そのまま地図をタップして出発地を選べるようにする
  if (!rt.from) { picking = "from"; beginMapPick(); }
}
// シートの高さが変わり終わってから地図を合わせる（途中の高さで計算すると、シートに隠れる）
function afterSheet(fn) {
  requestAnimationFrame(() => {
    const a = sheet().getAnimations();
    if (a.length) Promise.all(a.map((x) => x.finished)).then(fn, fn); else fn();
  });
}
function computeRoute() {
  if (rt.from && rt.to && (picking || mapPicking)) { picking = null; endMapPick(); }
  const from = place(rt.from), to = place(rt.to);
  rt.result = from && to && from.id !== to.id ? bestRoute(from, to, { noStairs: rt.noStairs }) : null;
  rt.steps = rt.result ? describe(rt.result, { from: titleOf(from), to: titleOf(to) }, ROUTE_HINTS) : [];
  rt.active = -1;
  syncUrl();
  if (rt.result) {
    const f = rt.result.legs[0].floor;
    if (f !== floor) { floor = f; drawFloor(); }
  }
  renderSheet();
  renderMap();
  setSheet(false);
  if (rt.result) afterSheet(() => fitRoute(rt.result.legs[0]));
  else if (rt.from && rt.from === rt.to) { const p = place(rt.to); if (p.floor !== floor) setFloor(p.floor); afterSheet(() => animateTo(p.rect ? viewFor(p.rect, 3.2) : viewFor([p.at[0] - 45, p.at[1] - 45, 90, 90], 2.4))); }
}
function fitRoute(leg) {
  const xs = leg.pts.map((p) => p[0]), ys = leg.pts.map((p) => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
  const p = 40 / viewFor([x0, y0, w, h], 4).k; // 画面で 40px ぶんあける
  animateTo(viewFor([x0 - p, y0 - p, w + 2 * p, h + 2 * p], 4));
}
function focusStep(i) {
  const st = rt.steps[i];
  if (!st) return;
  rt.active = i;
  const changed = st.floor !== floor;
  if (changed) { floor = st.floor; drawFloor(); }
  renderMap();
  renderSheet();
  setSheet(false); // 広げていたら半分にして、地図を見えるように
  document.querySelector(`#m-sheet [data-step="${i}"]`)?.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  afterSheet(() => animateTo(viewFor([st.at[0] - 25, st.at[1] - 25, 50, 50], 4.5)));
  if (changed) {
    toast(`${parseInt(st.floor)}階の地図に切りかえました`);
    const b = document.querySelector(`.m-floor[data-floor="${st.floor}"]`);
    b?.classList.remove("is-flash");
    void b?.offsetWidth; // アニメーションをもう一度
    b?.classList.add("is-flash");
  }
}

// 検索で出発地・目的地を選ぶ
function beginPick(which) {
  picking = which;
  const q = $("#m-q");
  q.placeholder = which === "from" ? "出発地をさがす（入口・部屋）" : "目的地をさがす";
  q.value = "";
  openResults();
  q.focus();
}
// 地図で選ぶ（検索の画面を閉じて、地図をタップしてもらう）
let mapPicking = false;
// 帯などは出さない（シートの「出発地を選ぶ」が青く光っているので、そのまま地図を押せばよい）
function beginMapPick() {
  const which = picking;
  closeResults();
  picking = which;
  mapPicking = true;
  setSheet(false);
}
function endMapPick() {
  mapPicking = false;
}
function finishPick(id) {
  const which = picking;
  endMapPick();
  closeResults();
  if (which === "from") rt.from = id; else rt.to = id;
  mode = "route";
  computeRoute();
}

async function share() {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  let text = "函館高専祭 校内マップ";
  if (mode === "route" && rt.to) {
    url.searchParams.set("to", rt.to);
    if (rt.from) url.searchParams.set("from", rt.from);
    text = `${titleOf(place(rt.to))}への道順（函館高専祭）`;
  } else if (selected) {
    url.hash = selected;
    text = `${titleOf(place(selected))}（函館高専祭 校内マップ）`;
  }
  try {
    if (navigator.share) { await navigator.share({ title: "函館高専祭 校内マップ", text, url: url.href }); return; }
    await navigator.clipboard.writeText(url.href);
    toast("リンクをコピーしました");
  } catch { /* 共有をやめたとき */ }
}
let toastT = 0;
function toast(msg) {
  const t = $("#m-toast");
  t.hidden = false;
  t.textContent = msg;
  t.classList.remove("is-off");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add("is-off"), 2600);
}

// ---------- QR を読む（いまここ） ----------
// カメラで校内の「いまここ」QR を読む。読めたら現在地にして、道案内中ならそこから案内しなおす。
// Android の Chrome などは BarcodeDetector、iPhone などは jsQR（読むときだけ読み込む）
let scan = null; // { stream, timer }
let jsqrP = null;
const loadJsQR = () => (jsqrP ??= new Promise((ok, ng) => {
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
  s.onload = () => (window.jsQR ? ok(window.jsQR) : ng(new Error("jsQR")));
  s.onerror = () => { jsqrP = null; ng(new Error("jsQR")); };
  document.head.append(s);
}));
function hereFromText(text) {
  try {
    const id = new URL(text, location.href).searchParams.get("here");
    return id && place(id) ? place(id).id : null;
  } catch { return null; }
}
const NO_CAMERA = "スマホのカメラアプリで QR を読んでも大丈夫です（道案内は続きから出ます）";
async function openScanner() {
  const dlg = $("#m-scan"), video = dlg.querySelector("video"), msg = dlg.querySelector(".scan-msg");
  msg.textContent = "カメラを準備しています…";
  dlg.querySelector(".scan-frame").classList.remove("is-ok");
  dlg.showModal();
  if (!navigator.mediaDevices?.getUserMedia) { msg.textContent = `このブラウザではカメラが使えません。${NO_CAMERA}`; return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    if (!dlg.open) { stream.getTracks().forEach((t) => t.stop()); return; }
    scan = { stream, timer: 0 };
    video.srcObject = stream;
    await video.play();
  } catch {
    msg.textContent = `カメラを使えませんでした。カメラを許可するか、${NO_CAMERA}`;
    return;
  }
  let detect;
  try {
    if ("BarcodeDetector" in window && (await BarcodeDetector.getSupportedFormats()).includes("qr_code")) {
      const bd = new BarcodeDetector({ formats: ["qr_code"] });
      detect = async () => (await bd.detect(video))[0]?.rawValue ?? null;
    } else {
      const jsQR = await loadJsQR();
      const c = document.createElement("canvas"), ctx = c.getContext("2d", { willReadFrequently: true });
      detect = async () => {
        const w = video.videoWidth, h = video.videoHeight;
        if (!w) return null;
        const s = Math.min(1, 640 / Math.max(w, h));
        c.width = Math.round(w * s);
        c.height = Math.round(h * s);
        ctx.drawImage(video, 0, 0, c.width, c.height);
        return jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: "dontInvert" })?.data ?? null;
      };
    }
  } catch {
    msg.textContent = `QR を読む準備ができませんでした。${NO_CAMERA}`;
    return;
  }
  const tick = async () => {
    if (!scan) return;
    let text = null;
    try { text = await detect(); } catch { /* 次のコマで */ }
    if (!scan) return;
    if (text) {
      const id = hereFromText(text);
      if (id) {
        navigator.vibrate?.(40);
        $("#m-scan .scan-frame").classList.add("is-ok");
        msg.textContent = "読めました";
        scan.timer = setTimeout(() => { closeScanner(); arriveHere(id); }, 300);
        return;
      }
      msg.textContent = "校内の「いまここ」QR ではないようです";
      clearTimeout(scan.msgT);
      scan.msgT = setTimeout(() => { if (scan) msg.textContent = "近くの「いまここ」QR を枠に入れてください"; }, 2000);
    }
    scan.timer = setTimeout(tick, 180);
  };
  tick();
}
function closeScanner() {
  if (scan) { clearTimeout(scan.timer); scan.stream.getTracks().forEach((t) => t.stop()); scan = null; }
  const dlg = $("#m-scan");
  dlg.querySelector("video").srcObject = null;
  if (dlg.open) dlg.close();
}
// QR を読めた：現在地にして、道案内中ならここから案内しなおす
function arriveHere(id) {
  setHere(id);
  const p = place(id);
  if (mode === "route" && rt.to === id) {
    rt = { ...rt, from: null, to: null, result: null, steps: [], active: -1 };
    closeSheet();
    select(id);
    toast("目的地に着きました");
    return;
  }
  if (mode === "route" && rt.to) {
    rt.from = id;
    computeRoute();
    toast(`現在地：${titleOf(p)}。ここから案内します`);
    return;
  }
  if (p.floor !== floor) setFloor(p.floor);
  renderMap();
  if (mode !== "home") renderSheet();
  const [x, y] = markPoint(p);
  animateTo(viewFor([x - 60, y - 60, 120, 120], 3));
  toast(`いまここ：${titleOf(p)}`);
}

// ---------- 検索 ----------
// 種類のボタン
const CHIPS = [
  { id: "now", label: "開催中", icon: LIST_ICON.now, match: (p) => getState().running?.some((e) => e.venue === p.id) },
  { id: "toilet", label: "トイレ", icon: LIST_ICON.toilet, match: (p) => isToilet(p) && !byRoom.has(p.id) },
  { id: "food", label: "模擬店", icon: LIST_ICON.shop, match: (p) => p.shopList?.length > 0 },
  { id: "exhibit", label: "学科展示", icon: LIST_ICON.exhibit, match: (p) => p.fest && p.kind === "exhibit" },
  { id: "venue", label: "会場", icon: LIST_ICON.venue, match: (p) => p.fest && p.kind === "venue" },
  { id: "stamp", label: "スタンプ", icon: LIST_ICON.stamp, match: (p) => p.shops?.length > 0 },
  { id: "hq", label: "本部", icon: LIST_ICON.hq, match: (p) => p.kind === "hq" },
  { id: "aed", label: "AED", icon: LIST_ICON.aed, match: (p) => p.kind === "aed" },
  { id: "vending", label: "自販機", icon: LIST_ICON.vending, match: (p) => p.kind === "vending" },
  { id: "deco", label: "装飾", icon: LIST_ICON.deco, match: (p) => p.kind === "deco" },
  { id: "bike", label: "駐輪場", icon: LIST_ICON.bike, match: (p) => p.id === "bike-parking" },
];
function updateChips() {
  document.querySelectorAll(".m-chip").forEach((b) => b.setAttribute("aria-pressed", String(mode === "list" && b.dataset.chip === listKind)));
}
// 表記ゆれをそろえる：全角半角・大文字小文字・カタカナ→ひらがな・小さい字→大きい字、のばし棒や記号は消す
const SMALL = { ぁ: "あ", ぃ: "い", ぅ: "う", ぇ: "え", ぉ: "お", っ: "つ", ゃ: "や", ゅ: "ゆ", ょ: "よ", ゎ: "わ", ゕ: "か", ゖ: "け" };
const norm = (s) => String(s ?? "").normalize("NFKC").toLowerCase()
  .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
  .replace(/[ぁぃぅぇぉっゃゅょゎゕゖ]/g, (c) => SMALL[c])
  .replace(/[\sー―‐\-－~～〜・･、。,.!！?？「」『』()（）[\]【】☆★♪♡&＆'"/]/g, "");
// よく使う漢字の読み・言いかえ（ひらがなや別の言い方でも見つかるように）
const ALIASES = [
  ["体育館", "たいいくかん アリーナ"], ["第一", "だいいち 1"],
  // ネーミングライツの愛称（愛称でも、ふつうの呼び方でも見つかるように）
  ["東京水道アリーナ", "とうきょうすいどう 第一体育館 たいいくかん"], ["太平洋セメントアリーナ", "たいへいようせめんと 第二体育館 たいいくかん"],
  ["ZACROS", "ざくろす ザクロス 第1講義室"], ["TSKE", "図書館 としょかん"], ["二十一食堂", "にじゅういち 学食 がくしょく"], ["未来コモンズ", "みらい コモンズ こもんず"],
  ["メデック", "めでっく 機械加工室"], ["CASTEM", "きゃすてむ キャステム NCプログラミング室"], ["Murase", "むらせ ムラセ 鋳造室 ちゅうぞう"], ["第二", "だいに 2"], ["第1", "だいいち"], ["第2", "だいに"],
  ["食堂", "しょくどう がくしょく ごはん"], ["学食", "がくしょく しょくどう ごはん"], ["図書館", "としょかん ライブラリー 本"],
  ["本部", "ほんぶ 案内 受付 救護 きゅうご 落とし物 おとしもの 迷子 まいご 景品"], ["玄関", "げんかん 入口 いりぐち"],
  ["中庭", "なかにわ"], ["保健室", "ほけんしつ 救護 けが"], ["講義室", "こうぎしつ 教室 きょうしつ"], ["教室", "きょうしつ"],
  ["実習工場", "じっしゅうこうじょう 工場 こうじょう"], ["学科展示", "がっかてんじ 展示 てんじ"], ["展示", "てんじ"],
  ["模擬店", "もぎてん 屋台 やたい お店 おみせ"], ["企画", "きかく ステージ イベント"], ["正門", "せいもん 入口 いりぐち 門"],
  ["学生寮", "がくせいりょう 寮 りょう"], ["寮", "りょう"], ["多目的", "たもくてき 車いす くるまいす バリアフリー"],
  ["階段", "かいだん"], ["焼き", "やき"], ["焼", "やき"], ["飲", "のみもの ドリンク"], ["会議室", "かいぎしつ"],
  ["社会基盤", "しゃかいきばん 土木"], ["物質環境", "ぶっしつかんきょう 化学"], ["情報", "じょうほう"], ["機械", "きかい"], ["電気", "でんき"],
  ["グラウンド", "運動場 うんどうじょう"], ["駐輪", "ちゅうりん 自転車"], ["サイクリング", "自転車 じてんしゃ"],
];
const GENRE_YOMI = { しょっぱい系: "しょっぱい 塩 しお", 甘い系: "あまい スイーツ デザート", がっつり系: "がっつり ごはん 主食 おなかいっぱい", ピリ辛系: "ぴりから 辛い からい", おやつ系: "おやつ お菓子 おかし", いやし系: "いやし 休憩 きゅうけい カフェ", ドリンク: "飲み物 のみもの" };
const aliasOf = (text) => ALIASES.filter(([w]) => text.includes(w)).map(([, a]) => a).join(" ");
// 名前の中の漢字をひらがなに置きかえた読み（「たこやき」で「たこ焼き」、「ほけんしつ」で「保健室」が出るように）
const YOMI = [
  ["お好み", "おこのみ"], ["焼き", "やき"], ["焼", "やき"], ["唐揚げ", "からあげ"], ["揚げ", "あげ"], ["綿", "わた"], ["飴", "あめ"],
  ["団子", "だんご"], ["餅", "もち"], ["麺屋", "めんや"], ["麺", "めん"], ["特製", "とくせい"], ["処", "どころ"], ["清", "きよし"], ["茶", "ちゃ"],
  ["体育館", "たいいくかん"], ["第一", "だいいち"], ["第二", "だいに"], ["食堂", "しょくどう"], ["学食", "がくしょく"], ["図書館", "としょかん"],
  ["本部", "ほんぶ"], ["玄関", "げんかん"], ["中庭", "なかにわ"], ["保健室", "ほけんしつ"], ["講義室", "こうぎしつ"], ["教室", "きょうしつ"],
  ["実習工場", "じっしゅうこうじょう"], ["見学", "けんがく"], ["展示", "てんじ"], ["模擬店", "もぎてん"], ["企画", "きかく"], ["正門", "せいもん"],
  ["学生寮", "がくせいりょう"], ["寮", "りょう"], ["多目的", "たもくてき"], ["男子", "だんし"], ["女子", "じょし"], ["会議室", "かいぎしつ"],
  ["学生課", "がくせいか"], ["総務課", "そうむか"], ["相談室", "そうだんしつ"], ["実験", "じっけん"], ["研究会", "けんきゅうかい"], ["部", "ぶ"],
];
const yomi = (text) => { let r = text; for (const [w, k] of YOMI) r = r.split(w).join(k); return r === text ? "" : r; };
// 階の言い方（2F・2階・にかい）
const floorWords = (f) => (f ? `${f} ${parseInt(f)}階 ${["", "いっかい", "にかい", "さんかい", "よんかい"][parseInt(f)] ?? ""}` : "");

let index = [];
// 1つの候補：f1 名前（いちばん大事）、f2 団体・部屋・建物・階、f3 説明・言いかえ
function addItem(item, f1, f2, f3) {
  const all = [f1, f2, f3].join(" ");
  const r1 = yomi(f1), r2 = yomi(f2);
  index.push({ ...item, f1: norm(`${f1} ${r1}`), f2: norm(`${f2} ${r2}`), f3: norm(`${f3} ${aliasOf(all)}`),
    words: `${f1} ${r1}`.split(/\s+/).map(norm).filter(Boolean) });
}
function buildIndex() {
  index = [];
  for (const p of places.values()) {
    if (byRoom.has(p.id)) continue; // 会場になっている部屋は会場として出す
    const b = buildingAt(p.floor, centerOf(p));
    const cls = CLASS_OF[p.code] ? `${CLASS_OF[p.code]} ${CLASS_OF[p.code].replace(/^(\d)S(?=[MEJ])/, "$1S-")}教室` : "";
    const kindWords = [
      isToilet(p) ? "トイレ お手洗い おてあらい 便所 べんじょ wc" : "",
      p.kind === "toilet-f" ? "女子 女性 じょし" : p.kind === "toilet-m" ? "男子 男性 だんし" : p.kind === "toilet-hc" ? "車いす 多目的 おむつ" : "",
      p.kind === "aed" ? "aed えーいーでぃー 救急 心臓" : "", p.kind === "vending" ? "自販機 じはんき 自動販売機 飲み物 のみもの ドリンク ジュース 水 お茶" : "",
      p.kind === "stairs" ? "階段 かいだん" : p.kind === "ev" ? "エレベーター えれべーたー ev 車いす バリアフリー" : p.kind === "door" ? "出入口 入口 いりぐち 出口 でぐち 玄関" : "",
      p.kind === "deco" ? `装飾 そうしょく 校内装飾 撮影 さつえい 撮影スポット フォト 写真 映え モニュメント 顔はめ ${DECOS.themes[p.grade]}` : "",
      p.id === "bike-parking" ? "駐輪場 ちゅうりんじょう 自転車 じてんしゃ バイク" : "", p.zone ? "模擬店 お店" : "", p.kind === "exhibit" ? "学科展示" : "",
      p.kind === "venue" ? "会場" : "", p.kind === "spot" ? "入口 目印 いまここ" : "",
      (p.shopList ?? []).flatMap((x) => x.genre ?? []).map((g) => `${g} ${g.replace("系", "")} ${GENRE_YOMI[g] ?? ""}`).join(" "),
    ].join(" ");
    addItem({ p, rank: p.fest || ["aed", "vending", "deco"].includes(p.kind) ? 0 : p.kind === "spot" || p.outdoor ? 1 : isToilet(p) ? 2 : 3 },
      [p.name, titleOf(p), p.code, ...(p.codes ?? []), p.dept].filter(Boolean).join(" "),
      [p.sub, p.roomName, cls, b?.name, b?.sub, floorWords(p.floor), p.id].filter(Boolean).join(" "),
      [p.desc, kindWords].filter(Boolean).join(" "));
  }
  for (const p of places.values()) {
    for (const x of p.shopList ?? []) {
      addItem({ p, kind: "shop", label: x.name, sub: `${x.group}・${titleOf(p)}`, rank: 0.4 },
        x.name, [x.group, x.cls, x.cls ? `${x.cls}教室` : "", titleOf(p), floorWords(p.floor)].filter(Boolean).join(" "),
        `${x.note ?? ""} 模擬店 お店${x.food ? " 食べ物 たべもの ごはん" : ""}`);
    }
  }
  const shopPlace = (sid) => [...places.values()].find((p) => p.shops?.includes(sid));
  for (const x of RALLY.shops) {
    const p = shopPlace(x.id);
    if (p) addItem({ p, kind: "shop", label: x.name, sub: `スタンプラリー・${titleOf(p)}`, rank: 0.5 }, x.name, titleOf(p), p.kind === "shop" || p.fest ? "お店 模擬店 スタンプラリー" : "スタンプラリー");
  }
  for (const x of PICKUP_SHOPS) {
    const p = place(x.venue);
    if (p) addItem({ p, kind: "shop", label: x.name, sub: `${x.group ?? ""}・${titleOf(p)}`, rank: 0.5 }, x.name, [x.group, titleOf(p)].filter(Boolean).join(" "), `${x.note ?? ""} お店 模擬店`);
  }
  for (const e of EVENTS) {
    const p = place(e.venue);
    if (p) addItem({ p, kind: "event", label: e.title, sub: `${md(e.start)} ${tPlain(e)}〜・${titleOf(p)}${e.internal ? "・学内のみ" : ""}`, rank: 0.6 }, e.title, titleOf(p), "企画 ステージ イベント");
  }
  // ステージの出演者（バンド名などでさがせる）
  const sp = place(STAGE.venue);
  if (sp) for (const a of STAGE.acts) addItem({ p: sp, kind: "event", label: a.name, sub: `${md(a.start)} ${tPlain(a)}〜・ステージ${a.kind ? `・${a.kind}` : ""}`, rank: 0.6 }, a.name, titleOf(sp), `ステージ 出演 ${a.kind ?? ""}`);
}
// 2文字ずつのかたまりの重なり（打ち間違い・うろ覚え用）
const bigrams = (s) => { const out = new Set(); for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2)); return out; };
function similar(a, b) {
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a), B = bigrams(b);
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return (2 * n) / (A.size + B.size);
}
// 1つの言葉がどれだけ合うか（合わなければ 0）
function termScore(it, t) {
  if (it.words.some((w) => w === t)) return 100;          // 名前（部屋番号など）とぴったり
  if (it.f1 === t) return 100;
  if (it.words.some((w) => w.startsWith(t)) || it.f1.startsWith(t)) return 70;
  if (it.f1.includes(t)) return 50;
  if (it.f2.includes(t)) return 28;
  if (it.f3.includes(t)) return 12;
  return 0;
}
function search(q) {
  const terms = String(q ?? "").split(/[\s　]+/).map(norm).filter(Boolean);
  if (!terms.length) return [];
  const scored = [];
  for (const it of index) {
    let s = 0;
    for (const t of terms) {
      const v = termScore(it, t);
      if (!v) { s = 0; break; }   // 言葉はぜんぶ合っているものだけ
      s += v;
    }
    if (s) scored.push({ it, s: s - it.rank * 6 });
  }
  // 見つからないときは、名前が似ているものを出す（打ち間違い・うろ覚え）。部屋番号のような英数字だけのときは出さない
  const whole = terms.join("");
  if (!scored.length && !/^[a-z0-9]+$/.test(whole) && whole.length >= 3) {
    const seen = new Set(scored.map((x) => x.it));
    for (const it of index) {
      if (seen.has(it)) continue;
      const sim = Math.max(similar(whole, it.f1), ...it.words.map((w) => similar(whole, w)));
      if (sim >= 0.45) scored.push({ it, s: sim * 40 - it.rank * 6 });
    }
  }
  // 同じ場所・同じ名前が何度も出ないように
  const out = [], keys = new Set();
  for (const x of scored.sort((a, b) => b.s - a.s)) {
    const k = `${x.it.p.id}|${x.it.label ?? titleOf(x.it.p)}`; // 見た目が同じ（同じ場所・同じ名前）なら1つに
    if (keys.has(k)) continue;
    keys.add(k);
    out.push(x.it);
    if (out.length >= 40) break;
  }
  return out;
}
function openResults() {
  document.body.classList.add("is-searching"); // 検索中は種類のボタンを隠す（結果とかぶらないように）
  $("#m-results").hidden = false;
  $("#m-clear").hidden = false;
  renderResults();
}
function closeResults() {
  document.body.classList.remove("is-searching");
  $("#m-results").hidden = true;
  $("#m-clear").hidden = true;
  $("#m-q").value = "";
  $("#m-q").blur();
  picking = null;
  endMapPick();
  $("#m-q").placeholder = SEARCH_PH;
}
function renderResults() {
  const q = $("#m-q").value;
  const box = $("#m-results");
  if (!q.trim()) {
    const fest = MAP.places.map((v) => place(v.id)).filter(Boolean);
    const hp = here && place(here);
    box.innerHTML = `
      ${picking ? `<button type="button" class="m-mappick" data-mappick>${I.map}地図で選ぶ</button>` : ""}
      ${picking === "from" && hp ? `<h3>いまここ</h3><ul class="m-list">${itemHtml({ p: hp, kind: "spot" })}</ul>` : ""}
      ${picking === "from" ? `<h3>入口・目印</h3><ul class="m-list">${MAP.spots.map((sp) => itemHtml({ p: place(sp.id), kind: "spot" })).join("")}</ul>` : ""}
      <h3>お祭りの会場</h3><ul class="m-list">${fest.map((p) => itemHtml({ p })).join("")}</ul>
      <p class="m-empty">部屋番号（例：L107）や「講義室」「トイレ」でもさがせます</p>`;
    return;
  }
  const hits = search(q);
  box.innerHTML = hits.length
    ? `<ul class="m-list">${hits.map((it) => itemHtml({ p: it.p, label: it.label, sub: it.sub, kind: it.kind })).join("")}</ul>`
    : `<p class="m-empty">「${esc(q)}」は見つかりませんでした</p>`;
}

// ---------- URL ----------
function syncUrl() {
  const url = new URL(location.href);
  url.searchParams.delete("to");
  url.searchParams.delete("from");
  url.hash = "";
  if (mode === "route" && rt.to) {
    url.searchParams.set("to", rt.to);
    if (rt.from && rt.from !== here) url.searchParams.set("from", rt.from);
  } else if (mode === "place" && selected) url.hash = selected;
  history.replaceState(null, "", url);
  saveRoute();
}
function fromUrl() {
  const q = new URLSearchParams(location.search);
  const to = place(q.get("to")), from = place(q.get("from"));
  if (to) { startRoute(to.id, from?.id); return true; }
  const id = decodeURIComponent(location.hash.slice(1));
  if (id && place(id)) { select(id); return true; }
  return false;
}

// ---------- はじめ ----------
export async function initMap(opts) {
  getState = opts.getState;
  const data = await (await fetch("assets/map/rooms.json")).json();
  buildPlaces(data.rooms);
  buildIndex();

  // QR から来た（?here=ID）なら「いまここ」を覚えておく
  const params = new URLSearchParams(location.search);
  const fromQr = params.has("here") && !!place(params.get("here"));
  try {
    if (fromQr) sessionStorage.setItem(HERE_KEY, JSON.stringify({ id: place(params.get("here")).id, t: Date.now() }));
    const saved = JSON.parse(sessionStorage.getItem(HERE_KEY) ?? "null");
    const id = saved?.id ?? saved?.room;
    if (saved && Date.now() - saved.t < HERE_SEC * 1000 && place(id)) { here = place(id).id; hereAt = saved.t; }
  } catch { /* 保存できないブラウザ */ }
  if (fromQr) {
    if (!here) { here = place(params.get("here")).id; hereAt = Date.now(); }
    params.delete("here");
    history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
  }
  if (here) {
    floor = place(here).floor;
    hereT = setTimeout(forgetHere, Math.max(0, hereAt + HERE_SEC * 1000 - Date.now()));
  }

  // 部品
  $("#m-floors").innerHTML = [...FLOORS].reverse().map((f) => `<button type="button" class="m-floor" role="radio" data-floor="${f}" aria-checked="false">${f}<span class="dot" hidden></span></button>`).join("");
  $("#m-chips").innerHTML = CHIPS.map((c) => `<button type="button" class="m-chip" data-chip="${c.id}" aria-pressed="false"><i aria-hidden="true">${c.icon}</i>${esc(c.label)}</button>`).join("");
  $("#m-locate").classList.toggle("has-here", !!here);

  $("#m-floors").addEventListener("click", (e) => { const b = e.target.closest(".m-floor"); if (b) setFloor(b.dataset.floor); });
  $("#m-chips").addEventListener("click", (e) => {
    const b = e.target.closest(".m-chip");
    if (!b) return;
    if (picking) closeResults(); // 出発地・目的地をえらんでいる途中なら、やめる
    if (mode === "list" && listKind === b.dataset.chip) { closeSheet(); return; }
    pushSheet();
    mode = "list";
    listKind = b.dataset.chip;
    selected = null;
    updateChips();
    syncUrl();
    renderSheet();
    setSheet(true);
    // その種類の場所を光らせる（なければある階へ）
    const hits = [...places.values()].filter(CHIPS.find((c) => c.id === listKind).match);
    if (hits.length && !hits.some((p) => p.floor === floor)) setFloor(hits[0].floor);
    renderMap();
    hits.forEach((p) => {
      document.querySelectorAll(`#m-rooms [data-id="${CSS.escape(p.id)}"]`).forEach((el) => {
        el.classList.remove("is-found");
        void el.getBBox(); // 続けて押したときも、最初から光らせる
        el.classList.add("is-found");
        setTimeout(() => el.classList.remove("is-found"), 2400);
      });
    });
  });
  // 右の QR ボタン：いつでも「いまここ」QR を読める（読むとその場所に地図が動く）
  $("#m-locate").addEventListener("click", openScanner);
  $("#m-fit").addEventListener("click", fitAll);
  // 方位：押すと北が上（真上から）。北が上のときに押すと、校内図の向きに戻す。3D：傾けて見る／真上から見る
  $("#m-compass").addEventListener("click", () => { setFollow(false); animateCam(Math.abs(normDeg(NORTH + cam.bearing)) < 1 ? 0 : -NORTH, 0); });
  $("#m-heading").addEventListener("click", toggleFollow);
  // QR を読む画面・凡例
  $("#m-scan").addEventListener("close", closeScanner);
  $("#m-scan-x").addEventListener("click", closeScanner);
  $("#m-help").addEventListener("click", openLegend);
  // 下のタブ（地図／みんなの声）と、みんなの声の中
  $("#m-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) setTab(b.dataset.tab); });
  $("#m-feed-post").addEventListener("click", openFeedCompose);
  $("#m-feed").addEventListener("click", (e) => {
    const fv = e.target.closest("[data-fv]");
    if (fv) { feedView = fv.dataset.fv; renderFeed(true); return; }
    const op = e.target.closest("[data-open]"); // 写真 → その投稿
    if (op) {
      feedView = "timeline";
      renderFeed(true);
      const li = document.querySelector(`#m-feed-list [data-post="${CSS.escape(op.dataset.open)}"]`);
      li?.scrollIntoView({ block: "center" });
      li?.classList.add("is-flash");
      return;
    }
    const go = e.target.closest("[data-go]"); // 投稿の場所 → 地図でその場所
    if (go) { setTab("map"); select(go.dataset.go); return; }
    voiceClick(e);
  });  $("#m-legend").addEventListener("click", (e) => { if (e.target === e.currentTarget || e.target.closest("[data-close]")) $("#m-legend").close(); });
  $("#m-notice").addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) { dismissNotice(); return; }
    $("#m-notice").classList.toggle("is-open"); // 長いお知らせは押すと全部出す
  });
  $("#m-tilt").addEventListener("click", () => animateCam(cam.bearing, cam.tilt > 0 ? 0 : TILT_ON));
  // シート：上下にスワイプで広げる・たたむ・しまう（スマホ）。つまみを押しても切りかわる
  const sheetUp = () => (sheet().classList.contains("is-min") ? setSheet(false) : setSheet(true));
  const sheetDown = () => (sheet().classList.contains("is-open") ? setSheet(false) : minimizeSheet());
  // スマホ：シートの上のほう（つまみ・見出し）をつかむと、シートが指について動く。離すと近い位置（しまう・半分・広げる）に止まる。
  // 中ほどは中身のスクロール。ただし中身がいちばん上のときに下へ引くのと、たたんでいるときは、どこでもつかめる
  const sh = sheet(), sbody = $("#m-sheet-body");
  let drag = null;
  sh.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) { drag = null; return; }
    const t = e.touches[0], r = sh.getBoundingClientRect();
    drag = { y0: t.clientY, h0: r.height, top: t.clientY - r.top < 72, scroll0: sbody.scrollTop, active: false, y: t.clientY, t: e.timeStamp, v: 0,
      max: r.bottom - $(".m-top").getBoundingClientRect().bottom - 8 }; // 上の検索のバーより下まで
  }, { passive: true });
  sh.addEventListener("touchmove", (e) => {
    if (!drag) return;
    const y = e.touches[0].clientY, dy = y - drag.y0;
    if (!drag.active) {
      if (Math.abs(dy) < 6) return;
      const open = sh.classList.contains("is-open");
      if (!(drag.top || !open || (dy > 0 && drag.scroll0 <= 0))) { drag = null; return; } // 中身のスクロールにまかせる
      drag.active = true;
      sh.classList.add("is-dragging");
      sh.classList.remove("is-min"); // しまっていたら中身を出しながら引き上げる
    }
    e.preventDefault();
    const h = Math.max(30, Math.min(drag.max, drag.h0 - dy));
    sh.style.maxHeight = sh.style.height = `${h}px`;
    const dt = Math.max(1, e.timeStamp - drag.t);
    drag.v = (y - drag.y) / dt; // 下向きが +（px/ms）
    drag.y = y;
    drag.t = e.timeStamp;
  }, { passive: false });
  const dragEnd = (e) => {
    const d = drag;
    drag = null;
    if (!d?.active) return;
    const v = e.timeStamp - d.t > 80 ? 0 : d.v; // 止めてから離したときは、払ったことにしない
    const h = sh.getBoundingClientRect().height, H = innerHeight;
    sh.classList.remove("is-dragging");
    sh.style.maxHeight = sh.style.height = "";
    // 止まる位置：しまう（つまみだけ）・半分・広げる。勢いよく払ったときはその向きへ1段
    const stops = [["min", 30], ["half", H * 0.42], ["open", Math.min(H * 0.78, d.max)]];
    let i = stops.reduce((best, s, k) => (Math.abs(s[1] - h) < Math.abs(stops[best][1] - h) ? k : best), 0);
    if (v < -0.4) i = Math.max(i, stops.findIndex((s) => s[1] > h + 1) === -1 ? 2 : stops.findIndex((s) => s[1] > h + 1));
    if (v > 0.4) i = Math.min(i, Math.max(0, stops.map((s) => s[1] < h - 1).lastIndexOf(true)));
    const name = stops[i][0];
    if (name === "min") minimizeSheet(); else setSheet(name === "open");
  };
  sh.addEventListener("touchend", dragEnd);
  sh.addEventListener("touchcancel", dragEnd);
  // マウス：つまみを上下にドラッグ、または押す
  let sy = null, swiped = false;
  $("#m-grip").addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") { sy = e.clientY; swiped = false; } });
  $("#m-grip").addEventListener("click", () => {
    if (!swiped) (sheet().classList.contains("is-open") || sheet().classList.contains("is-min") ? (sheet().classList.contains("is-min") ? sheetUp() : sheetDown()) : sheetUp());
    swiped = false;
  });
  addEventListener("pointerup", (e) => {
    if (sy == null) return;
    const d = e.clientY - sy;
    sy = null;
    if (Math.abs(d) > 30) { swiped = true; (d < 0 ? sheetUp : sheetDown)(); }
  });
  // どのシートにも右上に ×：場所・一覧・道案内は閉じて最初に戻る。最初のシートはしまう
  $("#m-sheet-x").addEventListener("click", () => {
    if (mode === "home") { minimizeSheet(); return; }
    if (picking) closeResults();
    const prev = sheetBack.pop();
    if (!prev) {
      rt = { ...rt, from: null, to: null, result: null, steps: [], active: -1 };
      closeSheet();
      return;
    }
    restoring = true;
    if (prev.mode === "list") {
      mode = "list";
      listKind = prev.listKind;
      selected = null;
      updateChips(); syncUrl(); renderSheet(); renderMap(); setSheet(true);
    } else if (prev.mode === "route") {
      rt = { ...prev.rt };
      mode = "route";
      selected = null;
      updateChips(); syncUrl(); computeRoute();
    } else {
      rt = { ...rt, from: null, to: null, result: null, steps: [], active: -1 };
      mode = "home"; // 道案内中の「部屋を押したら目的地」にならないように
      select(prev.selected);
    }
    restoring = false;
  });
  $("#m-sheet").addEventListener("click", (e) => {
    const tf = e.target.closest("[data-tf]");
    if (tf) { toiletFilter = tf.dataset.tf; renderSheet(); return; }
    const gf = e.target.closest("[data-gf]");
    if (gf) { genreFilter = gf.dataset.gf; renderSheet(); return; }
    const go = e.target.closest("[data-go]");
    if (go) { select(go.dataset.go); return; }
    if (voiceClick(e)) return;
    if (e.target.closest("[data-feed-open]")) { setTab("feed"); return; } // 引用の枠 → Enistagram
    const st = e.target.closest("[data-step]");
    if (st) { focusStep(Number(st.dataset.step)); return; }
    const pk = e.target.closest("[data-pick]");
    if (pk) { beginPick(pk.dataset.pick); return; }
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "route") startRoute(selected);
    if (act === "post") { const p = place(selected); if (p) openCompose(p); }
    if (act === "from") { pushSheet(); rt.from = selected; rt.to = null; rt.result = null; mode = "route"; renderSheet(); beginPick("to"); }
    if (act === "share") share();
    if (act === "swap") { [rt.from, rt.to] = [rt.to, rt.from]; computeRoute(); }
    if (act === "nostairs") { rt.noStairs = !rt.noStairs; computeRoute(); toast(rt.noStairs ? "階段を使わない道順にしました" : "いちばん近い道順にしました"); }
    if (act === "scan") openScanner();
  });
  // 検索
  const q = $("#m-q");
  q.addEventListener("focus", () => { if ($("#m-results").hidden) openResults(); });
  q.addEventListener("input", renderResults);
  q.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeResults();
    if (e.key === "Enter") $("#m-results [data-go]")?.click();
  });
  $("#m-clear").addEventListener("click", closeResults);
  $("#m-results").addEventListener("click", (e) => {
    if (e.target.closest("[data-mappick]")) { beginMapPick(); return; }
    const go = e.target.closest("[data-go]");
    if (!go) return;
    if (picking) { finishPick(place(go.dataset.go).id); return; }
    closeResults();
    select(go.dataset.go);
  });
  addEventListener("hashchange", fromUrl);

  // 上の検索のバーの下の端（広げたシートがバーの下にもぐらないように）
  new ResizeObserver(() => document.body.style.setProperty("--m-top-h", `${$(".m-top").getBoundingClientRect().bottom}px`)).observe($(".m-top"));
  // シートの高さ（お知らせの位置に使う）
  new ResizeObserver(() => document.body.style.setProperty("--m-sheet-h", `${sheet().getBoundingClientRect().height}px`)).observe(sheet());
  measure();
  drawFloor();
  $("#m-loading")?.remove();
  initGestures();
  // 縦長の画面（スマホ）は北を上に：横に長い校舎が縦になり、大きく見える
  if (screen.h > screen.w * 1.2) { cam = { ...cam, bearing: -NORTH }; layoutCam(); }
  view = viewFor(HOME, 1.2);
  clampView();
  applyView();
  renderMap();
  renderSheet();
  if (params.get("tab") === "feed") setTab("feed"); // map.html?tab=feed でみんなの声を開く
  const list = params.get("list");
  if (list && CHIPS.some((c) => c.id === list)) { $(`.m-chip[data-chip="${list}"]`)?.click(); return; }
  if (fromUrl()) return;
  // スマホのカメラで QR を読んで来た：さっきまで道案内をしていたら、ここから続きを出す
  const saved = fromQr && here ? savedRoute() : null;
  if (saved && saved.to !== here) {
    rt.noStairs = !!saved.noStairs;
    startRoute(saved.to, here);
    toast(`現在地：${titleOf(place(here))}。ここから案内します`);
    return;
  }
  if (here) {
    const [x, y] = markPoint(place(here));
    animateTo(viewFor([x - 60, y - 60, 120, 120], 3));
    if (fromQr) toast(`いまここ：${titleOf(place(here))}`);
  }
}

// 本部からのお知らせ（トップページと同じもの）
// 地図をふさがないように1行で出し、押すと全部、× で閉じる（同じお知らせは閉じたまま）
const NOTICE_KEY = "kosen63-notice-closed";
let noticeText = null;
// level が "urgent"（緊急）のときは赤くして、閉じたことがあっても出す
export function setNotice(text, level = null) {
  noticeText = text ?? null;
  let closed = null;
  try { closed = sessionStorage.getItem(NOTICE_KEY); } catch { /* 保存できないブラウザ */ }
  const n = $("#m-notice");
  const urgent = level === "urgent";
  n.classList.toggle("is-urgent", urgent);
  n.setAttribute("role", urgent ? "alert" : "status");
  n.hidden = !text || (!urgent && closed === text);
  n.querySelector("span").textContent = text ?? "";
  document.body.classList.toggle("has-notice", !n.hidden);
}
function dismissNotice() {
  try { sessionStorage.setItem(NOTICE_KEY, noticeText ?? ""); } catch { /* 保存できないブラウザ */ }
  $("#m-notice").hidden = true;
  document.body.classList.remove("has-notice");
}

// 凡例（色と印の意味）
function openLegend() {
  const sw = (cls) => `<svg viewBox="0 0 28 18" aria-hidden="true"><rect class="lg-sw ${cls}" x="1" y="1" width="26" height="16" rx="3"/></svg>`;
  const ic = (inner) => `<svg viewBox="-22 -12 44 24" aria-hidden="true" class="lg-ic">${inner}</svg>`; // どの印も地図と同じ大きさ
  const line = (cls) => `<svg viewBox="0 0 28 18" aria-hidden="true"><path class="${cls}" d="M2 9h24"/></svg>`;
  const rows = [
    ["場所", [
      [sw("k-shops"), "模擬店"], [sw("k-exhibit"), "学科展示"], [sw("k-venue"), "会場（ステージなど）"], [sw("k-hq"), "本部"],
      [sw("k-toilet"), "トイレ"], [sw("k-room"), "教室・そのほかの部屋"],
    ]],
    ["印", [
      [ic(`<g class="ic-wc">${person(0, "m", MAN)}</g>`), "男子トイレ"], [ic(`<g class="ic-wc">${person(0, "f", WOMAN)}</g>`), "女子トイレ"],
      [ic(`<g class="ic-wc">${person(0, "hc", WHEEL)}</g>`), "多目的トイレ"], [ic(`<g class="ic-st">${ICON.st}</g>`), "階段"],
      [ic(`<g class="ic-ev">${ICON.ev}</g>`), "エレベーター"], [ic(`<g class="ic-door">${ICON.door}</g>`), "建物の出入口"],
      [ic('<g class="ic-aed"><rect class="bg" x="-12" y="-8" width="24" height="16" rx="4"/><text>AED</text></g>'), "AED"],
      [ic(`<g class="ic-vend">${ICON.vend}</g>`), "自動販売機"],
      [ic(`<g class="ic-deco g1">${ICON.deco}</g>`), "撮影スポット（校内装飾・1年「海」）"],
      [ic(`<g class="ic-deco g2">${ICON.deco}</g>`), "撮影スポット（校内装飾・2年「学科・コース」）"],
      [ic(`<g class="ic-bike">${ICON.bike}</g>`), "駐輪場"],
    ]],
    ["道", [
      [line("lg-road"), "車も通る道"], [line("lg-foot"), "シャイニングロード（歩く人だけ）"], [line("lg-bike"), "サイクリングロード"],
      [line("lg-out"), "屋外の小道"], [line("lg-route"), "道案内の道順"],
    ]],
    ["いまの様子", [
      [ic('<g class="ic-now"><rect class="bg" x="-16" y="-8" width="32" height="16" rx="8"/><text>NOW</text></g>'), "いま企画をやっている"],
      [ic('<g class="ic-wait w10"><rect class="bg" x="-17" y="-8" width="34" height="16" rx="8"/><text>10分</text></g>'), "模擬店の待ち時間（赤は20分以上・灰色は売り切れ）"],
      [ic('<g class="ic-voice"><circle class="bg" r="8"/><text>2</text></g>'), "Enistagram の投稿の数"],
      [ic('<g class="ic-stamp"><circle class="bg" r="8"/><text>縁</text></g>'), "スタンプラリーの場所（押したら「縁」）"],
      ...CROWD.levels.map((lv) => [`<svg viewBox="0 0 28 18" aria-hidden="true"><rect x="1" y="1" width="26" height="16" rx="3" style="fill:color-mix(in srgb, ${lv.color} 35%, #fff);stroke:${lv.color};stroke-width:2.5"/></svg>`, `会場の混みぐあい：${esc(lv.label)}`]),
      [ic('<g class="mk-here"><circle class="dot" r="6"/></g>'), "いまここ（「いまここ」QR を読んだ場所）"],
      [ic('<g class="mk-pin"><path d="M0 8C-2 3-7 0-7-5a7 7 0 0 1 14 0c0 5-5 8-7 13z"/><circle cy="-5" r="2.5"/></g>'), "選んだ場所・目的地"],
    ]],
  ];
  $("#m-legend-body").innerHTML = rows.map(([h, items]) => `<h3>${h}</h3><ul>${items.map(([g, t]) => `<li>${g}<span>${t}</span></li>`).join("")}</ul>`).join("");
  $("#m-legend").showModal();
}
