/* FinDeg – ממלא את תפריט ה-hover על "תרשימי זרימה" בסרגל העליון: רשימת
 * מסלולים/התמחויות, וכל אחד עם משנה-תפריט (hover נוסף) לבחירה בין "המסלול
 * המומלץ" (js/flowchart-data.js - קיים רק לחלק מהמסלולים) לבין "תכנון אופטימלי"
 * (js/optimizer.js - זמין לכל מסלול נתמך, לא תלוי בקיום קו-בסיס רשמי).
 * טעון פעם אחת בטעינת העמוד (גם ב-index.html וגם ב-flowcharts.html - הסרגל
 * העליון זהה בשניהם).
 */
(function () {
  const D = window.FINDEG_DATA;
  const menu = document.getElementById("fc-nav-menu");
  if (!D || !menu) return;

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const FC = window.FINDEG_FLOWCHART || {};

  const branches = [];
  for (const [trackKey, track] of Object.entries(D.tracks)) {
    if (!track.supported) continue;
    if (track.hasSpecialization) {
      const anyYear = Object.values(track.years)[0];
      for (const [specKey, spec] of Object.entries(anyYear.specializations)) {
        branches.push({ trackKey, specKey, label: spec.name });
      }
    } else {
      branches.push({ trackKey, specKey: null, label: track.name });
    }
  }

  menu.innerHTML = branches.map(b => {
    const params = new URLSearchParams({ track: b.trackKey });
    if (b.specKey) params.set("spec", b.specKey);
    const hasIntended = !!FC[b.trackKey];
    const intendedHref = "flowcharts.html?" + params.toString() + "&mode=intended";
    params.set("mode", "optimizer");
    const optimizerHref = "flowcharts.html?" + params.toString();
    params.set("mode", "manual");
    const manualHref = "flowcharts.html?" + params.toString();
    return (
      '<div class="fc-nav-branch">' +
        '<span class="fc-nav-branch-label">' + esc(b.label) + " ◂</span>" +
        '<div class="fc-nav-sub">' +
          '<a href="' + intendedHref + '"' + (hasIntended ? "" : ' class="disabled" title="עדיין אין מסלול מומלץ למסלול זה"') + '>🗺️ המסלול המומלץ</a>' +
          '<a href="' + optimizerHref + '">⚡ תכנון אופטימלי</a>' +
          '<a href="' + manualHref + '">✋ תכנון ידני</a>' +
        "</div>" +
      "</div>"
    );
  }).join("");
})();
