import { HQ_FLAG } from "./ai-core.js";

const fab = () => document.querySelector(".ai-fab");
let shownFor = 0;

function toast() {
  if (document.querySelector(".hq-badge-toast")) return;
  const a = document.createElement("a");
  a.className = "hq-badge-toast";
  a.href = "hq.html";
  a.textContent = "本部から返事が来ています";
  document.body.append(a);
  setTimeout(() => a.remove(), 9000);
}

async function start() {
  try {
    const { signedInKit } = await import("./posts.js");
    const { fs, db, a } = await signedInKit();
    fs.onSnapshot(fs.doc(db, "hq_chats", a.currentUser.uid), (s) => {
      const d = s.exists() ? s.data() : null;
      const on = !!d?.unread_visitor;
      fab()?.classList.toggle("has-hq", on);
      const at = d?.last_at?.toMillis?.() ?? 0;
      if (on && at > shownFor) { shownFor = at; toast(); }
    });
  } catch {  }
}

try { if (localStorage.getItem(HQ_FLAG)) setTimeout(start, 2500); } catch {  }
