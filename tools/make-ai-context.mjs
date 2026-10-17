import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const top = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = await import(pathToFileURL(path.join(top, "site/assets/config.js")).href);
const { fillFaq } = await import(pathToFileURL(path.join(top, "site/assets/faq-text.js")).href);
const { ROOM_NAMES, SITE, ENTRANCES, RESTRICTED, codeRestricted } = await import(pathToFileURL(path.join(top, "site/assets/campus.js")).href);

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
    access: "市電「湯の川」から徒歩約15分、バス停「函館高専前」から徒歩1分。駐車場には限りがあるので、できるだけ市電やバスで来てほしい。公共交通機関での来場がむずかしい人は、車でも来場できる。身障者用の駐車場もある。台数や場所の細かいことは、AIは答えず、当日のスタッフか本部に聞くよう案内する。函館大学や近隣のコンビニ・スーパーには停めないこと。",
    contact: "函館工業高等専門学校 学生会（高専祭実行委員会）。学校へのお問い合わせは学生課 TEL 0138-59-6334",
  },
  faq: cfg.FAQ.flatMap((g) => g.items.map((i) => `${i.q} → ${clean(fillFaq(i.a))}`)),
  venues: cfg.VENUES.map((v) => ({ name: v.name, alias: v.alias ?? "" })),
  places: cfg.MAP.places.filter((p) => p.name).map((p) => ({ id: p.id, name: p.name, sub: p.sub ?? "", room: p.room ?? "", kind: p.kind ?? "", desc: clean(p.desc) })),
  stage: {
    venue: place(cfg.STAGE.venue), venueId: cfg.STAGE.venue,
    acts: cfg.STAGE.acts.map((a) => ({ date: md(a.start), time: `${hm(a.start)}〜${hm(a.end)}`, name: a.name, kind: a.kind, mood: clean(a.mood) })),
  },
  events: [...cfg.EVENTS, ...cfg.LIST_EVENTS].filter((e) => !e.stage).map((e) => ({
    date: md(e.start), time: `${hm(e.start)}〜${hm(e.end)}`, title: e.title, placeId: e.venue, place: place(e.venue), kind: e.kind ?? "", note: clean(e.copy), onCampusOnly: !!e.internal,
  })),
  shops: cfg.SHOPS.map((s) => ({
    id: s.room ?? (s.place || cfg.HOMEROOMS[s.cls]) ?? `shops-${s.bldg}${s.floor}`, name: clean(s.name), group: s.group ?? "", where: s.place ?? (s.bldg ? `${s.bldg}棟${s.floor}` : (s.room ?? cfg.HOMEROOMS[s.cls] ?? "")), genre: s.food ? s.genre : ["あそび・体験"], note: clean(s.note),
  })),
  toilets: Object.entries(ROOM_NAMES).filter(([id, n]) => /WC/.test(n) && !codeRestricted(id)).map(([id, n]) => `${id[0]}棟${id[1]}階 ${/多目的/.test(n) ? "多目的" : /男/.test(n) ? "男子" : /女/.test(n) ? "女子" : "共用"} id=${id}`),
  facilities: [
    ...SITE.aed.filter((a) => !/東京水道アリーナ/.test(a.sub)).map((a) => `AED（${a.sub}） id=${a.id}`),
    ...SITE.vending.filter((v) => !/東京水道アリーナ/.test(v.sub)).map((v) => `自動販売機（${v.sub}） id=${v.id}`),
    `本部・インフォメーション（玄関ホール。救護・落とし物・景品交換） id=hq`,
    ...Object.entries({ B109: "保健室", G106: "売店", G101: "二十一食堂（フードコート）", B110: "学生相談室" }).map(([id, n]) => `${n}（${id[0]}棟${id[1]}階） id=${id}`),
    `出入口：${ENTRANCES.map((e) => e.name).join("、")}`,
  ],
  restricted: RESTRICTED.labels,
  exhibits: cfg.DEPT_EXHIBITS.map((d) => ({ id: d.place, dept: d.dept, where: d.where, items: d.items })),
  garbage: cfg.GARBAGE.map((g) => `${g.kind}：${g.examples}`),
};

const out = path.join(top, "site/assets/ai-context.json");
fs.writeFileSync(out, JSON.stringify(ctx));
console.log("ai-context.json", fs.statSync(out).size, "bytes");
