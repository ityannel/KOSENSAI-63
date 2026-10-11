import { json, preflight, originOk, rateLimit } from "../_lib/common.js";
import { isStaff, bearer } from "../_lib/staff.js";
import { vapidHeader, ALLOWED_PUSH } from "../_lib/vapid.js";

export const onRequestOptions = preflight;

export async function onRequestPost({ request, env }) {
  if (!originOk(request)) return json(request, 403, { error: "origin" });
  if (!env.VAPID_PRIVATE_JWK) return json(request, 503, { error: "not_configured" });
  const token = bearer(request);
  if (!token || !(await isStaff(token))) return json(request, 403, { error: "staff_only" });
  if (!(await rateLimit(request, "notify-10m", 300, 600))) return json(request, 429, { error: "rate_limited" });

  let body;
  try { body = await request.json(); } catch { return json(request, 400, { error: "bad_json" }); }
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (!ALLOWED_PUSH.test(endpoint) || endpoint.length > 700) return json(request, 400, { error: "bad_endpoint" });

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: await vapidHeader(env, endpoint), TTL: "3600", Urgency: "high", "Content-Length": "0" },
    });
    if (res.status === 404 || res.status === 410) return json(request, 200, { sent: false, gone: true });
    if (!res.ok) return json(request, 502, { error: "push_service", status: res.status });
    return json(request, 200, { sent: true });
  } catch {
    return json(request, 502, { error: "upstream" });
  }
}
