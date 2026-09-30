// 函館の本物の天気を、絵に降らせる。
// Open-Meteo（無料・登録不要）から今の天気を取り、雨・雪・霧・雷を画面全体に重ねる。
// 風が強いほど短冊が大きく速く揺れる。?weather=rain|snow|fog|thunder|clear&wind=12 で確認できる。
import { FX } from "./config.js";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const params = new URLSearchParams(location.search);

// WMO の天気コード → この画面での扱い
function classify(code) {
  if (code === 0) return { kind: "clear", label: "晴れ" };
  if (code <= 3) return { kind: "cloudy", label: "くもり" };
  if (code === 45 || code === 48) return { kind: "fog", label: "霧" };
  if ((code >= 51 && code <= 57)) return { kind: "rain", label: "小雨", amount: 0.35 };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { kind: "rain", label: "雨", amount: code === 65 || code === 82 ? 1 : 0.65 };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { kind: "snow", label: "雪", amount: code === 75 || code === 86 ? 1 : 0.6 };
  if (code >= 95) return { kind: "thunder", label: "雷雨", amount: 0.9 };
  return { kind: "cloudy", label: "くもり" };
}

// 本部の管理画面で「天気を固定」したとき（全員の画面）。URL の ?weather= のほうが強い
let override = null;
let reload = () => {};
export function setWeatherOverride(next) {
  const same = JSON.stringify(next ?? null) === JSON.stringify(override);
  override = next ?? null;
  if (!same) reload();
}

async function fetchWeather() {
  const forced = params.get("weather") ?? override?.kind;
  if (forced) {
    const map = { clear: 0, cloudy: 3, fog: 45, rain: 63, snow: 73, thunder: 95 };
    return { ...classify(map[forced] ?? 0), wind: Number(params.get("wind") ?? override?.wind ?? 4) };
  }
  const { lat, lon } = FX.weather;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,wind_speed_10m&wind_speed_unit=ms&timezone=Asia%2FTokyo`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status);
  const { current } = await res.json();
  return { ...classify(current.weather_code), wind: current.wind_speed_10m };
}

// ---------- 雨・雪を描く ----------
function createPrecip(canvas) {
  const ctx = canvas.getContext("2d");
  let drops = [];
  let state = { kind: "clear", amount: 0, wind: 0 };
  let running = false;
  let w = 0, h = 0, last = 0;

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth || innerWidth; h = canvas.clientHeight || innerHeight; // PC ではスマホの幅の画面だけ（style.css）
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function spawn(fromTop) {
    const snow = state.kind === "snow";
    return {
      x: Math.random() * (w + 200) - 100,
      y: fromTop ? -20 : Math.random() * h,
      v: snow ? 0.6 + Math.random() * 1.2 : 9 + Math.random() * 7,
      len: snow ? 1.5 + Math.random() * 2.5 : 10 + Math.random() * 14,
      sway: Math.random() * Math.PI * 2,
    };
  }
  function frame(t) {
    const k = last ? Math.min(3, (t - last) / 16.7) : 1; // 60fps を1とした経過（90・120Hz の画面でも同じ速さ）
    last = t;
    ctx.clearRect(0, 0, w, h);
    const snow = state.kind === "snow";
    const drift = Math.min(state.wind, 15) * (snow ? 0.18 : 0.35);
    ctx.strokeStyle = "rgba(220, 235, 255, 0.55)";
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 1.1;
    for (const d of drops) {
      d.y += d.v * k;
      d.sway += 0.03 * k;
      d.x += (drift + (snow ? Math.sin(d.sway) * 0.5 : 0)) * k;
      if (d.y > h + 20 || d.x > w + 120) Object.assign(d, spawn(true));
      if (snow) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.len, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - drift * 1.5, d.y - d.len);
        ctx.stroke();
      }
    }
    if (running) requestAnimationFrame(frame);
  }

  addEventListener("resize", resize);
  return {
    set(next) {
      state = next;
      const falling = next.kind === "rain" || next.kind === "thunder" || next.kind === "snow";
      if (!falling || reduceMotion) {
        running = false;
        ctx.clearRect(0, 0, w, h);
        return;
      }
      resize();
      const count = Math.round((next.kind === "snow" ? 140 : 220) * (next.amount ?? 0.6) * Math.min(1.5, (w * h) / (1280 * 800)));
      drops = Array.from({ length: count }, () => spawn(false));
      if (!running) { running = true; last = 0; requestAnimationFrame(frame); }
    },
  };
}

// 雷：ときどき画面が光る
let thunderTimer = null;
function thunder(on) {
  clearTimeout(thunderTimer);
  if (!on || reduceMotion) return;
  const flash = () => {
    document.body.classList.add("lightning");
    setTimeout(() => document.body.classList.remove("lightning"), 180);
    thunderTimer = setTimeout(flash, 6000 + Math.random() * 12000);
  };
  thunderTimer = setTimeout(flash, 3000);
}

// onChange({ kind, label, wind }) で、空の説明文などを更新してもらう
export function initWeather(canvas, onChange) {
  const precip = createPrecip(canvas);
  const apply = (wx) => {
    document.body.dataset.weather = wx.kind;
    // 風が強いほど短冊が大きく速く揺れる（普段は ±5度）
    const amp = Math.min(22, 5 + Math.max(0, wx.wind - 3) * 1.6);
    document.body.style.setProperty("--amp", `${amp.toFixed(1)}deg`);
    document.body.style.setProperty("--wind-speed", String(Math.max(0.45, 1 - Math.max(0, wx.wind - 3) * 0.05)));
    precip.set(wx);
    thunder(wx.kind === "thunder");
    onChange(wx);
  };
  const load = () => fetchWeather().then(apply).catch((err) => console.warn("[weather] 天気を取れませんでした:", err));
  reload = load;
  load();
  setInterval(load, FX.weather.refreshMinutes * 60 * 1000);
}
