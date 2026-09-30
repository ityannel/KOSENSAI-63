// 本部コンソールの「サイトの設定」で「出さない」にした下のタブ（サイト・地図・Enistagram）を隠す。
// site_config/current = { tabs: { site, map, feed } }（false のタブは出さない。なければ全部出す）
// 前に読んだ設定をこのスマホに覚えておき、開いたらすぐ当てる（あとから届いた設定で、すぐ変わる）
// 隠し方は style.css（html の data-tabs-off に、隠すタブの名前が入る）
import { subscribeSiteConfig } from "./live.js";

const KEY = "kosen63-tabs";
const IDS = ["site", "map", "feed"];

function apply(tabs) {
  const off = IDS.filter((id) => tabs?.[id] === false);
  const root = document.documentElement;
  if (off.length) root.dataset.tabsOff = off.join(" "); else delete root.dataset.tabsOff;
  root.toggleAttribute("data-tabs-none", off.length === IDS.length); // 全部出さないなら、帯ごと隠す
}

try { apply(JSON.parse(localStorage.getItem(KEY) ?? "null")); } catch { /* 覚えていない・読めない */ }
subscribeSiteConfig((d) => {
  const tabs = d?.tabs ?? null;
  apply(tabs);
  try { localStorage.setItem(KEY, JSON.stringify(tabs)); } catch { /* 保存できないブラウザ */ }
});
