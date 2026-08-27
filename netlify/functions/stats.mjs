// FinDeg – קריאת המונים שנצברו ע"י track.mjs, לצפייה ב-tools/stats.html.
// מוגן במפתח סודי (STATS_KEY, משתנה-סביבה שמוגדר ב-Netlify UI) כדי שהנתונים
// לא יהיו חשופים לציבור - אין כאן שום נתון אישי, רק ספירות, אבל עדיין כלי
// למפתח בלבד. הגדירו את STATS_KEY תחת Site settings ▸ Environment variables.
import { getStore } from "@netlify/blobs";

export default async (req) => {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const secret = process.env.STATS_KEY;

  if (!secret || key !== secret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const store = getStore("findeg-stats");

  async function num(k) {
    const v = await store.get(k, { type: "text" });
    return parseInt(v, 10) || 0;
  }
  async function count(k) {
    const v = await store.get(k, { type: "json" });
    return Array.isArray(v) ? v.length : 0;
  }

  const pageviewsTotal = await num("pageview_total");
  const uploadsTotal = await num("upload_total");

  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const dateKey = d.toISOString().slice(0, 10);
    days.push({
      date: dateKey,
      pageviews: await num(`pageview_${dateKey}`),
      uploads: await num(`upload_${dateKey}`),
      uniqueVisitors: await count(`visitors_pageview_${dateKey}`),
      uniqueUploaders: await count(`visitors_upload_${dateKey}`),
    });
  }

  return new Response(
    JSON.stringify({
      pageviewsTotal,
      uploadsTotal,
      conversionRate: pageviewsTotal ? uploadsTotal / pageviewsTotal : 0,
      days,
    }),
    { headers: { "content-type": "application/json" } }
  );
};

export const config = { path: "/.netlify/functions/stats" };
