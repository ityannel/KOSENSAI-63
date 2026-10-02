// 5人に聞く。
// 絵の下の質問ボタン（または絵の中の人）を押すと、担当の人が吹き出しで答えて、
// 絵の下のほうに答えのカードが出る。カードの「くわしく」で、今までのパネルを開ける。
import { FESTIVAL, EVENTS, VENUES, CROWD, RALLY, PICKUP_SHOPS } from "./config.js";
import { stampCount, stampGoal } from "./rally.js";

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const hhmm = (iso) => new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
const venueName = (id) => { const v = VENUES.find((x) => x.id === id); return v ? (v.alias ?? v.name) : (id ?? ""); };
const link = (href, label) => `<a class="answer-btn" href="${href}">${esc(label)}</a>`;

// 質問 → 答える人。色は短冊と同じ系統
export const TOPICS = [
  { id: "now", label: "いま何してる？", who: "p4", color: "#E0874A" },
  { id: "crowd", label: "混んでる？", who: "p5", color: "#6CBAB5" },
  { id: "rally", label: "スタンプ", who: "p3", color: "#B5655A" },
  { id: "map", label: "地図", who: "p1", color: "#9BD7D0" },
  { id: "food", label: "ごはん", who: "p2", color: "#FBE1BC" },
  { id: "more", label: "その他", who: "p1", color: "#F3EEE6" },
];

// s = main.js から渡される今の様子 { phase, now, running, next, crowd, live, agoText }
const ANSWERS = {
  now(s) {
    if (s.phase === "before") {
      const days = Math.ceil((Date.parse(FESTIVAL.days[0].open) - s.now) / 86400000);
      const first = FESTIVAL.days[0];
      const day1 = EVENTS.filter((e) => e.start.startsWith(first.open.slice(0, 10))).slice(0, 3);
      return {
        line: days > 1 ? `開催まであと${days}日！` : "もうすぐ始まるよ！",
        html: `<h3>${esc(first.label)} ${hhmm(first.open)} スタート</h3>
          <ul class="answer-list">${day1.map((e) => `<li><time>${hhmm(e.start)}</time>${esc(e.title)}<small>${esc(venueName(e.venue))}</small></li>`).join("")}</ul>`,
        actions: [link("#schedule", "タイムテーブル")],
      };
    }
    if (s.phase === "after") {
      return { line: "来てくれてありがとう！", html: "<h3>第63回 函館高専祭は終わりました</h3><p>当日の食レポと写真を見返せます。</p>", actions: [link("#report", "食レポ・写真")] };
    }
    const r = s.running[0];
    const line = r ? `いま${venueName(r.venue)}で「${r.title}」やってる！`
      : s.next ? `次は${hhmm(s.next.start)}から「${s.next.title}」！` : "今日はもうおしまい。また明日！";
    const item = (e, tag) => `<li><time>${tag}</time>${esc(e.title)}<small>${esc(venueName(e.venue))}${e.start ? ` ${hhmm(e.start)}〜` : ""}</small></li>`;
    return {
      line,
      html: `<ul class="answer-list">${s.running.map((e) => item(e, "NOW")).join("")}${s.next ? item(s.next, "NEXT") : ""}</ul>
        ${!s.running.length && !s.next ? "<p>本日の公開は終了しました。</p>" : ""}`,
      actions: [link("#schedule", "タイムテーブル")],
    };
  },

  crowd(s) {
    const rows = CROWD.venues.map((id) => ({ id, c: s.crowd?.[id], lv: CROWD.levels[s.crowd?.[id]?.level] }));
    const known = rows.filter((r) => r.lv);
    if (!known.length) {
      return { line: "当日、ここで混み具合が見られるよ", html: `<p>体育館・玄関ホール・${esc(venueName("zacros"))}の混雑を、本部がリアルタイムで更新します。</p>`, actions: [link("#crowd", "くわしく")] };
    }
    const calm = [...known].sort((a, b) => a.c.level - b.c.level)[0];
    return {
      line: calm.c.level === 0 ? `いちばん空いてるのは${venueName(calm.id)}だよ` : `${venueName(calm.id)}が比較的すいてるよ`,
      html: `<ul class="answer-crowd">${rows.map((r) => `
        <li><i style="--lv:${r.lv?.color ?? "#8a8580"}"></i><b>${esc(venueName(r.id))}</b>
          <span>${r.lv ? esc(r.lv.label) : "まだ情報なし"}</span><small>${r.c?.updated_at ? esc(s.agoText(r.c.updated_at)) : ""}</small></li>`).join("")}</ul>`,
      actions: [link("#crowd", "くわしく")],
    };
  },

  rally(s) {
    const n = stampCount();
    const g = stampGoal();
    const out = !!s?.live?.prize_out; // 景品がなくなった
    const line = n >= g ? (out ? "そろった！ 景品はもう終わっちゃったって…" : `そろった！${RALLY.claimPlace}へ行こう`) : n > 0 ? `スタンプあと${g - n}個！` : "模擬店や学科展示のQRを読むとスタンプがたまるよ";
    return {
      line,
      html: `<div class="answer-rally">${Array.from({ length: g }, (_, i) => `<span class="mini-hanko${i < n ? " on" : ""}">${i < n ? "縁" : ""}</span>`).join("")}
        <b>${n} / ${g}</b></div><p>${out ? "景品は、すべてなくなりました。ごめんなさい。" : n >= g ? esc(RALLY.prize) : "校内の QR を読んでね（はじめの1個は、玄関のインフォメーションで）。"}</p>`,
      actions: [link("#rally", n >= g ? "引き換え画面" : "スタンプカード")],
    };
  },

  map() {
    return {
      line: "建物の場所はここを見て！",
      html: `<ul class="answer-chips">${VENUES.map((v) => `<li><a href="map.html#${esc(v.id)}">${esc(v.alias ?? v.name)}</a></li>`).join("")}</ul>`,
      actions: [link("map.html", "校内マップを開く"), link("map.html#hq", "本部はどこ？")],
    };
  },

  food(s) {
    const report = s.live?.food_reports?.at(-1);
    if (s.phase !== "before" && report) {
      return {
        line: "いちゃの食レポ、更新されてる！",
        html: `<h3>${esc(report.shop)}</h3><p>${esc(report.text)}</p>`,
        actions: [link("#report", "食レポをもっと"), link("#pickup", "注目の模擬店")],
      };
    }
    if (!PICKUP_SHOPS.length) {
      return {
        line: "模擬店は校内マップで探せるよ！",
        html: "<p>お店の名前や食べ物（たこやき・クレープなど）で検索できます。</p>",
        actions: [link("map.html?list=food", "模擬店の一覧")],
      };
    }
    return {
      line: "注目の模擬店はここ！",
      html: `<ul class="answer-list">${PICKUP_SHOPS.slice(0, 3).map((p) => `<li><time>${esc(p.group)}</time>${esc(p.name)}<small>${esc(venueName(p.venue))}</small></li>`).join("")}</ul>`,
      actions: [link("#pickup", "注目の模擬店")],
    };
  },

  more() {
    const items = [["#about", "高専祭について"], ["#schedule", "タイムテーブル"], ["#guide", "企画案内"], ["#pickup", "注目の模擬店"],
      ["#info", "来場案内・ごみ"], ["#report", "食レポ・写真"], ["#sponsors", "協賛"]];
    return { line: "ほかにもいろいろあるよ！", html: `<div class="answer-grid">${items.map(([h, l]) => link(h, l)).join("")}</div>`, actions: [] };
  },
};

let current = null;

export function initAsk({ getState, say }) {
  const bar = $("#askbar");
  bar.innerHTML = TOPICS.map((t) =>
    `<button type="button" class="ask" data-topic="${t.id}" style="--c:${t.color}" aria-pressed="false">${esc(t.label)}</button>`).join("");

  const close = () => {
    current = null;
    $("#answer").hidden = true;
    document.body.classList.remove("answer-open");
    bar.querySelectorAll(".ask").forEach((b) => b.setAttribute("aria-pressed", "false"));
  };

  const show = (id, speak) => {
    const t = TOPICS.find((x) => x.id === id);
    const a = ANSWERS[id](getState());
    current = id;
    if (speak) say(t.who, a.line, 6000);
    const box = $("#answer");
    box.setAttribute("aria-live", speak ? "polite" : "off"); // 30秒ごとの更新は読み上げない
    box.style.setProperty("--c", t.color);
    box.innerHTML = `
      <button type="button" class="answer-close" aria-label="閉じる">×</button>
      <p class="answer-q">${esc(t.label)}</p>
      <div class="answer-body">${a.html}</div>
      ${a.actions.length ? `<div class="answer-actions">${a.actions.join("")}</div>` : ""}`;
    box.hidden = false;
    document.body.classList.add("answer-open");
    bar.querySelectorAll(".ask").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.topic === id)));
  };
  const ask = (id) => {
    if (current === id) return close(); // 同じボタンをもう一度押したら閉じる
    show(id, true);
  };

  // 質問ボタン・絵の中の人・電柱の看板は、どれも「聞く」
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-topic]");
    if (el) {
      e.preventDefault();
      current = el.closest(".askbar") ? current : null; // 人を触ったときは、同じ話題でも開き直す
      ask(el.dataset.topic);
      return;
    }
    if (e.target.closest(".answer-close")) close();
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.body.classList.contains("panel-open")) close();
  });
  // 答えを開いたまま時間がたったら、中身を新しくする（混雑やNOWが変わるので）
  setInterval(() => {
    const b = $("#answer");
    if (!current || b.contains(document.activeElement)) return; // 押している途中は描き直さない
    const y = b.scrollTop;
    show(current, false);
    b.scrollTop = y;
  }, 30000);
  return { ask, close };
}
