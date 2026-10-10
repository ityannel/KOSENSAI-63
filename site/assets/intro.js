let seen = false;
try { seen = !!localStorage.getItem("kosen63-intro-seen"); } catch {}
if (!seen) {
  document.body.classList.add("intro");
  setTimeout(() => document.body.classList.remove("intro"), 6000);
}
