const SEGS = [["faq", "案内くん"], ["ai", "AIくん"], ["hq", "本部"]];
const HREF = { ai: "ai.html", hq: "hq.html" };

export const barHtml = (current) => `<ol class="qa-flow">${SEGS.map(([k, t], i) => {
  const inner = `<span class="qa-flow-no">${i + 1}</span><b>${t}</b>`;
  if (k === current) return `<li class="is-now"><span aria-current="page">${inner}</span></li>`;
  if (k === "faq") return `<li><button type="button" data-help="faq">${inner}</button></li>`;
  return `<li><a href="${HREF[k]}">${inner}</a></li>`;
}).join("")}</ol>`;

document.addEventListener("click", (e) => {
  if (e.target.closest?.('[data-help="faq"]')) document.dispatchEvent(new CustomEvent("faq:open"));
});
