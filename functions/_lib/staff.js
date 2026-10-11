const PROJECT = "enishi-7f43f";

const payloadOf = (token) => {
  try {
    const b = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b.padEnd(Math.ceil(b.length / 4) * 4, "=")));
  } catch { return null; }
};

export async function isStaff(token) {
  const p = payloadOf(token);
  const email = p?.email;
  if (!email || p.aud !== PROJECT) return false;
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/staff/${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status === 200;
}

export const bearer = (request) => (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
