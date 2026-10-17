import { ELECTION } from "./config.js";

const PART = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

function voteEnd() {
  const p = Object.fromEntries(PART.formatToParts(new Date(ELECTION.closes)).map((x) => [x.type, x.value]));
  return `${p.month}.${p.day} ${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}

export const fillFaq = (s) => String(s ?? "").replace("{voteEnd}", voteEnd());
