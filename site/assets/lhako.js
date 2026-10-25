import { LHAKO } from "./config.js";

export const MAX_RES = 3;

const at = (date, hm) => Date.parse(`${date}T${hm}:00+09:00`);

export function lhakoSlots() {
  const out = [];
  for (const day of LHAKO.days) {
    const from = at(day.date, day.start), to = at(day.date, day.end);
    for (let t = from; t + LHAKO.minutes * 60000 <= to; t += LHAKO.minutes * 60000) {
      const hm = new Date(t + 9 * 3600000).toISOString().slice(11, 16);
      const id = `${day.id}-${hm.replace(":", "")}`;
      const end = new Date(t + LHAKO.minutes * 60000 + 9 * 3600000).toISOString().slice(11, 16);
      out.push({ id, day: day.id, start: t, end: t + LHAKO.minutes * 60000, hm, endHm: end });
    }
  }
  return out;
}

export const seatId = (slotId, n) => `${slotId}-${n}`;

export const freeSeats = (taken, slotId) => [...Array(LHAKO.seats).keys()].filter((n) => !taken.has(seatId(slotId, n)));

let fbP = null;
function firebase() {
  fbP ??= (async () => {
    const { FIREBASE_VERSION, firebaseConfig, connectEmulators, firestoreFor } = await import("./live.js");
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
    const [appMod, auth, fs] = await Promise.all([import(`${base}/firebase-app.js`), import(`${base}/firebase-auth.js`), import(`${base}/firebase-firestore.js`)]);
    const app = appMod.getApps().find((x) => x.name === "[DEFAULT]") ?? appMod.initializeApp(firebaseConfig);
    const k = { auth, fs, a: auth.getAuth(app), db: firestoreFor(fs, app) };
    connectEmulators({ fs, db: k.db, auth, a: k.a });
    return k;
  })();
  return fbP;
}

async function signedIn(k) {
  if (!k.a.currentUser) await k.auth.signInAnonymously(k.a);
  return k.a.currentUser.uid;
}

export function firestoreStore() {
  let k = null, uid = null;
  const ready = async () => {
    k ??= await firebase();
    uid ??= await signedIn(k);
    return k;
  };
  return {
    async watch({ seats, mine, error }) {
      try {
        const { fs, db } = await ready();
        fs.onSnapshot(fs.collection(db, "lhako_seats"), (snap) => seats(new Set(snap.docs.map((d) => d.id))), (e) => error(e));
        fs.onSnapshot(fs.query(fs.collection(db, "lhako_res"), fs.where("uid", "==", uid)), (snap) => mine(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => error(e));
      } catch (e) {
        error(e);
      }
    },
    async book({ rid, slotId, seats, name }) {
      const { fs, db } = await ready();
      const b = fs.writeBatch(db);
      b.set(fs.doc(db, "lhako_res", rid), { uid, slot: slotId, seats, name, at: fs.serverTimestamp() });
      for (const n of seats) b.set(fs.doc(db, "lhako_seats", seatId(slotId, n)), { res: rid, at: fs.serverTimestamp() });
      await b.commit();
    },
    async cancel({ rid, slot, seats }) {
      const { fs, db } = await ready();
      const b = fs.writeBatch(db);
      b.delete(fs.doc(db, "lhako_res", rid));
      for (const n of seats) b.delete(fs.doc(db, "lhako_seats", seatId(slot, n)));
      await b.commit();
    },
    uid: () => uid,
  };
}

export function demoStore(slots) {
  const taken = new Set();
  const res = [];
  const listeners = {};
  for (const s of slots.slice(0, 6)) for (let n = 0; n < (s.hm.endsWith("20") ? 3 : 2); n++) taken.add(seatId(s.id, n));
  const push = () => { listeners.seats?.(new Set(taken)); listeners.mine?.(res.map((r) => ({ ...r }))); };
  return {
    async watch(fns) { Object.assign(listeners, fns); push(); },
    async book({ rid, slotId, seats: list, name }) {
      if (list.some((n) => taken.has(seatId(slotId, n)))) throw Object.assign(new Error("taken"), { code: "permission-denied" });
      list.forEach((n) => taken.add(seatId(slotId, n)));
      res.push({ id: rid, uid: "demo", slot: slotId, seats: list, name });
      push();
    },
    async cancel({ rid, slot, seats: list }) {
      list.forEach((n) => taken.delete(seatId(slot, n)));
      res.splice(res.findIndex((r) => r.id === rid), 1);
      push();
    },
    uid: () => "demo",
  };
}

export function freeResId(mine, uid) {
  for (let k = 0; k < MAX_RES; k++) if (!mine.some((r) => r.id === `${uid}-${k}`)) return `${uid}-${k}`;
  return null;
}
