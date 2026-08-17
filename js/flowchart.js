/* FinDeg – תרשים זרימה: מקצועות חובה לפי סמסטר + מקצועות בחירה שאפשר לנעוץ
 * לסמסטר מתאים, עם חצי דרישות קדם/מקצועות צמודים. תומך בכמה מסלולים (ראו
 * TRACKS למטה) - לא רק ניהול ובנייה. */
(function () {
  const D = window.FINDEG_DATA;
  const SEM = window.FINDEG_SEMESTERS || {};

  // מחיל תיקונים ידניים (js/prereq-overrides.js) על גרף דרישות הקדם הגולמי -
  // ראו הקובץ ההוא להסבר מלא. חד-פעמי בטעינה, לא בכל render.
  function patchPrereqs(raw, overrides) {
    const patched = {};
    for (const [id, entry] of Object.entries(raw)) {
      patched[id] = { prereq: [...(entry.prereq || [])], adjoining: [...(entry.adjoining || [])] };
    }
    if (overrides) {
      for (const [from, to] of (overrides.remove || [])) {
        if (patched[to]) patched[to].prereq = patched[to].prereq.filter(id => id !== from);
      }
      for (const [from, to] of (overrides.add || [])) {
        if (!patched[to]) patched[to] = { prereq: [], adjoining: [] };
        if (!patched[to].prereq.includes(from)) patched[to].prereq.push(from);
      }
    }
    return patched;
  }
  const PREREQ = patchPrereqs(window.FINDEG_PREREQS || {}, window.FINDEG_PREREQ_OVERRIDES);

  // כל המסלולים הנתמכים ב-data.js - לא רק אלה עם רשומת FINDEG_FLOWCHART (מיקום
  // סמסטרים "רשמי"): מצב "תכנון אופטימלי" לא צריך קו-בסיס רשמי בכלל, רק
  // מצב "מסלול מומלץ" כן (ראו hasIntendedData/render להלן - נופל בחזרה להודעה
  // ידידותית ולא לקריסה כשאין נתון כזה למסלול שנבחר).
  const TRACKS = Object.keys(D.tracks).filter(k => D.tracks[k].supported);
  const hasIntendedData = key => !!(window.FINDEG_FLOWCHART || {})[key];

  const $ = sel => document.querySelector(sel);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const cname = id => generalNames[id] || D.courseNames[id] || id;
  const pts = id => D.coursePoints[id];
  const fmtPts = p => (p == null ? "" : (p % 1 === 0 ? p.toFixed(0) : p.toFixed(1)));
  const seasonLabel = { winter: "חורף", spring: "אביב", summer: "קיץ" };

  // js/semesters.js: SEM[id] = { confirmed: bool, seasons: ["winter",...] } (לא מערך ישיר)
  const seasonsOf = id => ((SEM[id] && SEM[id].seasons) || []).filter(x => x !== "summer");

  function semBadge(id) {
    const s = seasonsOf(id);
    if (!s.length) return '<span class="sem-badge sem-unknown" title="לא נמצא בסמסטרים שנבדקו">?</span>';
    return s.map(x => '<span class="sem-badge sem-' + x + '">' + seasonLabel[x] + "</span>").join("");
  }

  // סמסטרים 5-8 שמתאימים לעונה של מקצוע (חורף -> 5/7, אביב -> 6/8). מקצוע לא-ידוע/רק-קיץ - כולם.
  function eligibleSemesters(id) {
    const s = seasonsOf(id);
    if (!s.length) return [5, 6, 7, 8];
    const out = [];
    if (s.includes("winter")) out.push(5, 7);
    if (s.includes("spring")) out.push(6, 8);
    return out.length ? out : [5, 6, 7, 8];
  }

  // עונה "רשמית" של מספר-סמסטר לפי הדגם הקבוע בכל flowchart-data.js (אי-זוגי
  // = חורף, זוגי = אביב) - משמש לדחיפת מקצועות קדימה (ראו nextAvailableSemester).
  const seasonOfNum = num => (num % 2 === 1 ? "winter" : "spring");
  // הסמסטר הקרוב ביותר (>= minNum, <= maxNum) שמתאים לעונה שבה המקצוע אכן
  // ניתן בפועל. אם אין התאמה בטווח כלל (למשל מקצוע חד-עונתי ו-minNum..maxNum
  // מכיל רק את העונה השנייה) - נופלים בחזרה ל-maxNum, עדיף על להיתקע בעבר.
  function nextAvailableSemester(id, minNum, maxNum) {
    const s = seasonsOf(id);
    for (let n = minNum; n <= maxNum; n++) {
      if (!s.length || s.includes(seasonOfNum(n))) return n;
    }
    return maxNum;
  }

  // ---------- מצב ----------
  let trackKey = TRACKS.includes("management") ? "management" : TRACKS[0];
  let yearKey = "5786";
  let specKey = "water"; // רלוונטי רק למסלולים עם hasSpecialization (כרגע: civil/מיפוי)
  let pinned = {}; // courseId -> semester num
  let projectKey = "";
  // עונת הסמסטר הבא (בתצוגת "תכנון אופטימלי" בלבד) - "" = ניחוש אוטומטי
  // (FINDEG_OPTIMIZER.inferNextSeason, לפי הסמסטר האחרון בתדפיס המסונכרן),
  // אחרת דריסה ידנית של המשתמש/ת - חיוני למי שאין לו/ה תדפיס מסונכרן בכלל
  // (אז אין ממה לנחש) או שהניחוש האוטומטי פשוט טועה.
  let optStartSeason = "";
  // מטרת האופטימיזציה (תצוגת "תכנון אופטימלי" בלבד): "recommended" (ברירת
  // מחדל) - עמוס בכוונה בשנים הראשונות (עד optCapPts, ברירת מחדל 25) ומקל
  // בהדרגה מסמסטר ב' של שנה ג' ואילך (taper/taperPeak ב-FINDEG_OPTIMIZER.
  // computePlan) - כך רוב הסטודנטים/ות בפועל מעדיפים לתכנן (בקשת המשתמש/ת,
  // 2026-07-19). "semesters" - ממזער מספר סמסטרים קודם כל, בלי תקרת נק'/סמסטר
  // אמיתית (רק מגבלה טכנית גבוהה כדי שהאלגוריתם לא ידחוס הכול לסמסטר אחד
  // תיאורטית) - "בשביל להיות עם החברים" הכי מהר שאפשר. "points" - מכבד תקרת
  // נק'/סמסטר סבירה (optCapPts, ניתנת לכיוונון) גם במחיר עוד סמסטרים, ומאזן
  // אקטיבית את העומס בין הסמסטרים (מזיז מקצועות עם slack>0 לסמסטר הכי פחות
  // עמוס). "frontload" - גם מכבד optCapPts, אבל בלי איזון אקטיבי: כל מקצוע
  // נדחס לסמסטר המוקדם ביותר האפשרי (EPS) וממלא אותו עד התקרה, רק כשסמסטר
  // בפועל חורג ממנה המקצוע הבא זז לסמסטר הבא - "למלא כל סמסטר עד התקרה ואז
  // לעבור הלאה" (בקשת המשתמש/ת, 2026-07-16), לא "לפזר באופן שווה" כמו
  // "points". ארבעת המצבים נתמכים ב-FINDEG_OPTIMIZER.computePlan דרך
  // options.capPts/frontload/taper/taperPeak בלבד - אין צורך בפרמטר "goal"
  // נפרד שם.
  let optGoal = "recommended";
  let optCapPts = 25;
  // תקרת נק'/סמסטר נפרדת ל"דחיסה מוקדמת עד תקרה" - השם עצמו מבטיח "עד תקרה",
  // אז כמו "עומס מאוזן" זו תקרה שכדאי שתהיה ניתנת לכיוונון; אבל *לא* אותו
  // משתנה כמו optCapPts (עומס מאוזן) - שינוי הסליידר במצב אחד לא אמור להשפיע
  // בשקט על השני, שתי התקרות עצמאיות (בקשת המשתמש/ת, 2026-07-21: קודם ביקש/ה
  // שהתקרה "לא תפריע" למצבים אחרים בכלל, ואז שספציפית ל-front-load כן תהיה
  // תקרה מכוונת, "כמו שכתוב בשם").
  let optFrontloadCapPts = 20;
  // תצוגת "תכנון ידני" (fc-manual-page): manualPos[id] = מספר-סמסטר יחסי
  // (כמו pos ב-optimizer.js, 1 = "הסמסטר הבא") שהמשתמש/ת גרר/ה אליו ידנית -
  // גובר על המיקום האוטומטי (EPS טהור, ראו renderManualView) לאותו מקצוע
  // בלבד. manualExtraCols - עמודות סמסטר ריקות נוספות שנוספו ידנית ("+ הוסף
  // סמסטר") מעבר למה שהתוכנית הבסיסית דורשת, כדי שיהיה לאן לגרור קדימה
  // (בקשת המשתמש/ת, 2026-07-16).
  let manualPos = {};
  let manualExtraCols = 0;
  // baseCols האחרון שחושב ב-renderManualView (בלי manualExtraCols) - נשמר
  // כדי ש"− הסר סמסטר" ידע אם העמודה האחרונה היא עמודה "תוספת" ריקה שמותר
  // להסיר, בלי לחשב את כל basePlan מחדש רק בשביל זה.
  let lastManualBaseCols = 0;
  // תצוגת "תכנון אופטימלי" (fc-opt-page): hardPins[id] = מספר-סמסטר *מוחלט*
  // (כפי שמוצג למשתמש/ת, כולל semOffset - לא יחסי כמו pos/manualPos) שאליו
  // המקצוע נגרר ידנית - "must", לא רק "מועמד" (בניגוד ל-pinned, שרק מסמן
  // "כלול איפשהו" ומשאיר לאלגוריתם לבחור סמסטר). נשמר כמספר מוחלט (לא יחסי)
  // כדי להישאר יציב לאורך זמן - "רוצה את זה בסמסטר אביב תשפ"ח" לא אמור לזוז
  // רק כי nominalSemester התקדם מאז (בקשת המשתמש/ת, 2026-07-20: "גרירה
  // מפורשת = קבוע בסמסטר הזה, לא סתם ניחוש שהאלגוריתם יכול לדרוס"). מומר
  // לסמסטר יחסי בתוך FINDEG_OPTIMIZER.computePlan עצמו (options.hardPins),
  // בדיוק כמו MIN_OFFERING_YEAR שם.
  let hardPins = {};
  // מקצועות שהמשתמש/ת ביטל/ה במפורש (untick בפאנל הבחירה בתכנון אופטימלי) -
  // מועברים ל-computePlan כ-excludedIds: לא ייבחרו אוטומטית למילוי מכסה שוב.
  // בלי זה untick של מקצוע שנבחר-אוטומטית לא עשה כלום - הוא חזר להיבחר מייד
  // בחישוב הבא (בקשת המשתמש/ת, 2026-07-21). id -> true.
  let excluded = {};
  // מזהי מקצועות-בחירה שבפועל שובצו בתוכנית האופטימלית האחרונה שחושבה
  // (renderOptimizerView) - קובע את מצב ה-checkbox בפאנל: מסומן = נמצא
  // בתוכנית (מכל סיבה - נעיצה, "מתוכנן"/"בהמשך", או פיק אוטומטי), לא רק
  // "ננעץ ידנית". renderElectives רץ תמיד *אחרי* רינדור התצוגה (ראו
  // renderCurrent), אז הסט הזה תמיד טרי בזמן שהפאנל נבנה.
  let optPlacedElectiveIds = new Set();
  // "intended" (המסלול המומלץ, ברירת מחדל), "optimizer" (תכנון אופטימלי) או
  // "manual" (תכנון ידני) - נקבע בטעינה לפי ?mode=, אפשר להחליף בלחיצה על
  // הטאבים (fc-mode-tabs). track/spec גם הם ניתנים לקביעה דרך ה-URL (מגיע
  // מתפריט ה-hover בסרגל העליון - js/nav-menu.js).
  let mode = "intended";
  // track/spec שהגיעו מה-URL גוברים על מה ש-loadState (למטה) היה טוען מ-localStorage -
  // אחרת קליק בתפריט ה-hover על מסלול אחר לא היה עושה כלום למי שכבר יש מצב שמור.
  let trackFromUrl = false, specFromUrl = false;
  (function readQueryParams() {
    const qs = new URLSearchParams(location.search);
    const qTrack = qs.get("track"), qSpec = qs.get("spec"), qMode = qs.get("mode");
    if (qTrack && TRACKS.includes(qTrack)) { trackKey = qTrack; trackFromUrl = true; }
    if (qSpec) { specKey = qSpec; specFromUrl = true; }
    if (qMode === "optimizer" || qMode === "intended" || qMode === "manual") mode = qMode;
  })();

  function track() { return D.tracks[trackKey]; }
  // yearData() ו-FC() מטפלים בשתי צורות: מסלול "שטוח" (years[y] = {sections,...}, כמו
  // ניהול ובנייה/מבנים) או מסלול עם התמחויות (years[y] = {specializations:{water,...}},
  // כמו אזרחית) - במקרה השני צוללים לפי specKey. FC() (מיקום סמסטרים) עוקב מבנית אחרי אותה
  // הבחנה: FINDEG_FLOWCHART[trackKey] הוא או {semesters} ישירות או {specializations:{...}}.
  function yearData() {
    const yd = track().years[yearKey];
    return (yd && yd.specializations) ? yd.specializations[specKey] : yd;
  }
  function FC() {
    const entry = window.FINDEG_FLOWCHART[trackKey];
    return entry.specializations ? entry.specializations[specKey] : entry;
  }

  // כולל את שם הסטודנט/ית (מהתדפיס המסונכרן, ראו readFindegSync/studentName
  // למטה) כדי שנעיצות/העדפות ידניות של תדפיס אחד לא "ידבקו" לתדפיס של מישהו
  // אחר שנטען אחר-כך באותו דפדפן - בדיוק אותה בעיה שכבר נפתרה ב-js/app.js
  // (overrideKey/extrasKey, storageSuffix) - כאן היא הייתה קיימת עדיין
  // (STORE_KEY היה קבוע-גלובלי, לא תלוי-שם) עד שהמשתמש/ת דיווח/ה על כך
  // (2026-07-15: "צריך שהבחירה שלי שם תהיה צמודה לשם שלי בגליון").
  const ANON_STORE_NAME = "unknown";
  function currentStoreName() {
    const sync = readFindegSync();
    return (sync && sync.studentName) ? sync.studentName.replace(/\s+/g, "_") : ANON_STORE_NAME;
  }
  function storeKey(name) {
    return "findeg_flowchart_state_" + name;
  }
  function loadState() {
    try {
      const name = currentStoreName();
      let raw = localStorage.getItem(storeKey(name));
      // מעבר "unknown" -> שם אמיתי: נעיצות שנעשו *לפני* שהתדפיס סונכרן (השם
      // עדיין לא היה ידוע, ראו currentStoreName) נשמרו תחת ה-bucket האנונימי.
      // ברגע שהשם מתגלה (loadState רץ שוב - ראו מאזין ה-storage למטה),
      // storeKey() מצביע פתאום על מפתח *חדש וריק* - בלי האימוץ הזה, הענף
      // "אין שמירה קודמת" למטה היה פשוט מוחק את הנעיצות במקום להעביר אותן
      // לשם הנכון (נתפס ותוקן 2026-07-16: "מה שבחרתי שם [בקבוצות א'/ב'] לא
      // שם" - בדיוק התסמין של נעיצה שנעשתה לפני שהתדפיס עלה).
      if (!raw && name !== ANON_STORE_NAME) {
        const legacy = localStorage.getItem(storeKey(ANON_STORE_NAME));
        if (legacy) {
          raw = legacy;
          localStorage.setItem(storeKey(name), legacy);
          localStorage.removeItem(storeKey(ANON_STORE_NAME));
        }
      }
      const s = raw ? JSON.parse(raw) : null;
      if (s) {
        if (!trackFromUrl && s.trackKey && TRACKS.includes(s.trackKey)) trackKey = s.trackKey;
        yearKey = s.yearKey || yearKey;
        if (!specFromUrl) specKey = s.specKey || specKey;
        pinned = s.pinned || {}; projectKey = s.projectKey || "";
        optStartSeason = s.optStartSeason || "";
        optGoal = ["recommended", "points", "frontload", "semesters"].includes(s.optGoal) ? s.optGoal : "semesters";
        optCapPts = s.optCapPts > 0 ? s.optCapPts : 20;
        optFrontloadCapPts = s.optFrontloadCapPts > 0 ? s.optFrontloadCapPts : 20;
        manualPos = s.manualPos || {};
        manualExtraCols = s.manualExtraCols > 0 ? s.manualExtraCols : 0;
        hardPins = s.hardPins || {};
        excluded = s.excluded || {};
      } else {
        // אין שמירה קודמת לתדפיס הזה (סטודנט/ית "חדש/ה" בדפדפן הזה, ואין גם
        // מה לאמץ מה-bucket האנונימי) - לא משאירים נעיצות משיוך קודם דלוקות
        // בזיכרון (נתפס ותוקן 2026-07-15)
        pinned = {}; projectKey = ""; manualPos = {}; manualExtraCols = 0; hardPins = {}; excluded = {};
      }
    } catch { /* ignore */ }
  }
  function saveState() {
    localStorage.setItem(storeKey(currentStoreName()), JSON.stringify({
      trackKey, yearKey, specKey, pinned, projectKey, optStartSeason, optGoal, optCapPts, optFrontloadCapPts,
      manualPos, manualExtraCols, hardPins, excluded
    }));
  }

  // ---------- סנכרון עם FinDeg (js/app.js) ----------
  // FinDeg כותב לשם השיתוף הזה בכל רינדור (ראו syncFlowchart ב-js/app.js):
  // מסלול/קטלוג/פרויקט שנבחרו + אילו מזהי מקצוע עברו בפועל + סימונים ידניים
  // (הושלם/מתוכנן). לא כולל ציונים או שום דבר רגיש - רק מזהי מקצוע.
  const FINDEG_SYNC_KEY = "findeg_flowchart_sync";
  function readFindegSync() {
    try { return JSON.parse(localStorage.getItem(FINDEG_SYNC_KEY)); } catch { return null; }
  }

  // הסמסטר שבו מקצוע-בחירה מסונכרן "אמור" לשבת - בדיוק כמו מקצוע חובה: הכי
  // מוקדם שבו כל דרישות הקדם שלו (PREREQ, אותו מקור שמצייר את החצים למעלה -
  // "טוב מספיק" לכאן, לא צריך את מבנה ה-OR/AND המלא כמו EPS ב-optimizer.js)
  // כבר מתמלאות לפי baseMap (מיקומי חובה/גמיש/פרויקט שכבר ידועים) ו-doneIds,
  // מעוגל לעונה המתאימה - במקום "הסמסטר הראשון בעונה המתאימה" הישן שהתעלם
  // לגמרי מדרישות קדם (בקשת המשתמש/ת, 2026-07-17: "לראות אותם כאילו הם חובה
  // ולמקם אותם... לפי הקריטריון"). ללא baseMap (קריאה בלי הפרמטר, למשל
  // מ-computeClaimedElectivePts/renderElectives שלא צריכים דיוק-סמסטר) נופל
  // בחזרה ל-eligibleSemesters(id)[0] הישן - זול ומספיק כשאין למה להשוות.
  function electiveDueSemester(id, baseMap, doneIds, maxCol) {
    if (!baseMap) return eligibleSemesters(id)[0];
    const p = PREREQ[id];
    const prereqIds = p ? [...(p.prereq || []), ...(p.adjoining || [])] : [];
    let minSem = 1;
    for (const pid of prereqIds) {
      if (doneIds && doneIds.has(pid)) continue; // כבר הושלם - לא חוסם
      const pos = baseMap[pid];
      if (pos != null) minSem = Math.max(minSem, pos + 1);
    }
    return nextAvailableSemester(id, minSem, maxCol || 8);
  }

  // מקצועות בחירה (משרשראות/קבוצה ב') שכבר הושלמו בפועל בתדפיס או סומנו
  // "הושלם"/"מתוכנן" ב-FinDeg - ממופים לסמסטר "כמו-חובה" (ראו electiveDueSemester
  // למעלה), אלא אם המשתמש כבר נעץ אותם ידנית בתרשים (זה גובר). status:
  // "done"|"planned". "בהמשך" (later) מטופל בנפרד (laterIds) - לא ממוקם
  // בתרשים בכלל (בכוונה: "בהמשך" אומר במפורש "לא בסמסטר הזה/הבא", אז אין
  // סמסטר סביר לנעוץ אליו אוטומטית) - רק מסומן בצהוב בפאנל הבחירה למטה,
  // בדיוק כמו ב-FinDeg עצמו. baseMap/doneIds (אופציונליים) - ראו electiveDueSemester.
  function computeSyncedElectives(baseMap, doneIds) {
    const sync = readFindegSync();
    const placed = {}, laterIds = new Set();
    if (!sync || sync.trackKey !== trackKey || !track().years[sync.yearKey || yearKey]) return { placed, laterIds };
    const yd = track().years[sync.yearKey || yearKey];
    const electivePool = new Set([
      ...chainPools(yd).flatMap(g => g.pool)
    ]);
    const passed = new Set(sync.passedIds || []);
    const overrides = sync.overrides || {};
    const maxCol = Math.max(...buildColumns().map(c => c.num));
    for (const id of electivePool) {
      if (overrides[id] === "later") { laterIds.add(id); continue; }
      if (pinned[id] != null) continue; // נעיצה ידנית בתרשים גוברת
      let status = null;
      if (passed.has(id) || overrides[id] === "done") status = "done";
      else if (overrides[id] === "planned") status = "planned";
      if (!status) continue;
      const sem = electiveDueSemester(id, baseMap, doneIds, maxCol);
      placed[id] = { sem, status };
    }
    return { placed, laterIds };
  }

  // מקצועות "הושלם" ב-FinDeg (בפועל מהתדפיס, או סימון ידני "הושלם") - לכל
  // מקצוע שמוצג בתרשים (לא רק בחירה), לא רק אלה שכבר טופלו כ-electives למעלה.
  // משמש גם לאפור/"ערפל" על התיבה וגם להשמטת החצים היוצאות ממנה (ראו drawArrows).
  function computeDoneIds() {
    const sync = readFindegSync();
    if (!sync || sync.trackKey !== trackKey) return new Set();
    const done = new Set(sync.passedIds || []);
    for (const [id, status] of Object.entries(sync.overrides || {})) if (status === "done") done.add(id);
    // הרחבה דרך שקילות קוד ישן/חדש (equivSet, engine.js) - בלעדיה מקצוע
    // שהושלם בפועל תחת קוד אחד (למשל התדפיס עדיין מפנה לקוד ישן) לא היה
    // מסומן "הושלם" כאן אם התרשים מציג אותו תחת הקוד המקביל/החדש - בדיוק
    // אותה שקילות ש-FINDEG_ENGINE.evaluate כבר מכבד בכל מקום אחר (תכנון
    // אופטימלי/ידני, FinDeg עצמו - שניהם עוברים דרך המנוע). "המסלול המומלץ"
    // לבדו פספס אותה כי הפונקציה הזו בדיקת-קיום גולמית על sync.passedIds,
    // לא עוברת דרך המנוע כלל (נתפס - בקשת המשתמש/ת, 2026-07-25: "done"
    // מ"מקצועות מקבילים" לא עבר לתצוגה הזו, בניגוד לכל שאר התצוגות).
    for (const id of [...done]) for (const e of FINDEG_ENGINE.equivSet(id)) done.add(e);
    return done;
  }

  // ---------- קליק על תיבת מקצוע = סימון/ביטול-סימון "הושלם" (אינטואיטיבי
  // יותר מלחזור ל-FinDeg עצמו) ----------
  // כותב ישירות לאותה שמירת overrides ש-js/app.js קורא/כותב (overrideKey שם,
  // אותו נוסח מפתח בדיוק - שם_מסלול_קטלוג) - כדי שהסימון יישאר גם בחזרה
  // ל-FinDeg עצמו, לא רק כאן. פעיל רק כשהתרשים מסונכרן למסלול הזה (אותו
  // תנאי בדיוק כמו computeDoneIds למעלה - אם אין סנכרון, אין גם למה/איך
  // לשייך את הסימון). מקצוע שכבר "עבר" בפועל בתדפיס (לא סימון ידני) לא ניתן
  // לביטול מכאן - זו עובדה מהתדפיס, לא בחירה ידנית (בקשת המשתמש, 2026-07-15:
  // "אם אני לוחצ/ת על קורס בתרשים זה צריך להיות כאילו סימנתי אותו כהושלם").
  function toggleDoneOverride(id) {
    const sync = readFindegSync();
    if (!sync || sync.trackKey !== trackKey) return;
    if ((sync.passedIds || []).includes(id)) return;
    const name = sync.studentName ? sync.studentName.replace(/\s+/g, "_") : "unknown";
    const key = "findeg_overrides_" + name + "_" + sync.trackKey + "_" + (sync.yearKey || "");
    let stored;
    try { stored = JSON.parse(localStorage.getItem(key)) || {}; } catch { stored = {}; }
    if (stored[id] === "done") delete stored[id]; else stored[id] = "done";
    localStorage.setItem(key, JSON.stringify(stored));
    sync.overrides = stored;
    localStorage.setItem(FINDEG_SYNC_KEY, JSON.stringify(sync));
    renderCurrent();
  }

  // ---------- ערפל על סמסטרים שכבר חלפו (לפי תאריך אמיתי, לא לפי סימוני
  // "הושלם" של מקצוע ספציפי - ראו doneIds/fc-mist למעלה) ----------
  // עוגן קבוע: סמסטר 1 הוא *תמיד* החורף הראשון של yearKey (שנת הקטלוג/תחילת
  // הלימודים), בלי קשר לעונה שבה הסטודנט/ית התחיל/ה בפועל. מי שהתחיל/ה
  // בפועל באביב "מרוויח/ה" סמסטר: החורף שמעולם לא נלמד כבר נחשב "עבר" ברגע
  // שמגיע תאריך תחילת הסמסטר הראשון שכן נלמד (ראו computeCompletedSemesters) -
  // זו בדיוק ההתנהגות המבוקשת, בלי לוגיקה נפרדת לזיהוי עונת ההתחלה בפועל.
  function gregorianStartYear() {
    for (const [greg, heb] of Object.entries(D.yearCatalogs || {})) {
      if (heb === yearKey) return +greg;
    }
    return null;
  }
  // תאריך תחילה משוער של סמסטר num, לפי הלוח האקדמי (חורף~אוקטובר, אביב~מרץ)
  function semesterStartDate(num, gregYear) {
    return num % 2 === 1
      ? new Date(gregYear + (num - 1) / 2, 9, 1)
      : new Date(gregYear + num / 2, 2, 1);
  }
  // סמסטר num נחשב "חלף" כשכבר הגיע תאריך תחילת הסמסטר שאחריו - כלומר גם
  // הזמן שלו עצמו כבר עבר, לא רק שהתחיל.
  function computeCompletedSemesters() {
    const gregYear = gregorianStartYear();
    const done = new Set();
    if (gregYear == null) return done;
    const now = new Date();
    for (let num = 1; num <= 8; num++) {
      if (now >= semesterStartDate(num + 1, gregYear)) done.add(num);
    }
    return done;
  }

  // ---------- בניית תוכן העמודות ----------
  function buildColumns() {
    return FC().semesters.map(s => {
      const mandatory = s.mandatory.slice();
      if (s.yearOnly && s.yearOnly[yearKey]) mandatory.push(...s.yearOnly[yearKey]);
      return {
        num: s.num, season: s.season, mandatory,
        flexible: s.flexible || [], general: s.general || [],
        // project: מחרוזת בודדת (מסלול עם בחירת פרויקט, כמו ניהול ובנייה) או
        // מערך (פרויקט קבוע רב-מקצועי, כמו הפרויקט המורחב במבנים) - שתי
        // הצורות מטופלות ישירות למטה (Array.isArray)
        project: s.project || null
      };
    });
  }

  // מקצועות שנדחקו קדימה (ראו computeSemNumMap) - id -> הסמסטר המקורי (לפני
  // הדחיפה), לשימוש בהערה בתיבה עצמה (renderGrid). מחושב מחדש בכל
  // computeSemNumMap, ברמת המודול כדי שרינדור הרשת יוכל לגשת בלי פרמטרים נוספים.
  let pushedFrom = {};

  // סמסטר בפועל של כל מקצוע המוצג כרגע (חובה+גמיש+פרויקט+נעוץ), לשימוש בחישוב
  // שרשרת קריטית אמיתית (במונחי מרחק-סמסטרים, לא רק מספר קפיצות בגרף) וגם
  // למיקום בפועל ברשת (renderGrid).
  function computeSemNumMap() {
    const map = {};
    for (const col of buildColumns()) {
      for (const id of col.mandatory) map[id] = col.num;
      for (const id of col.flexible) if (!(id in map)) map[id] = col.num;
      const projIds = Array.isArray(col.project) ? col.project : (col.project ? [col.project] : []);
      for (const id of projIds) map[id] = col.num;
    }
    if (projectKey && track().projectOptions) {
      const opt = track().projectOptions[projectKey];
      if (opt) for (const id of opt.ids) map[id] = 8;
    }
    // map (עד כאן, לפני שנוספו בחירות) הוא בדיוק "מיקומי החובה" - מעבירים
    // אותו כ-baseMap ל-computeSyncedElectives כדי שבחירה מסונכרנת תמוקם
    // לפי דרישות הקדם שלה (כמו מקצוע חובה), לא סתם "העונה המתאימה הראשונה".
    for (const [id, info] of Object.entries(computeSyncedElectives(map, computeDoneIds()).placed)) map[id] = info.sem;
    for (const [id, sem] of Object.entries(pinned)) map[id] = sem;

    // דוחפים קדימה מקצועות שעדיין לא הושלמו אך "תקועים" בעמודת סמסטר שכבר
    // חלף (ראו computeCompletedSemesters) - אל הסמסטר הבא המתאים לעונה שלהם,
    // לא יאוחר מהעמודה האחרונה שקיימת בתרשים. זה חל גם על נעיצה ידנית
    // (pinned): אם המשתמש/ת נעץ/ה בחירה לסמסטר מסוים אך הסמסטר הזה כבר חלף
    // בלי שהמקצוע סומן כהושלם - הבחירה נדחקת קדימה בדיוק כמו כל מקצוע אחר,
    // במקום להישאר "תקועה" לנצח בעמודה שכבר עברה.
    pushedFrom = {};
    const completed = computeCompletedSemesters();
    if (completed.size) {
      const completedMax = Math.max(...completed);
      const maxCol = Math.max(...buildColumns().map(c => c.num));
      const done = computeDoneIds();
      for (const id of Object.keys(map)) {
        if (done.has(id) || !completed.has(map[id])) continue;
        const next = nextAvailableSemester(id, completedMax + 1, maxCol);
        if (next !== map[id]) { pushedFrom[id] = map[id]; map[id] = next; }
      }
    }

    return map;
  }

  // שרשרת(ות) הדרישות-קדם הארוכות ביותר, לפי המרחק האמיתי המינימלי האפשרי -
  // לא לפי מספרי הסמסטר "הרשמיים" של flowchart-data.js. ההבדל חשוב: מקצוע
  // גמיש (ניתן בשתי העונות, כמו מבוא למכניקה הנדסית/תורת החוזק 1) יכול "לזוז"
  // בלוח הזמנים בלי לעכב שום דבר - וסטודנט חכם ינצל את הגמישות הזו כדי למזער
  // המתנה למקצוע נוקשה בהמשך השרשרת (שניתן בעונה אחת בלבד). למשל: אם תורת
  // החוזק מסתיים באביב וגיאולוגיה (אביב בלבד) לא זמינה שוב עד לאביב הבא -
  // שנה שלמה של המתנה! - בעוד שאם מזיזים את תורת החוזק סמסטר קדימה (עדיין
  // גמיש, לא באמת "מתעכבים") ומסיימים אותו בחורף, גיאולוגיה כבר זמינה
  // בסמסטר שאחריו. בלי לחשב את זה, שרשרת ארוכת-קפיצות אך גמישה-לגמרי (כמו
  // הדוגמה הזו) הייתה "מנצחת" בטעות שרשרת קצרה יותר אך עם צוואר בקבוק אמיתי
  // ובלתי נמנע (כמו יסודות מכניקת הזורמים, חורף בלבד, ← גיאומכניקה, חורף
  // בלבד) - לפי תיקון מפורש של המשתמש (סטודנט במסלול), 2026-07-10.
  //
  // המימוש: לכל מקצוע ולכל עונה אפשרית שבה הוא עשוי להסתיים, מחשבים את
  // המרחק האמיתי המינימלי מתחילת השרשרת - עם אופטימיזציה על בחירת העונה של
  // כל מקצוע-קדם גמיש (habits ה"רזרבה" ה-CPM-ית). "קריטי" = קשת שבלי רזרבה
  // בשום בחירת-עונה אפשרית - כלומר משתתפת בשרשרת שמגיעה בדיוק למרחק
  // המקסימלי הכולל, גם כשממטבים את התזמון בצורה הכי חכמה שאפשר.
  const REAL_SEASONS = ["winter", "spring"];
  function seasonOptions(id) {
    const s = seasonsOf(id);
    const filtered = s.filter(x => REAL_SEASONS.includes(x));
    return filtered.length ? filtered : REAL_SEASONS; // לא ידוע/רק קיץ - מניחים גמיש לגמרי
  }
  // מספר הסמסטרים המינימלי בין סיום ב-sFrom לבין ההזדמנות הבאה ל-sTo (חוזרים
  // על אותה עונה רק אחרי שנה שלמה - 2 סמסטרים; העונה השנייה זמינה כבר בסמסטר הבא)
  function seasonGap(sFrom, sTo) { return sFrom === sTo ? 2 : 1; }

  function computeCriticalPath(semNumMap) {
    const nodes = Object.keys(semNumMap);
    const nodeSet = new Set(nodes);
    const adjOut = {}, adjIn = {};
    for (const id of Object.keys(PREREQ)) {
      if (!nodeSet.has(id)) continue;
      const p = PREREQ[id];
      for (const src of [...(p.prereq || []), ...(p.adjoining || [])]) {
        if (!nodeSet.has(src)) continue;
        (adjOut[src] = adjOut[src] || []).push(id);
        (adjIn[id] = adjIn[id] || []).push(src);
      }
    }

    // longestTo(id, season): השרשרת הארוכה ביותר (בבחירת-עונה אופטימלית לכל
    // מקצוע-קדם) שמסתיימת ב-id, בהנחה ש-id עצמו מסתיים בעונה הנתונה.
    const memoTo = {};
    function longestTo(id, season) {
      const key = id + "|" + season;
      if (memoTo[key]) return memoTo[key];
      memoTo[key] = { hops: 0, span: 0 }; // מגן זמני מפני מעגל (לא צפוי בפועל)
      let best = { hops: 0, span: 0 };
      for (const src of (adjIn[id] || [])) {
        let bestSrc = null;
        for (const sSrc of seasonOptions(src)) {
          const sub = longestTo(src, sSrc);
          const gap = seasonGap(sSrc, season);
          const cand = { hops: sub.hops + 1, span: sub.span + gap };
          // בוחרים את עונת מקצוע-הקדם שממזערת את המרחק האמיתי (הרזרבה שהגמישות מאפשרת)
          if (!bestSrc || cand.span < bestSrc.span || (cand.span === bestSrc.span && cand.hops > bestSrc.hops)) bestSrc = cand;
        }
        if (bestSrc && (bestSrc.span > best.span || (bestSrc.span === best.span && bestSrc.hops > best.hops))) best = bestSrc;
      }
      memoTo[key] = best;
      return best;
    }
    // longestFrom(id, season): ההמשך הארוך ביותר *אחרי* id, בהנחה ש-id הסתיים בעונה הנתונה.
    const memoFrom = {};
    function longestFrom(id, season) {
      const key = id + "|" + season;
      if (memoFrom[key]) return memoFrom[key];
      memoFrom[key] = { hops: 0, span: 0 };
      let best = { hops: 0, span: 0 };
      for (const nxt of (adjOut[id] || [])) {
        let bestNxt = null;
        for (const sNxt of seasonOptions(nxt)) {
          const sub = longestFrom(nxt, sNxt);
          const gap = seasonGap(season, sNxt);
          const cand = { hops: sub.hops + 1, span: sub.span + gap };
          if (!bestNxt || cand.span < bestNxt.span || (cand.span === bestNxt.span && cand.hops > bestNxt.hops)) bestNxt = cand;
        }
        if (bestNxt && (bestNxt.span > best.span || (bestNxt.span === best.span && bestNxt.hops > best.hops))) best = bestNxt;
      }
      memoFrom[key] = best;
      return best;
    }

    // לכל מקצוע: בוחרים את העונה-שלו-עצמו שממזערת את סך המרחק (קדם+המשך) -
    // זו העונה ה"אמיתית" הכי חכמה לתזמן בה אותו מקצוע ספציפי. המקסימום מבין
    // כל אלה הוא אורך שרשרת הצוואר-בקבוק האמיתי שאי-אפשר להימנע ממנו.
    let overall = { hops: 0, span: 0 };
    const bestSeasonOf = {};
    for (const id of nodes) {
      let bestForId = null;
      for (const season of seasonOptions(id)) {
        const to = longestTo(id, season), from = longestFrom(id, season);
        const cand = { hops: to.hops + from.hops, span: to.span + from.span };
        if (!bestForId || cand.span < bestForId.span || (cand.span === bestForId.span && cand.hops > bestForId.hops)) {
          bestForId = cand; bestSeasonOf[id] = season;
        }
      }
      if (bestForId && (bestForId.span > overall.span || (bestForId.span === overall.span && bestForId.hops > overall.hops))) overall = bestForId;
    }

    // קשת קריטית: אין לה רזרבה בשום שילוב-עונות אפשרי - מגיעה בדיוק לאורך המקסימלי הכולל
    const edges = new Set(), critNodes = new Set();
    for (const id of nodes) {
      for (const to of (adjOut[id] || [])) {
        for (const sFrom of seasonOptions(id)) {
          for (const sTo of seasonOptions(to)) {
            const before = longestTo(id, sFrom), after = longestFrom(to, sTo);
            const gap = seasonGap(sFrom, sTo);
            const hops = before.hops + 1 + after.hops, span = before.span + gap + after.span;
            if (hops === overall.hops && span === overall.span) {
              edges.add(id + "->" + to);
              critNodes.add(id);
              critNodes.add(to);
            }
          }
        }
      }
    }
    // אם אין אף קשת (שרשרת של מקצוע בודד, למשל מרחב תרשים חלקי) - עדיין לפחות
    // המקצוע הבודד הארוך ביותר עצמו נספר, כדי שהתמצית למטה לא תישאר ריקה סתם
    if (!edges.size) {
      for (const id of nodes) {
        const season = bestSeasonOf[id];
        if (season && longestTo(id, season).hops + longestFrom(id, season).hops === overall.hops) critNodes.add(id);
      }
    }
    return { nodes: critNodes, edges, span: overall.span };
  }

  // שרשרת קריטית נוכחית + מקצועות שהושלמו (מחושבים מחדש בתחילת כל render, ראו
  // computeCriticalPath/computeDoneIds) - ברמת המודול כדי שכל פונקציות הרינדור/
  // ציור החצים יוכלו לגשת אליהן בלי להעביר בפרמטרים.
  let criticalNodes = new Set();
  let criticalEdges = new Set();
  let criticalSpan = 0;
  let doneIds = new Set();
  // "תכנון אופטימלי" (fc-opt-page): התוכנית ה"מוקפאת" הנוכחית - הפלט המלא
  // האחרון של FINDEG_OPTIMIZER.computePlan (plan/pointsById/generalNames/
  // notes/planAnchorSemester וכו'), *לא* מחושבת מחדש בכל render. null = "צריך
  // לחשב מחדש" (ביקור ראשון/אחרי הרצה מפורשת/איפוס/שינוי מסלול). גרירה
  // (drop handler למטה) עורכת אותה *ישירות* (מזיזה id בין מערכי ids של
  // סמסטרים) בלי לגעת ב-computePlan בכלל ובלי לאפס אותה - כך שגרירת מקצוע
  // בודד לא "מריצה מחדש" שום איזון/קיבולת על מה שלא נגעו בו, ובניגוד לגרסה
  // הקודמת (נעיצה-קשיחה-לכולם) גם לא מסמנת את כולם כ"נעוץ" (בקשת המשתמש/ת,
  // 2026-07-25: "the function for re-organizing a flowchart should only
  // rerun when clicking on the run, reset, or refreshing the page" - לא
  // מתמשך בין רענוני-דף בכוונה, ראו שלא נשמרת ב-saveState/loadState).
  // כוונתית לא נשמרת ל-localStorage - "רענון דף" הוא אחד משלושת הטריגרים
  // המותרים להרצה מחדש, אז חייבת "להישכח" ברענון.
  let materializedPlan = null;
  // id (gen_pe_1/gen_enrich_2 וכו') -> תווית תצוגה ("מל\"ג 2") למקצועות
  // ספורט/מל"ג/בחירה חופשית סינתטיים בתצוגות "תכנון אופטימלי"/"תכנון ידני"
  // (ראו FINDEG_OPTIMIZER.computePlan().generalNames) - אין להם ייצוג
  // ב-D.courseNames בכלל, cname() למטה בודקת כאן קודם. ריק בתצוגת "המסלול
  // המומלץ" (שם אין למקצועות ספורט/מל"ג ייצוג בתרשים בכלל, רק בגליון עצמו).
  let generalNames = {};

  // opts (אופציונלי): { draggable: bool, warn: bool, pts: number, noClickToggle: bool }.
  // draggable הופך את התיבה לניתנת-לגרירה (dragstart שם את id ב-dataTransfer,
  // נקלט ע"י ה-drop handler הכללי על .fcm-drop-zone/.fco-drop-zone - "תכנון
  // ידני"/"תכנון אופטימלי" בהתאמה). warn מציג תג "!" באדום בפינת התיבה -
  // דרישת הקדם שלה לא מתמלאת בפועל במיקום הנוכחי (בקשת המשתמש/ת, 2026-07-16).
  // pts דורס את D.coursePoints[id] הגלובלי (שלא מכיל את רוב מקצועות החובה -
  // הם מקודדים כ-C(id,pts) בתוך המסלול, ראו FINDEG_OPTIMIZER.computePlan.pointsById)
  // - בלעדיו רוב תיבות תכנון-ידני/אופטימלי היו מציגות "0 נק'"/בלי תג נקודות
  // בכלל. noClickToggle - "תכנון אופטימלי" בלבד: קליק שם *לא* מסמן "הושלם"
  // (רק גרירה משנה משהו, ראו מאזיני click/drag ב-document למטה) - בלי זה
  // הרמז (title) היה ממשיך להבטיח התנהגות שכבר לא קיימת.
  function courseBox(id, semNum, extraCls, noteHtml, opts) {
    const isDone = doneIds.has(id);
    // מקצוע שהושלם כבר לא "קריטי" בפועל (אין יותר סיכון לעיכוב) - הסימון
    // האדום מוצג רק למקצועות שעדיין לפנינו, אחרת התיבה נשארת מודגשת/אדומה
    // במקום להיראות אפורה כמו כל מקצוע אחר שהושלם.
    const isCrit = criticalNodes.has(id) && !isDone;
    const box = el("div", "fc-box" + (extraCls ? " " + extraCls : "") + (isCrit ? " fc-critical" : "") + (isDone ? " fc-done" : ""));
    box.dataset.courseId = id;
    if (semNum != null) box.dataset.semNum = semNum;
    box.title = (opts && opts.noClickToggle)
      ? "גררו לסמסטר אחר כדי לנעוץ אותו שם"
      : (isDone ? "לחצו כדי לבטל סימון \"הושלם\"" : "לחצו כדי לסמן כ\"הושלם\"");
    const p = (opts && opts.pts != null) ? opts.pts : pts(id);
    // מקצועות ספורט/מל"ג/בחירה חופשית סינתטיים (gen_pe_1 וכו', ראו
    // generalNames למעלה) - אין להם קוד קטלוגי אמיתי ולא עונת-היצע ספציפית
    // (זו בדיוק הנקודה - לא משנה איזה מקצוע בפועל, כל סמסטר מתאים), אז
    // מדלגים על "קוד המקצוע"/תג העונה שהיו מציגים מידע כוזב/מבלבל ("?").
    const isGeneral = id.startsWith("gen_");
    box.innerHTML = (p != null ? '<span class="fc-pts">' + fmtPts(p) + "</span>" : "") +
      "<b>" + esc((opts && opts.name) || cname(id)) + "</b>" +
      (isGeneral ? "" : '<span class="fc-code">' + id.slice(2, 8) + "</span>" + semBadge(id)) +
      (noteHtml || "") +
      (opts && opts.warn ? '<span class="fc-warn-badge" title="ממוקם בסמסטר לפני שדרישת הקדם שלו מתמלאת בפועל">!</span>' : "") +
      (isDone ? '<div class="fc-mist" title="הושלם"></div>' : "");
    if (opts && opts.draggable) {
      box.draggable = true;
      box.addEventListener("dragstart", e => {
        e.dataTransfer.setData("text/plain", id);
        e.dataTransfer.effectAllowed = "move";
      });
    }
    return box;
  }

  // ---------- סידור מחדש בתוך כל שורה לצמצום חציות חצים ----------
  // היוריסטיקת "מרכז כובד" (barycenter) סטנדרטית לצמצום חציות בגרפים שכבתיים:
  // לכל מקצוע בשורה, ממוצע האינדקסים (לא הפיקסלים - לא תלוי ברינדור) של שכניו
  // המחוברים (דרישת קדם/מקצוע צמוד) בשורות אחרות, וממיינים לפי זה. כמה סבבים
  // (למטה ואז למעלה, לסירוגין) כדי שגם קשרים לא-סמוכים יתכנסו סביר. לא מבטיח
  // אפס חציות (זה לא תמיד אפשרי בלי לשנות גם את מבנה הגרף עצמו), רק ממזער.
  function reorderRowsForCrossings(rowIds, semNumMap) {
    const adj = {};
    const addAdj = (a, b) => { (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a); };
    for (const id of Object.keys(PREREQ)) {
      if (!(id in semNumMap)) continue;
      const p = PREREQ[id];
      for (const src of [...(p.prereq || []), ...(p.adjoining || [])]) {
        if (src in semNumMap) addAdj(src, id);
      }
    }
    const sems = [...rowIds.keys()].sort((a, b) => a - b);
    const posIndex = {};
    const rebuildIndex = () => { for (const s of sems) rowIds.get(s).forEach((id, i) => { posIndex[id] = i; }); };
    rebuildIndex();

    function sweep(order) {
      for (const sem of order) {
        const ids = rowIds.get(sem);
        if (ids.length < 2) continue;
        const bary = {};
        for (const id of ids) {
          const neighbors = (adj[id] || []).filter(n => posIndex[n] !== undefined);
          bary[id] = neighbors.length ? neighbors.reduce((s, n) => s + posIndex[n], 0) / neighbors.length : posIndex[id];
        }
        ids.sort((a, b) => bary[a] - bary[b]);
        ids.forEach((id, i) => { posIndex[id] = i; });
      }
    }
    for (let iter = 0; iter < 4; iter++) sweep(iter % 2 === 0 ? sems : [...sems].reverse());
  }

  // הערת "נדחה קדימה" לתיבה שמיקומה בפועל (semNumMap) שונה מהמיקום ה"רשמי"
  // בגלל שהסמסטר המקורי כבר חלף (ראו pushedFrom/computeSemNumMap).
  function pushNote(id) {
    return pushedFrom[id] != null
      ? '<div class="section-note fc-push-note" style="margin:2px 0 0;font-size:.75rem">⏩ נדחה קדימה - במקור סמסטר ' + pushedFrom[id] + " (כבר חלף)</div>"
      : "";
  }

  function renderGrid() {
    const grid = $("#fc-grid");
    grid.innerHTML = "";
    const columns = buildColumns();
    const t = track();
    const projOpt = projectKey && t.projectOptions ? t.projectOptions[projectKey] : null;
    // computeSemNumMap() גם מרענן את pushedFrom (ראו שם) - חייב לרוץ לפני
    // שמשתמשים בו למיקום בפועל של כל תיבה למטה, לא רק לצורך סדר-חציות.
    // synced מחושב *אחרי* semNumMap ומקבל אותו כ-baseMap כדי ש-info.sem
    // (המפעיל למטה את הלולאה הנכונה - ראו "for (const [id, info] of
    // Object.entries(synced))") יהיה עקבי עם המיקום הסופי בפועל.
    const semNumMap = computeSemNumMap();
    const synced = computeSyncedElectives(semNumMap, computeDoneIds()).placed;
    const reducedGenerals = computeReducedGenerals();

    // שלב 1: אוספים לכל שורה את סדר-המקצועות (למיון מחדש) + "מפרט" תצוגה לכל
    // מקצוע (מחלקת CSS/הערה/כפתור ביטול-נעיצה) - לפני שמציירים בפועל, כדי
    // שאפשר יהיה לסדר מחדש (reorderRowsForCrossings) בלי לגעת ב-DOM עדיין.
    const rowIds = new Map(); // semNum -> [id,...]
    const specs = new Map(); // id -> {cls, note, unpin}
    const generalsByRow = new Map(); // semNum -> [{pts,label}]

    function addBox(sem, id, cls, note, unpin, opts) {
      if (!rowIds.has(sem)) rowIds.set(sem, []);
      if (!specs.has(id)) { rowIds.get(sem).push(id); specs.set(id, { cls, note, unpin, opts }); }
    }

    for (const col of columns) {
      generalsByRow.set(col.num, col.general);
      for (const id of col.mandatory) addBox(semNumMap[id] ?? col.num, id, "", pushNote(id));
      for (const id of col.flexible) {
        addBox(semNumMap[id] ?? col.num, id, "fc-flexible",
          '<div class="section-note" style="margin:2px 0 0;font-size:.75rem">גמיש - לרוב סמ\' 1-2, תלוי בסיווג</div>' + pushNote(id));
      }
      if (col.project) {
        const projIds = Array.isArray(col.project) ? col.project : [col.project];
        if (projIds.length > 1) {
          // פרויקט קבוע רב-מקצועי (כמו הפרויקט המורחב במבנים, 00140131+00140132) -
          // תיבה אחת מאוחדת, לא תיבה נפרדת לכל "חלק" (החלוקה הזו רק בירוקרטית -
          // זה מקצוע-קרדיט יחיד שנלמד יחד, ראו הערה ב-flowchart-data.js; בקשת
          // המשתמש/ת, 2026-07-19). העוגן (data-course-id, לצורך קליק-לסימון-
          // הושלם/חצים/סטטוס) הוא האחרון ברשימה - בפרויקט המבנים זה בדיוק
          // החלק שנושא את כל הנקודות (00140132, 5 נק'; 00140131=0).
          const anchorId = projIds[projIds.length - 1];
          const totalPts = projIds.reduce((s, pid) => s + (pts(pid) || 0), 0);
          addBox(semNumMap[anchorId] ?? col.num, anchorId, "fc-project", pushNote(anchorId), false,
            { name: "פרויקט מורחב במבנים א + ב", pts: totalPts });
        } else {
          for (const id of projIds) addBox(semNumMap[id] ?? col.num, id, "fc-project", pushNote(id));
        }
        if (projOpt) {
          for (const id of projOpt.ids) {
            addBox(semNumMap[id] ?? col.num, id, "fc-project", '<div class="section-note" style="margin:2px 0 0;font-size:.75rem">' + esc(projOpt.label) + "</div>" + pushNote(id));
          }
        }
      }
      for (const [id, info] of Object.entries(synced)) {
        if (info.sem !== col.num) continue;
        const tag = info.status === "done" ? "✓ הושלם (מ-FinDeg)" : "🕒 מתוכנן (מ-FinDeg)";
        addBox(semNumMap[id] ?? col.num, id, "fc-elective fc-synced-" + info.status, '<div class="section-note" style="margin:2px 0 0;font-size:.75rem">' + tag + "</div>" + pushNote(id));
      }
      for (const [id, sem] of Object.entries(pinned)) {
        if (sem !== col.num) continue;
        addBox(semNumMap[id] ?? sem, id, "fc-elective", pushNote(id), true);
      }
    }

    // שלב 2: סידור מחדש לצמצום חציות (לא נוגע במקצועות עצמם, רק בסדר בתוך השורה)
    reorderRowsForCrossings(rowIds, semNumMap);

    // שלב 3: רינדור בפועל, לפי הסדר הסופי
    const sortedSems = [...rowIds.keys()].sort((a, b) => a - b);
    for (const semNum of sortedSems) {
      const rowEl = el("div", "fc-row");
      rowEl.dataset.semNum = semNum;
      const season = columns.find(c => c.num === semNum).season;
      rowEl.appendChild(el("div", "fc-row-head" + (season === "spring" ? " spring" : ""),
        "סמסטר " + semNum + " · " + seasonLabel[season]));
      const boxesEl = el("div", "fc-row-boxes");

      for (const id of rowIds.get(semNum)) {
        const spec = specs.get(id);
        const box = courseBox(id, semNum, spec.cls, spec.note, spec.opts);
        if (spec.unpin) {
          const un = el("button", "fc-unpin", "✕");
          un.title = "בטל נעיצה";
          un.dataset.unpin = id;
          box.appendChild(un);
        }
        boxesEl.appendChild(box);
      }
      for (const g of (generalsByRow.get(semNum) || [])) {
        const info = reducedGenerals.get(g);
        if (info && info.pts <= 0) continue; // כוסה לגמרי ע"י בחירות שכבר סומנו
        const coveredNote = info && info.deducted > 0
          ? ' <span class="fc-general-note" title="' + fmtPts(info.deducted) + ' נק\' כבר מכוסות ע"י מקצועות בחירה שסומנו הושלמו/מתוכננים/בהמשך">(−' + fmtPts(info.deducted) + " נק' כוסו)</span>"
          : "";
        boxesEl.appendChild(el("div", "fc-box fc-general", fmtPts(info ? info.pts : g.pts) + ' נק\' · ' + esc(g.label) + coveredNote));
      }

      rowEl.appendChild(boxesEl);
      grid.appendChild(rowEl);
    }
  }

  // ---------- פאנל מקצועות בחירה ----------
  // מקבל שרשראות (yearData.chains, כמו בניהול ובנייה) וגם כל קטע type
  // chooseCourses/choosePoints ישירות מ-sections (כמו קבוצה א'/ב' במבנים) -
  // מדלג על "groupAB" (סיכום מצטבר של קבוצה א'+ב' יחד, לא פול אמיתי לנעיצה).
  function chainPools(yd) {
    const chains = yd.chains || {};
    const groups = [];
    for (const [key, chain] of Object.entries(chains)) {
      const pool = [...new Set([...(chain.core || []), ...((chain.chooseFrom && chain.chooseFrom.pool) || [])])];
      groups.push({
        key, title: chain.title, note: chain.note,
        minNote: chain.chooseFrom ? "לבחור לפחות " + chain.chooseFrom.min + " מהרשימה" : "",
        pool
      });
    }
    for (const s of (yd.sections || [])) {
      if (s.type !== "chooseCourses" && s.type !== "choosePoints") continue;
      if (s.id === "groupAB") continue; // סכום מצטבר, לא פול נעיצה עצמאי
      if (groups.some(g => g.key === s.id)) continue;
      groups.push({
        key: s.id, title: s.title, note: s.note,
        minNote: s.type === "chooseCourses" ? "לבחור לפחות " + s.min + " מהרשימה" : "לצבור לפחות " + fmtPts(s.minPts) + " נק'",
        pool: s.pool
      });
    }
    return groups;
  }

  // ---------- הפחתת נק' מ"בועות" בחירה כלליות (dashed) לפי בחירות שכבר סומנו ----------
  // שלושה "בורות" נק' עצמאיים, כל אחד עם קבוצת-תוויות משלו (רשימת-היתר נבחרה
  // ידנית מול flowchart-data.js - לא זיהוי לפי מילות-מפתח בתווית, שביר מדי:
  // "בחירה כלל טכניוני" למשל מכיל גם "בחירה" וגם "כלל טכניוני" ושייך לבור
  // השלישי בלבד, לא לראשון):
  //  - REDUCIBLE_GENERAL_LABELS[trackKey] - "בחירה קבוצה..." וכו', ממומן
  //    ממקצועות-בחירה קטלוגיים (chainPools) שנעוצו/סומנו הושלם/מתוכנן/בהמשך.
  //  - PE_GENERAL_LABELS ("ח. גופני") - ממומן מ-extras.manual (js/app.js,
  //    "הוספת מקצוע" ליד #mc-add) בקטגוריית ספורט (cat:"pe").
  //  - FREE_GENERAL_LABELS ("כלל טכניוני"/"בחירה כלל טכניוני") - ממומן
  //    מ-extras.manual בקטגוריית מל"ג/בחירה חופשית (cat:"enrich"/"free").
  // extras.manual (בניגוד למקצועות-פול) הן שם חופשי בלי מזהה קטלוגי בכלל -
  // לעולם לא יכולות להתאים לפול מקצועות אמיתי (chainPools), ולכן טופלות כאן
  // לגמרי בנפרד מ-computeClaimedElectivePts, לא כערך נוסף בתוך אותו Set.
  const REDUCIBLE_GENERAL_LABELS = {
    management: new Set(["בחירה קבוצה א'", "בחירה קבוצה א'+ב'"]),
    structures: new Set(["בחירה קבוצה א'+ב'"]),
    civil: new Set(["בחירת התמחות - הנדסת מים", "בחירה"])
  };
  const PE_GENERAL_LABELS = new Set(["ח. גופני"]);
  const FREE_GENERAL_LABELS = new Set(["כלל טכניוני", "בחירה כלל טכניוני"]);

  // סך הנק' של מקצועות-בחירה (מתוך פאנל הבחירה, chainPools) שכבר "נתפסו" -
  // נעוצים ידנית בתרשים, או מסומנים ב-FinDeg כהושלמו/מתוכננים/בהמשך. נספר
  // פעם אחת לכל מקצוע גם אם הוא מופיע בכמה שרשראות/פולים בו-זמנית (Set).
  function computeClaimedElectivePts() {
    const yd = yearData();
    const pool = new Set(chainPools(yd).flatMap(g => g.pool));
    const { placed: synced, laterIds } = computeSyncedElectives();
    let total = 0;
    for (const id of pool) {
      if (pinned[id] == null && !synced[id] && !laterIds.has(id)) continue;
      const p = pts(id);
      if (p != null) total += p;
    }
    return total;
  }

  // סך הנק' של מקצועות "הוספת מקצוע" (extras.manual מ-js/app.js, בלי מזהה
  // קטלוגי - ראו syncFlowchart) שכבר סומנו הושלם/מתוכנן/בהמשך, מחולק
  // לקטגוריה (pe מול enrich+free, ראו CAT_LABELS ב-app.js).
  function computeManualClaimedPts() {
    const sync = readFindegSync();
    const out = { pe: 0, free: 0 };
    if (!sync || sync.trackKey !== trackKey) return out;
    for (const m of (sync.manual || [])) {
      if (!m || (m.status !== "done" && m.status !== "planned" && m.status !== "later")) continue;
      const p = Number(m.pts) || 0;
      if (m.cat === "pe") out.pe += p;
      else if (m.cat === "enrich" || m.cat === "free") out.free += p;
    }
    return out;
  }

  // מחלקים כל "בור" נק' על פני כל "בועות" הבחירה שלו (ראו למעלה), לפי סדר
  // הופעתן בתרשים (הראשונה ראשונה) - עד שנגמר הסכום. מחזיר Map מ-אובייקט-
  // general (זהות, לא ערך) ל-{pts,deducted}.
  function computeReducedGenerals() {
    const reduced = new Map();
    const manualPts = computeManualClaimedPts();
    const pools = [
      { labels: REDUCIBLE_GENERAL_LABELS[trackKey], remaining: computeClaimedElectivePts() },
      { labels: PE_GENERAL_LABELS, remaining: manualPts.pe },
      { labels: FREE_GENERAL_LABELS, remaining: manualPts.free }
    ];
    for (const col of buildColumns()) {
      for (const g of col.general) {
        const pool = pools.find(p => p.labels && p.labels.has(g.label));
        if (!pool) continue;
        const deduct = Math.min(pool.remaining, g.pts);
        pool.remaining -= deduct;
        reduced.set(g, { pts: g.pts - deduct, deducted: deduct });
      }
    }
    return reduced;
  }

  function renderElectives() {
    const yd = yearData();
    const wrap = $("#fc-electives");
    if (!wrap) return;
    if (!yd) { wrap.innerHTML = ""; return; } // קטלוג/התמחות לא תקפים כרגע (מצב ביניים בטעינה)
    const { placed: synced, laterIds } = computeSyncedElectives();
    // סטטוס FinDeg גולמי פר-מקצוע (הושלם/מתוכנן/בהמשך), בלתי-תלוי ב-pinned -
    // synced/laterIds מסוננים לפי נעיצות (ראו computeSyncedElectives) ולכן
    // לא מתאימים לקביעת "האם מסומן ב-FinDeg" כאן. סימון FinDeg הוא מקור-אמת:
    // ה-checkbox שלו תמיד מסומן ונעול - מסירים אותו ב-FinDeg עצמו, לא כאן
    // (בקשת המשתמש/ת, 2026-07-21: "אם מסומן 'בהמשך' או 'מתוכנן' - שיסמן את
    // התיבה, זהו").
    const rawSync = readFindegSync();
    const rawOv = rawSync && rawSync.trackKey === trackKey ? (rawSync.overrides || {}) : {};
    const rawPassed = new Set(rawSync && rawSync.trackKey === trackKey ? (rawSync.passedIds || []) : []);
    const findegStatus = id => rawPassed.has(id) || rawOv[id] === "done" ? "done"
      : rawOv[id] === "planned" ? "planned"
      : rawOv[id] === "later" ? "later" : null;
    wrap.innerHTML = "";
    wrap.appendChild(el("h2", null, "מקצועות בחירה"));
    // ב"תכנון אופטימלי" וב"תכנון ידני" בחירת הסמסטר בפאנל הזה לעולם לא נקראת -
    // שני התצוגות מעבירות ל-FINDEG_OPTIMIZER.computePlan רק את *מזהי* המקצועות
    // הנעוצים (Object.keys(pinned), ראו renderOptimizerView/renderManualView),
    // האלגוריתם (או הגרירה הידנית, בתכנון ידני) קובע את הסמסטר בפועל - ערך
    // הסמסטר הספציפי שנבחר כאן היה מתעלם בשקט, מטעה. לכן בשתי התצוגות האלה
    // הפאנל מציג רק "רוצה/לא רוצה" (checkbox), לא בחירת-סמסטר (בקשת המשתמש/ת,
    // 2026-07-17/2026-07-21). ב"המסלול המומלץ" (mode==="intended") הסמסטר
    // עדיין קובע מיקום אמיתי בתרשים הקבוע, אז נשאר תפריט-נפתח.
    const useToggle = mode === "optimizer" || mode === "manual";
    wrap.appendChild(el("p", "section-note", mode === "optimizer"
      ? 'ה-checkbox מציג מה נכלל בתוכנית למעלה בפועל: סימון מוסיף מקצוע (האלגוריתם יבחר לו סמסטר), ' +
        "הסרת סימון מוציאה אותו - גם אם נבחר אוטומטית למילוי מכסה (האלגוריתם יבחר חלופה או יתריע שחסר). " +
        "מקצועות עם 📗 כבר הושלמו או מתוכננים ב-FinDeg ונכללים אוטומטית."
      : mode === "manual"
        ? 'סמנו את המקצועות שאתם/ן רוצים לכלול בתוכנית - גררו אותם אחר-כך לסמסטר הרצוי בתרשים למעלה. ' +
          "מקצועות עם 📗 כבר הושלמו או מתוכננים ב-FinDeg ונכללים אוטומטית; 🗓️ סומנו שם \"בהמשך\" - לא נכללים אוטומטית, רק מסומנים כאן."
        : 'בחרו סמסטר מהתפריט הנפתח ליד כל מקצוע כדי לנעוץ אותו בתרשים למעלה; "— לא נבחר —" מחזיר אותו לכאן. ' +
          "מקצועות עם 📗 כבר הושלמו או מתוכננים ב-FinDeg ומופיעים בתרשים אוטומטית; 🗓️ סומנו שם \"בהמשך\" " +
          "(לא בסמסטר הזה/הבא) - לא ממוקמים אוטומטית, רק מסומנים כאן."));

    for (const group of chainPools(yd)) {
      if (!group.pool.length) continue;
      const chainEl = el("div", "fc-chain");
      chainEl.appendChild(el("h3", null, esc(group.title)));
      if (group.minNote) chainEl.appendChild(el("p", "fc-chain-note", group.minNote));
      const row = el("div", "fc-chip-row");
      for (const id of group.pool) {
        const isPinned = pinned[id] != null;
        const syncInfo = synced[id];
        const isLaterSynced = !isPinned && laterIds.has(id);
        // במצבי-toggle (אופטימלי/ידני) ה-chip לא מקבל את מחלקת/תג ה"נעיצה"
        // (pinned/📌) - סימון checkbox שינה את צבע ה-chip בלי שום משמעות
        // נוספת, וזה רק בלבל (בקשת המשתמש/ת, 2026-07-21). הצבעים שנשארים
        // הם רק סטטוסי FinDeg (הושלם/מתוכנן/בהמשך) - עובדות חיצוניות, לא
        // מצב ה-checkbox עצמו.
        const showPinStyle = !useToggle && isPinned;
        const chip = el("span", "fc-chip" + (showPinStyle ? " pinned" : "") + (syncInfo ? " synced" : "") + (isLaterSynced ? " synced-later" : ""));
        const p = pts(id);
        const tag = showPinStyle ? "📌 " : syncInfo ? (syncInfo.status === "done" ? "📗 " : "📘 ") : isLaterSynced ? "🗓️ " : "";
        chip.innerHTML = tag + esc(cname(id)) +
          ' <small>(' + id.slice(2, 8) + (p != null ? " · " + fmtPts(p) + " נק'" : "") + ')</small> ' + semBadge(id);
        if (useToggle) {
          // "נעיצה" כאן אומרת רק "רוצה לכלול" - בלי סמסטר ספציפי (ראו הערה
          // מעל renderElectives). הערך שנשמר הוא eligibleSemesters(id)[0]
          // (שרירותי, לא נקרא בתכנון אופטימלי/ידני) כדי שהסימון יתנהג סביר
          // גם במעבר ל"המסלול המומלץ".
          // מצב הסימון בתכנון אופטימלי = "נמצא בתוכנית בפועל" (כולל פיקים
          // אוטומטיים למילוי מכסה, optPlacedElectiveIds) - לא רק "ננעץ
          // ידנית": מקצוע שמופיע למעלה חייב להופיע מסומן גם כאן, אחרת
          // הפאנל משקר (בקשת המשתמש/ת, 2026-07-21).
          const label = el("label", "fc-want-toggle");
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.dataset.wantToggle = id;
          // סימון FinDeg (הושלם/מתוכנן/בהמשך) = מקור-אמת: תמיד מסומן, ונעול -
          // ההסרה נעשית ב-FinDeg עצמו (שם הסימון נוצר), לא כאן. לשאר: מסומן
          // אם בתוכנית בפועל (אופטימלי, optPlacedElectiveIds) או ננעץ (ידני).
          const st = findegStatus(id);
          if (st) {
            cb.checked = true;
            cb.disabled = true;
            label.title = st === "done"
              ? "כבר הושלם - מנוכה מהדרישות אוטומטית"
              : "מסומן ב-FinDeg (" + (st === "planned" ? "מתוכנן" : "בהמשך") + ") ולכן נכלל תמיד בתוכנית - כדי להסיר, שנו את הסימון ב-FinDeg";
          } else {
            cb.checked = mode === "optimizer" ? (isPinned || optPlacedElectiveIds.has(id)) : isPinned;
          }
          label.appendChild(cb);
          label.appendChild(document.createTextNode(" לכלול"));
          chip.appendChild(label);
        } else {
          const select = el("select");
          select.dataset.pinSelect = id;
          const noneOpt = el("option", null, "— לא נבחר —");
          noneOpt.value = "";
          select.appendChild(noneOpt);
          for (const semNum of eligibleSemesters(id)) {
            const o = el("option", null, "סמסטר " + semNum);
            o.value = String(semNum);
            if (pinned[id] === semNum) o.selected = true;
            select.appendChild(o);
          }
          if (syncInfo && pinned[id] == null) select.title = "כרגע ממוקם אוטומטית לפי FinDeg - בחירה כאן תנעץ אותו ידנית";
          else if (isLaterSynced) select.title = "מסומן \"בהמשך\" ב-FinDeg - לא ממוקם אוטומטית; בחירה כאן תנעץ אותו לסמסטר ספציפי";
          chip.appendChild(select);
        }
        row.appendChild(chip);
      }
      chainEl.appendChild(row);
      wrap.appendChild(chainEl);
    }
  }

  // ---------- חצים (SVG) ----------
  // מוכללת (במקור בנויה רק בשביל "המסלול המומלץ") כדי שגם "תכנון ידני"
  // (renderManualView) יוכל לצייר את אותם חצי דרישות-קדם מעל הרשת שלו -
  // שני התצוגות חולקות בדיוק אותו מבנה-שכבות (עמודת-סמסטר = "שורה" עם
  // data-sem-num, ראו .fco-sem-col/renderManualView), רק ה-DOM selectors
  // שונים (pageSel/rowSel/svgSel) - הליבה הגיאומטרית (lanes/gutters/bends)
  // זהה, אין טעם לשכפל ~140 שורה בשביל שינוי שמות מחלקה בלבד
  // (בקשת המשתמש/ת, 2026-07-16: "גם בתכנון ידני צריך חצים מדרישת קדם לתלוי").
  // boxScopeSel (אופציונלי, ברירת מחדל pageSel) - שונה מ-pageSel רק ב"תכנון
  // ידני": pageSel (#fc-manual-page) הוא עוגן הקואורדינטות (position:relative,
  // מכיל גם את ה-svg עצמו), אבל תיבות ה"מגירה" הלא-ממוקמת (fcm-tray, גם היא
  // בתוך #fc-manual-page) לא אמורות להיות קצה-חץ - רק תיבות שבאמת בתוך הרשת
  // (#fcm-wrap) כן.
  function drawArrowsIn(pageSel, rowSel, svgSel, boxScopeSel) {
    const svg = $(svgSel);
    const page = $(pageSel);
    if (!svg || !page) return;
    svg.innerHTML = "";
    const pageRect = page.getBoundingClientRect();
    svg.setAttribute("width", page.scrollWidth);
    svg.setAttribute("height", page.scrollHeight);

    const boxes = {};
    document.querySelectorAll((boxScopeSel || pageSel) + " [data-course-id]").forEach(elm => {
      const id = elm.dataset.courseId;
      const r = elm.getBoundingClientRect();
      // אם אותו מקצוע מוצג כמה פעמים (למשל מקום פנוי + פינוי), משתמשים בהופעה הראשונה
      if (!boxes[id]) {
        boxes[id] = {
          x: r.left - pageRect.left, y: r.top - pageRect.top, w: r.width, h: r.height,
          semNum: elm.dataset.semNum ? +elm.dataset.semNum : null
        };
      }
    });

    const rows = {};
    document.querySelectorAll(rowSel).forEach(rowElm => {
      const r = rowElm.getBoundingClientRect();
      rows[+rowElm.dataset.semNum] = { top: r.top - pageRect.top, bottom: r.bottom - pageRect.top };
    });

    const visibleIds = Object.keys(boxes);
    const critical = criticalEdges;

    svg.innerHTML =
      '<defs>' +
      '<marker id="fc-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="var(--accent)"/></marker>' +
      '<marker id="fc-arrow-crit" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="var(--bad)"/></marker>' +
      "</defs>";

    // קו ישר בלבד (מקטעים אנכיים/אופקיים בזווית ישרה בלבד, לא עקומה, ולא נתיב
    // חיצוני מסביב לתרשים) - המעבר האופקי תמיד קורה בתוך המרווח שבין שורת
    // המקור לשורת היעד. גובה-המעבר של כל חץ לא אקראי: חצים שחולפים באותו מרווח
    // (אותו זוג שורות) מקבלים "מסלול" (lane) לפי קינון-מרווחים (assignLanes) -
    // חץ שה-x שלו מוכל לגמרי בתוך חץ אחר יורד למסלול פנימי יותר, וחצים
    // שלא חופפים כלל ב-x חוזרים לאותו מסלול חיצוני - כך שני חצים לא חולקים
    // מקטע אופקי אלא אם יש להם צומת אמיתי (מקצוע משותף).
    function assignLanes(edges) {
      const withRange = edges.map(e => ({ ...e, lo: Math.min(e.x1, e.x2), hi: Math.max(e.x1, e.x2) }));
      withRange.sort((a, b) => a.lo - b.lo || b.hi - a.hi);
      const stack = [];
      const laneOf = {};
      let maxLane = 0;
      for (const e of withRange) {
        while (stack.length && stack[stack.length - 1].hi <= e.lo) stack.pop();
        const lane = stack.length;
        laneOf[e.key] = lane;
        maxLane = Math.max(maxLane, lane);
        stack.push({ hi: e.hi, lane });
      }
      return { laneOf, maxLane };
    }

    function buildPoints(a, b, frac) {
      const x1 = a.x + a.w / 2, y1 = a.y + a.h;
      const x2 = b.x + b.w / 2, y2 = b.y;
      if (a.semNum == null || b.semNum == null) {
        // אחד הצדדים אינו בתוך הרשת (למשל מקצוע בחירה שטרם ננעץ) - קו ישר פשוט
        return [[x1, y1], [x2, y2]];
      }
      const gutterTop = rows[a.semNum] ? rows[a.semNum].bottom : y1;
      const gutterBottom = rows[b.semNum] ? rows[b.semNum].top : y2;
      const bendY = gutterTop + (gutterBottom - gutterTop) * frac;
      return [[x1, y1], [x1, bendY], [x2, bendY], [x2, y2]];
    }

    function drawLine(fromId, toId, dashed, frac) {
      const a = boxes[fromId], b = boxes[toId];
      const isCrit = critical.has(fromId + "->" + toId);
      const pts2 = buildPoints(a, b, frac);
      const d = pts2.map((p, i) => (i === 0 ? "M" : "L") + p[0] + "," + p[1]).join(" ");
      const baseOpacity = isCrit ? 1 : 0.3;
      const baseWidth = isCrit ? 2.5 : 1;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", isCrit ? "var(--bad)" : "var(--accent)");
      path.setAttribute("stroke-width", baseWidth);
      path.setAttribute("stroke-linejoin", "round");
      if (dashed) path.setAttribute("stroke-dasharray", "5,4");
      path.setAttribute("marker-end", isCrit ? "url(#fc-arrow-crit)" : "url(#fc-arrow)");
      path.setAttribute("opacity", baseOpacity);
      path.dataset.from = fromId;
      path.dataset.to = toId;
      path.dataset.crit = isCrit ? "1" : "0";
      path.dataset.baseOpacity = baseOpacity;
      path.dataset.baseWidth = baseWidth;
      svg.appendChild(path);
    }

    // אוספים את כל הקשתות שאמורות להצטייר קודם (בלי לצייר) - מקצוע שהושלם לא
    // צריך יותר חץ יוצא ממנו (הדרישה שהוא ייצג כבר מומשה, ראו doneIds) וגם לא
    // חץ נכנס אליו (אם המקצוע עצמו כבר הושלם, אין עוד "דרישה תלויה וממתינה"
    // להציג עליו - אחרת חץ קריטי אדום נשאר תקוע מעל תיבה שכבר הפכה אפורה).
    const edgeList = [];
    for (const id of visibleIds) {
      if (doneIds.has(id)) continue;
      const p = PREREQ[id];
      if (!p) continue;
      for (const src of (p.prereq || [])) {
        if (boxes[src] && !doneIds.has(src)) edgeList.push({ from: src, to: id, dashed: false });
      }
      for (const src of (p.adjoining || [])) {
        if (boxes[src] && !doneIds.has(src)) edgeList.push({ from: src, to: id, dashed: true });
      }
    }

    // מקבצים לפי זוג-שורות (אותו מרווח) כדי לחשב מסלולים (lanes) בנפרד לכל מרווח
    const byGutter = new Map();
    edgeList.forEach((e, i) => {
      const a = boxes[e.from], b = boxes[e.to];
      const key = a.semNum + "_" + b.semNum;
      if (!byGutter.has(key)) byGutter.set(key, []);
      byGutter.get(key).push({
        key: i,
        x1: a.x + a.w / 2, x2: b.x + b.w / 2
      });
    });
    const laneById = {};
    const maxLaneByGutter = {};
    for (const [key, edges] of byGutter) {
      const { laneOf, maxLane } = assignLanes(edges);
      Object.assign(laneById, laneOf);
      maxLaneByGutter[key] = maxLane;
    }

    edgeList.forEach((e, i) => {
      const a = boxes[e.from], b = boxes[e.to];
      const key = a.semNum + "_" + b.semNum;
      const maxLane = maxLaneByGutter[key];
      const lane = laneById[i] || 0;
      const frac = maxLane > 0 ? 0.15 + 0.7 * (lane / maxLane) : 0.5;
      drawLine(e.from, e.to, e.dashed, frac);
    });
  }
  function drawArrows() { drawArrowsIn("#fc-page", "#fc-page .fc-row", "#fc-svg"); }
  // "תכנון ידני" - אותו מנגנון, על .fco-sem-col בתוך #fcm-wrap בלבד (לא
  // #fcm-tray - תיבות במגירה הלא-ממוקמת לא אמורות לקבל חצים, ראו הערה מעל
  // drawArrowsIn). pageSel נשאר #fc-manual-page (עוגן הקואורדינטות של ה-svg).
  function drawManualArrows() { drawArrowsIn("#fc-manual-page", "#fcm-wrap .fco-sem-col", "#fcm-svg", "#fcm-wrap"); }
  // "תכנון אופטימלי" - כל מקצוע כבר משובץ (אין "מגירה" לא-ממוקמת כמו בתכנון
  // ידני), אז boxScopeSel יכול פשוט להיות ברירת המחדל (pageSel עצמו). מטרת
  // החצים כאן שונה מהשתיים האחרות: לא "תכנון" (הכול כבר קבוע ע"י האלגוריתם),
  // אלא הסבר - למה מקצוע מסוים נחת דווקא בסמסטר הזה (בקשת המשתמש/ת, 2026-07-21:
  // "שיהיה יותר מובן למה משהו הושם איפשהו").
  function drawOptimizerArrows() { drawArrowsIn("#fc-opt-page", "#fco-grid .fco-sem-col", "#fco-svg"); }

  // ---------- ערפל חזותי מעל שורות-סמסטר שכבר חלפו (ראו computeCompletedSemesters) ----------
  // מצוירים כ-div-ים עצמאיים שהם אחים ישירים של #fc-svg בתוך #fc-page (לא
  // בתוך .fc-row עצמה) - בדיוק כמו שהחצים ממוקמים יחסית ל-pageRect, כדי
  // שה-z-index יעבוד באופן ודאי מול ה-svg (שכבר יושב מעל התיבות, ראו
  // drawArrows) בלי תלות בהקשרי ערימה (stacking context) מקוננים.
  //
  // שורות רצופות שחלפו (לפי סדר-התצוגה בפועל - .fc-row, לא לפי מספר-סמסטר
  // גולמי: דחיפה קדימה של מקצועות שטרם הושלמו, ראו computeSemNumMap, עלולה
  // לרוקן שורה שלמה ולהעלים אותה מה-DOM, כך שה"רצף" הוויזואלי לא בהכרח שווה
  // לרצף המספרים) מאוחדות לתיבת-ערפל אחת גדולה שמשתרעת גם על הרווח שביניהן
  // (gap של .fc-grid) - במקום תיבה נפרדת לכל שורה עם רווח ריק ביניהן, שנראה
  // כמו כמה "טלאי ערפל" מנותקים במקום ענן אחד רציף (בקשת המשתמש, 2026-07-11).
  function drawFog() {
    const page = $("#fc-page");
    document.querySelectorAll("#fc-page > .fc-fog").forEach(e => e.remove());
    const pageRect = page.getBoundingClientRect();
    const completed = computeCompletedSemesters();
    const rows = [...document.querySelectorAll("#fc-page .fc-row")];
    let i = 0;
    while (i < rows.length) {
      if (!completed.has(+rows[i].dataset.semNum)) { i++; continue; }
      let j = i;
      while (j + 1 < rows.length && completed.has(+rows[j + 1].dataset.semNum)) j++;
      const top = rows[i].getBoundingClientRect();
      const bottom = rows[j].getBoundingClientRect();
      const fog = el("div", "fc-fog");
      fog.title = j > i ? "הסמסטרים האלה כבר חלפו" : "הסמסטר הזה כבר חלף";
      fog.style.top = (top.top - pageRect.top - 6) + "px";
      fog.style.left = (top.left - pageRect.left - 6) + "px";
      fog.style.width = (top.width + 12) + "px";
      fog.style.height = (bottom.bottom - top.top + 12) + "px";
      page.appendChild(fog);
      i = j + 1;
    }
  }

  // ---------- הדגשה בהעברת עכבר: מבודד את החצים של מקצוע אחד ----------
  function highlightCourse(id) {
    document.querySelectorAll("#fc-svg path[data-from]").forEach(p => {
      const related = p.dataset.from === id || p.dataset.to === id;
      p.setAttribute("opacity", related ? "1" : "0.06");
      p.setAttribute("stroke-width", related ? (p.dataset.crit === "1" ? "3" : "2") : p.dataset.baseWidth);
    });
  }
  function clearHighlight() {
    document.querySelectorAll("#fc-svg path[data-from]").forEach(p => {
      p.setAttribute("opacity", p.dataset.baseOpacity);
      p.setAttribute("stroke-width", p.dataset.baseWidth);
    });
  }
  function setupHoverHighlight() {
    document.getElementById("fc-page").addEventListener("mouseover", e => {
      const box = e.target.closest("[data-course-id]");
      if (box) highlightCourse(box.dataset.courseId);
    });
    document.getElementById("fc-page").addEventListener("mouseout", e => {
      const box = e.target.closest("[data-course-id]");
      if (!box) return;
      const to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest("[data-course-id]");
      if (!to) clearHighlight();
    });
  }

  // ---------- רינדור מלא ----------
  function render() {
    if (!hasIntendedData(trackKey)) {
      $("#fc-grid").innerHTML = '<div class="warn-box">עדיין אין "מסלול מומלץ" ידני למסלול הזה - נסו את הטאב "⚡ תכנון אופטימלי" למעלה.</div>';
      $("#fc-svg").innerHTML = "";
      const h1 = $("#fc-title");
      if (h1) h1.textContent = "🗺️ תרשים זרימה — " + track().name;
      return;
    }
    const semNumMap = computeSemNumMap();
    const crit = computeCriticalPath(semNumMap);
    criticalNodes = crit.nodes;
    criticalEdges = crit.edges;
    criticalSpan = crit.span;
    doneIds = computeDoneIds();
    generalNames = {}; // אין מקצועות-ספורט/מל"ג סינתטיים בתצוגת "המסלול המומלץ"
    renderGrid();
    // renderElectives() עבר להיקרא מרכזית מ-renderCurrent (לא כאן) - הפאנל
    // משותף לשתי התצוגות (מומלץ/אופטימלי), ראו fc-electives ב-flowcharts.html.
    const note = $("#fc-crit-note");
    if (note) {
      note.textContent = criticalSpan
        ? "השרשרת המסומנת באדום: " + (criticalNodes.size) + " מקצועות, מרחק של " + criticalSpan + " סמסטרים בין הראשון לאחרון."
        : "";
    }
    const h1 = $("#fc-title");
    if (h1) {
      const t = track();
      const specSuffix = t.hasSpecialization && yearData() ? " (" + yearData().name + ")" : "";
      h1.textContent = "🗺️ תרשים זרימה — " + t.name + specSuffix;
    }
    // חצים וערפל מחושבים אחרי שהדפדפן סידר את הלייאאוט
    requestAnimationFrame(() => { drawArrows(); drawFog(); });
  }

  // ---------- הקשר משותף לתצוגות "תכנון אופטימלי" ו"תכנון ידני" ----------
  // שתיהן מריצות בדיוק אותו FINDEG_ENGINE.evaluate() על אותו synthParsed
  // (מבוסס על סנכרון FinDeg) - רק ההצגה/עריכה שלאחר מכן שונה. yd==null מסמן
  // "אין נתוני קטלוג לשנה שנבחרה" לקורא - כל תצוגה מציגה הודעה משלה ומחזירה.
  function buildOptimizerContext() {
    const t = track();
    const yd = t.years[yearKey];
    if (!yd) return { t, yd: null };
    const sync = readFindegSync();
    const synced = sync && sync.trackKey === trackKey;
    const overrides = synced ? (sync.overrides || {}) : {};
    // "הושלם" יכול להגיע גם מהתדפיס (passedIds) וגם מסימון ידני ב-FinDeg
    // (overrides[id]==="done" - למשל פטור/שקילות שאושרו במזכירות) - שניהם
    // צריכים לספור כ"הושלם בפועל" גם כאן, לא רק בתצוגת "המסלול המומלץ"
    // (ראו computeDoneIds למעלה, אותו עיקרון). "מתוכנן" (planned) לעומת זאת
    // *לא* נכנס לרשימת ה"הושלם" - הוא רק מספק את הדרישה (עובר ל-overrides
    // למטה, ש-FINDEG_ENGINE.evaluate כבר יודע לטפל בו), בלי לפתוח דרישות קדם
    // מוקדם מדי עבור מקצוע שטרם באמת נלמד.
    const passedIds = synced
      ? [...new Set([...(sync.passedIds || []), ...Object.keys(overrides).filter(id => overrides[id] === "done")])]
      : [];
    // pts חיוני ולא קישוט: evalChoosePoints (engine.js) סוכם rec.pts של
    // מקצועות שהושלמו - רשומה סינתטית בלי pts נספרת כ-0 נק', ומאגרי-נקודות
    // (כמו "סה"כ בחירה בקבוצות א'+ב'") לעולם לא היו מגיעים ל"מסופק" בעמוד
    // הזה, גם כשבפועל הושלמו כל הנקודות - מה שגרר "ממלאי מקום" אוטומטיים
    // מיותרים בתכנון האופטימלי (נתפס - בקשת המשתמש/ת, 2026-07-21).
    // D.coursePoints מכסה את כל מקצועות-הבחירה שבמאגרים (שם זה נצרך);
    // למקצועות חובה אין אותו שם אבל גם אין צורך - הנקודות שלהם מגיעות
    // מ-item.pts של המסלול, לא מהרשומה.
    const synthParsed = { courses: passedIds.map(id => ({ id, passed: true, pts: D.coursePoints[id] })), studentName: null };
    // manual (מקצועות "הוספת מקצוע" ב-FinDeg, כולל מל"ג/ספורט/בחירה חופשית
    // שסומנו הושלם/מתוכנן) - היה תמיד [] קשיח כאן, למרות ש-sync.manual כבר
    // מכיל אותם (syncFlowchart ב-js/app.js): מקצוע מל"ג שכבר הושלם/תוכנן שם
    // המשיך "לדרוש" את כל תיבות המילוי הסינתטיות מחדש בתרשים, כאילו לא נעשה
    // כלום (נתפס - בקשת המשתמש/ת, 2026-07-24). ראו גם scheduleGeneralEd
    // ב-optimizer.js שעכשיו גם מציג "מתוכנן" בשמו האמיתי, לא רק מנכה נקודות.
    const manual = synced ? (sync.manual || []) : [];
    const res = FINDEG_ENGINE.evaluate(synthParsed, trackKey, yearKey, {
      specialization: specKey, projectKey: projectKey || null, overrides, categories: {}, manual
    });
    return { t, yd, sync, synced, passedIds, synthParsed, res };
  }

  // בודק אם דרישת-הקדם של id מתמלאת בפועל, לפי מפת-מיקומים נתונה (posAll:
  // id -> מספר-סמסטר, יחסי או מוחלט - לא משנה כל עוד עקבי לשני הצדדים של
  // ההשוואה) ומה שכבר הושלם (doneIdsSet). משותף לתצוגות "תכנון ידני"/"תכנון
  // אופטימלי" - שתיהן צריכות בדיוק את אותה בדיקה (מקצוע ש"נדחף" ידנית לפני
  // דרישת הקדם שלו, או שדרישת הקדם שלו נדחפה *אחרי* מקום שכבר תלוי בו, ראו
  // renderOptimizerView למטה - בקשת המשתמש/ת, 2026-07-24). אם אף חלופה
  // (OR) של אף אחד מהשקולים (equivSet) לא הושלמה/ממוקמת מוקדם מספיק *וגם*
  // לא ממוקמת בכלל כרגע - לא חוסמים (כמו computeEPS הלא-strict): אין מספיק
  // מידע כדי לדעת אם זו בעיה אמיתית (בקשת המשתמש/ת, 2026-07-16).
  function prereqSatisfiedAt(id, posAll, doneIdsSet) {
    const groups = D.coursePrereqs[id];
    if (!groups || !groups.length) return true;
    return groups.some(g => g.every(pid => {
      const eq = FINDEG_ENGINE.equivSet(pid) || [pid];
      if (eq.some(e => doneIdsSet.has(e))) return true;
      const scheduled = eq.map(e => posAll[e]).filter(v => v != null);
      return !scheduled.length || Math.min(...scheduled) < posAll[id];
    }));
  }

  // ---------- תצוגת "תכנון אופטימלי" (js/optimizer.js) ----------
  // מציגה גם תג "!" על מקצוע שדרישת הקדם שלו לא מתמלאת בפועל במיקום הנוכחי
  // (prereqSatisfiedAt) - התוכנית המחושבת-מראש בד"כ כן מכבדת דרישות קדם
  // מבפנים, *חוץ* ממקצועות שנעוצים ידנית (hardPins, גרירה): repairPrereqOrder
  // מדלג עליהם בכוונה (בחירת המשתמש/ת גוברת) - בלעדי הבדיקה כאן, גרירה
  // שיוצרת סתירה כזו הייתה משאירה את זה לחלוטין בלי שום סימן (נתפס - בקשת
  // המשתמש/ת, 2026-07-24: "the problematic course would be flagged").
  function renderOptimizerView() {
    const grid = $("#fco-grid"), summary = $("#fco-summary"), note = $("#fco-sync-note");
    const { t, yd, sync, synced, passedIds, synthParsed, res } = buildOptimizerContext();
    // סטטוס בחירה פר-מקצוע, לצביעת התיבות למטה ולהעדפת מילוי (preferredIds):
    // "בהמשך"/"מתוכנן" ב-FinDeg = בחירה מפורשת של המשתמש/ת (כחול), כל מילוי
    // אוטומטי אחר = פיק של האלגוריתם בלבד (בורדו) - חייב להיות מזוהה ככזה,
    // אחרת נראה כאילו המקצוע "חובה" כשהוא בעצם ממלא-מקום שאפשר להחליף
    // (בקשת המשתמש/ת, 2026-07-21).
    const syncOverrides = synced && sync ? (sync.overrides || {}) : {};
    const laterSet = new Set(Object.keys(syncOverrides).filter(id => syncOverrides[id] === "later"));
    const plannedSet = new Set(Object.keys(syncOverrides).filter(id => syncOverrides[id] === "planned"));
    // סימון FinDeg (מתוכנן/בהמשך) גובר על ביטול מקומי ישן (excluded) - סימון
    // כזה הוא בחירה מפורשת ועדכנית ב-FinDeg, בעוד ה-excluded המקומי נשאר
    // מפעם ("untick" ישן שנשכח) וחסם בשקט את השיבוץ בלי שום סימן נראה
    // (בקשת המשתמש/ת, 2026-07-21: מקצועות "בהמשך" לא הופיעו בתרשים בכלל).
    let excludedCleared = false;
    for (const id of [...laterSet, ...plannedSet]) {
      if (excluded[id]) { delete excluded[id]; excludedCleared = true; }
    }
    if (excludedCleared) saveState();
    if (!yd) {
      if (grid) grid.innerHTML = '<div class="warn-box">אין נתוני קטלוג לשנה שנבחרה.</div>';
      if (summary) summary.innerHTML = "";
      const svg0 = $("#fco-svg"); if (svg0) svg0.innerHTML = "";
      return;
    }
    if (note) {
      note.textContent = synced
        ? "🔗 מסונכרן עם FinDeg (" + passedIds.length + ' מקצועות שהושלמו מנוכים אוטומטית).'
        : "אין נתוני FinDeg מסונכרנים למסלול הזה כרגע - התוכנית מחושבת מאפס (בהנחה שטרם הושלם מקצוע).";
    }
    if (res.unsupported || res.noYear) {
      if (grid) grid.innerHTML = '<div class="warn-box">המסלול הזה עדיין לא נתמך.</div>';
      if (summary) summary.innerHTML = "";
      const svg0 = $("#fco-svg"); if (svg0) svg0.innerHTML = "";
      return;
    }
    // מטרת "מינימום סמסטרים" מבוטאת כאן כ-capPts=0 (falsy) - מבטל את כל בדיקות
    // תקרת הנק'/סמסטר בתוך FINDEG_OPTIMIZER (שלב 3/fillElectives/repairPrereqOrder,
    // כולן כתובות כ-`if (capPts && ...)`) בלי לגעת באלגוריתם עצמו: המקצועות
    // נדחסים הכי צפוף שדרישות קדם/עונות מאפשרות, בלי לפזר בגלל עומס נק' - בדיוק
    // "מינימום סמסטרים" מבלי לשנות שורת קוד אחת ב-optimizer.js.
    // "עומס מאוזן" ו"דחיסה מוקדמת עד תקרה" הן שתי התקרות היחידות שניתנות
    // לכיוונון ע"י המשתמש/ת (השם "עד תקרה" מבטיח את זה במפורש) - כל אחת עם
    // המשתנה שלה (optCapPts/optFrontloadCapPts), לא משותפות: שינוי הסליידר
    // במצב אחד לא אמור "לדלוף" ולשנות בשקט גם את ההתנהגות במצב השני (בקשת
    // המשתמש/ת, 2026-07-21). "מומלץ" (taper) ממשיכה להשתמש בברירת המחדל
    // הקבועה של buildTaperCap עצמה (taperPeak=undefined) - אין לה תקרה
    // מבוטאת בשם שלה, אז לא נחשפת כפרמטר מכוונן.
    const effectiveCapPts = optGoal === "points" ? optCapPts
      : optGoal === "frontload" ? optFrontloadCapPts
      : optGoal === "semesters" ? 0
      : undefined;
    // materializedPlan (state ברמת המודול, למעלה) - התוכנית "מוקפאת" ברגע
    // שחושבה, ולא מחושבת מחדש בכל render: רק ב-null (ביקור ראשון בתצוגה הזו/
    // אחרי "הרץ מחדש"/איפוס/שינוי מסלול-שנה-התמחות-פרויקט) נריץ את
    // FINDEG_OPTIMIZER.computePlan בפועל. גרירה (drop handler למטה) עורכת את
    // materializedPlan.plan *ישירות* בלי לגעת כאן בכלל - "הפונקציה שמארגנת
    // מחדש את התרשים צריכה לרוץ רק בלחיצה על הרצה/איפוס או ברענון הדף", לא
    // בכל גרירה או בכל שינוי הגדרה (יעד/תקרה) - אלה נשמרים כהעדפה ל"הרצה"
    // הבאה בלבד, לא מיושמים מיד (בקשת המשתמש/ת, 2026-07-25).
    if (!materializedPlan) {
      materializedPlan = FINDEG_OPTIMIZER.computePlan(res, synthParsed,
        { trackKey, specialization: specKey, projectKey: projectKey || null, capPts: effectiveCapPts,
          frontload: optGoal === "frontload", taper: optGoal === "recommended",
          startSeason: optStartSeason || undefined, yearKey, pinnedIds: Object.keys(pinned), hardPins,
          preferredIds: [...laterSet], excludedIds: Object.keys(excluded) });
    }
    const plan = materializedPlan;

    // כל מקצוע-בחירה שנחת בתוכנית בפועל (מכל סיבה) - קובע את מצב ה-checkbox
    // בפאנל למטה (ראו optPlacedElectiveIds למעלה).
    optPlacedElectiveIds = new Set(
      plan.notes.filter(n => n.kind === "elective" || n.kind === "hard-pin").map(n => n.id));

    doneIds = new Set(passedIds);
    // criticalNodes/criticalEdges מאופסים כאן (לא רק criticalNodes) - שני
    // המשתנים הם state ברמת המודול המשותף עם render() (המסלול המומלץ), שכן
    // כן מחשב שרשרת קריטית אמיתית; בלי לאפס גם criticalEdges כאן, מעבר
    // מ"המסלול המומלץ" ל"תכנון אופטימלי" היה משאיר חצים אדומים (קריטיים)
    // מהתצוגה הקודמת דלוקים בטעות מעל התרשים הזה (בקשת המשתמש/ת, 2026-07-21:
    // הוספת חצים לתכנון אופטימלי).
    criticalNodes = new Set();
    criticalEdges = new Set();
    generalNames = plan.generalNames || {};

    // plan.plan הוא תמיד יחסי (index 1 = "הסמסטר הבא") - plan.planAnchorSemester
    // הוא ההיסט להצגה כמספר-סמסטר אמיתי, לא רק "1,2,3..." - כמו nominalSemester
    // (תאריך אמיתי + yearKey) אבל מתקדם עוד סמסטר אחד כשה-startSeason נדרס/ה
    // ידנית לדלג על סמסטר שכבר תוכנן בנפרד (ראו הערה ב-computePlan,
    // optimizer.js - בקשת המשתמש/ת, 2026-07-17). nominalSemester הגולמי עדיין
    // משמש בנפרד לצ'יפ "נומינלית כרגע בסמסטר X" ולבדיקת overdueIds - שני אלה
    // עובדתיים-תאריכיים ולא אמורים לזוז בגלל בחירת-תכנון.
    const semOffset = plan.planAnchorSemester != null ? plan.planAnchorSemester - 1 : 0;

    if (summary) {
      // plan.totalSemesters (אורך התוכנית המשובצת בפועל) עשוי להיות גדול
      // מ-plan.criticalPathSemesters (הגבול התחתון התיאורטי - השרשרת הכי
      // ארוכה שנותרה, כולל מאגרי בחירה פתוחים ועונתיות, ראו
      // computeOpenPoolsMinSemesters ב-optimizer.js) - למשל כשמקצועות-בחירה
      // אוטומטיים שנבחרו למילוי מאגר דוחקים זה את זה לסמסטרים נוספים גם
      // כשהיה אפשרי מתמטית למלא את אותו מאגר מהר יותר עם בחירה אחרת. מציגים
      // את שניהם כשהם שונים - "בפועל" קודם (מה שבאמת מוצג למטה) ו"תיאורטי"
      // כהערה, לא ההפך, כדי לא להטעות שהתוכנית המוצגת כבר בת-הגבול-התחתון.
      const gap = plan.totalSemesters > plan.criticalPathSemesters;
      summary.innerHTML = '<span class="chip">' + plan.totalSemesters + " סמסטרים</span>" +
        (gap
          ? ' <span class="chip" style="background:var(--warn-soft);color:var(--warn)" title="השרשרת הכי ארוכה שנותרה (כולל מאגרי בחירה פתוחים ועונתיות) מאפשרת תיאורטית לסיים מהר יותר - הפער נובע ממקצועות-בחירה ספציפיים שנבחרו אוטומטית">מינימום תיאורטי: ' + plan.criticalPathSemesters + " סמסטרים</span>"
          : "") +
        (plan.nominalSemester != null
          ? ' <span class="chip" title="לפי תאריך תחילת הלימודים בפועל">נומינלית כרגע בסמסטר ' + plan.nominalSemester + "</span>"
          : "") +
        (plan.overdueIds && plan.overdueIds.length
          ? ' <span class="chip" style="background:var(--bad-soft);color:var(--bad)">⚠️ ' + plan.overdueIds.length +
            " מקצועות בפיגור מסמסטרים קודמים</span>"
          : "") +
        (plan.unplacedPools.length
          ? ' <span class="chip" style="background:var(--warn-soft);color:var(--warn)">⚠️ לא כל משבצות הבחירה שובצו</span>'
          : "");
    }
    if (grid) {
      grid.innerHTML = "";
      const notesById = {};
      for (const n of plan.notes) (notesById[n.id] = notesById[n.id] || []).push(n);
      // מיקום-בפועל (יחסי, index) של כל מה שמוצג - כדי לבדוק דרישות-קדם
      // בפועל (prereqSatisfiedAt) ולתייג "!" את מי שנשבר, בעיקר בגלל נעיצה
      // ידנית (hardPins) שחוסמת את repairPrereqOrder הרגיל (ראו הערה למעלה).
      const posAllOpt = {};
      for (const sem of plan.plan) for (const cid of sem.ids) posAllOpt[cid] = sem.index;
      for (const sem of plan.plan) {
        const absSem = sem.index + semOffset;
        const col = el("div", "fco-sem-col");
        col.dataset.semNum = absSem;
        col.appendChild(el("div", "fco-sem-head",
          "<b>סמסטר " + absSem + " (" + seasonLabel[sem.season] + ")</b><span>" + fmtPts(sem.pts) + " נק'</span>"));
        // גם עמודה ריקה חייבת להיות "יעד גרירה" תקף (גרירה לסמסטר שאין בו
        // עדיין שום מקצוע, למשל כדי לפזר משהו לסמסטר קליל יותר) - ה-class/
        // data-sem-index חייבים על ה-container עצמו, לא רק כשיש בו תיבות.
        const boxes = el("div", "fc-row-boxes fco-drop-zone");
        boxes.dataset.semIndex = absSem;
        for (const id of sem.ids) {
          const idNotes = notesById[id] || [];
          const isOverdue = idNotes.some(n => n.kind === "overdue");
          const isNotYetOffered = idNotes.some(n => n.kind === "not-yet-offered");
          const isHardPinned = hardPins[id] != null;
          // תיבת בחירה (מולאה מתוך מאגר, kind "elective") נצבעת לפי מי שבחר
          // אותה: המשתמש/ת (נעיצה בפאנל/גרירה/"מתוכנן"/"בהמשך" ב-FinDeg) =
          // כחול; האלגוריתם לבדו (ממלא-מקום למכסה) = בורדו, עם הערה שאפשר
          // להחליף (ראו הערה בראש renderOptimizerView).
          const isElectiveFill = idNotes.some(n => n.kind === "elective");
          // "בהמשך" נצבע בצהוב משלו (כמו ה-chip בפאנל, --later) - לא באותו
          // כחול של "מתוכנן"/נעיצה: אלה שני סימונים שונים ב-FinDeg והמשתמש/ת
          // מזהה אותם לפי צבע (בקשת המשתמש/ת, 2026-07-21).
          const electiveCls = !isElectiveFill ? ""
            : laterSet.has(id) ? "fc-later-elective"
            : (pinned[id] != null || isHardPinned || plannedSet.has(id)) ? "fc-user-elective"
            : "fc-auto-elective";
          const autoNote = electiveCls === "fc-auto-elective"
            ? '<div class="section-note fc-auto-note" style="margin:2px 0 0;font-size:.7rem">🎲 נבחר אוטומטית למילוי המכסה - סמנו מקצוע אחר בפאנל למטה כדי להחליפו</div>'
            : "";
          // הערות "general" (מל"ג/ספורט/בחירה חופשית סינתטיים, ראו scheduleGeneralEd
          // ב-optimizer.js) הן נימוק-שיבוץ פנימי לאלגוריתם ("קורס אחד לכל היותר
          // בסמסטר, נדחק מאוחר ככל האפשר...") - לא מידע רלוונטי למשתמש/ת הסופי/ת,
          // רק "רעש" מתחת לתיבה (בקשת המשתמש/ת, 2026-07-21). "project-last"/
          // "taper-split" (הזזת פרויקט הנדסי לסמסטר האחרון/נוסף, ראו optimizer.js)
          // אותו סיפור - נימוק פנימי, לא רלוונטי מתחת לתיבת הפרויקט עצמה
          // (בקשת המשתמש/ת, 2026-07-24). "hard-pin" (מתוכנן ב-FinDeg/נעוץ ידנית
          // בגרירה) - כבר מתוקשר חזותית לגמרי (מסגרת זהובה + כפתור ✕ לביטול,
          // ראו fc-hard-pinned/fc-unpin למטה) - הטקסט המילולי היה עוד "רעש" בלי
          // מידע חדש. משאירים רק הערות שמסמנות בעיה/סיכון אמיתיים (overdue/
          // not-yet-offered, עם fc-push-note) - לא סתם מסבירות למה תיבה נמצאת
          // איפה שהיא נמצאת (בקשת המשתמש/ת, 2026-07-26: "remove most of the
          // descriptions... unless it is about there being a flagged issue").
          const noteHtml = idNotes
            .filter(n => !["general", "project-last", "taper-split", "hard-pin"].includes(n.kind))
            .map(n => '<div class="section-note' + (n.kind === "overdue" || n.kind === "not-yet-offered" ? " fc-push-note" : "") +
              '" style="margin:2px 0 0;font-size:.7rem">' + esc(n.reason) + "</div>")
            .join("") + autoNote;
          const extraCls = [isOverdue || isNotYetOffered ? "fc-uncertain" : "", isHardPinned ? "fc-hard-pinned" : "", electiveCls]
            .filter(Boolean).join(" ") || null;
          const box = courseBox(id, absSem, extraCls, noteHtml,
            { draggable: true, pts: plan.pointsById[id], noClickToggle: true, warn: !prereqSatisfiedAt(id, posAllOpt, doneIds) });
          if (isHardPinned) {
            const un = el("button", "fc-unpin");
            un.textContent = "✕";
            un.title = "בטל נעיצה - האלגוריתם יבחר את הסמסטר שוב";
            un.dataset.unhardpin = id;
            box.appendChild(un);
          }
          boxes.appendChild(box);
        }
        col.appendChild(boxes);
        grid.appendChild(col);
      }
    }
    const h1 = $("#fc-title");
    if (h1) {
      const specSuffix = t.hasSpecialization && yd.specializations ? " (" + yd.specializations[specKey].name + ")" : "";
      h1.textContent = "⚡ תכנון אופטימלי — " + t.name + specSuffix;
    }
    // חצים מחושבים אחרי שהדפדפן סידר את הלייאאוט - כמו render()/renderManualView.
    requestAnimationFrame(() => drawOptimizerArrows());
  }

  // עונת סמסטר יחסי (1 = "הסמסטר הבא") - אותה נוסחת SEASON_CYCLE כמו
  // semesterSeason הפרטית ב-optimizer.js, משוכפלת בכוונה כאן (משמשת רק
  // לתווית העמודה בתצוגת "תכנון ידני" - לא כדאי לחשוף API פנימי בשביל זה).
  function relativeSeason(idx) {
    const cycle = ["winter", "spring"];
    const offset = (optStartSeason || "winter") === "spring" ? 1 : 0;
    return cycle[(idx - 1 + offset) % 2];
  }

  // ---------- תצוגת "תכנון ידני" ----------
  // הכול מתחיל ב"מגירה" הלא-ממוקמת (fcm-tray) - שום מקצוע לא ממוקם אוטומטית
  // מלכתחילה, רק manualPos (state מודול, ראו למעלה - id -> מספר-סמסטר יחסי
  // שהמשתמש/ת גרר/ה אליו בפועל) קובע מה מופיע בעמודות. FINDEG_OPTIMIZER.
  // computePlan עדיין רץ ברקע (frontload+capPts=0, "הכי נקי") אבל *רק* כדי
  // לשלוף את יקום המקצועות הרלוונטי (mandatoryIds/electivePools/pointsById)
  // ואת nominalSemester - לא כדי להציע מיקום התחלתי (בקשת המשתמש/ת,
  // 2026-07-16: "זה צריך להתחיל עם כל הקורסים בצד לפני שאני מזיז אותם").
  function renderManualView() {
    const grid = $("#fcm-grid"), summary = $("#fcm-summary"), tray = $("#fcm-tray");
    const { t, yd, synced, passedIds, synthParsed, res } = buildOptimizerContext();
    if (!yd) {
      if (grid) grid.innerHTML = '<div class="warn-box">אין נתוני קטלוג לשנה שנבחרה.</div>';
      if (summary) summary.innerHTML = "";
      if (tray) tray.innerHTML = "";
      return;
    }
    if (res.unsupported || res.noYear) {
      if (grid) grid.innerHTML = '<div class="warn-box">המסלול הזה עדיין לא נתמך.</div>';
      if (summary) summary.innerHTML = "";
      if (tray) tray.innerHTML = "";
      return;
    }
    const basePlan = FINDEG_OPTIMIZER.computePlan(res, synthParsed,
      { trackKey, specialization: specKey, projectKey: projectKey || null, capPts: 0, frontload: true,
        startSeason: optStartSeason || undefined, yearKey, pinnedIds: Object.keys(pinned) });

    // יקום המקצועות הרלוונטי: חובה שנותר + כל מועמדי-הבחירה הפתוחים (לא רק
    // מי ש-fillElectives היה בוחר אוטומטית - כל המועמדים, כדי שהבחירה תהיה
    // באמת ביד המשתמש/ת). universeIds משמש גם לניקוי manualPos מיושן.
    const universeIds = new Set(basePlan.mandatoryIds);
    for (const p of basePlan.electivePools) for (const id of p.ids) universeIds.add(id);
    for (const id of Object.keys(manualPos)) if (!universeIds.has(id)) delete manualPos[id];

    // baseCols - מספר הסמסטרים המינימלי שהתוכנית הבסיסית דורשת (כולל כל
    // מיקום ידני קיים, גם אם רחוק מהשרשרת הקריטית) - manualExtraCols נוסף
    // *מעליו* (לא Math.max מולו) כדי ש"+ הוסף סמסטר" תמיד יוסיף עמודה נראית,
    // גם כשה-baseCols כבר גדול מ-manualExtraCols (היה באג: לחיצות "נבלעו"
    // עד ש-manualExtraCols "השיג" את baseCols).
    let baseCols = Math.max(basePlan.criticalPathSemesters || 1, 1);
    for (const id in manualPos) baseCols = Math.max(baseCols, manualPos[id]);
    let colCount = baseCols + manualExtraCols;
    lastManualBaseCols = baseCols;
    const cols = [];
    for (let i = 1; i <= colCount; i++) cols.push({ index: i, ids: [] });
    for (const id in manualPos) cols[manualPos[id] - 1].ids.push(id);

    doneIds = new Set(passedIds);
    criticalNodes = new Set();
    // ספורט/מל"ג/בחירה חופשית (gen_*) לא נכנסים כרגע ל-universeIds/cols למעלה
    // (לא ניתנים לגרירה בתצוגה הזו עדיין) - עדיין קובעים generalNames ליתר
    // ביטחון, בלי עלות, למקרה שיתווספו בעתיד.
    generalNames = basePlan.generalNames || {};
    // ראו הערה המקבילה ב-renderOptimizerView (planAnchorSemester, לא
    // nominalSemester הגולמי - בקשת המשתמש/ת, 2026-07-17).
    const semOffset = basePlan.planAnchorSemester != null ? basePlan.planAnchorSemester - 1 : 0;

    // תג "!" - דרישת הקדם בפועל מול המיקום הידני הסופי. אם אף אחד מהשקולים
    // של דרישת-הקדם לא הושלם *וגם* לא ממוקם כרגע בתרשים (עדיין במגירה, או
    // זר לגמרי) - לא חוסמים (כמו computeEPS הלא-strict למקצועות חובה
    // ב-optimizer.js) - אין עדיין מספיק מידע כדי לדעת אם זו בעיה אמיתית
    // (בקשת המשתמש/ת, 2026-07-16).
    const posAll = {};
    for (const c of cols) for (const id of c.ids) posAll[id] = c.index;
    function prereqSatisfied(id) { return prereqSatisfiedAt(id, posAll, doneIds); }

    const placedCount = Object.keys(manualPos).length;
    const totalCount = universeIds.size;
    if (summary) {
      summary.innerHTML = '<span class="chip">' + colCount + " סמסטרים</span>" +
        '<span class="chip">' + placedCount + " / " + totalCount + " מקצועות ממוקמים</span>" +
        (synced ? ' <span class="chip">🔗 מסונכרן עם FinDeg</span>' : "");
    }
    if (grid) {
      grid.innerHTML = "";
      for (const c of cols) {
        const col = el("div", "fco-sem-col");
        col.dataset.semNum = c.index + semOffset;
        const semPts = c.ids.reduce((s, id) => s + (basePlan.pointsById[id] || 0), 0);
        col.appendChild(el("div", "fco-sem-head",
          "<b>סמסטר " + (c.index + semOffset) + " (" + seasonLabel[relativeSeason(c.index)] + ")</b><span>" + fmtPts(semPts) + " נק'</span>"));
        const boxes = el("div", "fc-row-boxes fcm-drop-zone");
        boxes.dataset.semIndex = c.index;
        for (const id of c.ids) {
          boxes.appendChild(courseBox(id, c.index + semOffset, null, "",
            { draggable: true, warn: !prereqSatisfied(id), pts: basePlan.pointsById[id] }));
        }
        col.appendChild(boxes);
        grid.appendChild(col);
      }
    }
    if (tray) {
      tray.innerHTML = "";
      const placed = new Set(Object.keys(manualPos));
      // סימון "מ-FinDeg" (הושלם/מתוכנן/בהמשך) גם על תיבות המגירה כאן - בדיוק
      // כמו ב"מסלול המומלץ" (fc-synced-done/planned) ובפאנל "מקצועות בחירה"
      // למטה (fc-later-elective, צהוב) - בלי זה מקצוע שכבר סומן ב-FinDeg
      // נראה במגירה בדיוק כמו כל מקצוע אחר, בלי שום רמז שהוא כבר "מסודר"
      // (בקשת המשתמש/ת, 2026-07-23).
      const { placed: syncedElectives, laterIds } = computeSyncedElectives(null, doneIds);
      const groups = [{ title: "מקצועות חובה", ids: basePlan.mandatoryIds }];
      for (const p of basePlan.electivePools) groups.push({ title: p.title, ids: p.ids });
      let anyUnplaced = false;
      for (const g of groups) {
        const unplaced = g.ids.filter(id => !placed.has(id) && !doneIds.has(id));
        if (!unplaced.length) continue;
        anyUnplaced = true;
        const wrap = el("div", "fcm-tray-group");
        wrap.appendChild(el("div", "fcm-tray-group-title", esc(g.title) + " (" + unplaced.length + ")"));
        const row = el("div", "fcm-tray-row");
        for (const id of unplaced) {
          const syncInfo = syncedElectives[id];
          const isLater = !syncInfo && laterIds.has(id);
          const cls = syncInfo ? "fc-synced-" + syncInfo.status : isLater ? "fc-later-elective" : null;
          const note = syncInfo
            ? '<div class="section-note" style="margin:2px 0 0;font-size:.75rem">' + (syncInfo.status === "done" ? "📗 הושלם (מ-FinDeg)" : "📘 מתוכנן (מ-FinDeg)") + "</div>"
            : isLater ? '<div class="section-note" style="margin:2px 0 0;font-size:.75rem">🗓️ בהמשך (מ-FinDeg)</div>' : "";
          row.appendChild(courseBox(id, null, cls, note, { draggable: true, pts: basePlan.pointsById[id] }));
        }
        wrap.appendChild(row);
        tray.appendChild(wrap);
      }
      if (!anyUnplaced) tray.appendChild(el("div", "fcm-tray-empty", "🎉 כל המקצועות ממוקמים בתרשים למעלה."));
    }
    const h1 = $("#fc-title");
    if (h1) {
      const specSuffix = t.hasSpecialization && yd.specializations ? " (" + yd.specializations[specKey].name + ")" : "";
      h1.textContent = "✋ תכנון ידני — " + t.name + specSuffix;
    }
    requestAnimationFrame(() => drawManualArrows());
  }

  // מפצל בין שתי התצוגות לפי mode (ראו fc-mode-tabs ב-flowcharts.html) - כל קריאה
  // חיצונית ל-render() (שינוי מסלול/סמסטר/נעיצה וכו') עוברת עכשיו דרך זה, לא ישירות.
  function renderCurrent() {
    const tabs = $("#fc-mode-tabs");
    if (tabs) for (const b of tabs.querySelectorAll(".fc-mode-tab")) b.classList.toggle("active", b.dataset.mode === mode);
    const fcPage = document.getElementById("fc-page"), optPage = document.getElementById("fc-opt-page"),
      manualPage = document.getElementById("fc-manual-page");
    const startSeasonWrap = $("#fc-startseason-wrap");
    if (fcPage) fcPage.classList.toggle("hidden", mode !== "intended");
    if (optPage) optPage.classList.toggle("hidden", mode !== "optimizer");
    if (manualPage) manualPage.classList.toggle("hidden", mode !== "manual");
    // עונת ה"סמסטר הבא" רלוונטית גם לתכנון ידני (מזהה עונת כל עמודה, ראו
    // relativeSeason) - לא רק לתכנון אופטימלי.
    if (startSeasonWrap) startSeasonWrap.classList.toggle("hidden", mode === "intended");
    if (mode === "optimizer") renderOptimizerView();
    else if (mode === "manual") renderManualView();
    else render();
    // הפאנל משותף לשלוש התצוגות (ראו fc-electives ב-flowcharts.html) - נעיצה
    // כאן משפיעה על כולן (FINDEG_OPTIMIZER.computePlan מקבל pinnedIds, ראו
    // renderOptimizerView/renderManualView).
    renderElectives();
  }

  // ---------- אתחול תפריטים ----------
  function refreshProjectOptions() {
    const t = track();
    const wrap = $("#fc-project-wrap");
    if (!t.hasProjectChoice || !t.projectOptions) {
      if (wrap) wrap.style.display = "none";
      projectKey = "";
      return;
    }
    if (wrap) wrap.style.display = "";
    const yd = yearData();
    const ps = $("#fc-project");
    ps.innerHTML = "";
    const none = el("option", null, "עוד לא החלטתי");
    none.value = "";
    ps.appendChild(none);
    for (const key of yd.projects.chooseOne) {
      const o = el("option", null, esc(t.projectOptions[key].label));
      o.value = key;
      ps.appendChild(o);
    }
    if ([...ps.options].some(o => o.value === projectKey)) ps.value = projectKey;
    else projectKey = "";
  }

  function refreshSpecOptions() {
    const t = track();
    const wrap = $("#fc-spec-wrap");
    if (!t.hasSpecialization) {
      if (wrap) wrap.style.display = "none";
      return;
    }
    if (wrap) wrap.style.display = "";
    const yd = track().years[yearKey];
    const specs = (yd && yd.specializations) || {};
    const ss = $("#fc-spec");
    ss.innerHTML = "";
    for (const [key, spec] of Object.entries(specs)) {
      const o = el("option", null, esc(spec.name));
      o.value = key;
      ss.appendChild(o);
    }
    if (![...ss.options].some(o => o.value === specKey)) specKey = ss.options[0] ? ss.options[0].value : specKey;
    ss.value = specKey;
  }

  function refreshYearOptions() {
    const ys = $("#fc-year");
    ys.innerHTML = "";
    for (const [key, label] of Object.entries(D.yearLabels)) {
      if (!track().years[key]) continue;
      const o = el("option", null, esc(label));
      o.value = key;
      ys.appendChild(o);
    }
    if (![...ys.options].some(o => o.value === yearKey)) yearKey = ys.options[0].value;
    ys.value = yearKey;
    refreshSpecOptions();
    refreshProjectOptions();
  }

  function initToolbar() {
    const tsel = $("#fc-track");
    if (tsel) {
      tsel.innerHTML = "";
      for (const key of TRACKS) {
        const o = el("option", null, esc(D.tracks[key].name));
        o.value = key;
        tsel.appendChild(o);
      }
      tsel.value = trackKey;
      tsel.addEventListener("change", () => {
        trackKey = tsel.value;
        pinned = {}; projectKey = ""; hardPins = {}; excluded = {}; materializedPlan = null; // תרשימי מסלולים שונים לא ברי-השוואה, מתחילים נקי
        refreshYearOptions();
        saveState();
        renderCurrent();
      });
    }

    refreshYearOptions();

    const ssel = $("#fc-spec");
    if (ssel) ssel.addEventListener("change", () => {
      specKey = ssel.value;
      pinned = {}; projectKey = ""; hardPins = {}; excluded = {}; materializedPlan = null; // התמחויות שונות = דרישות שונות, לא ברות-השוואה
      saveState();
      renderCurrent();
    });
    $("#fc-year").addEventListener("change", () => { yearKey = $("#fc-year").value; materializedPlan = null; refreshSpecOptions(); refreshProjectOptions(); saveState(); renderCurrent(); });
    $("#fc-project").addEventListener("change", e => { projectKey = e.target.value; materializedPlan = null; saveState(); renderCurrent(); });
    const ssnsel = $("#fc-startseason");
    if (ssnsel) {
      ssnsel.value = optStartSeason;
      ssnsel.addEventListener("change", e => { optStartSeason = e.target.value; saveState(); renderCurrent(); });
    }
    // תקרת נק'/סמסטר ניתנת-לכיוונון קיימת לשני מצבים בלבד ("עומס מאוזן"/
    // "דחיסה מוקדמת עד תקרה" - שניהם עם "תקרה" בשם עצמו), כל אחד עם המשתנה
    // הנפרד שלו (optCapPts/optFrontloadCapPts, ראו הערה שם) - לא קלט אחד
    // משותף. capValueForGoal/setCapForGoal ממפים בין מצב לבין המשתנה שלו.
    function capValueForGoal(goal) {
      return goal === "frontload" ? optFrontloadCapPts : optCapPts;
    }
    function setCapForGoal(goal, v) {
      if (goal === "frontload") optFrontloadCapPts = v; else optCapPts = v;
    }
    const goalSel = $("#fco-goal"), capInput = $("#fco-cap"), capWrap = $("#fco-cap-wrap");
    const capRelevant = goal => goal === "points" || goal === "frontload";
    if (goalSel) {
      goalSel.value = optGoal;
      if (capInput) capInput.value = capValueForGoal(optGoal);
      if (capWrap) capWrap.classList.toggle("hidden", !capRelevant(optGoal));
      goalSel.addEventListener("change", e => {
        optGoal = e.target.value;
        if (capInput) capInput.value = capValueForGoal(optGoal);
        if (capWrap) capWrap.classList.toggle("hidden", !capRelevant(optGoal));
        saveState();
        renderCurrent();
      });
    }
    if (capInput) capInput.addEventListener("change", e => {
      const v = +e.target.value;
      if (v > 0) setCapForGoal(optGoal, v);
      e.target.value = capValueForGoal(optGoal);
      saveState();
      renderCurrent();
    });
    // "הרץ אופטימיזציה" - הטריגר המפורש היחיד (מלבד איפוס/רענון-דף) שגורם
    // ל-renderOptimizerView לחשב מחדש בפועל (מאפס את materializedPlan) - כל
    // שינוי יעד/תקרה עד עכשיו רק נשמר כהעדפה, לא הופעל מיד (בקשת המשתמש/ת,
    // 2026-07-25). hardPins נשארים כפי שהם - מקצועות שנגררו ידנית קודם
    // נשארים קבועים גם אחרי הרצה חדשה, בדיוק כמו שהיה תמיד.
    const runBtn = $("#fco-run");
    if (runBtn) runBtn.addEventListener("click", () => {
      materializedPlan = null;
      renderCurrent();
    });
    $("#fc-reset").addEventListener("click", () => {
      if (!confirm("לאפס את כל המקצועות שנעוצו?")) return;
      pinned = {}; projectKey = ""; hardPins = {}; excluded = {}; materializedPlan = null; saveState(); renderCurrent();
    });
    const addSemBtn = $("#fcm-add-sem");
    if (addSemBtn) addSemBtn.addEventListener("click", () => {
      manualExtraCols++; saveState(); renderCurrent();
    });
    const removeSemBtn = $("#fcm-remove-sem");
    if (removeSemBtn) removeSemBtn.addEventListener("click", () => {
      if (manualExtraCols <= 0) {
        alert("אי אפשר להסיר - כל הסמסטרים המוצגים נדרשים ע\"י התוכנית או מכילים מקצוע שמוקם ידנית.");
        return;
      }
      const lastCol = lastManualBaseCols + manualExtraCols;
      const occupied = Object.values(manualPos).some(v => v === lastCol);
      if (occupied) {
        alert("יש מקצוע ממוקם בסמסטר האחרון - גררו אותו למגירה או לסמסטר אחר לפני ההסרה.");
        return;
      }
      manualExtraCols--; saveState(); renderCurrent();
    });
    const manualResetBtn = $("#fcm-reset");
    if (manualResetBtn) manualResetBtn.addEventListener("click", () => {
      if (!confirm("לאפס את כל המיקומים הידניים?")) return;
      manualPos = {}; manualExtraCols = 0; saveState(); renderCurrent();
    });
  }

  // ---------- החלת סנכרון FinDeg על מסלול/קטלוג/פרויקט (רק בטעינה/עדכון חיצוני,
  // לא בכל render - כדי לא לדרוס חקירה ידנית של המשתמש בתוך התרשים עצמו) ----------
  function applyFindegSync() {
    const sync = readFindegSync();
    const note = $("#fc-sync-note");
    if (!sync) { if (note) note.textContent = ""; return; }
    if (!TRACKS.includes(sync.trackKey)) {
      if (note) note.textContent = "⚠️ ב-FinDeg נבחר מסלול (" + (D.tracks[sync.trackKey] ? D.tracks[sync.trackKey].name : sync.trackKey) + ") שאין לו עדיין תרשים זרימה, אז לא מסונכרן כרגע.";
      return;
    }
    // אם הגיעו לכאן דרך קישור ספציפי (תפריט ה-hover) - המסלול/ההתמחות שנבחרו שם
    // גוברים על הסנכרון מ-FinDeg, אחרת הקישור לא היה עושה כלום.
    if (!trackFromUrl) trackKey = sync.trackKey;
    if (track().years[sync.yearKey]) yearKey = sync.yearKey;
    if (sync.projectKey) projectKey = sync.projectKey;
    if (!specFromUrl && sync.specialization) specKey = sync.specialization;
    const tsel = $("#fc-track");
    if (tsel) tsel.value = trackKey;
    refreshYearOptions();
    $("#fc-year").value = yearKey;
    refreshSpecOptions();
    refreshProjectOptions();
    saveState();
    if (note) note.textContent = "🔗 מסונכרן עם FinDeg (מסלול, קטלוג ופרויקט מתעדכנים אוטומטית; מקצועות בחירה שהושלמו/מתוכננים שם מופיעים בתרשים).";
  }

  document.addEventListener("change", e => {
    const sel = e.target.closest("[data-pin-select]");
    if (!sel) return;
    const id = sel.dataset.pinSelect;
    if (sel.value) pinned[id] = +sel.value; else delete pinned[id];
    saveState();
    renderCurrent();
  });
  document.addEventListener("change", e => {
    const cb = e.target.closest("[data-want-toggle]");
    if (!cb) return;
    const id = cb.dataset.wantToggle;
    if (cb.checked) {
      pinned[id] = eligibleSemesters(id)[0];
      delete excluded[id];
    } else {
      delete pinned[id];
      // בתכנון אופטימלי untick חייב באמת להוציא את המקצוע - כולל כזה שנבחר
      // אוטומטית למילוי מכסה (לא ננעץ מעולם): בלי סימון excluded הוא היה
      // חוזר להיבחר מייד בחישוב הבא כאילו כלום (בקשת המשתמש/ת, 2026-07-21).
      if (mode === "optimizer") excluded[id] = true;
    }
    saveState();
    renderCurrent();
  });
  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-unpin]");
    if (!btn) return;
    delete pinned[btn.dataset.unpin];
    saveState();
    renderCurrent();
  });
  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-unhardpin]");
    if (!btn) return;
    delete hardPins[btn.dataset.unhardpin];
    saveState();
    renderCurrent();
  });
  // קליק על תיבת מקצוע בתוך הרשת עצמה (לא בפאנל הבחירה למטה - שם לניעוץ יש
  // כבר תפריט-נפתח ייעודי) = סימון/ביטול "הושלם", ראו toggleDoneOverride.
  // *לא* ב-fc-opt-page ("תכנון אופטימלי") - שם קליק על מקצוע היה מסמן אותו
  // "הושלם" ומוציא אותו מהתוכנית לצמיתות בטעות (בקשת המשתמש/ת, 2026-07-20:
  // "כשלוחצים על סמסטרים בתכנון האופטימלי הם נעלמים ולא חוזרים"); שם הדרך
  // לזוז זה גרירה (ראו .fco-drop-zone למטה), לא קליק. בודקים data-unpin/
  // data-unhardpin קודם ומדלגים - הכפתורים האלה יושבים *בתוך* תיבה עם
  // data-course-id משלה, אחרת קליק עליהם היה גם מסמן "הושלם".
  document.addEventListener("click", e => {
    if (e.target.closest("[data-unpin], [data-unhardpin]")) return;
    const box = e.target.closest("#fc-page [data-course-id], #fc-manual-page [data-course-id]");
    if (!box) return;
    toggleDoneOverride(box.dataset.courseId);
  });

  // גרירה ושחרור בתצוגת "תכנון ידני" - מאזינים מואצלים ברמת document (לא על
  // כל עמודה בנפרד) כי הרשת נבנית מחדש בכל renderManualView, אז מאזינים
  // ישירים היו נמחקים בכל render. dragstart עצמו (ששם את id ב-dataTransfer)
  // מוגדר בתוך courseBox, ראו שם.
  document.addEventListener("dragover", e => {
    const zone = e.target.closest(".fcm-drop-zone, .fco-drop-zone");
    if (!zone) return;
    e.preventDefault();
    zone.classList.add("fc-dragover");
  });
  document.addEventListener("dragleave", e => {
    const zone = e.target.closest(".fcm-drop-zone, .fco-drop-zone");
    if (zone) zone.classList.remove("fc-dragover");
  });
  document.addEventListener("drop", e => {
    const zone = e.target.closest(".fcm-drop-zone, .fco-drop-zone");
    if (!zone) return;
    e.preventDefault();
    zone.classList.remove("fc-dragover");
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    if (zone.classList.contains("fco-drop-zone")) {
      // "תכנון אופטימלי": גרירה עורכת את materializedPlan *ישירות* (מזיזה
      // את id בין מערכי ids של הסמסטרים, מעדכנת נק') - בלי לקרוא ל-
      // FINDEG_OPTIMIZER.computePlan בכלל, כך שרק המקצוע הזה זז ושום דבר
      // אחר לא "מאורגן מחדש". hardPins[id] מתעדכן *רק* עבור המקצוע הזה
      // (לא כל מה שמוצג) - זה כל התג "נעוץ" שנראה, ומבטיח שהמיקום ישרוד גם
      // "הרץ מחדש" מאוחר יותר (בקשת המשתמש/ת, 2026-07-25: לא "לסמן הכול
      // כנעוץ" כתוצאה מגרירה בודדת - רק הפונקציה עצמה לא רצה מחדש בלי
      // לחיצה על הרץ/איפוס/רענון). מקצועות סינתטיים (gen_*) לא מקבלים
      // hardPin - אין להם id יציב בין הרצות (ראו scheduleGeneralEd,
      // optimizer.js), ותמיד "יש מספיק מבחר" בשבילם ממילא.
      if (materializedPlan) {
        const targetAbs = +zone.dataset.semIndex;
        const semOffset = materializedPlan.planAnchorSemester != null ? materializedPlan.planAnchorSemester - 1 : 0;
        const targetRel = Math.max(1, targetAbs - semOffset);
        const movedPts = materializedPlan.pointsById[id] ?? 0;
        for (const sem of materializedPlan.plan) {
          const i = sem.ids.indexOf(id);
          if (i !== -1) {
            sem.ids.splice(i, 1);
            sem.pts = +(sem.pts - movedPts).toFixed(2);
            break;
          }
        }
        // מרחיבים את materializedPlan.plan אם צריך (יעד מעבר לסוף התוכנית
        // הנוכחית) - עונת הסמסטר החדש נגזרת מזוגיות ה-index יחסית לסמסטר
        // 1 הקיים כבר (אותו מעגל חורף/אביב שהאלגוריתם עצמו קבע), לא ממוחזרת
        // בטעות מ-optStartSeason (עלול לא להתאים אם הזיהוי היה אוטומטי).
        const refSem = materializedPlan.plan[0];
        while (materializedPlan.plan.length < targetRel) {
          const idx = materializedPlan.plan.length + 1;
          const season = refSem
            ? (idx % 2 === refSem.index % 2 ? refSem.season : (refSem.season === "winter" ? "spring" : "winter"))
            : relativeSeason(idx);
          materializedPlan.plan.push({ index: idx, season, ids: [], pts: 0 });
        }
        const dest = materializedPlan.plan[targetRel - 1];
        dest.ids.push(id);
        dest.pts = +(dest.pts + movedPts).toFixed(2);
        materializedPlan.totalSemesters = materializedPlan.plan.length;
        if (!id.startsWith("gen_")) hardPins[id] = targetAbs;
      }
      saveState();
      renderCurrent();
      return;
    }
    const target = +zone.dataset.semIndex;
    // semIndex=0 = המגירה הלא-ממוקמת (#fcm-tray) - גרירה לשם מבטלת מיקום,
    // לא "ממקמת בסמסטר 0".
    if (target > 0) manualPos[id] = target; else delete manualPos[id];
    saveState();
    renderCurrent();
  });

  const modeTabs = document.getElementById("fc-mode-tabs");
  if (modeTabs) modeTabs.addEventListener("click", e => {
    const btn = e.target.closest(".fc-mode-tab");
    if (!btn) return;
    mode = btn.dataset.mode;
    const qs = new URLSearchParams(location.search);
    qs.set("mode", mode); qs.set("track", trackKey);
    if (track().hasSpecialization) qs.set("spec", specKey); else qs.delete("spec");
    history.replaceState(null, "", location.pathname + "?" + qs.toString());
    renderCurrent();
  });

  window.addEventListener("resize", () => { drawArrows(); drawFog(); drawManualArrows(); drawOptimizerArrows(); });
  setupHoverHighlight();

  // עדכון חי אם FinDeg עצמו פתוח בכרטיסייה אחרת ומשתנה (change ב-localStorage
  // לא מגיע לאותו טאב שכתב אותו, רק לכרטיסיות אחרות - בדיוק מה שרוצים כאן)
  window.addEventListener("storage", e => {
    // loadState() קודם - שם הסטודנט/ית שהתדפיס מסונכרן אליו יכול היה
    // להשתנות (העלאת תדפיס אחר בכרטיסייה השנייה), אז storeKey() (התלוי
    // ב-readFindegSync כרגע) עשוי להצביע על שמירה אחרת - צריך לטעון אותה
    // *לפני* ש-applyFindegSync דורס מסלול/קטלוג מעליה ושומר בחזרה.
    if (e.key === FINDEG_SYNC_KEY) { loadState(); applyFindegSync(); renderCurrent(); }
  });

  loadState();
  initToolbar();
  applyFindegSync();
  renderCurrent();
})();
