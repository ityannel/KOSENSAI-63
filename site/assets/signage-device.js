import { signedInKit } from "./posts.js";

const KEY = "kosen63-sg-id";
const params = new URLSearchParams(location.search);

export const deviceId = (() => {
  const q = params.get("d");
  let id = q && /^[A-Za-z0-9_-]{3,40}$/.test(q) ? q : null;
  try {
    if (id) localStorage.setItem(KEY, id);
    else id = localStorage.getItem(KEY);
  } catch {  }
  if (!id) {
    id = `sg-${Math.random().toString(36).slice(2, 8)}`;
    try { localStorage.setItem(KEY, id); } catch {  }
  }
  return id;
})();

export async function listDevices(onList) {
  let kit;
  try { kit = await signedInKit(); } catch { onList([]); return; }
  const { fs, db } = kit;
  fs.onSnapshot(fs.collection(db, "signage_devices"), { includeMetadataChanges: true }, (s) => { if (!s.metadata.fromCache) onList(s.docs.map((d) => ({ id: d.id, ...d.data() }))); }, () => onList([]));
}

export async function watchDevice(onConfig) {
  let kit;
  try { kit = await signedInKit(); } catch { onConfig(null); return; }
  const { fs, db } = kit;
  fs.onSnapshot(fs.doc(db, "signage_devices", deviceId), { includeMetadataChanges: true }, (s) => { if (!s.metadata.fromCache) onConfig(s.exists() ? s.data() : null); }, () => onConfig(null));
  const beat = () => fs.setDoc(fs.doc(db, "signage_seen", deviceId), {
    seen: fs.serverTimestamp(),
    w: innerWidth,
    h: innerHeight,
    o: document.body.classList.contains("portrait") ? "portrait" : "landscape",
    path: (location.pathname + location.search).slice(0, 80),
  }).catch(() => {});
  beat();
  setInterval(beat, 60000);
}
