const NS = "http://www.w3.org/2000/svg";
const jobs = new Map();

export function drawThread(box) {
  if (!box || jobs.has(box)) return;
  jobs.set(box, requestAnimationFrame(() => { jobs.delete(box); draw(box); }));
}

function draw(box) {
  let svg = box.querySelector(":scope > .tk-thread");
  if (!svg) {
    svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "tk-thread");
    svg.setAttribute("aria-hidden", "true");
    box.prepend(svg);
  }
  let front = box.querySelector(":scope > .tk-thread-front");
  if (!front) {
    front = document.createElementNS(NS, "svg");
    front.setAttribute("class", "tk-thread tk-thread-front");
    front.setAttribute("aria-hidden", "true");
  }
  box.append(front);
  if (box.classList.contains("is-list")) { svg.remove(); front.remove(); return; }
  const b = box.getBoundingClientRect();
  if (!b.width) return;
  svg.setAttribute("viewBox", `0 0 ${b.width} ${b.height}`);
  const u = b.width / 356;
  const runs = [[]];
  for (const el of box.children) {
    if (el === svg || el === front) continue;
    const hole = el.querySelector?.(".tk-hole");
    if (!hole) { if (runs.at(-1).length) runs.push([]); continue; }
    const r = hole.getBoundingClientRect();
    runs.at(-1).push([r.left + r.width / 2 - b.left, r.top + r.height / 2 - b.top]);
  }
  const d = runs.filter((p) => p.length).map((p) => {
    const tail = 26 * u;
    let s = `M${p[0][0] + 6 * u} ${p[0][1] - tail} Q${p[0][0] - 8 * u} ${p[0][1] - tail / 2} ${p[0][0]} ${p[0][1]}`;
    for (let i = 1; i < p.length; i++) {
      const [x0, y0] = p[i - 1], [x1, y1] = p[i];
      const w = (i % 2 ? 1 : -1) * 22 * u;
      s += ` C${x0 + w} ${y0 + (y1 - y0) * 0.45} ${x1 - w} ${y0 + (y1 - y0) * 0.55} ${x1} ${y1}`;
    }
    const [xl, yl] = p.at(-1);
    return s + ` Q${xl + 10 * u} ${yl + tail / 2} ${xl - 4 * u} ${yl + tail}`;
  }).join(" ");
  const sw = `stroke-width:${(2.6 * u).toFixed(2)}px`;
  svg.innerHTML = `<path d="${d}" style="${sw}"/>`;
  front.setAttribute("viewBox", `0 0 ${b.width} ${b.height}`);
  const hr = 4.5 * u * 0.92;
  front.innerHTML = `<clipPath id="tk-holes"><!-- 穴の丸 -->${runs.flat().map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${hr}"/>`).join("")}</clipPath><path d="${d}" style="${sw}" clip-path="url(#tk-holes)"/>`;
}

const watched = new WeakSet();
export function watchThread(box) {
  if (!box || watched.has(box)) return;
  watched.add(box);
  new ResizeObserver(() => drawThread(box)).observe(box);
  document.fonts?.ready.then(() => drawThread(box));
  box.addEventListener("load", () => drawThread(box), true);
  drawThread(box);
}
