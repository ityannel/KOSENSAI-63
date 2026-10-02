// 演出：絵の空に上がる花火と、スマホを振る・マウスを速く動かすと揺れる短冊
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ============================================================
// 花火
// ============================================================

const COLORS = [
  "#FFD27A",
  "#FF8FA3",
  "#9BD7D0",
  "#FFFFFF",
  "#F2A96A",
  "#C9A7FF",
  "#FFE89A",
  "#A8D8FF",
];

export function createFireworks(canvas) {
  const ctx = canvas.getContext("2d");

  let parts = [];
  let rockets = [];
  let flashes = [];

  let running = false;
  let until = 0;
  let nextLaunch = 0;

  let w = 0;
  let h = 0;
  let last = 0;

  // ----------------------------------------------------------
  // resize
  // ----------------------------------------------------------

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);

    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;

    if (
      cw === w &&
      ch === h &&
      canvas.width === Math.round(w * dpr)
    ) {
      return;
    }

    w = cw;
    h = ch;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ----------------------------------------------------------
  // 小さな火の粉を追加
  // ----------------------------------------------------------

  function spark(x, y, color, amount = 1) {
    for (let i = 0; i < amount; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = w * (0.0015 + Math.random() * 0.003);

      parts.push({
        x,
        y,

        px: x,
        py: y,

        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,

        gravity: h * (0.00004 + Math.random() * 0.00008),

        life: 0.45 + Math.random() * 0.5,
        decay: 0.012 + Math.random() * 0.012,

        size: w * (0.0015 + Math.random() * 0.0025),

        color,

        sparkle: Math.random() < 0.25,
      });
    }
  }

  // ----------------------------------------------------------
  // ロケット打ち上げ
  // ----------------------------------------------------------

  function launch() {
    const x = w * (0.12 + Math.random() * 0.76);

    rockets.push({
      x,
      y: h * 0.58,

      vx: (Math.random() - 0.5) * w * 0.001,

      vy: -(h * 0.010 + Math.random() * h * 0.004),

      top: h * (0.08 + Math.random() * 0.24),

      color: COLORS[Math.floor(Math.random() * COLORS.length)],

      trailTimer: 0,
    });
  }

  // ----------------------------------------------------------
  // 花火爆発
  // ----------------------------------------------------------

  function explode(r) {
    const big = Math.random() < 0.22;

    const count = big
      ? 130 + Math.floor(Math.random() * 50)
      : 80 + Math.floor(Math.random() * 45);

    const baseSpeed = w * (
      big
        ? 0.005 + Math.random() * 0.002
        : 0.004 + Math.random() * 0.003
    );

    const secondColor =
      COLORS[Math.floor(Math.random() * COLORS.length)];

    // --------------------------------------------------------
    // 爆発フラッシュ
    // --------------------------------------------------------

    flashes.push({
      x: r.x,
      y: r.y,
      life: 1,
      size: big ? w * 0.045 : w * 0.03,
    });

    // --------------------------------------------------------
    // 外側へ飛ぶ火花
    // --------------------------------------------------------

    for (let i = 0; i < count; i++) {
      const a =
        (i / count) * Math.PI * 2 +
        (Math.random() - 0.5) * 0.08;

      const s =
        baseSpeed *
        (0.55 + Math.random() * 0.6);

      const color =
        Math.random() < 0.78
          ? r.color
          : secondColor;

      parts.push({
        x: r.x,
        y: r.y,

        px: r.x,
        py: r.y,

        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,

        gravity: h * (
          0.00007 +
          Math.random() * 0.00008
        ),

        life: 1,

        decay:
          0.006 +
          Math.random() * 0.006,

        size:
          w * (
            big
              ? 0.0025 + Math.random() * 0.003
              : 0.002 + Math.random() * 0.0025
          ),

        color,

        sparkle: Math.random() < 0.3,
      });
    }

    // --------------------------------------------------------
    // 内側の細かい火花
    // --------------------------------------------------------

    for (let i = 0; i < count * 0.45; i++) {
      const a = Math.random() * Math.PI * 2;

      const s =
        baseSpeed *
        (0.15 + Math.random() * 0.45);

      parts.push({
        x: r.x,
        y: r.y,

        px: r.x,
        py: r.y,

        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,

        gravity: h * 0.00005,

        life: 0.6 + Math.random() * 0.35,

        decay: 0.012 + Math.random() * 0.008,

        size: w * (
          0.0012 + Math.random() * 0.0018
        ),

        color:
          Math.random() < 0.7
            ? "#FFFFFF"
            : r.color,

        sparkle: true,
      });
    }

    // --------------------------------------------------------
    // 放射状のリング
    // --------------------------------------------------------

    const ringCount = big ? 32 : 24;

    for (let i = 0; i < ringCount; i++) {
      const a = (i / ringCount) * Math.PI * 2;

      const s = baseSpeed * 0.72;

      parts.push({
        x: r.x,
        y: r.y,

        px: r.x,
        py: r.y,

        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,

        gravity: h * 0.000035,

        life: 0.75,

        decay: 0.008,

        size: w * 0.002,

        color: "#FFFFFF",

        sparkle: false,
      });
    }

    // --------------------------------------------------------
    // 低確率で二段爆発
    // --------------------------------------------------------

    if (big && Math.random() < 0.35) {
      setTimeout(() => {
        if (!running) return;

        explode({
          x: r.x + (Math.random() - 0.5) * w * 0.06,
          y: r.y + (Math.random() - 0.5) * h * 0.04,
          color: secondColor,
        });
      }, 180 + Math.random() * 180);
    }
  }

  // ----------------------------------------------------------
  // アニメーション
  // ----------------------------------------------------------

  function frame(t) {
    const k = last
      ? Math.min(3, (t - last) / 16.7)
      : 1;

    last = t;

    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation = "source-over";

    ctx.clearRect(0, 0, w, h);

    ctx.globalCompositeOperation = "lighter";

    // --------------------------------------------------------
    // 花火を打ち上げる
    // --------------------------------------------------------

    if (t < until && t > nextLaunch) {
      launch();

      nextLaunch =
        t +
        280 +
        Math.random() * 650;
    }

    // --------------------------------------------------------
    // ロケット
    // --------------------------------------------------------

    rockets = rockets.filter((r) => {
      r.x += r.vx * k;
      r.y += r.vy * k;

      r.trailTimer += k;

      // ロケットの尾
      if (r.trailTimer >= 1) {
        r.trailTimer = 0;

        spark(
          r.x,
          r.y + 4,
          r.color,
          2
        );
      }

      // ロケット本体
      ctx.globalAlpha = 1;

      ctx.fillStyle = "#FFF3D6";

      ctx.fillRect(
        r.x - 1,
        r.y,
        2,
        7
      );

      // ロケットの光
      ctx.globalAlpha = 0.55;

      ctx.beginPath();

      ctx.arc(
        r.x,
        r.y + 6,
        Math.max(1.5, w * 0.003),
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.globalAlpha = 1;

      // 爆発
      if (r.y <= r.top) {
        explode(r);
        return false;
      }

      return true;
    });

    // --------------------------------------------------------
    // 花火の粒子
    // --------------------------------------------------------

    parts = parts.filter((p) => {
      p.px = p.x;
      p.py = p.y;

      p.x += p.vx * k;
      p.y += p.vy * k;

      p.vy += p.gravity * k;

      // 空気抵抗
      p.vx *= Math.pow(0.985, k);
      p.vy *= Math.pow(0.985, k);

      p.life -= p.decay * k;

      if (p.life <= 0) {
        return false;
      }

      // ------------------------------------------------------
      // 軌跡
      // ------------------------------------------------------

      ctx.globalAlpha =
        Math.max(0, p.life * 0.45);

      ctx.strokeStyle = p.color;

      ctx.lineWidth =
        Math.max(0.5, p.size * 0.9);

      ctx.beginPath();

      ctx.moveTo(p.px, p.py);

      ctx.lineTo(p.x, p.y);

      ctx.stroke();

      // ------------------------------------------------------
      // 本体
      // ------------------------------------------------------

      ctx.globalAlpha =
        Math.min(1, p.life * 1.4);

      ctx.fillStyle = p.color;

      ctx.beginPath();

      ctx.arc(
        p.x,
        p.y,
        Math.max(0.8, p.size),
        0,
        Math.PI * 2
      );

      ctx.fill();

      // ------------------------------------------------------
      // キラッとする粒
      // ------------------------------------------------------

      if (p.sparkle && p.life > 0.25) {
        const pulse =
          0.5 +
          Math.sin(t * 0.025 + p.x) * 0.5;

        ctx.globalAlpha =
          p.life * pulse * 0.8;

        const s =
          p.size * (2.5 + pulse * 2);

        ctx.fillStyle = "#FFFFFF";

        ctx.beginPath();

        ctx.moveTo(p.x, p.y - s);
        ctx.lineTo(p.x + s * 0.25, p.y);
        ctx.lineTo(p.x, p.y + s);
        ctx.lineTo(p.x - s * 0.25, p.y);

        ctx.closePath();

        ctx.fill();
      }

      return true;
    });

    // --------------------------------------------------------
    // 爆発フラッシュ
    // --------------------------------------------------------

    flashes = flashes.filter((f) => {
      f.life -= 0.055 * k;

      if (f.life <= 0) {
        return false;
      }

      ctx.globalAlpha =
        f.life * 0.55;

      ctx.fillStyle = "#FFFFFF";

      ctx.beginPath();

      ctx.arc(
        f.x,
        f.y,
        f.size * (1 - f.life * 0.3),
        0,
        Math.PI * 2
      );

      ctx.fill();

      return true;
    });

    ctx.globalAlpha = 1;

    // --------------------------------------------------------
    // 次のフレーム
    // --------------------------------------------------------

    if (
      t < until ||
      rockets.length ||
      parts.length ||
      flashes.length
    ) {
      requestAnimationFrame(frame);
    } else {
      running = false;
      ctx.clearRect(0, 0, w, h);
    }
  }

  addEventListener("resize", resize);

  return {
    // ms の間、花火を上げ続ける
    show(ms) {
      if (reduceMotion) return;

      resize();

      until = Math.max(
        until,
        performance.now() + ms
      );

      if (!running) {
        running = true;
        nextLaunch = 0;
        last = 0;

        requestAnimationFrame(frame);
      }
    },
  };
}


// ============================================================
// 揺れる短冊
// ※ スマホの「傾き」は使用しない
// ============================================================

export function initShake(shakeButton) {
  if (reduceMotion) return;

  const root =
    document.getElementById("tanzaku-nav") ??
    document.body;

  let angle = 0;
  let vel = 0;
  let running = false;

  // ----------------------------------------------------------
  // バネアニメーション
  // ----------------------------------------------------------

  const loop = () => {
    // バネ
    vel += -angle * 0.06;

    // 空気抵抗
    vel *= 0.92;

    angle += vel;

    root.style.setProperty(
      "--kick",
      `${angle.toFixed(2)}deg`
    );

    if (
      Math.abs(vel) > 0.01 ||
      Math.abs(angle) > 0.05
    ) {
      requestAnimationFrame(loop);
    } else {
      angle = 0;
      root.style.setProperty(
        "--kick",
        "0deg"
      );

      running = false;
    }
  };

  const push = (v) => {
    vel += Math.max(
      -14,
      Math.min(14, v)
    );

    if (!running) {
      running = true;
      requestAnimationFrame(loop);
    }
  };

  // ----------------------------------------------------------
  // スマホ：振る
  //
  // deviceorientation は一切使わない。
  // ----------------------------------------------------------

  let lastShake = 0;

  const onMotion = (e) => {
    const a = e.acceleration ?? {};

    const x = a.x ?? 0;
    const y = a.y ?? 0;
    const z = a.z ?? 0;

    const mag =
      Math.hypot(x, y, z);

    const now = performance.now();

    // 強く振ったときだけ反応
    if (
      mag > 4 &&
      now - lastShake > 100
    ) {
      lastShake = now;

      push(
        Math.sign(x || 1) *
        Math.min(12, mag * 0.9)
      );
    }
  };

  const listen = () => {
    addEventListener(
      "devicemotion",
      onMotion
    );
  };

  // ----------------------------------------------------------
  // iPhone / iPad
  // ----------------------------------------------------------

  const touch =
    matchMedia("(pointer: coarse)").matches;

  const needsPermission =
    touch &&
    typeof DeviceMotionEvent !== "undefined" &&
    typeof DeviceMotionEvent.requestPermission === "function";

  if (needsPermission) {
    shakeButton.hidden = false;

    shakeButton.addEventListener(
      "click",
      async () => {
        try {
          const res =
            await DeviceMotionEvent.requestPermission();

          if (res === "granted") {
            listen();

            // 許可直後に少し揺らす
            push(8);
          }
        } catch {
          // 拒否された場合は何もしない
        }

        shakeButton.hidden = true;
      },
      { once: true }
    );
  } else {
    listen();
  }

  // ----------------------------------------------------------
  // PC：
  // マウスを高速で左右に動かす
  // ----------------------------------------------------------

  let last = null;

  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") {
        return;
      }

      const now =
        performance.now();

      if (last) {
        const v =
          (e.clientX - last.x) /
          Math.max(
            1,
            now - last.t
          );

        if (Math.abs(v) > 1.6) {
          push(v * 2.2);
        }
      }

      last = {
        x: e.clientX,
        t: now,
      };
    }
  );

  return {
    push,
  };
}


// ============================================================
// 奥行き
// ※ スマホの傾きは使用しない
// PCのマウスだけでパララックス
// ============================================================

export function initParallax() {
  if (reduceMotion) return;

  const targets =
    document.querySelectorAll(
      ".layer-sky, .logo"
    );

  let tx = 0;
  let ty = 0;

  let x = 0;
  let y = 0;

  let running = false;

  // ----------------------------------------------------------
  // アニメーション
  // ----------------------------------------------------------

  const loop = () => {
    x += (tx - x) * 0.08;
    y += (ty - y) * 0.08;

    for (const el of targets) {
      el.style.setProperty(
        "--par-x",
        x.toFixed(3)
      );

      el.style.setProperty(
        "--par-y",
        y.toFixed(3)
      );
    }

    if (
      Math.abs(tx - x) > 0.002 ||
      Math.abs(ty - y) > 0.002
    ) {
      requestAnimationFrame(loop);
    } else {
      running = false;
    }
  };

  const aim = (nx, ny) => {
    nx = Math.max(
      -1,
      Math.min(1, nx)
    );

    ny = Math.max(
      -1,
      Math.min(1, ny)
    );

    if (
      Math.abs(nx - tx) < 0.03 &&
      Math.abs(ny - ty) < 0.03
    ) {
      return;
    }

    tx = nx;
    ty = ny;

    if (!running) {
      running = true;
      requestAnimationFrame(loop);
    }
  };

  // ----------------------------------------------------------
  // PCのマウスのみ
  // ----------------------------------------------------------

  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") {
        return;
      }

      aim(
        (e.clientX / innerWidth) * 2 - 1,
        (e.clientY / innerHeight) * 2 - 1
      );
    }
  );

  addEventListener(
    "pointerleave",
    () => {
      aim(0, 0);
    }
  );
}