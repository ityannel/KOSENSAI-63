// ページの中で QR を読む（カメラ）。スタンプカードで使う。地図の「いまここ」QR を読む画面（map.js）と同じ形・同じ読み方
// Android の Chrome などは BarcodeDetector、iPhone などは jsQR（読むときだけ読み込む）
// openQrScanner({ title, hint, wrong, noCamera, accept, onRead })
//   accept(text) … 読めた字を調べて、使える QR なら何か返す（使えなければ null）
//   onRead(結果) … 読めたら、画面を閉じてから呼ぶ
let jsqrP = null;
const loadJsQR = () => (jsqrP ??= new Promise((ok, ng) => {
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
  s.onload = () => (window.jsQR ? ok(window.jsQR) : ng(new Error("jsQR")));
  s.onerror = () => { jsqrP = null; ng(new Error("jsQR")); };
  document.head.append(s);
}));

let dlg, scan = null;
function build() {
  if (dlg) return;
  document.body.insertAdjacentHTML("beforeend", `
    <dialog class="qs" id="qs">
      <p class="qs-title"></p>
      <div class="qs-view"><video playsinline muted></video><i class="qs-frame" aria-hidden="true"></i></div>
      <p class="qs-msg" role="status"></p>
      <button type="button" class="qs-x">やめる</button>
    </dialog>`);
  dlg = document.getElementById("qs");
  dlg.querySelector(".qs-x").addEventListener("click", close);
  dlg.addEventListener("close", stop);
}
function stop() {
  if (scan) { clearTimeout(scan.timer); clearTimeout(scan.msgT); scan.stream.getTracks().forEach((t) => t.stop()); scan = null; }
  if (dlg) dlg.querySelector("video").srcObject = null;
}
function close() { stop(); if (dlg?.open) dlg.close(); }

export async function openQrScanner({ title, hint, wrong, noCamera, accept, onRead }) {
  build();
  const video = dlg.querySelector("video"), msg = dlg.querySelector(".qs-msg"), frame = dlg.querySelector(".qs-frame");
  dlg.setAttribute("aria-label", title);
  dlg.querySelector(".qs-title").textContent = title;
  frame.classList.remove("is-ok");
  msg.textContent = "カメラを準備しています…";
  dlg.showModal();
  if (!navigator.mediaDevices?.getUserMedia) { msg.textContent = `このブラウザではカメラが使えません。${noCamera}`; return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    if (!dlg.open) { stream.getTracks().forEach((t) => t.stop()); return; }
    scan = { stream, timer: 0, msgT: 0 };
    video.srcObject = stream;
    await video.play();
  } catch {
    msg.textContent = `カメラを使えませんでした。カメラを許可するか、${noCamera}`;
    return;
  }
  msg.textContent = hint;
  let detect;
  try {
    if ("BarcodeDetector" in window && (await BarcodeDetector.getSupportedFormats()).includes("qr_code")) {
      const bd = new BarcodeDetector({ formats: ["qr_code"] });
      detect = async () => (await bd.detect(video))[0]?.rawValue ?? null;
    } else {
      const jsQR = await loadJsQR();
      const c = document.createElement("canvas"), ctx = c.getContext("2d", { willReadFrequently: true });
      detect = async () => {
        const w = video.videoWidth, h = video.videoHeight;
        if (!w) return null;
        const s = Math.min(1, 640 / Math.max(w, h));
        c.width = Math.round(w * s);
        c.height = Math.round(h * s);
        ctx.drawImage(video, 0, 0, c.width, c.height);
        return jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: "dontInvert" })?.data ?? null;
      };
    }
  } catch {
    msg.textContent = `QR を読む準備ができませんでした。${noCamera}`;
    return;
  }
  const tick = async () => {
    if (!scan) return;
    let text = null;
    try { text = await detect(); } catch { /* 次のコマで */ }
    if (!scan) return;
    if (text) {
      const got = accept(text);
      if (got) {
        navigator.vibrate?.(40);
        frame.classList.add("is-ok");
        msg.textContent = "読めました";
        scan.timer = setTimeout(() => { close(); onRead(got); }, 300);
        return;
      }
      msg.textContent = wrong;
      clearTimeout(scan.msgT);
      scan.msgT = setTimeout(() => { if (scan) msg.textContent = hint; }, 2000);
    }
    scan.timer = setTimeout(tick, 180);
  };
  tick();
}
