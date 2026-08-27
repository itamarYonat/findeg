/* FinDeg – מעקב שימוש אנונימי, פנימי בלבד (למפתח): כמה כניסות לאתר וכמה
 * גרירות/בחירות בפועל של תדפיס ציונים. לא נשלח שום תוכן קובץ, ציון או נתון
 * מזהה-אישית לשרת - רק שם אירוע ומזהה-מכשיר אקראי (לא קשור לזהות אמיתית),
 * כדי לאפשר גם ספירת "כמה אנשים" ולא רק "כמה פעולות". נשמר ב-Netlify Blobs
 * דרך netlify/functions/track.mjs. לצפייה בנתונים ראו tools/stats.html.
 * נטען בכל דף (index.html + faculties/<id>/{index,flowcharts}.html).
 * FINDEG_TRACK("upload") נקרא מ-js/landing.js ו-js/app.js בתוך handleFile().
 */
(function () {
  const ENDPOINT = "/.netlify/functions/track";
  const CID_KEY = "findeg_cid";

  function getCid() {
    try {
      let cid = localStorage.getItem(CID_KEY);
      if (!cid) {
        cid = (crypto.randomUUID && crypto.randomUUID()) || (Math.random().toString(36).slice(2) + Date.now().toString(36));
        localStorage.setItem(CID_KEY, cid);
      }
      return cid;
    } catch {
      return null;
    }
  }

  function send(event) {
    try {
      const payload = JSON.stringify({ event, cid: getCid() });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: "application/json" }));
      } else {
        fetch(ENDPOINT, { method: "POST", body: payload, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
      }
    } catch {}
  }

  window.FINDEG_TRACK = send;
  send("pageview");
})();
