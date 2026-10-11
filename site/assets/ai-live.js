import { CROWD, SHOPS, HOMEROOMS, FX } from "./config.js";
import { watchSchedule } from "./schedule.js";
import { subscribeCrowd, subscribeShops, subscribeLive } from "./live.js";
import { noticeOf } from "./notice.js";

const state = { crowd: null, shops: null, live: null, weather: null };
const mins = (ms) => (ms ? Math.max(0, Math.round((Date.now() - ms) / 60000)) : null);
const norm = (t) => String(t ?? "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();
const STATUS = { normal: "待ちなし", "10min": "10分待ち", "20min": "20分以上待ち", soldout: "売り切れ", closed: "休業中" };

function weatherText(code) {
  if (code === 0) return "晴れ";
  if (code <= 3) return "くもり";
  if (code === 45 || code === 48) return "霧";
  if (code >= 51 && code <= 67) return "雨";
  if (code >= 71 && code <= 77) return "雪";
  if (code >= 80 && code <= 82) return "にわか雨";
  if (code >= 85 && code <= 86) return "雪";
  if (code >= 95) return "雷雨";
  return "くもり";
}

async function loadWeather() {
  try {
    const { lat, lon } = FX.weather;
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,temperature_2m,wind_speed_10m&wind_speed_unit=ms&timezone=Asia%2FTokyo`);
    if (!res.ok) return;
    const c = (await res.json())?.current;
    if (c) state.weather = { text: weatherText(c.weather_code), temp: Math.round(c.temperature_2m), wind: Math.round(c.wind_speed_10m * 10) / 10, at: Date.now() };
  } catch {  }
}

export function startLive() {
  watchSchedule(() => {});
  subscribeCrowd((d) => { state.crowd = d; });
  subscribeShops((l) => { state.shops = l; state.shopsAt = Date.now(); });
  subscribeLive((d) => { state.live = d; });
  loadWeather();
  setInterval(loadWeather, 15 * 60 * 1000);
}

function shopDocs() {
  const out = [];
  for (const d of state.shops ?? []) {
    if (!d.status || !STATUS[d.status]) continue;
    const s = SHOPS.find((x) => {
      const room = x.room ?? HOMEROOMS[x.cls];
      return d.map ? [x.name, x.cls, room].filter(Boolean).some((v) => norm(v) === norm(d.map)) : norm(d.name) === norm(x.name);
    });
    out.push({ n: (s?.name ?? d.name).replace(/\s+/g, " "), s: STATUS[d.status], ago: mins(d.updated_at), ...(d.message ? { m: d.message } : {}) });
    if (out.length >= 60) break;
  }
  return out;
}

export function liveSnapshot() {
  const snap = {};
  if (state.crowd) {
    snap.crowd = CROWD.venues.filter((v) => state.crowd[v]?.level != null).map((v) => {
      const ago = mins(state.crowd[v].updated_at);
      return { place: CROWD.short[v] ?? v, status: CROWD.levels[state.crowd[v].level]?.label ?? "", ago, ...(ago != null && ago > CROWD.staleMinutes ? { stale: true } : {}) };
    });
  }
  const shops = shopDocs();
  if (state.shops) snap.shops = shops;
  const notice = noticeOf(state.live, "top");
  if (notice) snap.notice = { text: notice.text, urgent: notice.urgent };
  if (state.weather) snap.weather = { text: state.weather.text, temp: state.weather.temp, wind: state.weather.wind, ago: mins(state.weather.at) };
  return snap;
}
