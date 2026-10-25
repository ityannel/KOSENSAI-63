import { LHAKO } from "../assets/config.js";
import { lhakoSlots, seatId } from "../assets/lhako.js";

export function initLhakoAdmin({ fs, db, $, esc, write, listen }) {
  const box = $("#lhako-box"), tabs = $("#lhako-days");
  const slots = lhakoSlots();
  let res = [], day = LHAKO.days[0].id;

  const paintTabs = () => {
    tabs.innerHTML = LHAKO.days.map((d) => `<button type="button" class="btn btn-sm ${d.id === day ? "btn-primary" : "btn-ghost"}" data-day="${d.id}">${esc(d.label)}</button>`).join("");
  };

  function paint() {
    const bySlot = new Map();
    for (const r of res) bySlot.set(r.slot, [...(bySlot.get(r.slot) ?? []), r]);
    const total = res.filter((r) => slots.some((s) => s.id === r.slot && s.day === day)).reduce((n, r) => n + r.seats.length, 0);
    $("#lhako-total").textContent = `この日の予約：${total}人`;
    box.innerHTML = slots.filter((s) => s.day === day).map((s) => {
      const list = bySlot.get(s.id) ?? [], n = list.reduce((a, r) => a + r.seats.length, 0);
      return `<div class="lhako-row${n >= LHAKO.seats ? " is-full" : ""}">
        <div class="lhako-slot"><b>${s.hm}–${s.endHm}</b><em>${n} / ${LHAKO.seats}人</em></div>
        <ul class="lhako-res">${list.length ? list.map((r) => `<li><span>${esc(r.name)}さん・${r.seats.length}人</span><button type="button" class="btn btn-ghost btn-sm btn-danger" data-cancel="${esc(r.id)}">取り消す</button></li>`).join("") : '<li class="muted small">まだ予約はありません</li>'}</ul>
      </div>`;
    }).join("");
  }

  tabs.addEventListener("click", (e) => {
    const b = e.target.closest("[data-day]");
    if (!b) return;
    day = b.dataset.day; paintTabs(); paint();
  });
  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cancel]");
    const r = b && res.find((x) => x.id === b.dataset.cancel);
    if (!r || !confirm(`${r.name}さん（${r.seats.length}人）の予約を取り消しますか？`)) return;
    write("予約を取り消しました", () => {
      const batch = fs.writeBatch(db);
      batch.delete(fs.doc(db, "lhako_res", r.id));
      for (const n of r.seats) batch.delete(fs.doc(db, "lhako_seats", seatId(r.slot, n)));
      return batch.commit();
    });
  });

  listen(fs.collection(db, "lhako_res"), (snap) => {
    res = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => Array.isArray(r.seats));
    paint();
  });
  paintTabs();
  paint();
}
