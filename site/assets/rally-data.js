import { RALLY } from "./config.js";

const KEY = "kosen63-rally-data";
const params = new URLSearchParams(location.search);
const CONFIG = { shops: RALLY.shops.map((s) => ({ ...s })), staffPin: RALLY.staffPin };

function apply(data) {
  const useFirestore = Array.isArray(data?.shops) && data.shops.length > 0;
  const shops = useFirestore ? data.shops : CONFIG.shops;
  RALLY.shops.splice(0, RALLY.shops.length, ...shops.map((s) => ({ ...s })));
  RALLY.staffPin = data?.staffPin ?? CONFIG.staffPin;
}

let loaded = false;
export const rallyLoaded = () => loaded || params.has("demo");
try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
  if (saved && !params.has("demo")) { apply(saved); loaded = true; }
} catch {  }

const listeners = new Set();
export function onRallyChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let resolveReady;
const ready = new Promise((ok) => { resolveReady = ok; });
export function rallyReady(timeout = 2000) {
  return Promise.race([ready, new Promise((ok) => setTimeout(ok, timeout))]);
}

if (params.has("demo")) {
  resolveReady();
} else {
  import("./live.js").then(({ subscribeRally }) => subscribeRally((data) => {
    const before = JSON.stringify({ shops: RALLY.shops, staffPin: RALLY.staffPin });
    apply(data);
    loaded = true;
    try { localStorage.setItem(KEY, JSON.stringify(data ?? null)); } catch {  }
    resolveReady();
    if (JSON.stringify({ shops: RALLY.shops, staffPin: RALLY.staffPin }) !== before) listeners.forEach((fn) => fn());
  })).catch(() => resolveReady());
}
