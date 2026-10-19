import { SIGNAGE } from "../assets/config.js";

const SLIDES = [["stage", "ステージ"], ["posts", "みんなの投稿"], ["popular", "人気の投稿"], ["shop", "模擬店"], ["crowd", "混雑"], ["way", "道案内"], ["stamp", "スタンプ"], ["share", "シェア"]];
const FACINGS = [[0, "標準"], [90, "右に90度まわす"], [180, "反対向き"], [270, "左に90度まわす"]];

export function initSgAdmin({ fs, db, a, $, esc, toast, listen, time }) {
  const list = $("#sg-list"), form = $("#sg-form");
  let devices = new Map(), seen = new Map(), editing = null;
  const stamp = () => ({ updated_at: fs.serverTimestamp(), updated_by: a.currentUser.email });
  const ms = (v) => v?.toMillis?.() ?? 0;
  const spotName = (k) => SIGNAGE.spots[k]?.name ?? "";
  const baseUrl = () => new URL("../signage.html", location.href).href;
  const urlOf = (id) => `${baseUrl()}?d=${encodeURIComponent(id)}`;
  const newId = () => `sg-${Math.random().toString(36).slice(2, 8)}`;

  function paintList() {
    const ids = [...new Set([...devices.keys(), ...seen.keys()])];
    const now = Date.now();
    ids.sort((x, y) => (ms(seen.get(y)?.seen) - ms(seen.get(x)?.seen)) || x.localeCompare(y));
    list.innerHTML = ids.length ? ids.map((id) => {
      const d = devices.get(id), s = seen.get(id), last = ms(s?.seen), live = last && now - last < 150000;
      return `<button type="button" class="sg-row${editing === id ? " is-on" : ""}" data-id="${esc(id)}">
        <i class="sg-dot${live ? " is-live" : ""}" title="${live ? "いま表示中" : "しばらく反応なし"}"></i>
        <span class="sg-main"><b>${esc(d?.name || "（未登録の画面）")}</b><small>${esc(id)}${d?.spot ? `・${esc(spotName(d.spot))}` : ""}</small></span>
        <span class="sg-meta">${s ? `${esc(`${s.w ?? "?"}×${s.h ?? "?"}`)}・${s.o === "portrait" ? "縦" : "横"}<br>${last ? esc(time(last)) : ""}` : "まだ開かれていません"}</span>
        ${d ? "" : '<em class="tag tag-warn">未登録</em>'}</button>`;
    }).join("") : '<p class="muted small">まだ、画面はありません。「＋ 画面を登録」を押すか、サイネージのページを開くと、ここに出ます。</p>';
  }

  function openForm(id, isNew = false) {
    editing = id;
    const d = devices.get(id) ?? {};
    form.hidden = false;
    $("#sg-id").value = id;
    $("#sg-url").value = urlOf(id);
    $("#sg-name").value = d.name ?? "";
    $("#sg-spot").innerHTML = `<option value="">（指定しない）</option>${Object.entries(SIGNAGE.spots).map(([k, v]) => `<option value="${esc(k)}">${esc(v.name)}</option>`).join("")}`;
    $("#sg-spot").value = d.spot ?? "";
    $("#sg-orient").value = d.orient ?? "auto";
    $("#sg-facing").innerHTML = FACINGS.map(([v, t]) => `<option value="${v}">${t}</option>`).join("");
    $("#sg-facing").value = String(d.facing ?? 0);
    const on = new Set(Array.isArray(d.slides) ? d.slides : []);
    $("#sg-slides").innerHTML = SLIDES.map(([k, t]) => `<label class="sg-chk"><input type="checkbox" value="${k}"${!on.size || on.has(k) ? " checked" : ""}><span>${t}</span></label>`).join("");
    $("#sg-only").innerHTML = `<option value="">（出さない）</option>${SLIDES.map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}`;
    $("#sg-only").value = d.only && (d.only_until ?? 0) > Date.now() ? d.only : "";
    $("#sg-only-min").value = "30";
    $("#sg-banner").value = d.banner && (d.banner_until ?? 0) > Date.now() ? d.banner : "";
    $("#sg-banner-min").value = "30";
    $("#sg-note").value = d.note ?? "";
    $("#sg-del").hidden = !devices.has(id);
    $("#sg-reload").hidden = !devices.has(id);
    $("#sg-form-title").textContent = isNew ? "画面を登録" : d.name ? d.name : "画面の設定";
    paintList();
    form.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function read() {
    const slides = [...$("#sg-slides").querySelectorAll("input:checked")].map((x) => x.value);
    const onlyMin = Math.max(1, Math.min(600, Number($("#sg-only-min").value) || 30));
    const banMin = Math.max(1, Math.min(600, Number($("#sg-banner-min").value) || 30));
    const only = $("#sg-only").value, banner = $("#sg-banner").value.trim().slice(0, 120);
    const prev = devices.get(editing) ?? {};
    const keepOnly = only && prev.only === only && (prev.only_until ?? 0) > Date.now() && $("#sg-only-min").dataset.touched !== "1";
    const keepBan = banner && prev.banner === banner && (prev.banner_until ?? 0) > Date.now() && $("#sg-banner-min").dataset.touched !== "1";
    return {
      name: $("#sg-name").value.trim().slice(0, 40),
      spot: $("#sg-spot").value,
      orient: $("#sg-orient").value,
      facing: Number($("#sg-facing").value) || 0,
      slides: slides.length === SLIDES.length ? [] : slides,
      only: only || "",
      only_until: only ? (keepOnly ? prev.only_until : Date.now() + onlyMin * 60000) : 0,
      banner,
      banner_until: banner ? (keepBan ? prev.banner_until : Date.now() + banMin * 60000) : 0,
      note: $("#sg-note").value.trim().slice(0, 200),
    };
  }

  $("#sg-new").addEventListener("click", () => openForm(newId(), true));
  list.addEventListener("click", (e) => {
    const b = e.target.closest("[data-id]");
    if (b) openForm(b.dataset.id, !devices.has(b.dataset.id));
  });
  for (const id of ["sg-only-min", "sg-banner-min"]) $(`#${id}`).addEventListener("input", (e) => { e.target.dataset.touched = "1"; });
  $("#sg-copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("#sg-url").value); toast("URLをコピーしました"); } catch { $("#sg-url").select(); }
  });
  $("#sg-open").addEventListener("click", () => window.open($("#sg-url").value, "_blank", "noopener"));
  $("#sg-close").addEventListener("click", () => { editing = null; form.hidden = true; paintList(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!editing) return;
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      await fs.setDoc(fs.doc(db, "signage_devices", editing), { ...read(), ...stamp(), ...(devices.get(editing)?.reload_at ? { reload_at: devices.get(editing).reload_at } : {}) });
      toast("保存しました。画面には、数秒で反映されます");
    } catch (err) {
      toast("保存できませんでした", true);
      console.warn("[staff] サイネージの保存:", err.code);
    } finally {
      btn.disabled = false;
    }
  });
  $("#sg-reload").addEventListener("click", async () => {
    if (!editing || !devices.has(editing)) return;
    try {
      await fs.setDoc(fs.doc(db, "signage_devices", editing), { ...devices.get(editing), reload_at: fs.serverTimestamp(), ...stamp() });
      toast("再読み込みを、送りました");
    } catch { toast("送れませんでした", true); }
  });
  $("#sg-del").addEventListener("click", async () => {
    if (!editing || !devices.has(editing) || !confirm("この画面の登録をやめますか？（画面は、そのまま表示されます）")) return;
    try {
      await fs.deleteDoc(fs.doc(db, "signage_devices", editing));
      editing = null; form.hidden = true;
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
}
