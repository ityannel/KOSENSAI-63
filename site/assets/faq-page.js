import { FAQ } from "./config.js";
import { fillFaq } from "./faq-text.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

document.getElementById("faq-list").innerHTML = FAQ.map((g, i) => `<section aria-labelledby="faq-g${i}">
  <h2 id="faq-g${i}"><span class="no">${i + 1}</span>${esc(g.group)}</h2>
  <dl>${g.items.map(({ q, a }) => `<dt>${esc(q)}</dt><dd>${esc(fillFaq(a))}</dd>`).join("")}</dl>
</section>`).join("");
