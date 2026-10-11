export function initAiAdmin({ fs, db, a, $, esc, toast, write, listen, time }) {
  const form = $("#ai-cfg"), faqBox = $("#ai-faq"), logBox = $("#ai-loglist"), statBox = $("#ai-stats");
  let faq = [], logs = [], filter = "";

  const stamp = () => ({ updated_at: fs.serverTimestamp(), updated_by: a.currentUser.email });

  function paintFaq() {
    faqBox.innerHTML = faq.length
      ? faq.map((x, i) => `<div class="ai-faq-row" data-i="${i}">
          <input class="ai-faq-q" value="${esc(x.q)}" maxlength="100" placeholder="質問（例：落とし物はどこ？）" aria-label="質問">
          <textarea class="ai-faq-a" rows="2" maxlength="300" placeholder="答え（例：本部（H棟1F）で預かっています）" aria-label="答え">${esc(x.a)}</textarea>
          <button type="button" class="btn btn-ghost btn-sm" data-faq-del="${i}">消す</button>
        </div>`).join("")
      : '<p class="muted small">まだありません。よくある質問と答えを足すと、AIくんが、その内容で答えます。</p>';
    $("#ai-faq-add").disabled = faq.length >= 20;
  }
  function readFaq() {
    return [...faqBox.querySelectorAll(".ai-faq-row")].map((r) => ({ q: r.querySelector(".ai-faq-q").value.trim(), a: r.querySelector(".ai-faq-a").value.trim() })).filter((x) => x.q && x.a);
  }
  faqBox.addEventListener("click", (e) => {
    const b = e.target.closest("[data-faq-del]");
    if (!b) return;
    faq = readFaq();
    faq.splice(Number(b.dataset.faqDel), 1);
    paintFaq();
  });
  $("#ai-faq-add").addEventListener("click", () => {
    faq = [...faqBox.querySelectorAll(".ai-faq-row")].map((r) => ({ q: r.querySelector(".ai-faq-q").value, a: r.querySelector(".ai-faq-a").value }));
    if (faq.length >= 20) return;
    faq.push({ q: "", a: "" });
    paintFaq();
    faqBox.querySelectorAll(".ai-faq-q")[faq.length - 1]?.focus();
  });

  listen(fs.doc(db, "ai_config", "current"), (snap) => {
    const d = snap.exists() ? snap.data() : {};
    if (form.contains(document.activeElement)) return;
    $("#ai-enabled").checked = d.enabled !== false;
    $("#ai-extra").value = d.extra ?? "";
    $("#ai-lim-10m").value = d.limit_device_10m ?? 8;
    $("#ai-lim-day").value = d.limit_device_day ?? 30;
    $("#ai-lim-all").value = d.global_day ?? 1300;
    faq = Array.isArray(d.faq) ? d.faq.map((x) => ({ q: String(x?.q ?? ""), a: String(x?.a ?? "") })) : [];
    paintFaq();
    $("#ai-cfg-meta").textContent = d.updated_by ? `最後の保存：${d.updated_by}（${time(d.updated_at?.toMillis?.())}）` : "まだ保存していません（いまは、初期の設定で動いています）";
    $("#ai-state").textContent = d.enabled === false ? "休止中" : "動いています";
    $("#ai-state").dataset.on = String(d.enabled !== false);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const num = (id, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number($(id).value) || lo)));
    const data = {
      enabled: $("#ai-enabled").checked,
      extra: $("#ai-extra").value.trim().slice(0, 1500),
      faq: readFaq().slice(0, 20),
      limit_device_10m: num("#ai-lim-10m", 1, 30),
      limit_device_day: num("#ai-lim-day", 1, 200),
      global_day: num("#ai-lim-all", 50, 5000),
    };
    write(data.enabled ? "AIくんの設定を保存しました" : "AIくんを休止にしました", () => fs.setDoc(fs.doc(db, "ai_config", "current"), { ...data, ...stamp() }));
  });

  function paintStats() {
    const now = Date.now(), ms = (l) => l.at;
    const day = logs.filter((l) => now - ms(l) < 86400000), hour = logs.filter((l) => now - ms(l) < 3600000);
    const devs = new Set(day.map((l) => l.sid)).size;
    const unknown = day.filter((l) => /分からねえ|知らせは出てねえ|担当じゃねえ/.test(l.a)).length;
    const byHour = Array.from({ length: 12 }, (_, i) => day.filter((l) => now - ms(l) >= i * 3600000 && now - ms(l) < (i + 1) * 3600000).length).reverse();
    const max = Math.max(1, ...byHour);
    statBox.innerHTML = `
      <div class="ai-stat"><b>${day.length}</b><span>この24時間の質問</span></div>
      <div class="ai-stat"><b>${hour.length}</b><span>この1時間</span></div>
      <div class="ai-stat"><b>${devs}</b><span>聞いた端末（24時間）</span></div>
      <div class="ai-stat"><b>${unknown}</b><span>「分からない」と答えた数</span></div>
      <div class="ai-spark" aria-label="1時間ごとの質問の数（12時間）">${byHour.map((n) => `<i style="--h:${Math.round((n / max) * 100)}%" title="${n}件"></i>`).join("")}</div>`;
  }
  function paintLogs() {
    const f = filter.trim().toLowerCase();
    const rows = logs.filter((l) => !f || l.q.toLowerCase().includes(f) || l.a.toLowerCase().includes(f)).slice(0, 100);
    logBox.innerHTML = rows.length ? rows.map((l) => {
      const unk = /分からねえ|知らせは出てねえ|担当じゃねえ/.test(l.a);
      return `<details class="ai-log-row${unk ? " is-unk" : ""}">
        <summary><time>${esc(time(l.at))}</time><b>${esc(l.q)}</b>${unk ? '<i class="tag tag-warn">分からない</i>' : ""}<code>${esc(l.sid)}</code></summary>
        <div class="ai-log-a">${esc(l.a).replace(/\n/g, "<br>")}</div>
        <div class="ai-log-acts"><button type="button" class="btn btn-ghost btn-sm" data-faq-from="${esc(l.id)}">この質問を、よくある質問に足す</button><button type="button" class="btn btn-ghost btn-sm" data-log-del="${esc(l.id)}">この記録を消す</button></div>
      </details>`;
    }).join("") : '<p class="muted small">記録はまだありません。</p>';
  }
  listen(fs.query(fs.collection(db, "ai_logs"), fs.orderBy("at", "desc"), fs.limit(300)), (snap) => {
    logs = snap.docs.map((d) => { const v = d.data(); return { id: d.id, q: String(v.q ?? ""), a: String(v.a ?? ""), sid: String(v.sid ?? ""), at: v.at?.toMillis?.() ?? Date.now() }; });
    paintStats();
    if (!logBox.querySelector("details[open]")) paintLogs();
  });
  $("#ai-logq").addEventListener("input", (e) => { filter = e.target.value; paintLogs(); });
  logBox.addEventListener("click", (e) => {
    const del = e.target.closest("[data-log-del]"), add = e.target.closest("[data-faq-from]");
    if (del) write("記録を消しました", () => fs.deleteDoc(fs.doc(db, "ai_logs", del.dataset.logDel)));
    if (add) {
      const l = logs.find((x) => x.id === add.dataset.faqFrom);
      if (!l) return;
      faq = [...faqBox.querySelectorAll(".ai-faq-row")].map((r) => ({ q: r.querySelector(".ai-faq-q").value, a: r.querySelector(".ai-faq-a").value }));
      if (faq.length >= 20) return toast("よくある質問は、20件までです", true);
      faq.push({ q: l.q.slice(0, 100), a: "" });
      paintFaq();
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      faqBox.querySelectorAll(".ai-faq-a")[faq.length - 1]?.focus();
      toast("質問を足しました。答えを書いて、保存してください");
    }
  });
  $("#ai-log-clear").addEventListener("click", async () => {
    if (!logs.length) return toast("消す記録はありません");
    if (!confirm(`AIくんの質問の記録を、すべて消しますか？（${logs.length}件）元には戻せません。`)) return;
    const ok = await write("記録をすべて消しました", async () => {
      for (let i = 0; i < logs.length; i += 400) {
        const b = fs.writeBatch(db);
        logs.slice(i, i + 400).forEach((l) => b.delete(fs.doc(db, "ai_logs", l.id)));
        await b.commit();
      }
    });
    if (ok) paintLogs();
  });
}
