import { json, preflight, originOk, rateLimit, gemini, MODELS } from "../_lib/common.js";

export const onRequestOptions = preflight;

const PROJECT = "enishi-7f43f";

const RUBRIC = `あなたは、学校祭の投稿（写真と文章）を、スタッフが確認するときの補助をします。公開するかどうかを決めるのは人間です。あなたは「確認が必要かどうか」の候補と理由だけを出します。
見るところ：
- 個人情報：はっきり写った顔のアップ、名札、住所、電話番号、メールアドレス、SNS の ID、学校名と名前の組み合わせ
- 悪口・いやがらせ・差別・うそ・あおり
- 性的な内容、暴力、危険な行為（モッシュ・ダイブ、飲酒・喫煙、立入禁止の場所）
- 宣伝・勧誘・高専祭に関係のない内容、スパム
- 撮影禁止の疑い、他人の作品・写真の無断転載の疑い
迷うときは、「review」にして、理由を短く書く。問題がなければ「ok」。ふつうの学校祭の写真（模擬店・ステージ・風景・集合写真で個人が特定されにくいもの）は ok。
理由は、やさしい日本語で、1つ20字から40字ほど。最大3つ。`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", enum: ["ok", "review"] },
    severity: { type: "INTEGER" },
    reasons: { type: "ARRAY", items: { type: "STRING" } },
    summary: { type: "STRING" },
  },
  required: ["verdict", "severity", "reasons", "summary"],
};

const payloadOf = (token) => {
  try {
    const b = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b.padEnd(Math.ceil(b.length / 4) * 4, "=")));
  } catch { return null; }
};

async function isStaff(token) {
  const p = payloadOf(token);
  const email = p?.email;
  if (!email || p.aud !== PROJECT) return false;
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/staff/${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status === 200;
}

const clip = (s, n) => String(s ?? "").slice(0, n);

export async function onRequestPost({ request, env }) {
  if (!originOk(request)) return json(request, 403, { error: "origin" });
  if (!env.GEMINI_API_KEY) return json(request, 503, { error: "not_configured" });
  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || !(await isStaff(token))) return json(request, 403, { error: "staff_only" });
  if (!(await rateLimit(request, "mod-10m", 120, 600))) return json(request, 429, { error: "rate_limited" });

  let body;
  try { body = await request.json(); } catch { return json(request, 400, { error: "bad_json" }); }
  const text = clip(body?.text, 600);
  const photo = typeof body?.photo === "string" ? body.photo : "";
  const m = photo.match(/^data:(image\/(?:jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (photo && (!m || photo.length > 900000)) return json(request, 400, { error: "bad_photo" });
  if (!text && !m) return json(request, 400, { error: "empty" });

  const parts = [{ text: `投稿の文章：${text || "（なし）"}\n場所：${clip(body?.place, 40) || "（なし）"}` }];
  if (m) parts.push({ inlineData: { mimeType: m[1], data: m[2] } });

  try {
    const out = await gemini(env, {
      systemInstruction: { parts: [{ text: RUBRIC }] },
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1500, responseMimeType: "application/json", responseSchema: SCHEMA },
    }, env.GEMINI_MODERATION_MODEL ?? MODELS.moderate, "low");
    const r = JSON.parse(out);
    return json(request, 200, {
      verdict: r.verdict === "ok" ? "ok" : "review",
      severity: Math.max(0, Math.min(3, Number(r.severity) || 0)),
      reasons: (Array.isArray(r.reasons) ? r.reasons : []).slice(0, 3).map((x) => clip(x, 80)),
      summary: clip(r.summary, 160),
    });
  } catch {
    return json(request, 502, { error: "upstream" });
  }
}
