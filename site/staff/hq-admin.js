const VOL_KEY = "kosen63-hq-vol", MUTE_KEY = "kosen63-hq-mute";
const QUICK = ["すぐに向かいます。そのままお待ちください。", "少しお待ちください。確認します。", "いまいる場所を、もう少し教えてください。", "落とし物は、本部で預かっています。本部にお越しください。", "対応しました。ほかにも困ったことがあれば、送ってください。"];

const API = ["localhost", "127.0.0.1"].includes(location.hostname) || location.hostname.endsWith("pages.dev") ? "" : "https://hakodate-kosensai.pages.dev";

export function initHq({ fs, db, a, $, $$, esc, toast, write, listen, time }) {
  const listBox = $("#hq-inbox"), threadBox = $("#hq-thread"), banner = $("#hq-banner");
  let chats = new Map(), selected = null, tab = "open", unsubMsgs = null, msgs = [];
  let ctx = null, urgentTimer = null, titleTimer = null, firstSnapshot = true;
  const baseTitle = document.title;

  const vol = () => { try { return Math.min(1, Math.max(0, Number(localStorage.getItem(VOL_KEY) ?? 1))); } catch { return 1; } };
  const muted = () => { try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; } };
  function audio() {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function out() {
    const c = audio();
    if (!out.node) {
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -8; comp.ratio.value = 6;
      const master = c.createGain();
      master.connect(comp).connect(c.destination);
      out.node = master;
    }
    out.node.gain.value = vol() * 1.6;
    return out.node;
  }
  function tone(freq, at, dur, type, peak) {
    const c = audio(), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    const t0 = c.currentTime + at;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(out());
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function bell() {
    const motif = [659, 831, 988, 1319];
    for (let r = 0; r < 3; r++) {
      motif.forEach((f, i) => {
        const at = r * 2.2 + i * 0.28, long = i === motif.length - 1 ? 1.4 : 0.5;
        tone(f, at, long, "triangle", 0.55);
        tone(f * 2, at, long * 0.7, "sine", 0.22);
      });
    }
  }
  function siren() {
    for (let i = 0; i < 16; i++) tone(i % 2 ? 1175 : 880, i * 0.5, 0.48, "square", 0.32);
  }
  function play(kind) {
    if (muted()) return;
    try { kind === "urgent" ? siren() : bell(); } catch {  }
  }
  const audioReady = () => !!ctx && ctx.state === "running";

  const unreadAll = () => [...chats.values()].filter((c) => c.unread_staff && c.status !== "closed");
  const unreadUrgent = () => unreadAll().filter((c) => c.urgent);

  function paintBanner() {
    const all = unreadAll(), urg = unreadUrgent();
    $("#nav-hq-badge").hidden = !all.length;
    $("#nav-hq-badge").textContent = all.length;
    banner.hidden = !all.length;
    banner.classList.toggle("is-urgent", urg.length > 0);
    $("#hq-banner-text").textContent = urg.length ? `緊急の連絡が ${urg.length} 件 来ています（ほか ${all.length - urg.length} 件）` : `本部への連絡が ${all.length} 件 来ています`;
    $("#hq-audio-warn").hidden = audioReady() || muted() || !all.length;
    clearInterval(titleTimer);
    if (all.length) {
      let on = false;
      titleTimer = setInterval(() => { on = !on; document.title = on ? `● ${urg.length ? "緊急" : "連絡"} ${all.length}件｜本部コンソール` : baseTitle; }, 900);
    } else document.title = baseTitle;
    clearInterval(urgentTimer);
    if (urg.length && !muted()) urgentTimer = setInterval(() => { if (unreadUrgent().length) play("urgent"); }, 9000);
  }

  function alertNew(c) {
    paintBanner();
    play(c.urgent ? "urgent" : "bell");
  }

  const when = (ms) => (ms ? time(ms) : "");
  function paintList() {
    const rows = [...chats.values()].filter((c) => (tab === "all" ? true : tab === "closed" ? c.status === "closed" : c.status !== "closed")).sort((x, y) => (y.last_at ?? 0) - (x.last_at ?? 0));
    listBox.innerHTML = rows.length ? rows.map((c) => `<button type="button" class="hq-row${c.id === selected ? " is-sel" : ""}${c.unread_staff && c.status !== "closed" ? " is-unread" : ""}${c.status === "closed" ? " is-closed" : ""}" data-chat="${esc(c.id)}">
        <span class="hq-row-top">${c.urgent && c.status !== "closed" ? '<i class="tag tag-danger">緊急</i>' : ""}<b>${esc(c.place || "場所の記入なし")}</b><time>${esc(when(c.last_at))}</time></span>
        <span class="hq-row-txt">${c.last_from === "staff" ? "本部：" : ""}${esc(c.last_text)}</span>
      </button>`).join("") : '<p class="muted small hq-empty">いまは、ありません。</p>';
  }

  function paintThread() {
    const c = chats.get(selected);
    $("#hq-thread-empty").hidden = !!c;
    $("#hq-thread-main").hidden = !c;
    if (!c) return;
    $("#hq-thread-title").textContent = c.place || "場所の記入なし";
    $("#hq-thread-state").textContent = c.status === "closed" ? "対応済み" : c.urgent ? "緊急" : "対応中";
    $("#hq-thread-state").dataset.k = c.status === "closed" ? "closed" : c.urgent ? "urgent" : "open";
    $("#hq-urgent").checked = !!c.urgent;
    $("#hq-close").textContent = c.status === "closed" ? "もう一度、開く" : "対応済みにする";
    $("#hq-msgs").innerHTML = msgs.map((m) => m.text.startsWith("【AIくんとの会話】") ? `<div class="hq-m is-ai"><p>${esc(m.text.replace("【AIくんとの会話】", ""))}</p><time>AIくんとの会話（来場者が、本部に見せました）</time></div>` : `<div class="hq-m ${m.from === "staff" ? "is-staff" : "is-visitor"}"><p>${esc(m.text).replace(/\n/g, "<br>")}</p><time>${m.from === "staff" ? `${esc(m.by ?? "本部")}・` : "来場者・"}${esc(when(m.at))}</time></div>`).join("");
    const box = $("#hq-msgs");
    box.scrollTop = box.scrollHeight;
  }

  function select(id) {
    selected = id;
    unsubMsgs?.();
    msgs = [];
    const c = chats.get(id);
    document.body.classList.toggle("hq-open", !!c);
    if (c) {
      unsubMsgs = fs.onSnapshot(fs.query(fs.collection(db, "hq_chats", id, "msgs"), fs.orderBy("at")), (s) => {
        msgs = s.docs.map((d) => { const v = d.data(); return { id: d.id, from: v.from, text: v.text, by: v.by, at: v.at?.toMillis?.() ?? Date.now() }; });
        paintThread();
      });
      if (c.unread_staff) fs.updateDoc(fs.doc(db, "hq_chats", id), { unread_staff: false }).catch(() => {});
    }
    paintList(); paintThread();
  }

  listen(fs.query(fs.collection(db, "hq_chats"), fs.orderBy("last_at", "desc"), fs.limit(200)), (snap) => {
    const next = new Map();
    snap.forEach((d) => { const v = d.data(); next.set(d.id, { id: d.id, ...v, last_at: v.last_at?.toMillis?.() ?? null, created_at: v.created_at?.toMillis?.() ?? null }); });
    const fresh = [];
    if (!firstSnapshot) for (const [id, c] of next) {
      const old = chats.get(id);
      if (c.last_from === "visitor" && c.unread_staff && c.id !== selected && (!old || (old.last_at ?? 0) < (c.last_at ?? 0))) fresh.push(c);
      else if (c.last_from === "visitor" && c.id === selected && (!old || (old.last_at ?? 0) < (c.last_at ?? 0))) { play("bell"); fs.updateDoc(fs.doc(db, "hq_chats", id), { unread_staff: false }).catch(() => {}); }
    }
    chats = next;
    paintList(); paintThread(); paintBanner();
    if (fresh.length) alertNew(fresh.sort((x, y) => Number(!!y.urgent) - Number(!!x.urgent))[0]);
    if (firstSnapshot && unreadAll().length) play(unreadUrgent().length ? "urgent" : "bell");
    firstSnapshot = false;
  });

  listBox.addEventListener("click", (e) => { const b = e.target.closest("[data-chat]"); if (b) select(b.dataset.chat); });
  $$("#hq-tabs [data-tab]").forEach((b) => b.addEventListener("click", () => {
    tab = b.dataset.tab;
    $$("#hq-tabs [data-tab]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    paintList();
  }));
  $("#hq-back").addEventListener("click", () => { document.body.classList.remove("hq-open"); selected = null; unsubMsgs?.(); paintList(); paintThread(); });
  $("#hq-banner-go").addEventListener("click", () => {
    const target = unreadUrgent()[0] ?? unreadAll()[0];
    location.hash = "hq";
    if (target) select(target.id);
  });
  $("#hq-banner-stop").addEventListener("click", () => { clearInterval(urgentTimer); toast("緊急の音を、いったん止めました（新しい連絡では、また鳴ります）"); });
  $("#hq-audio-warn").addEventListener("click", () => { try { audio(); play("bell"); } catch {  } paintBanner(); });
  addEventListener("pointerdown", () => { try { audio(); } catch {  } paintBanner(); }, { once: true });

  const volEl = $("#hq-vol"), muteEl = $("#hq-mute");
  volEl.value = String(Math.round(vol() * 100));
  muteEl.checked = muted();
  volEl.addEventListener("input", () => { try { localStorage.setItem(VOL_KEY, String(Number(volEl.value) / 100)); } catch {  } });
  muteEl.addEventListener("change", () => { try { localStorage.setItem(MUTE_KEY, muteEl.checked ? "1" : "0"); } catch {  } paintBanner(); });
  $("#hq-test").addEventListener("click", () => { const m = muted(); try { localStorage.setItem(MUTE_KEY, "0"); } catch {  } play("bell"); try { localStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch {  } paintBanner(); });
  $("#hq-test-urgent").addEventListener("click", () => { const m = muted(); try { localStorage.setItem(MUTE_KEY, "0"); } catch {  } play("urgent"); try { localStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch {  } });

  $("#hq-quick").innerHTML = QUICK.map((q) => `<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join("");
  $("#hq-quick").addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (!b) return; $("#hq-reply-q").value = b.dataset.q; $("#hq-reply-q").focus(); });

  $("#hq-reply").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("#hq-reply-q").value.trim().slice(0, 400);
    if (!text || !selected) return;
    const id = selected;
    write("返事を送りました", async () => {
      const b = fs.writeBatch(db);
      b.set(fs.doc(fs.collection(db, "hq_chats", id, "msgs")), { from: "staff", text, at: fs.serverTimestamp(), by: a.currentUser.email });
      b.update(fs.doc(db, "hq_chats", id), { last_text: text.slice(0, 120), last_from: "staff", last_at: fs.serverTimestamp(), unread_staff: false, unread_visitor: true });
      await b.commit();
      $("#hq-reply-q").value = "";
      const endpoint = chats.get(id)?.push;
      if (endpoint) {
        try {
          const token = await a.currentUser.getIdToken();
          const res = await fetch(`${API}/api/notify`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ endpoint }) });
          const j = await res.json().catch(() => ({}));
          toast(j.sent ? "返事を送りました（相手のスマホに、通知も送りました）" : "返事を送りました（通知は、届きませんでした。画面を開いたときに見えます）");
        } catch {  }
      }
    });
  });
  $("#hq-to-faq").addEventListener("click", async () => {
    const q = [...msgs].reverse().find((m) => m.from === "visitor" && !m.text.startsWith("【AIくんとの会話】"))?.text?.replace(/^【[^】]*】\s*/, "");
    const ans = [...msgs].reverse().find((m) => m.from === "staff")?.text;
    if (!q || !ans) return toast("来場者の質問と、本部の返事が、どちらも要ります", true);
    const ref = fs.doc(db, "ai_config", "current");
    const cur = await fs.getDoc(ref);
    const d = cur.exists() ? cur.data() : {};
    const faq = [...(Array.isArray(d.faq) ? d.faq : []), { q: q.slice(0, 100), a: ans.slice(0, 300) }].slice(-20);
    write("AIくんの「よくある質問」に足しました", () => fs.setDoc(ref, { enabled: d.enabled !== false, extra: d.extra ?? "", faq, limit_device_10m: d.limit_device_10m ?? 8, limit_device_day: d.limit_device_day ?? 30, global_day: d.global_day ?? 1300, updated_at: fs.serverTimestamp(), updated_by: a.currentUser.email }));
  });
  $("#hq-urgent").addEventListener("change", (e) => { if (selected) write(e.target.checked ? "緊急にしました" : "緊急をはずしました", () => fs.updateDoc(fs.doc(db, "hq_chats", selected), { urgent: e.target.checked })); });
  $("#hq-close").addEventListener("click", () => {
    const c = chats.get(selected);
    if (!c) return;
    write(c.status === "closed" ? "もう一度、開きました" : "対応済みにしました", () => fs.updateDoc(fs.doc(db, "hq_chats", selected), { status: c.status === "closed" ? "open" : "closed", urgent: false, unread_staff: false }));
  });
  $("#hq-del").addEventListener("click", async () => {
    const c = chats.get(selected);
    if (!c || !confirm("このやり取りを、消しますか？（元には戻せません）")) return;
    const id = selected;
    const ok = await write("消しました", async () => {
      const s = await fs.getDocs(fs.collection(db, "hq_chats", id, "msgs"));
      const b = fs.writeBatch(db);
      s.forEach((d) => b.delete(d.ref));
      b.delete(fs.doc(db, "hq_chats", id));
      await b.commit();
    });
    if (ok) { selected = null; unsubMsgs?.(); document.body.classList.remove("hq-open"); paintThread(); }
  });
}
