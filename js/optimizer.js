/* FinDeg – אופטימיזציית מפת קורסים לסמסטרים הבאים.
 *
 * גישה (עודכן 2026-08-20, בקשת המשתמש/ת - "כל פעם שאנחנו עורכים משהו אני
 * צריך להילחם איתך על לתקן את זה"): אלגוריתם מבוסס-עדיפות אחד (scheduleUnified,
 * ראו ההערה שם) לכל חמשת מצבי האופטימיזציה כאחד ("מומלץ"/"מינימום סמסטרים"/
 * "דחיסה מוקדמת"/"תקרת נק' קבועה"/"מספר סמסטרים קבוע") - שונים רק בתקרת-
 * הנק'-לסמסטר, לא באלגוריתם עצמו. לכל מקצוע ניקוד = עדיפות בסיסית (אורך
 * שרשרת הדרישות התלויות בו, computeCoursePriorities) + בונוסים תלויי-סמסטר.
 * בכל סמסטר, קודם המקצוע עם הניקוד הגבוה ביותר מבין אלה שדרישות הקדם שלהם
 * כבר מתמלאות (EPS מבני, לא "מיקום חי") - עד לתקרת הסמסטר, ואז ממשיכים
 * לסמסטר הבא. אין יותר slack/LPS/מתיחת-נתיב-קריטי/שלד-ידני (GREEDY_SKELETON) -
 * הניקוד לבדו אמור לגרום למקצועות על השרשרת הארוכה ביותר להיבחר מוקדם, בלי
 * מנגנון נפרד.
 *
 * מקצועות בחירה (electives) אין להם מיקום "רשמי" מלכתחילה - הם מתחרים על
 * "מכסה" (נקודות/מקצועות עוד חסרים במאגר בחירה) באותו סבב-סמסטרים בדיוק,
 * לפי אותו ניקוד.
 *
 * מקור האמת לדרישות קדם: D.coursePrereqs (לא js/prereqs.js/FINDEG_PREREQS -
 * זה האחרון שטוח/מפושט לצורך ציור חצים בתרשים הזרימה בלבד, לא משמר את מבנה
 * "OR של AND" הנדרש כאן לחישוב EPS נכון).
 */
window.FINDEG_OPTIMIZER = (function () {
  const D = () => window.FINDEG_DATA;
  const SEM = () => window.FINDEG_SEMESTERS || {};
  const SEASON_CYCLE = ["winter", "spring"]; // v1: התוכנית הראשית לא כוללת קיץ (ראו קובץ זה, §קיץ למטה)

  // D().coursePoints מכיל נקודות רק למקצועות שמופיעים כ-id גולמי במאגרי בחירה
  // (pools) - מקצועות חובה מקודדים כ-C(id, pts) בתוך כל מסלול, עם הנקודות
  // מוטמעות ישירות שם, לא במילון הגלובלי. לכן ptsOverride (שנבנה ב-computePlan
  // מתוך res.sections/chains/projects, שכבר "יודע" את pts הנכון של כל מקצוע
  // חובה) הוא מקור האמת הראשון; המילון הגלובלי הוא רק גיבוי (טוב למקצועות
  // בחירה, שאין להם ייצוג אחר).
  let ptsOverride = {};
  function coursePts(id) { return ptsOverride[id] ?? D().coursePoints[id] ?? 0; }
  // capPts יכול להיות מספר קבוע *או* פונקציה semIndex->מספר - כאן משמש רק
  // repairPrereqOrder (0/falsy = בלי תקרה כלל, ראו קריאתו ב-computePlan);
  // scheduleUnified מנהל את תקרת-המצב שלו בעצמו (capFn/avgPts, ראו שם).
  function capAt(cap, idx) { return typeof cap === "function" ? cap(idx) : cap; }
  function courseSeasons(id) {
    const s = SEM()[id];
    const seasons = s && s.seasons ? s.seasons.filter(x => x !== "summer") : null;
    return seasons && seasons.length ? seasons : null; // null = לא ידוע, לא מגבילים
  }
  function courseDifficulty(id) {
    const d = D().courseDifficulty[id];
    return d && d.n >= 5 ? d.d : null; // מדגם קטן מדי (n<5) - לא סומכים על הציון
  }
  function prereqGroups(id) { return D().coursePrereqs[id] || []; }
  // שקילות קודים ישנים/חדשים לאותו מקצוע (equivGroups, data.js) - חיוני כאן:
  // דרישות קדם נשלפו מ-SAP וחלקן עדיין מפנות לקוד הישן (למשל 00140731 "מבוא
  // לתכן מיסעות") בעוד הקטלוג שלנו למסלול מסוים כבר עבר לקוד החדש (00140735)
  // - בלי הרחבת שקילות כאן, בדיקת "האם דרישת הקדם כבר סופקה" הייתה מפספסת
  // התאמה אמיתית ומחשיבה מקצוע שגוי כ"לא ניתן לאימות" (נתפס ותוקן 2026-07-10).
  function equivSet(id) {
    return (window.FINDEG_ENGINE && window.FINDEG_ENGINE.equivSet) ? window.FINDEG_ENGINE.equivSet(id) : [id];
  }

  // עוגן יחיד לכל מיפוי אינדקס->עונה בקובץ הזה: סמסטר 1 = "הסמסטר הבא"
  // האמיתי של הסטודנט/ית (currentStartSeason, נקבע פעם אחת בכל computePlan).
  // חובה להשתמש בפונקציה הזו בלבד לכל חישוב עונה (EPS/LPS/עיגול/תוכנית
  // סופית) - שימוש בהנחת "סמסטר 1 = חורף" קבועה במקום אחד ולא באחר הוא
  // בדיוק הבאג שגרם למקצועות להיות ממוקמים בעונה שגויה (נתפס ותוקן 2026-07-10).
  let currentStartSeason = "winter";
  function semesterSeason(index) {
    const offset = currentStartSeason === "spring" ? 1 : 0;
    return SEASON_CYCLE[(index - 1 + offset) % 2];
  }
  // מעגל קדימה לסמסטר התואם הקרוב ביותר (>=), לפי עונות ההיצע של המקצוע
  function roundUpToSeason(index, seasons) {
    if (!seasons) return index;
    let i = index;
    while (!seasons.includes(semesterSeason(i))) i++;
    return i;
  }

  /**
   * EPS (Earliest Possible Semester) לכל מקצוע ב-remainingIds.
   * doneIds - מקצועות שכבר הושלמו בפועל, מספקים כל דרישת קדם מיידית (EPS=0).
   * posOverride (אופציונלי) - מקצועות ששובצו כבר לסמסטר מסוים בתוכנית (אך
   * טרם "הושלמו" - הדרישה תמולא רק *אחרי* אותו סמסטר, לא מיידית!). קריטי
   * למילוי בחירות: מקצוע בחירה שדרישת הקדם שלו היא מקצוע חובה שכבר שובץ
   * לסמסטר 1 חייב EPS>=2, לא EPS=0 - אחרת שני המקצועות עלולים להיכנס לאותו
   * סמסטר בניגוד לדרישת הקדם עצמה (נתפס ותוקן 2026-07-10).
   * גם מחזיר source[id] = צירוף דרישות הקדם הספציפי שהשיג את ה-EPS המינימלי
   * (ה"צוואר בקבוק" האמיתי של המקצוע) - נחוץ לחישוב LPS נכון בהמשך (לא כל
   * חלופת OR רלוונטית ל"קריטיות", רק זו שבפועל קבעה את הזמן המוקדם ביותר).
   */
  // strict=true: מקצוע קדם שאינו done/posOverride/ב-remainingIds נחשב "לא
  // ניתן לאימות" (EPS=Infinity) במקום "בטח כבר זמין". חיוני למועמדי בחירה -
  // אחרת עלול "להמליץ" על מקצוע שדרישת הקדם האמיתית שלו (שאינה חלק מדרישות
  // המסלול, לכן לעולם לא תשובץ בתוכנית בעצמה) פשוט לא תופיע לסטודנט/ית בשום
  // מקום, אף שהתוכנית מניחה בשקט שהיא כבר טופלה (נתפס ותוקן 2026-07-10:
  // 00140710/00140709 בהתמחות תחבורה, תלויים ב-00140731 שאינו חלק מהדרישות).
  // לא מופעל עבור מקצועות חובה - שם ה"רכות" הזו עדיין נחוצה למקרי קצה בנתוני
  // המקור (למשל דרישת קדם שגויה שנרשמה כ-AND במקום OR בין שני מקצועות מבוא
  // חלופיים בין שנתונים - ראו הערה ב-README/memory).
  function computeEPS(remainingIds, doneIds, posOverride, strict) {
    const eps = {}, source = {};
    const remainingSet = new Set(remainingIds);
    const known = strict ? new Set([...doneIds, ...remainingIds, ...(posOverride ? Object.keys(posOverride) : [])]) : null;
    function epsOf(id) {
      const eq = equivSet(id);
      if (eq.some(e => doneIds.has(e))) return 0;
      if (posOverride) {
        const positions = eq.map(e => posOverride[e]).filter(p => p != null);
        if (positions.length) return Math.min(...positions);
      }
      // אם id עצמו אינו חלק מהמקצועות שבאמת מתוזמנים כאן, אבל יש לו שקול
      // (קוד חדש/ישן לאותו מקצוע בפועל) שכן - נעדיף לחשב לפי השקול, לא לפי
      // דרישות הקדם של id עצמו (עלולות להיות גרף שונה/לא רלוונטי - הסטודנט/ית
      // לעולם לא ילמד/תלמד את id בקוד הזה במיוחד, רק את השקול שלו). בלי זה,
      // "00140731" (קוד ישן) חושב לפי דרישות הקדם *שלו עצמו* במקום להסתמך על
      // המיקום האמיתי של "00140735" (הקוד החדש, שבאמת מתוזמן) - נתפס ותוקן 2026-07-10.
      if (!remainingSet.has(id)) {
        const altInRemaining = eq.find(e => e !== id && remainingSet.has(e));
        if (altInRemaining) return epsOf(altInRemaining);
      }
      if (strict && !eq.some(e => known.has(e))) return Infinity;
      if (eps[id] != null) return eps[id];
      eps[id] = 1; // הגנה מפני מעגליות בגרף (לא אמורה לקרות בפועל)
      const groups = prereqGroups(id);
      let best = 1, bestGroup = null;
      if (groups.length) {
        best = Infinity;
        for (const group of groups) {
          const groupEps = group.length ? Math.max(...group.map(p => epsOf(p) + 1)) : 1;
          if (groupEps < best) { best = groupEps; bestGroup = group; }
        }
        // אם אף חלופת "או" לא ניתנת לאימות (כל הענפים חוזרים Infinity) - במצב
        // strict זה בדיוק האות שביקשנו: מקצוע בחירה שדרישת הקדם האמיתית שלו
        // לעולם לא תתמלא בתוכנית הזו חייב להישאר Infinity ולהיפסל, לא "להירגע"
        // בחזרה ל-1. הרכות הזו (best=1) עדיין רלוונטית *רק* למצב הלא-strict
        // (חובה) שבו נתוני מקור פגומים לא יפילו מקצוע חובה שלם. נתפס ותוקן
        // 2026-07-10: 00960411/00140329 (הנדסה אזרחית-מים) נשארו "בני-אימות"
        // כוזב למרות ששני ענפי ה"או" שלהם תלויים במקצועות זרים לגמרי (מדעי
        // המחשב), כי הריכוך הזה דרס את ה-Infinity הנכון שכבר חושב.
        if (!Number.isFinite(best) && !strict) { best = 1; bestGroup = null; }
      }
      // best יכול להישאר Infinity כאן רק במצב strict (הענף לעיל) - roundUpToSeason
      // לא בנוי לקבל אינסוף (הלולאה הפנימית שלו לא תיעצר), אז מדלגים על העיגול.
      const rounded = Number.isFinite(best) ? roundUpToSeason(best, courseSeasons(id)) : Infinity;
      eps[id] = rounded;
      source[id] = bestGroup;
      return rounded;
    }
    for (const id of remainingIds) epsOf(id);
    return { eps, source };
  }

  /**
   * שלד סמסטרים ריק, החל מסמסטר 1 = "הסמסטר הבא" (currentStartSeason).
   */
  function makeEmptyPlan(n) {
    const plan = [];
    for (let i = 1; i <= n; i++) plan.push({ index: i, season: semesterSeason(i), ids: [], pts: 0 });
    return plan;
  }

  /**
   * מנחש את עונת "הסמסטר הבא" של הסטודנט/ית מתוך התדפיס (הסמסטר האחרון בו
   * נלמדו מקצועות בפועל, +1 בסבב חורף/אביב). ברירת מחדל "חורף" אם לא ידוע.
   */
  function inferNextSeason(parsed) {
    const order = { winter: 0, spring: 1, summer: 2 };
    let best = null;
    for (const c of parsed.courses || []) {
      if (!c.year || !c.season || order[c.season] == null) continue;
      if (!best || c.year > best.year || (c.year === best.year && order[c.season] > order[best.season])) {
        best = { year: c.year, season: c.season };
      }
    }
    if (!best) return "winter";
    if (best.season === "winter") return "spring";
    return "winter"; // אחרי אביב/קיץ - חורף הבא
  }

  // ---------- "באיזה סמסטר אני נומינלית/ית עכשיו" + "מה הייתי אמור/ה כבר
  // להשלים עד עכשיו" ----------
  // inferNextSeason למעלה מנחש רק את ה*עונה* של הסמסטר הבא, לא כמה סמסטרים
  // כבר עברו מתחילת הלימודים בכלל - "תוכנית אופטימלית" תמיד התחילה למספר
  // מ-1 = "הסמסטר הבא" בלי קשר לכמה זמן הסטודנט/ית כבר לומד/ת, ולכן לא הייתה
  // לה שום דרך להשוות "מה כבר הושלם" מול "מה אמור היה כבר להיות מושלם" (בקשת
  // המשתמש, 2026-07-13). התאריך האמיתי (לא רק סדר-הקורסים בתדפיס) הוא מקור-
  // האמת היחיד לכך - בדיוק אותה נוסחה כמו gregorianStartYear/
  // computeCompletedSemesters ב-flowchart.js, משוכפלת בכוונה (מודול IIFE
  // נפרד, לא כדאי לקשור שני קבצים רק בשביל ~15 שורות משותפות).
  function gregorianStartYear(yearKey) {
    for (const [greg, heb] of Object.entries(D().yearCatalogs || {})) {
      if (heb === yearKey) return +greg;
    }
    return null;
  }
  function semesterStartDate(num, gregYear) {
    return num % 2 === 1
      ? new Date(gregYear + (num - 1) / 2, 9, 1)
      : new Date(gregYear + num / 2, 2, 1);
  }
  // מספר-הסמסטר (1-אינדקס, סמסטר 1 = החורף הראשון של yearKey) שבו הסטודנט/ית
  // אמור/ה להיות "כרגע" באופן נומינלי, לפי תאריך אמיתי. null אם yearKey לא
  // סופק/לא מזוהה בקטלוגים - במקרה כזה מדלגים על השוואת "מה הייתי אמור/ה כבר
  // להשלים" לגמרי (ראו קריאה ל-computeNominalSemester ב-computePlan).
  function computeNominalSemester(yearKey) {
    const gregYear = gregorianStartYear(yearKey);
    if (gregYear == null) return null;
    const now = new Date();
    let num = 1;
    while (now >= semesterStartDate(num + 1, gregYear)) num++;
    return num;
  }

  // ---------- מקצועות שדרישת הקטלוג כבר כוללת אותם אך טרם נפתחו בפועל ----------
  // yearCatalogs (data.js) ממפה רק שנים שיש להן קטלוג נתמך בכלי הזה - לא עוזר
  // לשנה עתידית כמו "תשפ"ח" שעדיין אין לה קטלוג. ההיסט המספרי בין שנה עברית
  // ללועזית קבוע (רק תחילת/סוף ה"ספירה" קופצים בספטמבר/אוקטובר, לא המספר עצמו)
  // - נגזר מכל זוג ידוע ב-yearCatalogs במקום קבוע מוצפן בקוד, כדי שימשיך לעבוד
  // גם אחרי שיתווספו קטלוגים חדשים.
  function hebYearToGregStart(hebYear) {
    const entries = Object.entries(D().yearCatalogs || {});
    if (!entries.length) return null;
    const [greg0, heb0] = entries[0];
    return +greg0 + (+hebYear - +heb0);
  }
  // מספר-סמסטר מוחלט (1 = החורף הראשון של studentYearKey, כמו
  // computeNominalSemester) שבו מקצוע עם דרישת-פתיחה מינימלית (minHebYear,
  // "לא נפתח לפני שנה X") נפתח לראשונה בפועל - מעוגל לחורף (העונה שבה נפתחת
  // כל שנה) כי "לפחות שנה X" פירושו שכל סמסטר בשנה הזו כשיר, והמוקדם שבהם הוא חורפה.
  function minAbsoluteSemesterForYear(studentYearKey, minHebYear) {
    const startGreg = gregorianStartYear(studentYearKey);
    const targetGreg = hebYearToGregStart(minHebYear);
    if (startGreg == null || targetGreg == null) return null;
    let num = 1;
    while (semesterStartDate(num, startGreg).getFullYear() < targetGreg) num++;
    if (num % 2 === 0) num++;
    return num;
  }
  // מקצועות שכבר מופיעים כדרישת קטלוג (C(id,pts) במסלול) אך המקצוע עצמו טרם
  // נפתח בפועל כקבוצת הוראה אמיתית, לפי בדיקה מול הפקולטה - לא ניתן להסיק
  // מ-semesters.js (SAP/היסטוגרמות) כי הוא פשוט מעולם לא הופיע שם. id -> שנה
  // עברית שבה נפתח לראשונה. לדוגמה: 00140160 "חשיפה למחקר בהנדסת מבנים וניהול
  // הבנייה" - דרישה שנוספה כבר בקטלוג תשפ"ו (add160, data.js) אך המקצוע עצמו
  // לא נפתח לפני תשפ"ח (נתפס 2026-07-14, בקשת המשתמש/ת).
  const MIN_OFFERING_YEAR = { "00140160": "5788" };

  /**
   * שולף מ-D.tracks[trackKey] את קו הבסיס הרשמי (js/flowchart-data.js) עבור
   * מסלול/שנה/התמחות נתונים, אם קיים. מחזיר map של id -> מספר סמסטר (1-8),
   * או null אם אין נתון קו-בסיס למסלול הזה (עדיין - ראו הערה בראש הקובץ).
   */
  function officialBaseline(trackKey, options) {
    const FC = window.FINDEG_FLOWCHART || {};
    let entry = FC[trackKey];
    if (!entry) return null;
    if (entry.specializations) entry = entry.specializations[options.specialization];
    if (!entry || !entry.semesters) return null;
    const map = {};
    for (const sem of entry.semesters) {
      for (const id of sem.mandatory || []) map[id] = sem.num;
      for (const id of sem.flexible || []) if (map[id] == null) map[id] = sem.num;
      if (Array.isArray(sem.project)) { for (const id of sem.project) map[id] = sem.num; }
      else if (sem.project) map[sem.project] = sem.num;
    }
    return map;
  }

  // ---------- עדיפות מקצוע (אורך שרשרת) לכל 5 מצבי האופטימיזציה ----------
  // עדיפות(id) = אורך השרשרת היורדת הארוכה ביותר שמתחילה ב-id, בתוך universeIds
  // בלבד, לפי דרישות-קדם אמיתיות (D().coursePrereqs, לא adjoining - אין למקור
  // הזה בכלל מושג כזה). מקצוע שאף מקצוע אחר ב-universeIds לא תלוי בו = עדיפות
  // 1; מקצוע שהוא דרישת קדם ישירה למקצוע עם עדיפות 2 = עדיפות 3, וכן הלאה -
  // "כמה מקצועות רצופים תלויים במקצוע הזה". אותו רעיון בדיוק כמו
  // computeCriticalPath ב-js/flowchart.js, רק עם universeIds/מקור שונים (שם:
  // מקצועות מוצגים בתרשים כרגע + PREREQ המשוטח; כאן: יקום התוכנית המחושבת -
  // חובה+כל מועמדי-בחירה - + coursePrereqs המלא/OR-of-AND, מקור האמת לדרישות
  // קדם בקובץ הזה) - לפי בקשת המשתמש/ת, 2026-08-20: "give every course a
  // priority listing... per discipline chosen", לשימוש כניקוד-בסיס ב-scheduleUnified.
  function computeCoursePriorities(universeIds) {
    const universe = new Set(universeIds);
    const adjOut = {}; // src -> מקצועות ב-universe שיש להם src כדרישת-קדם ישירה
    for (const id of universeIds) {
      for (const group of prereqGroups(id)) {
        for (const p of group) {
          const real = equivSet(p).find(e => universe.has(e));
          if (real) (adjOut[real] = adjOut[real] || []).push(id);
        }
      }
    }
    const memo = {};
    function priorityOf(id) {
      if (id in memo) return memo[id];
      memo[id] = 1; // הגנה מפני מעגליות (לא אמורה לקרות בפועל)
      let best = 0;
      for (const nxt of (adjOut[id] || [])) best = Math.max(best, priorityOf(nxt));
      return (memo[id] = best + 1);
    }
    const result = {};
    for (const id of universeIds) result[id] = priorityOf(id);
    return result;
  }

  /**
   * מעבר תיקון אחרון - רשת ביטחון, לא תחליף לשלבים 1-3 לעיל. שלבי האיזון
   * (קו-בסיס רשמי, מתיחת נתיב קריטי, איזון קושי, קיבולת) כל אחד עוקב אחרי
   * "גבולות חיים" משלו (livePrereqMax/liveDependentMin) מול ה*תלות הקריטית
   * היחידה* של כל מקצוע (source/dependents - רק החבר ה"צוואר בקבוק" בצירוף
   * דרישות הקדם שקבע את ה-EPS) - אבל דרישת קדם מסוג AND יכולה לכלול גם
   * חברים שאינם הצוואר-בקבוק (EPS נמוך משלהם), שאף שלב לא עוקב אחריהם
   * במפורש, ולכן עלולים בכל זאת להסתדר בסדר הפוך בפועל (בפרט כשקו-הבסיס
   * הרשמי ממקם שני מקצועות קשורים באותו סמסטר בדיוק, וכל אחד מוזז אחר-כך
   * בנפרד לכיוון שונה). סורק את התוכנית הסופית (חובה+בחירה) ומזיז קדימה כל
   * מקצוע שדרישת הקדם שלו בפועל עדיין לא מתמלאת, עד לסמסטר הראשון שבו כן
   * (מרחיב את התוכנית בסמסטרים נוספים אם צריך) - נתפס ותוקן 2026-07-10:
   * 00140004/00160203 (הנדסה אזרחית-מים) שניהם התחילו מאותו סמסטר קו-בסיס
   * רשמי (6) ואז זזו לכיוונים מנוגדים בשלבים נפרדים.
   */
  // fixedIds (אופציונלי, Set) - מקצועות שנעוצו קשיח בגרירה (js/flowchart.js,
  // תכנון אופטימלי) - "must" אומר קבוע לגמרי, גם אם דרישת הקדם שלהם בפועל
  // לא מתמלאת בסמסטר הזה (בחירת המשתמש/ת המפורשת גוברת); מדולגים כאן לגמרי,
  // לא מוזזים אף פעם ע"י המעבר הזה.
  function repairPrereqOrder(plan, doneIds, capPts, fixedIds) {
    const notes = [];
    let guard = 0;
    while (guard++ < 30) {
      const pos = {};
      for (const sem of plan) for (const id of sem.ids) pos[id] = sem.index;
      let fixed = false;
      for (const sem of plan) {
        for (const id of [...sem.ids]) {
          if (fixedIds && fixedIds.has(id)) continue;
          const groups = prereqGroups(id);
          if (!groups.length) continue;
          const satisfiedBy = pid => equivSet(pid).some(e => doneIds.has(e) || (pos[e] != null && pos[e] < sem.index));
          if (groups.some(g => g.every(satisfiedBy))) continue; // כבר תקין
          // לכל חלופת "או": המיקום הראשון שבו כל חבריה כבר מתמלאים (או Infinity
          // אם אחד מחבריה לעולם לא בר-אימות בתוכנית הזו - מקצוע זר לחלוטין)
          let target = Infinity;
          for (const g of groups) {
            let maxReq = -1, resolvable = true;
            for (const pid of g) {
              const eq = equivSet(pid);
              let p = eq.some(e => doneIds.has(e)) ? 0 : null;
              if (p == null) {
                const positions = eq.map(e => pos[e]).filter(v => v != null);
                if (positions.length) p = Math.min(...positions);
              }
              if (p == null) { resolvable = false; break; }
              maxReq = Math.max(maxReq, p);
            }
            if (resolvable) target = Math.min(target, maxReq + 1);
          }
          if (!Number.isFinite(target) || target <= sem.index) continue;
          // target הוא רק החסם התחתון (דרישת קדם) - מחפשים ממנו והלאה גם עונה
          // מתאימה וגם מקום מבחינת מכסת נקודות (capPts), בלי לדרוס עוד עומס
          // שכבר שם (נתפס ותוקן 2026-07-10, לצד תיקון דומה בשלב 3 של scheduleUnified).
          let destIndex = target;
          const seasons = courseSeasons(id);
          while (true) {
            while (plan.length < destIndex) plan.push({ index: plan.length + 1, season: semesterSeason(plan.length + 1), ids: [], pts: 0 });
            if (seasons && !seasons.includes(plan[destIndex - 1].season)) { destIndex++; continue; }
            if (!capPts || plan[destIndex - 1].pts + coursePts(id) <= capAt(capPts, destIndex)) break;
            destIndex++;
          }
          const dest = plan[destIndex - 1];
          sem.ids = sem.ids.filter(x => x !== id);
          sem.pts = +(sem.pts - coursePts(id)).toFixed(2);
          dest.ids.push(id);
          dest.pts = +(dest.pts + coursePts(id)).toFixed(2);
          notes.push({ id, kind: "prereq-fix", from: sem.index, to: dest.index,
            reason: "תוקן כדי לכבד דרישת קדם שלא כובדה בשלבי האיזון הקודמים" });
          fixed = true;
        }
      }
      if (!fixed) break;
    }
    return notes;
  }

  // ---------- דרישות כלל-טכניוניות (ספורט/מל"ג/בחירה חופשית) ----------
  // אלה לא "מקצועות" עם id קטלוגי (res.general.buckets ב-engine.js) - "נתח"
  // (chunk) גנרי מייצג קורס יחיד בגודל טיפוסי. pe=1 (לא 2!) - מקצוע חינוך
  // גופני בודד שווה נק' אחת בפועל בטכניון, ודרישת ה-pe הכוללת תמיד 2, כלומר
  // תמיד *שני* מקצועות נפרדים. איך שהם בפועל ממוקמים לסמסטרים - ראו
  // scheduleUnified למטה (שרשרת-קדם סינתטית לספורט/מל"ג, לא רשימת-tiers).
  const GENERAL_CHUNK = { free: 3, pe: 1, enrich: 2 };
  // תווית קצרה+ממוספרת לכל תיבה בתרשים (לא ליחידות/עמוד הסיבה בפירוט - שם
  // עדיין b.label המלא, "מל\"ג (העשרה)" וכו') - "מל\"ג 1"/"ספורט 2" וכו',
  // כדי שברור מיד שכל תיבה היא נתח נפרד מאותה דרישה, לא אותו מקצוע כפול
  // (בקשת המשתמש/ת, 2026-07-19: "כתבו מל\"ג 1, מל\"ג 2, מל\"ג 3").
  const GENERAL_SHORT_LABEL = { pe: "ספורט", enrich: 'מל"ג', free: "בחירה חופשית" };


  /**
   * הליבה היחידה של האופטימיזציה - כל חמשת המצבים ("מומלץ"/"מינימום
   * סמסטרים"/"דחיסה מוקדמת"/"תקרת נק' קבועה"/"מספר סמסטרים קבוע") עוברים
   * דרך אותו אלגוריתם בדיוק, נבדלים רק ב-mode/fixedValue (לפי בקשת המשתמש/ת,
   * 2026-08-20: "again assigned as before" לכל מצב).
   *
   * לכל מקצוע (חובה/בחירה/ספורט/מל"ג/בחירה חופשית) ניקוד = עדיפות בסיסית
   * (computeCoursePriorities למקצוע אמיתי, או מיקום בשרשרת סינתטית 1/2/3
   * לספורט/מל"ג) + בונוסים תלויי-הסמסטר-המועמד: +1.5 אם הסמסטר המועמד זהה
   * לסמסטר במסלול המומלץ (officialRelMap, חובה בלבד); +1 למקצוע-בחירה/בחירה
   * חופשית בסמסטר מוחלט 5-7; +1 לספורט/מל"ג בסמסטר מוחלט >4. ספורט/מל"ג
   * מיוצגים כשרשרת-קדם סינתטית (יחידה N דורשת יחידה N-1 - בדיוק כמו מקצוע
   * רגיל) - מבטיח לכל היותר יחידה אחת "בחינם" לסמסטר, בלי מנגנון נפרד.
   *
   * עיבוד: סמסטר-אחר-סמסטר (1.. ומעבר לזה במידת הצורך), בכל סמסטר אוספים את
   * כל הפריטים הזמינים (EPS מבני של כל האצווה <= הסמסטר + עונה מתאימה - floor
   * סטטי, לא "מיקום חי"; בדיוק כמו שאר הקובץ, כולל repairPrereqOrder כרשת
   * ביטחון בסוף לתיקון הפרות שבכל זאת נותרו), ממיינים לפי ניקוד יורד, ומשבצים
   * עד תקרת הסמסטר - תמיד משבצים לפחות פריט אחד בסמסטר ריק גם אם חורג
   * מהתקרה, כדי לא להיתקע.
   *
   * תקרה לפי mode:
   *  "frontload" - תקרה שטוחה 40 (לא אילוץ אמיתי - רק תקרה גבוהה כדי
   *    שהאלגוריתם לא ידחוס תיאורטית הכול לסמסטר אחד; "כמה שיותר, בלי איזון").
   *  "semesters" - N = העדיפות הגבוהה ביותר ביקום (השרשרת הארוכה ביותר, ספירת
   *    מקצועות טהורה - לא מחושב-עונה), avgPts = סה"כ נק' משוער / N, תקרה שטוחה.
   *  "fixedPoints" - תקרה שטוחה = fixedValue (המשתמש/ת קובע/ת ידנית).
   *  "fixedSemesters" - N = fixedValue (המשתמש/ת קובע/ת ידנית), avgPts כמו "semesters".
   *  "recommended" - תקרה 25 לסמסטרים 1-6 (מספר מוחלט, לא יחסי), 15 לסמסטרים
   *    7 ואילך (גם מעבר לסמסטר 8 - בלי "שסתום שחרור" ל-Infinity, ראו הערה
   *    ליד capFn למטה: השיבוץ כבר מבטיח לפחות מקצוע אחד לכל סמסטר גם כשחורג
   *    מהתקרה, אז עדיף כמה סמסטרים נוספים מתונים על פני סמסטר יחיד עמוס מדי).
   * בכל המקרים עם N מוגדר מראש (semesters/fixedSemesters) - התוכנית עדיין
   * יכולה להתארך מעבר ל-N בפועל אם דרישות קדם/עונות באמת מחייבות (fallback
   * ל"לא לאבד אף מקצוע" - ראו MAX_SEM למטה), לא נחתכת קשיח ב-N.
   *
   * פרויקטים (projectIds) מקבלים עדיפות-בסיס מלאכותית נמוכה (0.5, ראו
   * PROJECT_BASE למטה) כדי שכל מקצוע אחר יזכה בתחרות על מקום בסמסטר עמוס -
   * לא מובטח שינחתו ממש בסמסטר האחרון, רק שלא "יתפסו מקום" ממקצוע אמיתי
   * (בקשת המשתמש/ת, 2026-08-20: "it doesn't need to be guaranteed last, it
   * needs to be mostly last... 0.5 is good enough").
   *
   * lockedMap: מקצועות-חובה נעוצים-קשיח (id -> סמסטר יחסי קבוע). pinnedIds:
   * מועמדי-בחירה שחייבים להישבץ איפשהו (לא בהכרח בסמסטר קבוע) - לא מתחרים
   * על "מכסה", רק על מקום/תקרה מול שאר הפריטים. hardPinsRelative: גם חובה
   * וגם בחירה, סמסטר יחסי *קבוע* (גרירה/"מתוכנן"). buckets: res.general.buckets
   * (ספורט/מל"ג/בחירה חופשית). pointsById/generalNames מתעדכנים ישירות
   * (by reference) - לא ערכי-חזרה נפרדים, כדי ש-computePlan ימשיך לעבוד בלי
   * שינוי מבני.
   */
  function scheduleUnified(remainingIds, doneIds, lockedMap, minPosMap, openPools, pinnedIds, hardPinsRelative,
    groupAIds, buckets, mode, fixedValue, officialRelMap, planAnchorSemester, pointsById, generalNames, projectIds) {
    const notes = [];
    const projects = projectIds || new Set();

    // ---- EPS מבני (floor סטטי לכל האצווה) ----
    const { eps: mandEps } = computeEPS(remainingIds, doneIds);
    if (minPosMap) {
      for (const id of remainingIds) {
        if (minPosMap[id] != null && minPosMap[id] > mandEps[id]) {
          notes.push({ id, kind: "not-yet-offered", from: mandEps[id], to: minPosMap[id],
            reason: "המקצוע עדיין לא נפתח בפועל - נדחה לסמסטר המוקדם ביותר שבו הוא צפוי להיפתח" });
          mandEps[id] = minPosMap[id];
        }
      }
    }
    const allCandidateIds = [...new Set(openPools.flatMap(p => p.pool))];
    const { eps: elecEps } = computeEPS(allCandidateIds, doneIds, mandEps, true);

    // ---- עדיפות בסיסית (אורך שרשרת) לכל מקצוע "אמיתי" ----
    const universe = new Set([...remainingIds, ...allCandidateIds]);
    const priorities = computeCoursePriorities([...universe]);
    const maxPriority = universe.size ? Math.max(...Object.values(priorities)) : 1;
    // criticalN מוצג למשתמש/ת כ"מינימום תיאורטי" (js/flowchart.js) בכל מצב,
    // לא רק "מינימום סמסטרים" - אותה עדיפות-מקסימלית בדיוק.
    const criticalN = maxPriority;

    // ---- תקרה/N לפי mode (ראו הערת-הראש) ----
    // absSem: סמסטר יחסי (1 = "הסמסטר הבא") -> מספר-סמסטר *מוחלט* מתחילת
    // התואר - "recommended" מבוסס על סמסטר מוחלט (1-6/7-8), לא יחסי, כדי
    // שהתקרה לא תזוז בהתאם למתי הסטודנט/ית מתחיל/ה לתכנן (אותו עוגן בדיוק
    // כמו הבונוסים למטה - מוגדר כאן, לא רק שם, כי capFn נבנה לפני אותה נקודה).
    function absSem(relSem) { return planAnchorSemester != null ? relSem + planAnchorSemester - 1 : relSem; }
    let targetN = null, capFn;
    if (mode === "semesters") targetN = maxPriority;
    else if (mode === "fixedSemesters") targetN = Math.max(1, +fixedValue || 1);
    else if (mode === "fixedPoints") capFn = () => Math.max(1, +fixedValue || 1);
    // בלי "שסתום שחרור" ל-Infinity מעבר לסמסטר 8 - השיבוץ כבר מבטיח לפחות
    // מקצוע אחד לכל סמסטר גם כשחורג מהתקרה (אף מקצוע לא "נתקע"), אז תקרת 15
    // יכולה פשוט להמשיך גם מעבר לסמסטר 8 - עדיף כמה סמסטרים נוספים מתונים
    // על פני סמסטר יחיד עמוס מדי אם התואר בפועל דורש יותר מ-8.
    else if (mode === "recommended") capFn = idx => (absSem(idx) <= 6 ? 25 : 15);
    else capFn = () => 40; // "frontload" (ברירת מחדל - תקרה גבוהה, לא אילוץ אמיתי)

    // ---- פרויקטים: עדיפות-בסיס נמוכה מלאכותית (0.5, מתחת למינימום האמיתי 1)
    // כדי שכל מקצוע אחר יזכה בתחרות על מקום בסמסטר מולם - "לא לתפוס מקום
    // מוקדם רק כי דרישות הקדם שלו כבר מתמלאות", גם שאין באמת שום דבר שתלוי
    // בפרויקט עצמו (עלה בגרף, ולכן ממילא עדיפות 1 "טבעית" - בלי ההנמכה
    // המלאכותית הזו הוא היה שקול לכל עלה אחר, לא נדחק בכוונה). בכוונה *לא*
    // מבטיח שהפרויקט ינחת ממש בסמסטר האחרון - רק שהוא לא ידחוק החוצה מקצוע
    // "אמיתי" בסמסטר עמוס (בקשת המשתמש/ת, 2026-08-20: "it doesn't need to be
    // guaranteed last, it needs to be mostly last - you wouldn't want a
    // person taking this course in a full semester. it being on 0.5 is good
    // enough"). ניסיון קודם באותו יום להוסיף גם הזזה-קשיחה-לסוף בפועל (אחרי
    // שהסבב כולו רץ) הוסר לפי בקשה מפורשת - הפשטות עדיפה כאן על דיוק-יתר.
    const PROJECT_BASE = 0.5;

    let N = targetN != null ? targetN : 1;
    for (const s of Object.values(hardPinsRelative || {})) N = Math.max(N, s);

    // ---- פריטי ספורט/מל"ג/בחירה חופשית סינתטיים ----
    const genItems = [];
    if (buckets) {
      for (const key of ["pe", "free", "enrich"]) {
        const b = buckets[key];
        if (!b) continue;
        const chained = key !== "free"; // רק ספורט/מל"ג מוגבלים ליחידה אחת לסמסטר
        const bonusCat = key === "free" ? "elective" : "genlate";
        let consumed = Math.min(b.pts, b.needed);
        let chainPrev = null, chainPos = 0;
        for (const c of b.courses.filter(cc => cc.planned)) {
          if (consumed >= b.needed - 0.01) break;
          const amt = Math.min(c.pts, +(b.needed - consumed).toFixed(2));
          const id = "gen_" + key + "_manual_" + (c.manualIndex != null ? c.manualIndex : c.name);
          chainPos++;
          genItems.push({ id, pts: amt, bonusCat, name: c.name, chainAfter: chained ? chainPrev : null,
            priority: chained ? chainPos : 1,
            reason: 'מילוי דרישת "' + b.label + '" - מקצוע מתוכנן שכבר נוסף ידנית ב-FinDeg' });
          if (chained) chainPrev = id;
          consumed = +(consumed + amt).toFixed(2);
        }
        let remaining = +(b.needed - consumed).toFixed(2);
        let n = Math.floor(consumed / GENERAL_CHUNK[key]) + 1;
        while (remaining > 0.01) {
          const amt = Math.min(GENERAL_CHUNK[key], remaining);
          const num = n++;
          const id = "gen_" + key + "_" + num;
          chainPos++;
          genItems.push({ id, pts: amt, bonusCat, name: GENERAL_SHORT_LABEL[key] + " " + num, chainAfter: chained ? chainPrev : null,
            priority: chained ? chainPos : 1,
            reason: 'מילוי דרישת "' + b.label + '"' });
          if (chained) chainPrev = id;
          remaining = +(remaining - amt).toFixed(2);
        }
      }
    }

    // ---- סה"כ נק' משוער (ל-avgPts) - חובה + בחירה נדרשת (משוער ל"ספירה") + כלל-טכני ----
    let totalPts = remainingIds.reduce((s, id) => s + coursePts(id), 0);
    for (const p of openPools) {
      if (p.kind === "points") totalPts += Math.max(0, p.need);
      else {
        const avg = p.pool.length ? p.pool.reduce((s, id) => s + coursePts(id), 0) / p.pool.length : 3;
        totalPts += Math.max(0, p.need) * avg;
      }
    }
    for (const it of genItems) totalPts += it.pts;
    // targetN מוגדר (semesters/fixedSemesters) -> תקרה שטוחה = totalPts/N;
    // אחרת (frontload/fixedPoints/recommended) -> capFn(idx) לכל סמסטר בנפרד.
    const avgPts = targetN != null ? (targetN > 0 ? totalPts / targetN : totalPts) : null;
    function capAt(idx) { return avgPts != null ? avgPts : capFn(idx); }

    function electiveBonus(s) { const a = absSem(s); return (a >= 5 && a <= 7) ? 1 : 0; }
    function genLateBonus(s) { return absSem(s) > 4 ? 1 : 0; }

    const pinned = pinnedIds || new Set();
    const groupAPrefer = groupAIds || new Set();
    const hard = hardPinsRelative || {};

    const plan = makeEmptyPlan(N);
    const placedPos = {};
    function place(id, pts, sem, note) {
      while (plan.length < sem) plan.push({ index: plan.length + 1, season: semesterSeason(plan.length + 1), ids: [], pts: 0 });
      const dest = plan[sem - 1];
      dest.ids.push(id);
      dest.pts = +(dest.pts + pts).toFixed(2);
      placedPos[id] = sem;
      pointsById[id] = pts;
      if (note) notes.push(note);
    }

    // מקצועות חובה נעוצים-קשיח - ממוקמים ישירות, מדולגים מהסבב הרגיל למטה.
    const lockedIds = new Set(lockedMap ? Object.keys(lockedMap) : []);
    const remainingSet = new Set(remainingIds);
    for (const id of lockedIds) {
      if (remainingSet.has(id)) place(id, coursePts(id), Math.max(1, lockedMap[id]));
    }

    // מיפוי מועמד-בחירה -> כל המאגרים שהוא חבר בהם (לזיכוי - ראו creditPools)
    const poolRemaining = {}, poolsOf = {}, poolKind = {}, poolTitle = {};
    for (const p of openPools) {
      poolRemaining[p.key] = p.need;
      poolKind[p.key] = p.kind;
      poolTitle[p.key] = p.title;
      for (const id of p.pool) (poolsOf[id] = poolsOf[id] || []).push(p.key);
    }
    function creditPools(id, pts) {
      for (const key of (poolsOf[id] || [])) poolRemaining[key] -= (poolKind[key] === "points" ? pts : 1);
    }

    // מועמדי-בחירה נעוצים-קשיח (גרירה/"מתוכנן") - ממוקמים ישירות + הערה,
    // ומזכים כל מאגר שמכיל אותם. draggedReason כמו scheduleUnified -
    // computePlan מזהה ומחליף את הניסוח בהמשך למי שסומן "מתוכנן" ב-FinDeg.
    const electiveHardPinned = new Set();
    for (const [id, sem] of Object.entries(hard)) {
      if (lockedIds.has(id) || doneIds.has(id) || placedPos[id] != null) continue;
      if (!(poolsOf[id] || []).length) continue; // לא מועמד-בחירה ידוע כלל
      const seasons = courseSeasons(id);
      let idx = Math.max(1, sem);
      if (seasons && !seasons.includes(semesterSeason(idx))) {
        let i = idx; while (!seasons.includes(semesterSeason(i))) i++;
        idx = i;
      }
      place(id, coursePts(id), idx, { id, kind: "hard-pin", to: idx, pool: poolsOf[id][0],
        reason: idx === sem ? "נעוץ ידנית לסמסטר הזה (גרירה) - קבוע, לא יוזז אוטומטית"
          : "נגרר לסמסטר שהמקצוע לא ניתן בו בפועל - הוזז לסמסטר התואם הקרוב ביותר, עדיין קבוע" });
      electiveHardPinned.add(id);
      creditPools(id, coursePts(id));
    }

    // "וודאי" (pinned, לא קשיח - כולל "בהמשך"/laterWanted, שכבר מאוחד לתוך
    // pinnedIds ב-computePlan) - מוכרחים להישבץ איפשהו, אבל הסמסטר עצמו נקבע
    // ע"י הסבב הרגיל למטה (לא קבוע, לא מתחרים על מכסה מול שאר מועמדי המאגר).
    // מזכים את המאגר *כבר עכשיו* (לפני שהסמסטר בפועל נקבע) - לא רק כשהסבב
    // סוף-סוף משבץ אותם בפועל: אחרת מילוי-אוטומטי בסמסטרים המוקדמים לא "יודע"
    // שהדרישה כבר מכוסה (המקצוע הוודאי עדיין מחכה לתורו, למשל כי העדיפות/EPS
    // שלו נמוכים משל מקצועות אחרים) ובוחר עוד מקצועות מיותרים למכסה - נתפס
    // (בקשת המשתמש/ת, 2026-08-20: "when marking things for later the system
    // still takes other courses to fill up the course limit"). preCredited
    // מונע זיכוי כפול כשהם בפועל משתבצים בהמשך (ראו למטה, בלולאת השיבוץ).
    const guaranteedElectives = new Set();
    const preCredited = new Set();
    for (const id of pinned) {
      if (electiveHardPinned.has(id) || doneIds.has(id) || placedPos[id] != null) continue;
      if (!(poolsOf[id] || []).length) continue;
      guaranteedElectives.add(id);
      creditPools(id, coursePts(id));
      preCredited.add(id);
    }

    const remainingMandatory = new Set(remainingIds.filter(id => !lockedIds.has(id)));
    const guaranteedGen = [...genItems];

    // ---- סבב סמסטר-אחר-סמסטר ----
    const MAX_SEM = N + 40; // רשת ביטחון מפני מקרה-קצה בנתונים - לא אמור לקרות בפועל
    for (let s = 1; s <= MAX_SEM; s++) {
      const allDone = remainingMandatory.size === 0 && guaranteedElectives.size === 0 &&
        guaranteedGen.length === 0 && Object.values(poolRemaining).every(v => v <= 0);
      if (allDone) break;

      while (plan.length < s) plan.push({ index: plan.length + 1, season: semesterSeason(plan.length + 1), ids: [], pts: 0 });
      const sem = plan[s - 1];
      const season = sem.season;

      const candidates = [];
      for (const id of remainingMandatory) {
        if (mandEps[id] > s) continue;
        const seasons = courseSeasons(id);
        if (seasons && !seasons.includes(season)) continue;
        const isProject = projects.has(id);
        const bonus = officialRelMap && officialRelMap[id] === s ? 1.5 : 0;
        const base = isProject ? PROJECT_BASE : priorities[id];
        candidates.push({ id, pts: coursePts(id), score: base + bonus, kind: "mandatory" });
      }
      for (const id of guaranteedElectives) {
        if (!Number.isFinite(elecEps[id]) || elecEps[id] > s) continue;
        const seasons = courseSeasons(id);
        if (seasons && !seasons.includes(season)) continue;
        candidates.push({ id, pts: coursePts(id), score: priorities[id] + electiveBonus(s), kind: "elective" });
      }
      // autoPool (אם קיים - ראו computePlan) מגביל את המילוי *האוטומטי* בלבד
      // לשרשראות הרלוונטיות בפועל; p.pool המלא עדיין משמש ל-poolsOf/electivePools
      // (זיהוי-מאגר לזיכוי + פאנל הבחירה הידני), לא מוחלף כאן.
      const poolCandidateIds = new Set();
      for (const p of openPools) if (poolRemaining[p.key] > 0) for (const id of (p.autoPool || p.pool)) poolCandidateIds.add(id);
      for (const id of poolCandidateIds) {
        if (doneIds.has(id) || placedPos[id] != null || guaranteedElectives.has(id) || electiveHardPinned.has(id)) continue;
        if (!Number.isFinite(elecEps[id]) || elecEps[id] > s) continue;
        const seasons = courseSeasons(id);
        if (seasons && !seasons.includes(season)) continue;
        candidates.push({ id, pts: coursePts(id),
          score: priorities[id] + electiveBonus(s) + (groupAPrefer.has(id) ? 0.01 : 0), kind: "elective" });
      }
      for (const it of guaranteedGen) {
        if (it.chainAfter && placedPos[it.chainAfter] == null) continue; // הקודם בשרשרת עוד לא שובץ
        const bonus = it.bonusCat === "genlate" ? genLateBonus(s) : electiveBonus(s);
        candidates.push({ id: it.id, pts: it.pts, score: it.priority + bonus, kind: "gen", ref: it });
      }

      candidates.sort((a, b) => b.score - a.score || (courseDifficulty(a.id) ?? 3) - (courseDifficulty(b.id) ?? 3));

      let used = sem.pts;
      const semCap = capAt(s);
      for (const cand of candidates) {
        if (semCap !== Infinity && used > 0 && used + cand.pts > semCap) continue;
        if (cand.kind === "mandatory") {
          place(cand.id, cand.pts, s);
          remainingMandatory.delete(cand.id);
        } else if (cand.kind === "gen") {
          place(cand.id, cand.pts, s, { id: cand.id, kind: "general", to: s, reason: cand.ref.reason });
          generalNames[cand.id] = cand.ref.name;
          const gi = guaranteedGen.indexOf(cand.ref);
          if (gi >= 0) guaranteedGen.splice(gi, 1);
        } else {
          const poolKey = (poolsOf[cand.id] || [])[0];
          place(cand.id, cand.pts, s, { id: cand.id, kind: "elective", to: s, pool: poolKey,
            reason: 'מילוי משבצת בחירה (' + (poolTitle[poolKey] || "") + ')' });
          if (!preCredited.has(cand.id)) creditPools(cand.id, cand.pts); // וודאי כבר זוכה מראש - לא לזכות פעמיים
          guaranteedElectives.delete(cand.id);
        }
        used += cand.pts;
      }
    }

    return { plan, notes, eps: mandEps, criticalN };
  }

  /**
   * נקודת הכניסה הראשית. מצפה לתוצאת FINDEG_ENGINE.evaluate() (res) - שואב
   * ממנה את רשימת מקצועות החובה שעוד חסרים ואת מאגרי הבחירה הפתוחים, כדי
   * לא לשכפל את כל לוגיקת "מה כבר הושלם/מתוכנן/חסר" שכבר קיימת שם.
   *
   * options: { trackKey, specialization?,
   *            goal? ("recommended" (ברירת מחדל) | "semesters" | "frontload" |
   *            "fixedPoints" | "fixedSemesters" - ראו scheduleUnified לפירוט
   *            מלא של ההבדל בין המצבים),
   *            fixedValue? (מספר - רלוונטי רק ל-goal "fixedPoints"
   *            [תקרת נק'/סמסטר] או "fixedSemesters" [מספר סמסטרים]),
   *            startSeason? (ברירת מחדל מנוחש מ-parsed),
   *            yearKey? (שנת קטלוג/תחילת לימודים - לחישוב nominalSemester/
   *            overdueIds למטה; בלעדיו מדלגים על ההשוואה הזו, ראו
   *            computeNominalSemester),
   *            pinnedIds? (Set/מערך של מזהי מקצועות-בחירה שנעצו ידנית בפאנל
   *            הבחירה המשותף - ראו scheduleUnified; אלה תמיד משובצים ראשונים,
   *            לפני מילוי אוטומטי),
   *            preferredIds? (Set/מערך - מקצועות שסומנו "בהמשך" ב-FinDeg;
   *            לא חובה לשבץ, אבל מועדפים על פני פיק שרירותי במילוי אוטומטי
   *            של מאגר שעוד חסר - ראו scheduleUnified) }
   */
  function computePlan(res, parsed, options) {
    options = options || {};
    const doneIds = new Set(parsed.courses.filter(c => c.passed).map(c => c.id));
    for (const g of D().equivGroups) if (g.some(id => doneIds.has(id))) for (const id of g) doneIds.add(id);
    const nominalSemester = computeNominalSemester(options.yearKey);
    // "הסמסטר הבא לתכנון" (skipBaseline) הוא *תמיד* nominalSemester+1, לא
    // nominalSemester עצמו - הסטודנט/ית תמיד "בתוך" הסמסטר הנומינלי כרגע (או
    // כבר רשומ/ה אליו), אז אי-אפשר לתכנן מחדש *לתוכו*; הסמסטר החופשי הראשון
    // לתכנון-אמת הוא תמיד זה שאחריו - בלי צורך בשום override ידני (נתפס -
    // בקשת המשתמש/ת, 2026-07-21: "מדלגים על סמסטר... אז זה אמור להיות +1",
    // לא +0 כברירת מחדל ולא +2 כשגם דורסים ידנית - תיקון לגרסה הקודמת שדרשה
    // דריסה ידנית של startSeason כדי לקבל את ה+1 הזה מלכתחילה, ואז הכפילה
    // אותו בטעות ל-2 כש-startSeason נדרס בנוסף).
    // עונת ברירת המחדל של סמסטר 1 נגזרת *מ*-skipBaseline עצמו (זוגי/אי-זוגי,
    // אותה נוסחה בדיוק כמו semesterStartDate למעלה - odd=חורף) - לא מהתדפיס
    // (inferNextSeason, המבוסס רק על מקצועות עם ציון אמיתי) - האחרון "עיוור"
    // בדיוק לסמסטר שהסטודנט/ית *כרגע* רשומ/ה אליו (עוד אין לו ציון), ולכן
    // יחשוב שהוא עדיין לא התחיל בכלל; inferNextSeason משמש רק כגיבוי כש-
    // yearKey לא סופק/nominalSemester לא ידוע.
    const skipBaseline = nominalSemester != null ? nominalSemester + 1 : null;
    const autoSeason = skipBaseline != null
      ? (skipBaseline % 2 === 1 ? "winter" : "spring")
      : inferNextSeason(parsed);
    currentStartSeason = options.startSeason || autoSeason;
    // מספר-הסמסטר המוחלט שאליו "סמסטר יחסי 1" של התוכנית מתייחס בפועל - זה
    // מה שצריך לשמש כ-semOffset בתצוגה (js/flowchart.js), לא nominalSemester
    // הגולמי (זה נשאר עובדה תאריכית טהורה - "באיזה סמסטר אני נומינלית/ית
    // כרגע" - ומשמש בנפרד ל"מה הייתי אמור/ה כבר להשלים", לא לעוגן התכנון).
    // דריסה ידנית נוספת של startSeason (מעבר ל-autoSeason שכבר מדלג על
    // הסמסטר הנוכחי) - מדלגת עוד סמסטר אחד מעבר לזה (למשל תוכנן/ה כבר גם את
    // הסמסטר שאחרי הנוכחי בנפרד).
    const planAnchorSemester = skipBaseline != null
      ? skipBaseline + (options.startSeason && options.startSeason !== autoSeason ? 1 : 0)
      : null;
    // ---- שליפת מקצועות חובה שעוד חסרים, מתוך res (לא לחשב שוב) ----
    // גם אוספים ptsOverride כאן: D().coursePoints לא מכיל מקצועות שמוגדרים
    // רק כ-C(id,pts) בתוך מסלול (רוב מקצועות החובה!) - res כבר "יודע" את
    // הנקודות הנכונות לכל שורה, לכן שואבים משם ולא מהמילון הגלובלי.
    ptsOverride = {};
    const missingMandatory = [];
    // מקצועות-פרויקט (לא רק res.projects של ניהול ובנייה - גם קטע "courses"
    // עם id:"project" כמו הפרויקט המורחב במבנים) - נאספים כדי ש-scheduleUnified
    // ידחוק אותם לסמסטר האחרון (עדיפות-בסיס נמוכה + בונוס "בסמסטר האחרון" -
    // ראו הערה שם, בקשת המשתמש/ת, 2026-08-20).
    const projectIds = new Set();
    // מקצועות-חובה שסומנו "מתוכנן" ב-FinDeg (overrides[id]==="planned") -
    // הצהרה מפורשת של הסטודנט/ית "זה מה שאני לוקח/ת עכשיו", לא רק "עוד
    // מקצוע חסר" - צריכים להיכנס לסמסטר הבא (relative=1) בעדיפות הגבוהה
    // ביותר, בדיוק כמו נעיצה ידנית (hardPins). נאספים כאן תוך כדי איסוף
    // remainingIds הרגיל, ומוזגים ל-hardPinsRelative בהמשך הפונקציה (בקשת
    // המשתמש/ת, 2026-07-25: "that's the user telling you what he is planning
    // on taking and we should respect it as the highest priority").
    const plannedMandatoryIds = new Set();
    for (const r of res.sections || []) {
      if (r.kind !== "courses") continue;
      const isProjectSection = r.section && r.section.id === "project";
      for (const row of r.missing) {
        const id = row.item.ids.find(i => !doneIds.has(i)) || row.item.ids[0];
        missingMandatory.push(id);
        ptsOverride[id] = row.item.pts;
        if (isProjectSection) projectIds.add(id);
        if (row.planned) plannedMandatoryIds.add(id);
      }
    }
    for (const c of res.chains || []) {
      for (const row of c.coreRows) {
        if (row.done || doneIds.has(row.id)) continue;
        missingMandatory.push(row.id);
        ptsOverride[row.id] = row.pts;
        if (row.planned) plannedMandatoryIds.add(row.id);
      }
    }
    if (res.projects && !res.projects.mandatory.done) {
      const ids = res.projects.mandatory.item.ids;
      const id = ids.find(i => !doneIds.has(i)) || ids[0];
      missingMandatory.push(id);
      ptsOverride[id] = res.projects.mandatory.item.pts;
      projectIds.add(id);
      if (res.projects.mandatory.planned) plannedMandatoryIds.add(id);
    }
    // הפרויקט השני שנבחר בתפריט (project-select, ניהול ובנייה): בחירה מפורשת
    // מהתפריט היא כבר כוונה ברורה לבצע אותו - לא אמור לדרוש גם סימון נפרד
    // "מתוכנן" ב-FinDeg כדי להופיע בתרשים, בדיוק כמו הפרויקט החובה למעלה
    // (בקשת המשתמש/ת, 2026-07-24: "if I selected that I am taking the [chain]
    // project, the project should be on the flow chart without me having to
    // select it manually as planned"). שרשרת-הקדם של הפרויקט (extraCourses/
    // extraChoose) כבר נכנסת ל-remainingIds למעלה דרך res.chains בלי קשר לזה
    // (מופעלת ע"י עצם הבחירה, ראו projectChainMap/evaluate ב-engine.js) - מה
    // שהיה חסר הוא רק הפרויקט עצמו. "בהמשך" (later) עדיין מכבד את הכלל
    // הכללי - לא משבצים בכוח מקצוע שסומן מפורשות "לא עכשיו".
    if (res.projects && res.projects.chosen && !res.projects.chosen.done && !res.projects.chosen.later) {
      const ids = res.projects.chosen.ids;
      const id = ids.find(i => !doneIds.has(i)) || ids[0];
      if (!missingMandatory.includes(id)) {
        missingMandatory.push(id);
        ptsOverride[id] = res.projects.chosen.pts;
        projectIds.add(id);
        if (res.projects.chosen.planned) plannedMandatoryIds.add(id);
      }
    }
    const remainingIds = [...new Set(missingMandatory)];

    // ---- מאגרי בחירה פתוחים (עדיין לא סיפקו את הדרישה) ----
    // מקצוע-בחירה שסומן "מתוכנן" ב-FinDeg (overrides[id]==="planned") עובר
    // ב-poolHits (engine.js) מ-r.misses ל-r.hits (עם h.planned=true) - זה נכון
    // לצורכי "התקדמות בפועל" (עדיין לא הושלם, לא נספר ב-doneCount/satisfied),
    // אבל בלי הטיפול הבא הוא נעלם *לגמרי* מתוכנית הסמסטרים: לא ב-remainingIds
    // (לא חובה), ולא ב-pool (יצא מ-misses) - "תכנון אופטימלי"/"תכנון ידני" היו
    // בכלל לא מראים מקצוע שהסטודנט/ית כבר בחר/ה ותכנן/ה בפועל, ואפילו עלולים
    // "להמליץ" על מקצוע-בחירה אחר, מיותר, למילוי אותה מכסה (נתפס - בקשת
    // המשתמש/ת, 2026-07-16: "מקצועות שנוספו לא נוספים אוטומטית לתרשים הזרימה").
    // התיקון: מחזירים אותו ל-pool (כדי ש-scheduleUnified ידע שהוא מועמד תקף)
    // ומצרפים אותו ל-pinnedIds למטה (כדי שהוא *ייבחר* וישובץ תמיד, לא רק
    // "יהיה מועמד") - need נשאר מחושב בלי לספור אותו (כמו ב-doneCount/pts
    // הרגילים), כי ההפחתה היחידה שקורה בפועל היא כש-scheduleUnified משבץ אותו
    // דרך pinnedInPool, לא לפני כן - חיסור כפול היה גורם ל-need שלילי מיותר.
    // excludedIds (אופציונלי) - מקצועות שהמשתמש/ת ביטל/ה במפורש (untick בפאנל
    // הבחירה בתכנון אופטימלי, ראו js/flowchart.js): מסוננים מכל מאגר לגמרי -
    // לא ייבחרו אוטומטית, לא כמועדפים, ואפילו לא כ"מתוכננים"/"בהמשך" מ-FinDeg
    // (הביטול כאן הוא ההחלטה העדכנית יותר). בלי זה untick רק שינה צבע -
    // המקצוע חזר להיבחר אוטומטית בכל חישוב מחדש (נתפס - בקשת המשתמש/ת, 2026-07-21).
    const excludedSet = new Set(options.excludedIds || []);
    // מקצועות שסומנו "בהמשך" ב-FinDeg (options.preferredIds) - בחירה מפורשת
    // בדיוק כמו "מתוכנן", רק עם כוונת-תזמון ("לא עכשיו") - *תמיד* נכללים
    // בתוכנית (מאוחדים ל-pinnedIds למטה), גם כשהמאגר שלהם כבר מסופק ע"י מה
    // שהושלם: סטודנט/ית שסימנ/ה מקצוע "בהמשך" מתכוונ/ת לקחת אותו, נקודות
    // עודפות נספרות ממילא לבחירה חופשית (נתפס - בקשת המשתמש/ת, 2026-07-21:
    // "לבחור משהו כ'בהמשך' עדיין לא מוסיף אותו לתרשים" - קרה בדיוק כשכל
    // המאגרים כבר היו מסופקים, אז המילוי דילג עליהם לגמרי).
    const laterWanted = new Set([...(options.preferredIds || [])].filter(id => !excludedSet.has(id)));

    // מזהי "קבוצה א'" (groupA), אם קיימת - נחוצים למילוי אוטומטי מועדף של
    // מאגר "סה"כ בחירה בקבוצות א'+ב'" (groupAB, ראו scheduleUnified): כשיש
    // צורך למלא נקודות אוטומטית ושתי הקבוצות מועמדות, עדיף למלא מקבוצה א'
    // (בד"כ נרחבת/פחות ייחודית) ולא "לבזבז" מקבוצה ב' (בד"כ מוגבלת/ייעודית
    // יותר) על נקודות שאפשר היה להשלים באותה קלות מקבוצה א' (בקשת המשתמש/ת,
    // 2026-07-21). r.section.pool (לא r.misses) - נחוץ תמיד, גם אם groupA
    // עצמה כבר "מסופקת" (satisfied) ולכן לא ב-openPools בכלל.
    const groupAIds = new Set();
    for (const r of res.sections || []) {
      if (r.kind === "chooseCourses" && r.section && r.section.id === "groupA") {
        for (const id of r.section.pool || []) groupAIds.add(id);
      }
    }

    const plannedElectiveIds = new Set();
    const openPools = [];
    for (const r of res.sections || []) {
      if (r.kind !== "chooseCourses" && r.kind !== "choosePoints") continue;
      const plannedIds = r.hits.filter(h => h.planned).map(h => h.id);
      plannedIds.forEach(id => plannedElectiveIds.add(id));
      // מאגר מסופק עדיין נכנס אם יש בו בחירות מפורשות שטרם שובצו ("מתוכנן"
      // או "בהמשך") - הן חייבות מקום בתוכנית גם בלי need פתוח.
      if (r.satisfied && !plannedIds.length && !r.misses.some(id => laterWanted.has(id))) continue;
      if (r.kind === "chooseCourses") {
        openPools.push({ key: r.section.id, title: r.section.title, kind: "count",
          need: r.needed - r.doneCount, pool: [...plannedIds, ...r.misses] });
      } else {
        openPools.push({ key: r.section.id, title: r.section.title, kind: "points",
          need: r.needed - r.pts, pool: [...plannedIds, ...r.misses] });
      }
    }
    for (const c of res.chains || []) {
      if (!c.chooseResult) continue;
      const plannedIds = c.chooseResult.hits.filter(h => h.planned).map(h => h.id);
      plannedIds.forEach(id => plannedElectiveIds.add(id));
      if (c.chooseResult.satisfied && !plannedIds.length && !c.chooseResult.misses.some(id => laterWanted.has(id))) continue;
      openPools.push({ key: c.key + "_choose", title: c.title, kind: "count",
        need: c.chooseResult.min - c.chooseResult.doneCount, pool: [...plannedIds, ...c.chooseResult.misses] });
    }
    // דרישת נק' מצטברת קבוצה א' / קבוצה א'+ב' (ניהול ובנייה בלבד - res.groupA/
    // res.groupAB, ראו evalChoosePoints ב-engine.js): אותו kind:"choosePoints"
    // בדיוק כמו res.sections למעלה, רק עם pool מאוחד משלהן (לא props של
    // res.sections/res.chains הרגילים) - בלעדי הטיפול הבא, המילוי האוטומטי
    // היה עוצר ברגע שממלא רק את מכסת ה"מספר מקצועות" של כל שרשרת-משנה (למשל
    // 3 מ"ניהול ובנייה") בלי לבדוק שגם דרישת הנק' המצטברת (17/20 נק') אכן
    // מתמלאת - סטודנט/ית יכל/ה לקבל בדיוק 3 מקצועות זולים שלא מגיעים ל-17
    // נק' (נתפס - בקשת המשתמש/ת, 2026-07-29). מעבד אחרי שרשראות-המשנה בכוונה,
    // כדי שמה ששובץ כבר דרכן ייזקף לזכות (credited, ראו scheduleUnified) והמילוי
    // הנוסף כאן יתמקד רק בפער האמיתי שנשאר.
    // יקום "השרשראות הרלוונטיות בפועל" - המסלול הראשי (alwaysOn, למשל "ניהול
    // ובנייה") + השרשרת של הפרויקט השני שנבחר בפועל (למשל "חומרים") - res.chains
    // כבר מכיל רק שרשראות "מופעלות" (ראו evaluate ב-engine.js: chain.alwaysOn
    // || projectChain === key), אז אין צורך לשחזר את לוגיקת ה-triggered כאן.
    // בסיס להגבלת המילוי *האוטומטי* של groupA/groupAB למטה בלבד - בחירה ידנית/
    // "בהמשך" עדיין יכולה לכלול כל מקצוע מהמאגר המלא (בקשת המשתמש/ת,
    // 2026-08-20: "if I do management and decide my other project is materials,
    // then any auto fill courses will be either from management or materials
    // chain"). ריק (Set ריק) לגבי מסלולים בלי chains בכלל (structures וכו') -
    // שם autoPool פשוט לא נוסף למטה, ומילוי אוטומטי ממשיך ללא הגבלה כמו קודם.
    const relevantChainIds = new Set();
    for (const c of res.chains || []) {
      for (const row of c.coreRows || []) relevantChainIds.add(row.id);
      if (c.chooseResult) {
        for (const h of c.chooseResult.hits) relevantChainIds.add(h.id);
        for (const id of c.chooseResult.misses) relevantChainIds.add(id);
      }
    }
    for (const r of [res.groupA, res.groupAB].filter(Boolean)) {
      const plannedIds = r.hits.filter(h => h.planned).map(h => h.id);
      plannedIds.forEach(id => plannedElectiveIds.add(id));
      if (r.satisfied && !plannedIds.length && !r.misses.some(id => laterWanted.has(id))) continue;
      const pool = [...plannedIds, ...r.misses];
      const entry = { key: r.section.id, title: r.section.title, kind: "points",
        need: r.needed - r.pts, pool };
      if (relevantChainIds.size) entry.autoPool = pool.filter(id => relevantChainIds.has(id));
      openPools.push(entry);
    }

    if (excludedSet.size) {
      for (const p of openPools) p.pool = p.pool.filter(id => !excludedSet.has(id));
      for (const id of excludedSet) plannedElectiveIds.delete(id);
    }

    // hardPins (אופציונלי, id -> מספר-סמסטר *מוחלט*, ראו js/flowchart.js) -
    // גרירה מפורשת בתצוגת "תכנון אופטימלי": "must", לא הצעה. ממירים למספר
    // יחסי (index 1 = "הסמסטר הבא") לפי planAnchorSemester - בדיוק אותו עוגן
    // ש-js/flowchart.js משתמש בו כדי להציג מספר-סמסטר מוחלט (semOffset שם),
    // לא nominalSemester הגולמי (ראו הערה על planAnchorSemester למעלה - שונים
    // כש-startSeason נדרס ידנית). בלי עוגן (yearKey לא ידוע) מוחלט==יחסי.
    // חל גם על מקצועות חובה (ממוזג ל-lockedMap, גובר על השלד אם שניהם קיימים
    // לאותו מקצוע) וגם על מועמדי-בחירה (מטופל בנפרד ב-scheduleUnified) - לא
    // צריך לדעת כאן מראש מי מהשניים זה, שני הצרכנים מסננים לפי מה שרלוונטי להם.
    const hardPinsRelative = {};
    for (const [id, absSem] of Object.entries(options.hardPins || {})) {
      const rel = planAnchorSemester != null ? absSem - planAnchorSemester + 1 : absSem;
      hardPinsRelative[id] = Math.max(1, rel);
    }
    // מקצוע שסומן "מתוכנן" ב-FinDeg (plannedMandatoryIds/plannedElectiveIds,
    // נאספו למעלה) - הצהרה מפורשת "זה מה שאני לוקח/ת עכשיו", לא רק "עוד
    // מועמד". נכנס לסמסטר הבא (relative=1) באותה עדיפות בדיוק כמו נעיצה
    // ידנית - lockedIds (ל-scheduleUnified) ו-scheduleUnified (ל-
    // scheduleUnified) גם מדלגים על בדיקת-EPS הרגילה עבור מקצועות נעוצים, אז
    // אם דרישת הקדם בפועל לא מתמלאת עד אז - לא "מתקנים" בשקט, פשוט משבצים
    // כמבוקש ומשאירים לתג "!" (prereqSatisfiedAt, js/flowchart.js) לסמן את
    // הבעיה. דריסה מפורשת של המשתמש/ת (options.hardPins, גרירה בפועל) גוברת -
    // "מתוכנן" הוא רק ברירת-מחדל, לא נדרס בחזרה אם כבר נגררה לסמסטר אחר
    // (בקשת המשתמש/ת, 2026-07-25: "that's the user telling you what he is
    // planning on taking and we should respect it as the highest priority,
    // from there you plan").
    for (const id of [...plannedMandatoryIds, ...plannedElectiveIds]) {
      if (hardPinsRelative[id] == null) hardPinsRelative[id] = 1;
    }
    const mandatoryHardPins = {};
    for (const id of remainingIds) if (hardPinsRelative[id] != null) mandatoryHardPins[id] = hardPinsRelative[id];
    // מקצועות עם דרישת-פתיחה מינימלית (MIN_OFFERING_YEAR) - ממירים "שנה
    // עברית מינימלית" לרצפת-סמסטר *יחסית* (index 1 = "הסמסטר הבא", כמו כל
    // מיקום אחר בקובץ הזה) לפי planAnchorSemester - לא nominalSemester הגולמי
    // (ראו הערה על hardPinsRelative למעלה, אותה סיבה בדיוק: startSeason נדרס
    // ידנית מזיז את העוגן בסמסטר אחד, לא רק את העונה). בלי עוגן - מדלגים.
    const minPosMap = {};
    if (planAnchorSemester != null) {
      for (const id of remainingIds) {
        const minYear = MIN_OFFERING_YEAR[id];
        if (!minYear) continue;
        const absMin = minAbsoluteSemesterForYear(options.yearKey, minYear);
        if (absMin != null) minPosMap[id] = Math.max(1, absMin - planAnchorSemester + 1);
      }
    }
    // officialRelMap - בונוס +1.5 ב-scheduleUnified למקצוע שממוקם באותו
    // סמסטר כמו במסלול המומלץ (flowchart-data.js), בכל חמשת המצבים כאחד -
    // כולל "מומלץ" עצמו עכשיו (לא עוד עוגן-מיקום-התחלתי כמו קודם, רק ניקוד).
    // סמסטר-מומלץ שכבר חלף (rel<1, מקצוע בפיגור) לא נכנס - אין "מומלץ" אמיתי
    // עבורו יותר.
    const officialMap = officialBaseline(options.trackKey, options);
    const officialRelMap = {};
    if (officialMap && planAnchorSemester != null) {
      for (const id of remainingIds) {
        if (officialMap[id] == null) continue;
        const rel = officialMap[id] - planAnchorSemester + 1;
        if (rel >= 1) officialRelMap[id] = rel;
      }
    }
    // pointsById/generalNames - scheduleUnified מעדכן אותם ישירות (by
    // reference) עבור מקצועות ספורט/מל"ג/בחירה חופשית הסינתטיים בלבד (אין
    // להם ייצוג אחר) - מקצועות אמיתיים כבר מקבלים ערך כאן.
    const pointsById = {};
    for (const id of remainingIds) pointsById[id] = coursePts(id);
    for (const p of openPools) for (const id of p.pool) pointsById[id] = coursePts(id);
    const generalNames = {};
    // pinnedIds "אמיתי" (פאנל הבחירה בתרשים הזרימה, options.pinnedIds) ∪
    // plannedElectiveIds (סונכרן אוטומטית מ-FinDeg למעלה) - שניהם "חייבים
    // להישבץ", רק המקור שונה (בחירה בתרשים מול בחירה שכבר נעשתה ב-FinDeg עצמו).
    // laterWanted מאוחד פנימה: "בהמשך" = בחירה מפורשת שחייבת שיבוץ, בדיוק
    // כמו "מתוכנן" - לא רק העדפת-מילוי (ראו הערה על laterWanted למעלה).
    const pinnedIds = new Set([...(options.pinnedIds || []), ...plannedElectiveIds, ...laterWanted].filter(id => !excludedSet.has(id)));

    // ---- נקודת-הליבה היחידה: כל חמשת המצבים (options.goal) עוברים דרך
    // scheduleUnified - ראו ההערה שם למפת "תקרה לפי mode". ----
    const mode = options.goal || "recommended";
    const { plan, notes: schedNotes, criticalN } = scheduleUnified(remainingIds, doneIds, mandatoryHardPins,
      minPosMap, openPools, pinnedIds, hardPinsRelative, groupAIds, res.general ? res.general.buckets : null,
      mode, options.fixedValue, officialRelMap, planAnchorSemester, pointsById, generalNames, projectIds);
    const minSemesters = criticalN;
    // הבחנה בניסוח בין נעיצה ידנית אמיתית (גרירה, options.hardPins) לבין
    // נעיצה שמקורה בסימון "מתוכנן" ב-FinDeg (plannedMandatoryIds/
    // plannedElectiveIds, שהוזגו לתוך hardPinsRelative למעלה) - שתיהן
    // מתנהגות זהה (relative=1, קבוע) אבל הניסוח "נעוץ ידנית... גרירה" היה
    // מטעה כשהמקור בפועל היה "מתוכנן", לא גרירה בתרשים (בקשת המשתמש/ת,
    // 2026-07-25). מתקנים את schedNotes בדיעבד (kind:"hard-pin" שיצא מתוך
    // scheduleUnified) במקום להעביר פרמטר נוסף דרך כל שרשרת הקריאות עד לשם.
    const explicitHardPinIds = new Set(Object.keys(options.hardPins || {}));
    const plannedReason = "סומן \"מתוכנן\" ב-FinDeg - משובץ אוטומטית לסמסטר הבא, קבוע";
    const draggedReason = "נעוץ ידנית לסמסטר הזה (גרירה) - קבוע, לא יוזז אוטומטית";
    for (const n of schedNotes) {
      if (n.kind === "hard-pin" && !explicitHardPinIds.has(n.id) && plannedElectiveIds.has(n.id) && n.reason === draggedReason) {
        n.reason = plannedReason;
      }
    }
    // מקצועות חובה שנעצו קשיח (mandatoryHardPins) - הערה מסבירה, בדיוק כמו
    // שמועמדי-בחירה נעוצים-קשיח מקבלים בתוך scheduleUnified. אין צורך לבדוק
    // את המיקום הסופי ב-plan - הוא מובטח להיות בדיוק mandatoryHardPins[id].
    const mandatoryHardPinNotes = Object.keys(mandatoryHardPins).map(id => ({
      id, kind: "hard-pin", to: mandatoryHardPins[id],
      reason: (!explicitHardPinIds.has(id) && plannedMandatoryIds.has(id)) ? plannedReason : draggedReason
    }));
    // repairPrereqOrder לא אמור לזוז מקצוע שנעוץ קשיח בכלל (מחובה או בחירה) -
    // "must" פירושו קבוע, גם אם דרישת הקדם שלו לא בפועל מתמלאת בסמסטר הזה.
    // capPts=0 (בלי תקרה) תמיד - scheduleUnified כבר כיבד את תקרת המצב שלו
    // בזמן השיבוץ הראשוני; תקרה נוספת כאן הייתה דוחפת תיקון-דרישת-קדם בודד
    // לסמסטר חדש כמעט-ריק בסוף התוכנית במקום לספוג אותו בסמסטר קיים.
    const repairNotes = repairPrereqOrder(plan, doneIds, 0, new Set(Object.keys(hardPinsRelative)));

    // ---- "מה הייתי אמור/ה כבר להשלים עד עכשיו" - תמיד מול קו-הבסיס הרשמי
    // (flowchart-data.js). ---
    const overdueIds = (nominalSemester != null && officialMap)
      ? remainingIds.filter(id => officialMap[id] != null && officialMap[id] < nominalSemester)
      : [];
    const overdueNotes = overdueIds.map(id => ({
      id, kind: "overdue",
      reason: "לפי קו-הבסיס הרשמי היה אמור/ה להיות מושלם עד סמסטר " + officialMap[id] +
        " - כרגע בפיגור (נמצא/ת נומינלית בסמסטר " + nominalSemester + ")"
    }));

    // מקצועות חובה שנותרו + כל מועמדי-הבחירה הפתוחים (לא רק מי שבאמת שובץ
    // ב-plan) - נחוץ לתצוגת "תכנון ידני" (renderManualView, js/flowchart.js)
    // שרוצה להציג "מגירה" עם כל המקצועות הרלוונטיים לפני שהמשתמש/ת גורר/ת
    // אותם בעצמו/ה לסמסטר, לא רק את מה ש-scheduleUnified בחר/ה אוטומטית.
    const electivePools = openPools.map(p => ({ key: p.key, title: p.title, kind: p.kind, ids: p.pool }));

    return {
      plan, // [{index, season, ids, pts}] - index יחסי, 1 = "הסמסטר הבא"; ראו nominalSemester להמרה למספר אמיתי
      pointsById,
      // id (gen_pe_1/gen_enrich_2/gen_free_3 וכו', ראו scheduleUnified) ->
      // תווית תצוגה קצרה+ממוספרת ("מל\"ג 2") - למקצועות ספורט/מל"ג/בחירה
      // חופשית שאין להם id קטלוגי אמיתי, כדי ש-js/flowchart.js ידע להציג
      // אותם בתיבה בלי לנסות לחפש אותם ב-D.courseNames (לא ימצא כלום שם).
      generalNames,
      mandatoryIds: remainingIds,
      electivePools,
      totalSemesters: plan.length,
      criticalPathSemesters: minSemesters,
      hasOfficialBaseline: !!(officialMap || Object.keys(mandatoryHardPins).length),
      // מספר-הסמסטר האמיתי (לא היחסי) שבו אמור/ה להיות עכשיו, לפי תאריך
      // (null אם yearKey לא סופק/לא ידוע - ראו computeNominalSemester). עובדה
      // תאריכית טהורה - לא מושפעת מ-startSeason, משמש ל"מה הייתי אמור/ה כבר
      // להשלים" (overdueIds למטה) ולתצוגת "נומינלית כרגע בסמסטר X" בלבד.
      nominalSemester,
      // מספר-הסמסטר המוחלט שאליו סמסטר יחסי 1 של plan מתייחס בפועל - זה מה
      // ש-js/flowchart.js צריך להשתמש בו לחישוב semOffset (לא nominalSemester
      // הגולמי), אחרת דריסת startSeason ידנית כדי לדלג על סמסטר שכבר תוכנן
      // בנפרד (ראו הערה למעלה) הייתה מציגה מספר-סמסטר שגוי (קטן ב-1) למרות
      // שהעונה עצמה כן תוקנה.
      planAnchorSemester,
      overdueIds, // subset של remainingIds שהיה אמור/ה להיות מושלם לפי קו-הבסיס הרשמי אך עוד לא
      notes: [...schedNotes, ...mandatoryHardPinNotes, ...repairNotes, ...overdueNotes],
      unplacedPools: openPools.filter(p => {
        // "מולא" = שיבוצים אוטומטיים (elective) + גרירות ידניות (hard-pin) +
        // זיכוי על מקצועות ששובצו כבר דרך מאגר אחר (pool-credit) - כל השלושה
        // מספקים את הדרישה בפועל, לא רק הראשון (ראו scheduleUnified).
        const filled = schedNotes
          .filter(n => (n.kind === "elective" || n.kind === "hard-pin") && n.pool === p.key)
          .reduce((s, n) => s + (p.kind === "points" ? coursePts(n.id) : 1), 0);
        const credited = schedNotes
          .filter(n => n.kind === "pool-credit" && n.pool === p.key)
          .reduce((s, n) => s + n.amount, 0);
        return filled + credited < p.need;
      }).map(p => p.key)
    };
  }

  return { computePlan, computeEPS, inferNextSeason };
})();
