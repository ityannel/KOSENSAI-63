import { createPicker } from "./sg-map.js";

const SLIDES = [["stage", "ステージ"], ["posts", "みんなの投稿"], ["popular", "人気の投稿"], ["shop", "模擬店"], ["crowd", "混雑"], ["way", "道案内"], ["stamp", "スタンプ"], ["share", "シェア"]];
const GROUPS = ["where", "orient", "slides", "only", "banner", "note"];
const DEFAULTS = { name: "", spot: "", place: null, heading: 270, orient: "auto", facing: 0, slides: [], only: "", only_until: 0, banner: "", banner_until: 0, note: "" };

export function initSgAdmin({ fs, db, a, $, esc, toast, listen, time }) {
  const list = $("#sg-list"), form = $("#sg-form");
  let devices = new Map(), seen = new Map(), targets = [], selected = new Set(), picker = null, pickerP = null;
  const stamp = () => ({ updated_at: fs.serverTimestamp(), updated_by: a.currentUser.email });
  const ms = (v) => v?.toMillis?.() ?? 0;
  const baseUrl = () => new URL("../signage.html", location.href).href;
  const urlOf = (id) => `${baseUrl()}?d=${encodeURIComponent(id)}`;
  const newId = () => `sg-${Math.random().toString(36).slice(2, 8)}`;
  const bulk = () => targets.length > 1;
  const whereText = (d) => (d?.place ? "地図で置いた場所" : "");

  function paintList() {
    const ids = [...new Set([...devices.keys(), ...seen.keys()])];
    const now = Date.now();
    ids.sort((x, y) => (ms(seen.get(y)?.seen) - ms(seen.get(x)?.seen)) || x.localeCompare(y));
    list.innerHTML = ids.length ? ids.map((id) => {
      const d = devices.get(id), s = seen.get(id), last = ms(s?.seen), live = last && now - last < 150000;
      return `<div class="sg-row${targets.includes(id) ? " is-on" : ""}">
        <label class="sg-sel" title="まとめて編集するときに、チェックします"><input type="checkbox" data-sel="${esc(id)}"${selected.has(id) ? " checked" : ""}></label>
        <button type="button" class="sg-open" data-id="${esc(id)}">
          <i class="sg-dot${live ? " is-live" : ""}" title="${live ? "いま表示中" : "しばらく反応なし"}"></i>
          <span class="sg-main"><b>${esc(d?.name || "（未登録の画面）")}</b><small>${esc(id)}${whereText(d) ? `・${whereText(d)}` : ""}</small></span>
          <span class="sg-meta">${s ? `${esc(`${s.w ?? "?"}×${s.h ?? "?"}`)}・${s.o === "portrait" ? "縦" : "横"}<br>${last ? esc(time(last)) : ""}` : "まだ開かれていません"}</span>
          ${d ? "" : '<em class="tag tag-warn">未登録</em>'}</button></div>`;
    }).join("") : '<p class="muted small">まだ、画面はありません。「＋ 画面を登録」を押すか、サイネージのページを開くと、ここに出ます。</p>';
    $("#sg-count").textContent = selected.size ? `${selected.size}台を選んでいます` : "チェックして選ぶと、まとめて編集できます";
    $("#sg-bulk").disabled = selected.size < 2;
    picker?.setDevices(ids.map((id) => { const d = devices.get(id), l = ms(seen.get(id)?.seen); return { id, name: d?.name, place: d?.place && typeof d.place.x === "number" ? d.place : null, heading: Number.isFinite(Number(d?.heading)) ? Number(d.heading) : 270, live: l && now - l < 150000 }; }));
    $("#sg-all").checked = ids.length > 0 && ids.every((id) => selected.has(id));
  }

  async function ensurePicker() {
    pickerP ??= createPicker($("#sg-where"), { onSelect: (id, put) => { selected.clear(); openForm([id], !devices.has(id), false).then(() => { if (put) picker?.placeCenter(); }); } }).then((p) => { picker = p; paintList(); return p; }).catch((err) => { console.warn("[staff] 地図:", err); $("#sg-where").innerHTML = '<p class="muted small">地図を読み込めませんでした。</p>'; return null; });
    return pickerP;
  }

  async function openForm(ids, isNew = false, scroll = true) {
    targets = ids;
    form.hidden = false;
    form.classList.toggle("is-bulk", bulk());
    const first = devices.get(ids[0]) ?? {};
    const d = bulk() ? {} : first;
    $("#sg-form-title").textContent = bulk() ? `${ids.length}台を、まとめて編集` : isNew ? "画面を登録" : d.name || "画面の設定";
    $("#sg-bulk-note").hidden = !bulk();
    $("#sg-single").hidden = bulk();
    $("#sg-id").value = bulk() ? "" : ids[0];
    $("#sg-url").value = bulk() ? "" : urlOf(ids[0]);
    $("#sg-name").value = d.name ?? "";
    $("#sg-orient").value = d.orient ?? "auto";
    const on = new Set(Array.isArray(d.slides) ? d.slides : []);
    $("#sg-slides").innerHTML = SLIDES.map(([k, t]) => `<label class="sg-chk"><input type="checkbox" value="${k}"${!on.size || on.has(k) ? " checked" : ""}><span>${t}</span></label>`).join("");
    $("#sg-only").innerHTML = `<option value="">（出さない）</option>${SLIDES.map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}`;
    $("#sg-only").value = d.only && (d.only_until ?? 0) > Date.now() ? d.only : "";
    $("#sg-only-min").value = "30";
    $("#sg-banner").value = d.banner && (d.banner_until ?? 0) > Date.now() ? d.banner : "";
    $("#sg-banner-min").value = "30";
    $("#sg-note").value = d.note ?? "";
    form.querySelectorAll(".sg-use input").forEach((c) => { c.checked = false; });
    $("#sg-del").hidden = bulk() || !devices.has(ids[0]);
    $("#sg-reload").hidden = bulk() ? false : !devices.has(ids[0]);
    paintList();
    const p = await ensurePicker();
    p?.setActive(bulk() ? null : ids[0], { name: d.name ?? "", place: d.place ?? null, heading: d.heading ?? 270 });
    $("#sg-where-save").disabled = bulk();
    if (scroll) form.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function patch(grp) {
    switch (grp) {
      case "where": {
        const w = picker?.get() ?? { place: null, heading: 270 };
        return { spot: "", place: w.place, heading: w.heading };
      }
      case "orient": return { orient: $("#sg-orient").value };
      case "slides": {
        const s = [...$("#sg-slides").querySelectorAll("input:checked")].map((x) => x.value);
        return { slides: s.length === SLIDES.length ? [] : s };
      }
      case "only": {
        const only = $("#sg-only").value, min = Math.max(1, Math.min(600, Number($("#sg-only-min").value) || 30));
        return { only, only_until: only ? Date.now() + min * 60000 : 0 };
      }
      case "banner": {
        const banner = $("#sg-banner").value.trim().slice(0, 120), min = Math.max(1, Math.min(600, Number($("#sg-banner-min").value) || 30));
        return { banner, banner_until: banner ? Date.now() + min * 60000 : 0 };
      }
      default: return { note: $("#sg-note").value.trim().slice(0, 200) };
    }
  }
  function build() {
    const groups = bulk() ? GROUPS.filter((g) => form.querySelector(`[data-grp="${g}"] .sg-use input`)?.checked) : GROUPS;
    const out = {};
    for (const g of groups) Object.assign(out, patch(g));
    if (!bulk()) out.name = $("#sg-name").value.trim().slice(0, 40);
    return out;
  }
  const docFor = (id, p) => {
    const base = { ...DEFAULTS, ...(devices.get(id) ?? {}) };
    const doc = { ...base, ...p, ...stamp() };
    if (base.reload_at) doc.reload_at = base.reload_at;
    return doc;
  };

  $("#sg-new").addEventListener("click", () => { selected.clear(); openForm([newId()], true); });
  $("#sg-all").addEventListener("change", (e) => {
    const ids = [...new Set([...devices.keys(), ...seen.keys()])];
    selected = new Set(e.target.checked ? ids : []);
    paintList();
  });
  $("#sg-bulk").addEventListener("click", () => { if (selected.size > 1) openForm([...selected]); });
  list.addEventListener("change", (e) => {
    const c = e.target.closest("[data-sel]");
    if (!c) return;
    if (c.checked) selected.add(c.dataset.sel); else selected.delete(c.dataset.sel);
    paintList();
  });
  list.addEventListener("click", (e) => {
    const b = e.target.closest("[data-id]");
    if (b) { selected.clear(); openForm([b.dataset.id], !devices.has(b.dataset.id)); }
  });
  $("#sg-copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("#sg-url").value); toast("URLをコピーしました"); } catch { $("#sg-url").select(); }
  });
  $("#sg-open").addEventListener("click", () => window.open($("#sg-url").value, "_blank", "noopener"));
  $("#sg-close").addEventListener("click", () => { targets = []; form.hidden = true; picker?.setActive(null); $("#sg-where-save").disabled = true; paintList(); });
  $("#sg-name").addEventListener("input", (e) => picker?.setName(e.target.value));
  $("#sg-to-map").addEventListener("click", () => $("#sg-overview").scrollIntoView({ block: "start", behavior: "smooth" }));
  $("#sg-where-save").addEventListener("click", () => { if (targets.length === 1) form.requestSubmit(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!targets.length) return;
    const p = build();
    if (bulk() && !Object.keys(p).length) { toast("変更する項目に、チェックを入れてください", true); return; }
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      await Promise.all(targets.map((id) => fs.setDoc(fs.doc(db, "signage_devices", id), docFor(id, p))));
      toast(bulk() ? `${targets.length}台に、保存しました` : "保存しました。画面には、数秒で反映されます");
    } catch (err) {
      toast("保存できませんでした", true);
      console.warn("[staff] サイネージの保存:", err.code);
    } finally {
      btn.disabled = false;
    }
  });
  $("#sg-reload").addEventListener("click", async () => {
    if (!targets.length) return;
    try {
      await Promise.all(targets.map((id) => fs.setDoc(fs.doc(db, "signage_devices", id), { ...docFor(id, {}), reload_at: fs.serverTimestamp() })));
      toast(bulk() ? `${targets.length}台に、再読み込みを送りました` : "再読み込みを、送りました");
    } catch { toast("送れませんでした", true); }
  });
  $("#sg-del").addEventListener("click", async () => {
    const id = targets[0];
    if (bulk() || !devices.has(id) || !confirm("この画面の登録をやめますか？（画面は、そのまま表示されます）")) return;
    try {
      await fs.deleteDoc(fs.doc(db, "signage_devices", id));
      targets = []; form.hidden = true; picker?.setActive(null); $("#sg-where-save").disabled = true;
      toast("登録をやめました");
    } catch { toast("消せませんでした", true); }
  });

  listen(fs.collection(db, "signage_devices"), (snap) => {
    devices = new Map(snap.docs.map((d) => [d.id, d.data()]));
    paintList();
  });
  listen(fs.collection(db, "signage_seen"), (snap) => {
    seen = new Map(snap.docs.map((d) => [d.id, d.data()]));
    paintList();
  });
  setInterval(paintList, 30000);
  ensurePicker();
}
