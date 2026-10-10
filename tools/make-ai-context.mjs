import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const top = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = await import(pathToFileURL(path.join(top, "site/assets/config.js")).href);

const hm = (iso) => new Date(iso).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
const md = (iso) => new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" });
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const place = (id) => {
  const v = cfg.VENUES.find((x) => x.id === id);
  return v ? (v.alias ? `${v.alias}（${v.name}）` : v.name) : id;
};

const ctx = {
  festival: {
    name: "第63回 函館高専祭「縁（えにし）」",
    days: cfg.FESTIVAL.days.map((d) => ({ date: md(d.open), open: hm(d.open), close: hm(d.close) })),
    venue: "函館工業高等専門学校（函館市戸倉町14-1）",
    about: cfg.ABOUT,
    access: "市電やバスなどの公共交通機関で来場。駐車場が限られているため、車での来場はご遠慮ください。函館大学や近隣のコンビニ・スーパーには停めないこと。",
    contact: "函館工業高等専門学校 学生会（高専祭実行委員会）。学校へのお問い合わせは学生課 TEL 0138-59-6334",
  },
  rules: [...cfg.VISIT.map((v) => `${v.title}：${clean(v.detail)}`), ...cfg.NOTICES],
  venues: cfg.VENUES.map((v) => ({ name: v.name, alias: v.alias ?? "" })),
  places: cfg.MAP.places.filter((p) => p.name).map((p) => ({ name: p.name, sub: p.sub ?? "", room: p.room ?? "", kind: p.kind ?? "", desc: clean(p.desc) })),
  stage: {
    venue: place(cfg.STAGE.venue),
    acts: cfg.STAGE.acts.map((a) => ({ date: md(a.start), time: `${hm(a.start)}〜${hm(a.end)}`, name: a.name, kind: a.kind, mood: clean(a.mood) })),
  },
  events: [...cfg.EVENTS, ...cfg.LIST_EVENTS].filter((e) => !e.stage).map((e) => ({
    date: md(e.start), time: `${hm(e.start)}〜${hm(e.end)}`, title: e.title, place: place(e.venue), kind: e.kind ?? "", note: clean(e.copy), onCampusOnly: !!e.internal,
  })),
  shops: cfg.SHOPS.map((s) => ({
    name: clean(s.name), group: s.group ?? "", where: s.place ?? (s.bldg ? `${s.bldg}棟${s.floor}` : (s.room ?? cfg.HOMEROOMS[s.cls] ?? "")), genre: s.food ? s.genre : ["あそび・体験"], note: clean(s.note),
  })),
  exhibits: cfg.DEPT_EXHIBITS.map((d) => ({ dept: d.dept, where: d.where, items: d.items })),
  garbage: cfg.GARBAGE.map((g) => `${g.kind}：${g.examples}`),
};

const out = path.join(top, "site/assets/ai-context.json");
fs.writeFileSync(out, JSON.stringify(ctx));
console.log("ai-context.json", fs.statSync(out).size, "bytes");
