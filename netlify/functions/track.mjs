// FinDeg – מונה שימוש אנונימי: קליטת אירוע ("pageview" / "upload") ושמירתו
// ב-Netlify Blobs. לא נשמר ולא נשלח שום תוכן קובץ או נתון מזהה-אישית - רק
// שם האירוע ומזהה-מכשיר אקראי (findeg_cid, ראו js/analytics.js) לספירת
// "כמה אנשים" בנוסף ל"כמה פעולות". נקרא מ-js/analytics.js בכל טעינת דף.
import { getStore } from "@netlify/blobs";

const ALLOWED_EVENTS = new Set(["pageview", "upload"]);

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const event = body && body.event;
  const cid = body && body.cid;
  if (!ALLOWED_EVENTS.has(event)) {
    return new Response("Bad Request", { status: 400 });
  }

  const store = getStore("findeg-stats");
  const today = new Date().toISOString().slice(0, 10);

  async function bump(key) {
    const current = await store.get(key, { type: "text" });
    const next = String((parseInt(current, 10) || 0) + 1);
    await store.set(key, next);
  }

  await bump(`${event}_total`);
  await bump(`${event}_${today}`);

  if (typeof cid === "string" && cid.length > 0 && cid.length <= 64) {
    const visitorsKey = `visitors_${event}_${today}`;
    const raw = await store.get(visitorsKey, { type: "json" });
    const set = new Set(Array.isArray(raw) ? raw : []);
    if (set.size < 20000) {
      set.add(cid);
      await store.setJSON(visitorsKey, [...set]);
    }
  }

  return new Response(null, { status: 204 });
};

export const config = { path: "/.netlify/functions/track" };
