const SEGS = [["faq", "よくある質問", "選んで答えを見る"], ["ai", "AIくん", "自由に質問"], ["hq", "本部", "スタッフに連絡"]];
const HREF = { ai: "ai.html", hq: "hq.html" };

export const barHtml = (current) => `<ol class="qa-flow">${SEGS.map(([k, t, d], i) => {
  const inner = `<span class="qa-flow-no">${i + 1}</span><span class="qa-flow-t"><b>${t}</b><small>${d}</small></span>`;
  if (k === current) return `<li class="is-now"><span aria-current="page">${inner}</span></li>`;
  if (k === "faq") return `<li><button type="button" data-help="faq">${inner}</button></li>`;
  return `<li><a href="${HREF[k]}">${inner}</a></li>`;
}).join("")}</ol>`;

document.addEventListener("click", (e) => {
  if (e.target.closest?.('[data-help="faq"]')) document.dispatchEvent(new CustomEvent("faq:open"));
});
