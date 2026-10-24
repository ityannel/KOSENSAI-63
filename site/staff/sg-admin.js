import { createPicker } from "./sg-map.js";
import { MAP } from "../assets/config.js";
import { loadMiniMap, locatePoint } from "../assets/ai-minimap.js";

const SLIDES = [["stage", "ステージ"], ["posts", "みんなの投稿"], ["popular", "人気の投稿"], ["shop", "模擬店"], ["crowd", "混雑"], ["stamp", "スタンプ"], ["share", "シェア"]];
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
  const allIds = () => [...new Set([...devices.keys(), ...[...seen].filter(([, s]) => Date.now() - ms(s?.seen) < 300000).map(([id]) => id)])];
  const whereText = (d) => (d?.place ? "地図で置いた場所" : "");

  function paintList() {
    const ids = allIds();
    const now = Date.now();
    const reg = (id) => devices.has(id);
    ids.sort((x, y) => (reg(y) - reg(x)) || (reg(x) ? (devices.get(x).name || x).localeCompare(devices.get(y).name || y, "ja") : ms(seen.get(y)?.seen) - ms(seen.get(x)?.seen)));
    const firstUn = ids.find((id) => !reg(id));
    list.innerHTML = ids.length ? ids.map((id) => {
      const d = devices.get(id), s = seen.get(id), last = ms(s?.seen), live = last && now - last < 150000;
      return `${id === firstUn ? '<p class="sg-sub">いま開かれている、登録していない画面（押して登録できます）</p>' : ""}<div class="sg-row${targets.includes(id) ? " is-on" : ""}">
        <label class="sg-sel" title="まとめて編集するときに、チェックします"><input type="checkbox" data-sel="${esc(id)}"${selected.has(id) ? " checked" : ""}></label>
        <button type="button" class="sg-open" data-id="${esc(id)}">
          <i class="sg-dot${live ? " is-live" : ""}" title="${live ? "いま表示中" : "しばらく反応なし"}"></i>
          <span class="sg-main"><b>${esc(d?.name || "（まだ登録していない画面）")}</b><small>${esc(id)}${whereText(d) ? `・${whereText(d)}` : ""}</small></span>
          <span class="sg-meta">${s ? `${esc(`${s.w ?? "?"}×${s.h ?? "?"}`)}・${s.o === "portrait" ? "縦" : "横"}<br>${last ? esc(time(last)) : ""}` : "まだ開かれていません"}</span>
          ${d ? "" : '<em class="tag tag-warn">未登録</em>'}</button></div>`;
    }).join("") : '<p class="muted small">まだ、画面はありません。「＋ 画面を登録」を押すか、サイネージのページを開くと、ここに出ます。</p>';
    $("#sg-count").textContent = selected.size ? `${selected.size}台を選んでいます` : "チェックして選ぶと、まとめて編集できます";
    $("#sg-bulk").disabled = selected.size < 2;
    picker?.setDevices(ids.map((id) => { const d = devices.get(id), l = ms(seen.get(id)?.seen); return { id, name: d?.name, place: d?.place && typeof d.place.x === "number" ? d.place : null, heading: Number.isFinite(Number(d?.heading)) ? Number(d.heading) : 270, live: l && now - l < 150000 }; }));
    $("#sg-all").checked = ids.length > 0 && ids.every((id) => selected.has(id));
    paintLive();
  }

  const chosen = new Map();
  const placeOptions = () => `<option value="">（場所を選ぶ）</option>${[...new Set(candidates().map((c) => c.name))].map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("")}`;
  function paintLive() {
    const box = $("#sg-live");
    if (!box || box.contains(document.activeElement) && document.activeElement.matches("select")) return;
    const now = Date.now();
    const q = ($("#sg-live-q")?.value ?? "").trim().toLowerCase();
    const live = [...seen].filter(([, s]) => now - ms(s?.seen) < 300000).sort((a, b) => ms(b[1]?.seen) - ms(a[1]?.seen)).map(([id]) => id);
    const ids = q ? live.filter((id) => id.toLowerCase().includes(q)) : live;
    const opts = placeOptions();
    const idHtml = (id) => (id.length > 4 ? `${esc(id.slice(0, -4))}<em>${esc(id.slice(-4))}</em>` : `<em>${esc(id)}</em>`);
    box.innerHTML = ids.length ? ids.map((id) => {
      const d = devices.get(id), s = seen.get(id);
      return `<div class="sg-live-row" data-id="${esc(id)}">
        <div class="sg-live-id"><i class="sg-dot is-live"></i><b>${idHtml(id)}</b><small>${esc(d?.name || "（名前なし）")}・${esc(`${s.w ?? "?"}×${s.h ?? "?"}`)}・${esc(time(ms(s.seen)))}・${d?.place ? "場所：設定ずみ" : "場所：まだ"}</small></div>
        <div class="sg-live-act"><select data-pl aria-label="場所の名前">${opts}</select><button type="button" class="btn btn-primary btn-sm" data-apply>反映</button><button type="button" class="btn btn-ghost btn-sm" data-map>地図で動かす</button><button type="button" class="btn btn-ghost btn-sm" data-flash>画面にIDを出す</button></div>
      </div>`;
    }).join("") : `<p class="muted small">${q ? `末尾が「${esc(q)}」の画面は、いま開かれていません。` : "いま開かれている画面は、ありません。サイネージのページを開くと、ここに出ます。"}</p>`;
    box.querySelectorAll(".sg-live-row").forEach((row) => { const v = chosen.get(row.dataset.id); if (v) row.querySelector("select").value = v; });
  }
  $("#sg-live-q").addEventListener("input", paintLive);
  $("#sg-live").addEventListener("change", (e) => {
    const sel = e.target.closest("select[data-pl]");
    if (sel) chosen.set(sel.closest(".sg-live-row").dataset.id, sel.value);
  });
  $("#sg-live").addEventListener("click", async (e) => {
    const row = e.target.closest(".sg-live-row");
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.closest("[data-map]")) {
      selected.clear();
      await openForm([id], !devices.has(id), false);
      picker?.placeCenter();
      $("#sg-overview").scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    if (e.target.closest("[data-flash]")) {
      try {
        await fs.setDoc(fs.doc(db, "signage_devices", id), docFor(id, { banner: `この画面のID：${id}`, banner_until: Date.now() + 60000 }));
        toast("その画面に、IDを1分間、出しました");
      } catch (err) { toast("出せませんでした", true); console.warn("[staff] サイネージのID表示:", err.code); }
      return;
    }
    if (e.target.closest("[data-apply]")) {
      const q = row.querySelector("select").value;
      if (!q) { toast("場所を選んでください", true); return; }
      await loadMiniMap();
      const r = resolvePlace(q);
      if (r.err) { toast(r.err, true); return; }
      try {
        await fs.setDoc(fs.doc(db, "signage_devices", id), docFor(id, { place: r.place, spot: "", name: devices.get(id)?.name || r.name }));
        toast(`${id} を「${r.name}」にしました`);
      } catch (err) { toast("保存できませんでした", true); console.warn("[staff] サイネージの場所:", err.code); }
    }
  });

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
    const ids = allIds();
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

  const norm = (t) => String(t ?? "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();
  const candidates = () => [
    ...MAP.spots.filter((s) => s.at && s.name).map((s) => ({ key: s.id, name: s.name, at: s.at, floor: s.floor ?? "1F" })),
    ...MAP.places.filter((p) => p.name).map((p) => ({ key: p.id, name: p.name, floor: p.floor ?? "1F", alt: [p.short, p.sub, ...[].concat(p.room ?? [])].filter(Boolean) })),
  ];
  const namesOf = (c) => [c.name, c.key, ...(c.alt ?? [])].map(norm);
  function resolvePlace(query) {
    const n = norm(query);
    if (!n) return { err: "場所の名前がありません" };
    const cs = candidates();
    let hit = cs.filter((c) => namesOf(c).includes(n));
    if (!hit.length) hit = cs.filter((c) => namesOf(c).some((x) => x.includes(n) || (x.length >= 3 && n.includes(x))));
    const uniq = [...new Map(hit.map((c) => [c.key, c])).values()];
    if (!uniq.length) return { err: `「${query}」という場所が見つかりません` };
    if (uniq.length > 1) return { err: `「${query}」は、複数あります（${uniq.slice(0, 4).map((c) => c.name).join("・")}）` };
    const c = uniq[0];
    const pt = c.at ?? locatePoint(c.key);
    if (!pt) return { err: `「${c.name}」は、地図の位置が分かりません` };
    return { name: c.name, place: { x: Math.round(pt[0]), y: Math.round(pt[1]), floor: c.floor } };
  }
  function resolveId(token) {
    const t = token.toLowerCase();
    const known = [...new Set([...devices.keys(), ...seen.keys()])];
    if (known.includes(token)) return { id: token };
    const hit = known.filter((id) => id.toLowerCase().endsWith(t));
    if (hit.length === 1) return { id: hit[0] };
    if (hit.length > 1) return { err: `「${token}」で終わるIDが、複数あります（${hit.slice(0, 4).join("・")}）` };
    return { err: `「${token}」で終わるIDは、いま開かれている画面に、ありません` };
  }
  const parseLine = (line) => {
    const m = line.match(/^\s*([A-Za-z0-9_-]{2,40})[\s:：=＝,，]+(.+?)\s*$/);
    return m ? { id: m[1], q: m[2] } : null;
  };
  $("#sg-bp-fill").addEventListener("click", () => {
    const ids = allIds();
    $("#sg-bp-text").value = ids.length ? ids.map((id) => `${id} `).join("\n") : "";
    if (!ids.length) toast("いま開かれている画面は、ありません");
    $("#sg-bp-text").focus();
  });
  $("#sg-bp-go").addEventListener("click", async () => {
    const out = $("#sg-bp-result"), lines = $("#sg-bp-text").value.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) { toast("IDと場所を、書いてください", true); return; }
    await loadMiniMap();
    const rows = [];
    const btn = $("#sg-bp-go");
    btn.disabled = true;
    for (const line of lines) {
      const p = parseLine(line);
      if (!p) { rows.push([false, `${line.trim()}（IDと場所の名前を、空白で分けて書いてください）`]); continue; }
      const idr = resolveId(p.id);
      if (idr.err) { rows.push([false, idr.err]); continue; }
      p.id = idr.id;
      const r = resolvePlace(p.q);
      if (r.err) { rows.push([false, `${p.id}：${r.err}`]); continue; }
      try {
        await fs.setDoc(fs.doc(db, "signage_devices", p.id), docFor(p.id, { place: r.place, spot: "", name: devices.get(p.id)?.name || r.name }));
        rows.push([true, `${p.id} → ${r.name}`]);
      } catch (err) {
        rows.push([false, `${p.id}：保存できませんでした`]);
        console.warn("[staff] サイネージの場所:", err.code);
      }
    }
    btn.disabled = false;
    out.innerHTML = rows.map(([ok, t]) => `<li class="${ok ? "is-ok" : "is-ng"}">${ok ? "✓" : "✕"} ${esc(t)}</li>`).join("");
    const okN = rows.filter((r) => r[0]).length;
    toast(okN ? `${okN}台の場所を、反映しました` : "反映できた画面は、ありません", !okN);
  });
  $("#sg-bp-names").textContent = [...new Set(candidates().map((c) => c.name))].join("、");

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
