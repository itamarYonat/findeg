/* FinDeg – אופטימיזציית מפת קורסים לסמסטרים הבאים.
 *
 * גישה (עודכן 2026-07-13, בקשת המשתמש/ת): כל מקצוע חובה שנותר נסחט מלכתחילה
 * ל-EPS שלו (Earliest Possible Semester - הסמסטר המוקדם ביותר שדרישות הקדם
 * שלו מתמלאות בו) - "לא לדחות שום דבר בלי סיבה מבנית". זה קובע גם את המספר
 * המינימלי התיאורטי של סמסטרים (criticalN = ה-EPS הגבוה ביותר מבין הנותרים).
 * מעל הבסיס הזה, שני סוגי שיפורים ממוקדים:
 *
 *   1. "מתיחת נתיב קריטי" - הגנה על מקצועות עם slack=0 (Critical Path Method
 *      - על השרשרת הארוכה ביותר שקובעת את criticalN) שיצאו ממוקמים מאוחר
 *      מ-EPS שלהם ע"י שלב 2/קו-בסיס - נדחפים בחזרה ל-EPS.
 *   2. "איזון נקודות" - מקצוע עם slack>0 (LPS-EPS גדול מ-0, כלומר יש לו יותר
 *      מסמסטר-יעד אחד אפשרי) מוזז בתוך [EPS,LPS] שלו לסמסטר עם פחות נקודות
 *      נצברות, כדי לפזר את העומס בין הסמסטרים במקום לדחוס אותם לפי הסדר
 *      שקבע ה-EPS גרידא.
 *
 * חריגה יחידה: סטודנט/ית שעדיין *לא* התחיל/ה ללמוד בכלל (doneIds ריק)
 * ובמסלול עם סדר-לימוד מומלץ ידני/רשמי (GREEDY_SKELETON או קו-הבסיס הרשמי,
 * js/flowchart-data.js) - שם המיקום ההתחלתי (לפני שלבי 1-2) הוא הסדר המומלץ,
 * לא EPS ישירות, כדי לשמר את הסדר ש"עם החברים" הולכים לפיו. ברגע שיש היסטוריה
 * בפועל (doneIds לא ריק) הסדר המומלץ כבר לא רלוונטי לנקודת ההתחלה הספציפית
 * של הסטודנט/ית הזו - מתעלמים ממנו לגמרי וסוחטים ישירות ל-EPS.
 *
 * מקצועות בחירה (electives) אין להם מיקום "רשמי" מלכתחילה - הם פשוט נכנסים
 * לתוך "משבצות פתוחות" (נקודות/מקצועות עוד חסרים במאגר בחירה) בכל סמסטר לפי
 * מה שנשאר מקום אליו, קודם, קדם ורמת קושי - זה מה שהופך את הבעיה לפתירה
 * הרבה יותר בקלות ממה שהיא הייתה אם הכול היה "קשיח".
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
  // capPts בכל הקובץ הזה יכול להיות מספר קבוע (כרגיל) *או* פונקציה
  // semIndex->מספר - "תקרה יורדת" למצב "מומלץ" (ראו buildTaperCap/goal:
  // "recommended" ב-computePlan) - עומס כבד בהתחלה, מקל בהדרגה בהמשך, במקום
  // תקרה שטוחה זהה לכל סמסטר. כל מקום שבודק/משתמש ב-capPts כמספר צריך לעבור
  // דרך capAt(capPts, idx) במקום להשתמש בו ישירות - כך שהתמיכה בתקרה יורדת
  // "שקופה" לכל שאר האלגוריתם (שלב 3/fillElectives/repairPrereqOrder/
  // scheduleGeneralEd) בלי לשנות את הלוגיקה שלהם, רק את המספר שמושווים אליו.
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
  // מעגל אחורה לסמסטר התואם הקרוב ביותר (<=)
  function roundDownToSeason(index, seasons) {
    if (!seasons) return index;
    let i = index;
    while (i >= 1 && !seasons.includes(semesterSeason(i))) i--;
    return i > 0 ? i : index; // אם לא נמצא כלל (לא אמור לקרות) - לא מגבילים
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

  // מקצועות ש"תלויים" קריטית במקצוע נתון (כלומר, המקצוע הזה חבר בצירוף
  // דרישות הקדם שבפועל קבע את ה-EPS שלהם - לא סתם "אחת מכמה חלופות אפשריות")
  function buildCriticalDependents(remainingIds, source) {
    const dependents = {};
    for (const id of remainingIds) dependents[id] = [];
    for (const id of remainingIds) {
      const bundle = source[id];
      if (!bundle) continue;
      for (const p of bundle) {
        // p עלול להיות קוד ישן/מקביל (equivGroups) שאינו בעצמו חלק מ-
        // remainingIds (למשל "00140610" הקוד הישן של "00140619") - בלי
        // הפתרון הבא, dependents[p] היה undefined והתלות האמיתית הייתה
        // "נעלמת" בשקט: שלב 2/3 היו רואים את "00140619" כחופשי לגמרי
        // להזזה, בלי לדעת שמקצוע אחר תלוי בו דרך השם הישן - ואז
        // repairPrereqOrder היה צריך לתקן בדיעבד ומאריך את כל התוכנית
        // (נתפס - בקשת המשתמש/ת, 2026-07-17: מעבר למצב "מינימום סמסטרים"
        // האריך את התוכנית במקום לשמר את אורך ה-front-load).
        const real = equivSet(p).find(e => dependents[e]);
        if (real) dependents[real].push(id);
      }
    }
    return dependents;
  }

  // כמו pos[id], אבל "סולח" על קוד ישן/מקביל (equivGroups) שאין לו בעצמו
  // עמדה ב-pos - פותר לפי מי מחברי קבוצת-השקילות שכן ממוקם. משמש בכל מקום
  // ששלב 2/3 קוראים pos[מזהה-קדם] ישירות (אותה בעיה בדיוק כמו ב-
  // buildCriticalDependents למעלה, רק בכיוון ההפוך - "מה המיקום החי של
  // דרישת הקדם הזו" במקום "מי תלוי בי").
  function resolveLivePos(id, pos) {
    if (pos[id] != null) return pos[id];
    const alt = equivSet(id).find(e => pos[e] != null);
    return alt != null ? pos[alt] : null;
  }

  // LPS (Latest Possible Semester) ביחס ליעד targetN (בד"כ = הנתיב הקריטי -
  // מספר הסמסטרים המינימלי התיאורטי - כדי ש-slack=0 יסמן באמת "אסור לזוז")
  function computeLPS(remainingIds, dependents, targetN) {
    const lps = {};
    function lpsOf(id) {
      if (lps[id] != null) return lps[id];
      lps[id] = targetN; // הגנה מפני מעגליות
      const deps = dependents[id] || [];
      let latest = targetN;
      for (const d of deps) latest = Math.min(latest, lpsOf(d) - 1);
      const rounded = roundDownToSeason(latest, courseSeasons(id));
      lps[id] = rounded;
      return rounded;
    }
    for (const id of remainingIds) lpsOf(id);
    return lps;
  }

  /**
   * גבול תחתון אמיתי למספר-הסמסטרים המינימלי התיאורטי, כולל מאגרי-בחירה
   * פתוחים - לא רק מקצועות חובה (criticalN ב-scheduleMandatory/computePlan
   * למטה מחושב אך ורק מ-remainingIds, שהם חובה בלבד; מאגר בחירה פתוח כמו
   * "עוד 6 נק' מקבוצה א'" לא משפיע עליו כלל, גם אם המועמדים היחידים שנשארו
   * בו תלויים בשרשרת-קדם ארוכה). "לא בוחר" אילו מקצועות ספציפיים ימלאו את
   * המאגר (זה עדיין תפקידה הבלעדי של fillElectives) - רק שואל, עבור כל
   * מאגר בנפרד, "מה הכי מהר שניתן היה למלא את הדרישה הזו תיאורטית, עם
   * הבחירה הכי חכמה האפשרית": ממיינים את כל המועמדים לפי EPS (המוקדם קודם,
   * מכבד עונתיות - roundUpToSeason כבר בפנים), וצוברים עד שהדרישה (נק'
   * או מס' מקצועות) מתמלאת - ה-EPS של המועמד האחרון שנצבר הוא הגבול התחתון
   * של המאגר הזה (מתמטית אי אפשר למלא אותו מהר יותר, גם עם הבחירה הטובה
   * ביותר). התוצאה הסופית היא המקסימום מבין כל המאגרים + criticalN של
   * מקצועות החובה (ראו minSemesters ב-computePlan).
   */
  function computeOpenPoolsMinSemesters(openPools, doneIds, mandatoryEps) {
    let bound = 0;
    for (const p of openPools) {
      if (!(p.need > 0)) continue;
      const { eps: candEps } = computeEPS(p.pool, doneIds, mandatoryEps, true);
      const ranked = p.pool.filter(id => Number.isFinite(candEps[id])).sort((a, b) => candEps[a] - candEps[b]);
      let remaining = p.need, last = 0;
      for (const id of ranked) {
        if (remaining <= 0) break;
        remaining -= (p.kind === "points" ? coursePts(id) : 1);
        last = candEps[id];
      }
      // אם אין מספיק מועמדים בני-אימות בכלל למלא את הדרישה - "last" נשאר
      // ה-EPS של האחרון שכן נוסה (הכי טוב שאפשר לדעת כרגע), לא Infinity -
      // עדיף גבול-תחתון תת-מוערך על פני לשבור את כל החישוב.
      bound = Math.max(bound, last);
    }
    return bound;
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

  // ---------- "תקרה יורדת" למצב "מומלץ" (goal: "recommended") ----------
  // רוב הסטודנטים/ות רוצים להעמיס בכבדות בשנים הראשונות (שם יש הכי הרבה
  // מקצועות-חובה עם דרישות-קדם קלות, ופחות "עייפות תואר") ולהקל בהדרגה
  // בהמשך - "במיוחד מסמסטר ב' של שנה ג' ואילך" (בקשת המשתמש/ת, 2026-07-19).
  // TAPER_FROM (=6, "סמסטר ב' של שנה ג'") הוא מספר-סמסטר *מוחלט* מתחילת
  // התואר, לא index יחסי לתוכנית הנותרת - סטודנט/ית שכבר בשנה ג' לא אמור/ה
  // לקבל את כל התוכנית הנותרת בעומס כבד רק כי index=1 שם. לכן ממירים index
  // יחסי -> מוחלט לפי nominalSemester (אותו תרגום בדיוק כמו isYearOne ב-
  // scheduleGeneralEd) - בלי nominalSemester (yearKey לא ידוע) מתייחסים
  // ל-index עצמו כאילו הוא כבר מוחלט (הכי סביר כברירת מחדל: "הסמסטר הבא"
  // שלי הוא גם "הסמסטר 1" שלי, כי אין נתון אחר). מעבר ל-TAPER_FROM - יורד
  // ב-TAPER_STEP נק' לכל סמסטר, עד רצפה (TAPER_FLOOR) שעדיין מהווה עומס
  // לימודים משמעותי, לא כמעט-כלום.
  const TAPER_FROM = 6, TAPER_STEP = 3, TAPER_FLOOR = 10;
  // תקרת-סמסטרים מוחלטת קשיחה - 8 (תואר תקן), גם במחיר חריגה מהתקרה הרגילה
  // (peak/taper) באחד הסמסטרים, לא הארכת התוכנית בלי סוף: "recommended"
  // לעולם לא אמור להציע תואר שנמשך יותר מ-8 סמסטרים בגלל תקרת-נק' בלבד
  // (בקשת המשתמש/ת, 2026-07-21: "should not resort to extending the path
  // to more than 8 semesters overall [lest it exceeds 25 pts/semester]").
  // דרישות-קדם אמיתיות (EPS/criticalN) עדיין יכולות להאריך מעבר לזה אם
  // באמת הכרחי מבנית - זה לא ניתן לעקיפה בשום מצב, רק החריגה *מהתקרה* היא
  // מה שמוותרים עליה כאן.
  const TAPER_MAX_SEMESTERS = 8;
  // סף "עומס מדי" לסמסטר האחרון בפועל של "מומלץ" - מעליו עדיף לפתוח עוד
  // סמסטר (אם עדיין לא הגענו ל-TAPER_MAX_SEMESTERS) ולפזר, ראו הבלוק אחרי
  // רשת-הביטחון של 8 הסמסטרים ב-computePlan (בקשת המשתמש/ת, 2026-07-24).
  const TAPER_SPLIT_THRESHOLD = 10;
  function buildTaperCap(nominalSemester, peak) {
    peak = peak > 0 ? peak : 25;
    // index יחסי מקסימלי שעדיין מסתיים בסמסטר מוחלט 8 - מי שכבר נמצא/ת
    // נומינלית בסמסטר X נשארו לה/ו לכל היותר 8-X+1 סמסטרים עד שם.
    const maxRel = nominalSemester != null ? Math.max(1, TAPER_MAX_SEMESTERS - nominalSemester + 1) : TAPER_MAX_SEMESTERS;
    return function (idx) {
      // "שסתום שחרור" - מהסמסטר האחרון המותר והלאה אין תקרה בכלל, כדי
      // שדחיסת-קיבולת (שלב 3/fillElectives/scheduleGeneralEd) תעדיף לדחוס
      // הכול לשם במקום לפתוח סמסטר תשיעי.
      if (idx >= maxRel) return Infinity;
      const abs = nominalSemester != null ? (nominalSemester - 1 + idx) : idx;
      if (abs <= TAPER_FROM) return peak;
      return Math.max(TAPER_FLOOR, peak - TAPER_STEP * (abs - TAPER_FROM));
    };
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

  /**
   * שלד ידני ("greedy skeleton") למסלולי ניהול ובנייה/מבנים - עוגנים קבועים
   * שתמיד יתוזמנו באותו סמסטר (1-אינדקס לפי סדר הרשימה), נבחר ידנית ע"י
   * המשתמש/ת ולא נגזר מ-EPS/LPS או מקו-הבסיס הרשמי (flowchart-data.js) - שונה
   * ממנו במכוון (למשל 00140618 מוקדם משמעותית מהמיקום ה"רשמי" כי אין לו
   * דרישות קדם וכדאי לנצל את זה). כל מה שלא ברשימה כאן "לא קריטי" - מתוזמן
   * כרגיל ע"י EPS/LPS/איזון-קושי/קיבולת (scheduleMandatory), בדיוק כמו קודם.
   * איבר שהוא מערך (למשל [03140535,03140536]) הוא קבוצת-שקילות - "מבוא
   * להנדסת חומרים" מקודד בקטלוגים שונים תחת קוד אחר, נבחר בפועל לפי מה
   * שבאמת מופיע ב-remainingIds (ראו skeletonLockMap).
   */
  const GREEDY_SKELETON = {
    management: [
      ["00140008", "00140102", "01040019", "01040042", "01250001"],
      ["00140104", "01040044", "01040131", "00140618"],
      ["00140214", "00140505", ["03140535", "03140536"], "00140108"],
      ["00140153", "00140405"],
      ["00140619", "00140409", "00140617"],
      ["00140411", "00140609"]
    ],
    structures: [
      ["00140008", "00140102", "01040019", "01040042", "01250001"],
      ["00140104", "01040044", "01040131", "00140618"],
      ["00140214", "00140505", ["03140535", "03140536"], "00140108"],
      ["00140153", "00140405"],
      ["00140143", "00140409", "00140145", "00140149"],
      ["00140411", "00140150", "00140148"],
      ["00140163", "00140147"]
    ]
  };

  /**
   * ממפה את GREEDY_SKELETON לרשימת מקצועות שעדיין נותרו בפועל (remainingIds)
   * -> מספר סמסטר קבוע. עבור קבוצת-שקילות (מערך) בוחרים את הזהות שבאמת
   * מופיעה ב-remainingIds (תלוי קטלוג/שנתון); עבור מי שכבר הושלם - לא נכנס
   * למפה כלל (אין צורך לנעול מקצוע שכבר לא ברשימת החסרים).
   */
  function skeletonLockMap(trackKey, remainingIds) {
    const blocks = GREEDY_SKELETON[trackKey];
    if (!blocks) return null;
    const remainingSet = new Set(remainingIds);
    const locked = {};
    blocks.forEach((slots, i) => {
      const semNum = i + 1;
      for (const entry of slots) {
        const alts = Array.isArray(entry) ? entry : [entry];
        const hit = alts.find(id => remainingSet.has(id));
        if (hit) locked[hit] = semNum;
      }
    });
    return locked;
  }

  // מספר "עונות בטוחות" למקצוע - כמה גמיש/בטוח להזיז אותו: 2 = ניתן בשתי
  // העונות (או שלא ידוע בכלל - לא מגבילים, ראו courseSeasons), 1 = עונה אחת
  // בלבד (מסוכן יותר להזיז - עלול "לא לצאת" באותה שנה אם מפספסים).
  function seasonFlex(id) {
    const s = courseSeasons(id);
    return s ? s.length : 2;
  }

  /**
   * הליבה: בונה תוכנית סמסטרים לרשימת מקצועות חובה שנותרו (remainingIds),
   * עם EPS/LPS/slack, קו-בסיס (רשמי אם קיים, אחרת EPS עצמו), מתיחת נתיב
   * קריטי, ואז מפזר עודף/פערים לפי slack וקיבולת סמסטר.
   * balance (ברירת מחדל true) - כשfalse מדלג על שלב 2 (איזון נקודות בין
   * סמסטרים לפי slack). זה ההבדל היחיד בין מצב "עומס מאוזן" ל-"front-load"
   * (בקשת המשתמש/ת, 2026-07-16): שניהם מכבדים capPts בשלב 3, אבל front-load
   * לא מזיז אקטיבית מקצוע עם slack>0 כדי לפזר עומס - הוא נשאר בסמסטר
   * המוקדם ביותר (EPS) שלו, וזז הלאה רק כשסמסטר בפועל חורג מהתקרה.
   */
  // prefPosMap (אופציונלי, id -> סמסטר יחסי) - המיקום ה*מומלץ* לפי הקטלוג
  // הרשמי (flowchart-data.js), מומר לעוגן היחסי שלנו ב-computePlan. בניגוד
  // ל-baselineMap (שקובע את המיקום ההתחלתי, ורק לסטודנט/ית שטרם התחיל/ה),
  // זה רק *העדפת שוויון* בשלבי האיזון: מקצוע לא יוזז מהסמסטר המומלץ שלו
  // (ולא יימנע מלחזור אליו) אלא אם ההזזה משפרת את איזון הנקודות באופן
  // ממשי (PREF_TOL) - "כשזה כמעט אותו דבר, עדיף להיות עם החברים בסמסטר
  // שהקטלוג התכוון אליו" (בקשת המשתמש/ת, 2026-07-22).
  const PREF_TOL = 3; // נק' - בערך מקצוע טיפוסי אחד; מתחת לזה השיפור לא שווה סטייה מהמומלץ
  function scheduleMandatory(remainingIds, doneIds, baselineMap, capPts, lockedMap, minPosMap, balance, prefPosMap) {
    if (balance == null) balance = true;
    const { eps, source } = computeEPS(remainingIds, doneIds);
    const notes = [];
    // מקצועות עם תאריך-פתיחה מינימלי ידוע (MIN_OFFERING_YEAR, minPosMap
    // נבנה ב-computePlan) - מעלים את ה-EPS המבני עצמו, לא רק את pos[] בהמשך,
    // כדי שגם slack/LPS/שלבי האיזון למטה "ידעו" שהמקצוע לא זמין קודם לכן
    // ולא ינסו למשוך אותו מוקדם יותר. source[id]=null - זו לא "צוואר בקבוק"
    // של דרישת קדם אמיתית, אין תלות-קריטית אמיתית לבנות ממנה.
    if (minPosMap) {
      for (const id of remainingIds) {
        if (minPosMap[id] != null && minPosMap[id] > eps[id]) {
          notes.push({ id, kind: "not-yet-offered", from: eps[id], to: minPosMap[id],
            reason: "המקצוע עדיין לא נפתח בפועל - נדחה לסמסטר המוקדם ביותר שבו הוא צפוי להיפתח" });
          eps[id] = minPosMap[id];
          source[id] = null;
        }
      }
    }
    const dependents = buildCriticalDependents(remainingIds, source);
    const criticalN = remainingIds.length ? Math.max(1, ...remainingIds.map(id => eps[id])) : 1;
    const lps = computeLPS(remainingIds, dependents, criticalN);
    // מקצועות "שלד" (GREEDY_SKELETON) - סמסטר קבוע, לא זז בשום שלב למטה
    // (1-3). כל מה שלא כאן "לא קריטי" - מתוזמן כרגיל.
    const lockedIds = new Set(lockedMap ? Object.keys(lockedMap) : []);

    // קו בסיס בפועל: נתון רשמי (baselineMap, מוזז כך שסמסטר 1 = "הסמסטר הבא"
    // האמיתי) אם קיים; אחרת EPS. שלד ידני/נעיצה קשיחה (lockedMap) *דורסים*
    // את המיקום הזה בשלב נפרד אחריו - שכבה על גבי הבסיס, לא חלופה בלעדית לו
    // (נתפס ותוקן 2026-07-20: מסלול בלי שלד שקיבל נעיצה קשיחה בודדת אחת היה
    // מאבד את קו-הבסיס הרשמי *לכל* שאר המקצועות שלו, כי lockedMap הפך מ-null
    // לאובייקט לא-ריק ברגע שהייתה נעיצה אחת בכלל - הענף "אם lockedMap" למעלה
    // חל אז על כולם, לא רק על הנעוץ).
    let pos = {};
    if (baselineMap) {
      // המרה: הסמסטר הרשמי המוקדם ביותר מבין מה שנשאר -> העוגן לסמסטר 1 שלנו
      const officialMin = Math.min(...remainingIds.map(id => baselineMap[id] ?? 99));
      for (const id of remainingIds) {
        pos[id] = baselineMap[id] != null ? (baselineMap[id] - officialMin + 1) : eps[id];
      }
    } else {
      for (const id of remainingIds) pos[id] = eps[id];
    }
    if (lockedMap) {
      for (const id of remainingIds) if (lockedMap[id] != null) pos[id] = lockedMap[id];
    }
    // הגנה כפולה על כל מיקום שמקורו בקו הבסיס הרשמי/בשלד הידני: (א) לא פחות
    // מ-EPS - מי שמאחורה בפועל (למשל אחרי חזרה על מקצוע) לא יכול/ה להתחיל
    // לפני שדרישות הקדם באמת מתמלאות (זו גם רשת ביטחון על השלד הידני - אם
    // עוגן קבוע נסתר במקרה עומד לפני ה-EPS המבני שלו, זו טעות בשלד ולא
    // התנהגות רצויה, אז הוא נדחק קדימה כמו כל טעות אחרת); (ב) עיגול לעונה
    // הנכונה - "מספר סמסטר" בקו הבסיס הרשמי הוא רק סדר יחסי, לא הבטחת עונה
    // (הזזת ה-officialMin לסמסטר 1 שלנו לא בהכרח שומרת על זוגיות חורף/אביב
    // אם currentStartSeason שונה מהעונה שממנה קו הבסיס עצמו התחיל את הספירה)
    // - בלי זה מקצוע יכול לצאת ממוקם בעונה שהוא כלל לא ניתן בה (נתפס ותוקן 2026-07-10).
    // מקצועות "שלד" (lockedIds) מדולגים מהגנת ה-EPS הזו במכוון: השלד אומת
    // ידנית מול גרף דרישות הקדם האמיתי, בעוד ש-EPS המבני יכול "להתנפח"
    // ממקורות נתונים לא מדויקים (למשל דרישת קדם רשומה למקצוע השלמות/סיווג
    // שרק חלק מהסטודנטים צריכים בפועל, לא דרישה אמיתית לכולם) - סומכים על
    // הנעילה הידנית, לא על ה-EPS, לגביהם בלבד.
    for (const id of remainingIds) {
      if (!lockedIds.has(id)) pos[id] = Math.max(pos[id], eps[id], 1);
      pos[id] = roundUpToSeason(pos[id], courseSeasons(id));
    }

    // שלב 1: מתיחת נתיב קריטי - מקצוע עם slack=0 שממוקם מאוחר מ-EPS שלו
    // חוסם בפועל את אורך התוכנית כולה - מזיזים אותו ל-EPS, בסדר טופולוגי
    // (מה שמקדם EPS מוקדם קודם) כדי לאפשר לתלויים בו "לרדוף" באותו מעבר.
    // מקצועות "שלד" (lockedIds) מדולגים - הסמסטר שלהם קבוע מראש, לא נגזר.
    const topoOrder = [...remainingIds].sort((a, b) => eps[a] - eps[b]);
    for (const id of topoOrder) {
      if (lockedIds.has(id)) continue;
      const slack = lps[id] - eps[id];
      if (slack === 0 && pos[id] > eps[id]) {
        notes.push({ id, kind: "pulled-earlier", from: pos[id], to: eps[id],
          reason: "על הנתיב הקריטי - הזזה מוקדמת מקצרת את התואר" });
        pos[id] = eps[id];
      }
    }

    // שלב 2: איזון נקודות - כל מקצוע עם slack>0 (כבר בממוקם ב-EPS שלו, ראו
    // שלב 1/pos הראשוני) מוזז בתוך [EPS,LPS] שלו לסמסטר עם פחות נקודות, כדי
    // לאזן את עומס הנקודות בין הסמסטרים ככל האפשר (לא רק מקצועות "קשים" -
    // בקשת המשתמש/ת, 2026-07-13: היעד הוא איזון נקודות, לא קושי).
    // מקצועות "שלד" לא מועמדים להזזה (לא ב-flexible) - אבל עדיין נספרים
    // בעומס (loadOf) של הסמסטר שלהם, כך שהאיזון קורה סביבם, לא דרכם.
    const planLen = Math.max(criticalN, ...Object.values(pos));
    function loadOf(semIndex) {
      return remainingIds.filter(id => pos[id] === semIndex)
        .reduce((s, id) => s + coursePts(id), 0);
    }
    if (balance) {
      // הכי "דחוק" קודם (slack קטן - פחות הזדמנויות לזוז מאוחר יותר בלולאה);
      // בין שווים - נקודות גבוהות קודם (למקצוע הזה יש את ההשפעה הכי גדולה על האיזון).
      const flexible = topoOrder.filter(id => !lockedIds.has(id) && lps[id] - eps[id] > 0)
        .sort((a, b) => (lps[a] - eps[a]) - (lps[b] - eps[b]) || coursePts(b) - coursePts(a));
      for (const id of flexible) {
        const pts = coursePts(id);
        const seasons = courseSeasons(id);
        // גבולות "חיים" (לא רק EPS/LPS הסטטיים): דרישות הקדם וה"תלויים" של
        // המקצוע הזה יכלו כבר לזוז בשלבים קודמים (או באיטרציה קודמת של אותו
        // שלב) - סטטי [EPS,LPS] בלבד לא מבטיח pos[קדם] < pos[זה] < pos[תלוי]
        // בפועל, רק שכל אחד בנפרד בתוך הטווח התיאורטי שלו (נתפס ותוקן 2026-07-10).
        const livePrereqMax = Math.max(0, ...(source[id] || []).map(p => resolveLivePos(p, pos) ?? 0));
        const liveDependentMin = Math.min(lps[id] + 1, ...(dependents[id] || []).map(dd => pos[dd] ?? Infinity));
        const pref = prefPosMap ? prefPosMap[id] : null;
        let bestSem = pos[id], bestLoad = loadOf(pos[id]);
        // עומס הסמסטר המומלץ (אם הוא בכלל מועמד חוקי בטווח/עונה - אחרת נשאר
        // null וההעדפה פשוט לא חלה). כשהמקצוע כבר יושב שם - זה עומסו הנוכחי.
        let prefLoad = pos[id] === pref ? bestLoad : null;
        for (let s = Math.max(eps[id], livePrereqMax + 1); s <= Math.min(lps[id], liveDependentMin - 1); s++) {
          if (s === pos[id]) continue;
          if (seasons && !seasons.includes(semesterSeason(s))) continue; // המקצוע לא ניתן בעונה הזו
          const load = loadOf(s) + pts; // העומס בסמסטר החדש אחרי ההזזה
          if (s === pref) prefLoad = load;
          if (load < bestLoad - 0.3) { bestLoad = load; bestSem = s; } // סף קטן - לא זזים על שיפור זניח
        }
        // העדפת הסמסטר המומלץ (prefPosMap): אם הוא כמעט-תיקו מול המנצח לפי
        // עומס (בתוך PREF_TOL) - הוא גובר. מכסה את שני הכיוונים: נשארים בו
        // כשכבר שם (bestSem היה מזיז החוצה על שיפור קטן), וחוזרים אליו כשלא.
        if (pref != null && prefLoad != null && bestSem !== pref && prefLoad <= bestLoad + PREF_TOL) {
          bestSem = pref;
        }
        if (bestSem !== pos[id]) {
          notes.push({ id, kind: "rebalanced", from: pos[id], to: bestSem,
            reason: bestSem === pref
              ? "יושר לסמסטר המומלץ לפי הקטלוג - האיזון כמעט זהה, עדיף להישאר עם המסלול הרשמי"
              : "לא חוסם כלום בהמשך - הוזז כדי לאזן נקודות בין הסמסטרים" });
          pos[id] = bestSem;
        }
      }
    }

    // שלב 3: קיבולת - סמסטר שחורג ממכסת הנקודות מעביר את המקצוע עם ה-slack
    // הגדול ביותר (הכי "לא דוחק") לסמסטר הבא בתוך [EPS,LPS] שלו; אם אין
    // סמסטר כזה בתוך הגמישות - התוכנית מתארכת בסמסטר אחד ומנסים שוב.
    let extended = Math.max(planLen, ...Object.values(pos));
    for (let guard = 0; guard < 50; guard++) {
      let moved = false;
      for (let s = 1; s <= extended; s++) {
        let load = loadOf(s);
        if (capPts && load > capAt(capPts, s)) {
          // הכי גמיש קודם (slack גדול ביותר); בין שווים - קודם מי שניתן
          // בשתי העונות (seasonFlex גדול) - "בטוח" יותר להזיז, פחות סיכון
          // "להיתקע" בעונה שהמקצוע כלל לא ניתן בה; ובין שווים גם בזה - קודם
          // מי ש*לא* יושב בסמסטר המומלץ שלו לפי הקטלוג (prefPosMap) - מקצוע
          // שכבר במקומו הרשמי מפונה אחרון (אותה העדפה כמו בשלב 2).
          const atPref = id => (prefPosMap && prefPosMap[id] === pos[id]) ? 1 : 0;
          const inSem = topoOrder.filter(id => pos[id] === s && !lockedIds.has(id))
            .sort((a, b) => (lps[b] - eps[b]) - (lps[a] - eps[a]) || seasonFlex(b) - seasonFlex(a) || atPref(a) - atPref(b));
          for (const id of inSem) {
            if (loadOf(s) <= capAt(capPts, s)) break;
            let target = null;
            // גבול "חי" - אסור לעקוף בפועל מקצוע שתלוי בזה (ראו הערה בשלב 2
            // על ההבדל בין גבול LPS הסטטי לבין המיקום המתעדכן בפועל)
            const liveDependentMin = Math.min(Infinity, ...(dependents[id] || []).map(dd => pos[dd] ?? Infinity));
            // בלי חסם עליון קשיח על t מלבד liveDependentMin (התלוי הישיר) - חסימה
            // ל-Math.max(lps[id],extended) (כפי שהיה קודם) מנעה בפועל את "התארכות
            // התוכנית" שהתיעוד למעלה מבטיח: LPS מחושב מול criticalN, אורך *נתיב
            // התלויות* בלבד - לא לוקח בחשבון שיש הרבה יותר תוכן (נק') ממה שנכנס
            // בפועל ב-capPts*criticalN, מה שקורה כשיש הרבה מקצועות "עלה" מקבילים
            // (בלי שרשרת עמוקה) כמו במיפוי/סביבה. ברגע ש-t עובר את extended אין שם
            // שום עומס קיים עדיין - מתקבל תמיד, וזה בדיוק ה"התארכות" המובטחת
            // (נתפס ותוקן 2026-07-10: 30/48.5 נק' בסמסטר אחד במיפוי, capPts=20).
            for (let t = s + 1; t < liveDependentMin; t++) {
              if (t > lps[id] && lps[id] - eps[id] === 0) break; // קריטי - אסור לזוז החוצה
              const seasons = courseSeasons(id);
              if (seasons && !seasons.includes(semesterSeason(t))) continue;
              if (t > extended) { target = t; break; }
              if (loadOf(t) + coursePts(id) <= capAt(capPts, t)) { target = t; break; }
            }
            if (target != null) {
              notes.push({ id, kind: "capacity", from: pos[id], to: target,
                reason: "פינוי עומס - הסמסטר המקורי חרג ממכסת הנקודות" });
              pos[id] = target;
              extended = Math.max(extended, target);
              moved = true;
            }
          }
        }
      }
      if (!moved) break;
    }

    const plan = makeEmptyPlan(extended);
    for (const id of remainingIds) {
      const p = plan[pos[id] - 1];
      p.ids.push(id);
      p.pts += coursePts(id);
    }
    return { plan, eps, lps, notes, criticalN };
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
          // שכבר שם (נתפס ותוקן 2026-07-10, לצד תיקון דומה בשלב 3 של scheduleMandatory).
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

  /**
   * ממלא משבצות בחירה פתוחות (openPools) לתוך תוכנית קיימת (plan, כפי
   * שהוחזר מ-scheduleMandatory), החל מהסמסטר המוקדם ביותר שבו כל מקצוע
   * מועמד אפשרי (EPS משלו, מחושב ad-hoc מול doneIds+מה שכבר שובץ בתוכנית),
   * ומעדיף למלא את הסמסטר הכי פחות עמוס מבין האפשריים (לאזן, לא לגדוש אחד).
   * openPools: [{ key, title, kind: "count"|"points", need, pool: [ids] }]
   */
  // ממקם מועמד-בחירה בודד (id) בתוך plan, בסמסטר המוקדם ביותר האפשרי (EPS
  // "חי", מחושב מחדש ברגע השיבוץ - ראו הערה למטה) מבין אלה שלא חורגים ממכסת
  // הנק' וזמינים בעונה הנכונה. בברירת מחדל מעדיף את הכי פחות עמוס (לאזן, לא
  // לגדוש אחד); במצב front-load (frontload=true) - בדיוק כמו scheduleMandatory
  // - נדחס למשבצת המוקדמת ביותר האפשרית במקום, בלי קשר לעומס שכבר שם. בלי
  // הפרמטר הזה, fillElectives היה מתעלם לגמרי מ-frontload (נתפס - בקשת
  // המשתמש/ת, 2026-07-17: מקצוע בחירה בלי שום דרישת קדם חוסמת נשאר מאוחר
  // מ-EPS שלו גם במצב front-load, כי הפונקציה הזו תמיד איזנה עומס בלי תלות
  // באיזה מצב הופעלה - בניגוד ל-scheduleMandatory שכן מכבד את הדגל). מחזיר
  // true אם שובץ.
  // mustPlace (אופציונלי): מקצוע שחייב להשתבץ (נעיצה/"מתוכנן"/"בהמשך") -
  // כשאין משבצת מתאימה בתוך התוכנית הקיימת, מאריכים אותה עד לסמסטר בעונה
  // הנכונה עם מקום, במקום להחזיר false ולהפיל את המקצוע בשקט. בלי זה מקצוע
  // חד-עונתי (למשל חורף-בלבד) שסומן "בהמשך" פשוט נעלם כשכל סמסטרי-החורף
  // בתוכנית היו מלאים - והאלגוריתם בחר ממלא-מקום אחר בלי שום אזהרה, בעוד
  // שסמסטר חורף מתאים היה נוצר ממילא רגע אחר-כך ע"י שיבוץ המל"ג (נתפס -
  // בקשת המשתמש/ת, 2026-07-21, אומת בקונסול צעד-צעד). מילוי אוטומטי רגיל
  // (mustPlace=false) עדיין לא מאריך - עדיף מועמד אחר שנכנס בתוכנית הקיימת.
  function placeElectiveNow(id, plan, doneIds, capPts, notes, pool, frontload, mustPlace) {
    const freshPos = {};
    for (const sem of plan) for (const fid of sem.ids) freshPos[fid] = sem.index;
    const { eps: liveEps } = computeEPS([id], doneIds, freshPos, true);
    const earliest = liveEps[id];
    if (!Number.isFinite(earliest)) return false; // דרישת הקדם שלו לא בת-אימות בתוכנית הזו
    const seasons = courseSeasons(id);
    let target = null, targetLoad = Infinity;
    for (const sem of plan) {
      if (sem.index < earliest) continue;
      if (seasons && !seasons.includes(sem.season)) continue;
      if (capPts && sem.pts + coursePts(id) > capAt(capPts, sem.index)) continue;
      if (frontload) { target = sem; break; } // המשבצת המתאימה המוקדמת ביותר - plan מסודר לפי index עולה
      if (sem.pts < targetLoad) { targetLoad = sem.pts; target = sem; }
    }
    if (!target && mustPlace) {
      // הארכה: סמסטרים חדשים מעבר לסוף התוכנית, עד הראשון שגם בעונה הנכונה
      // וגם עם מקום במכסה (סמסטר חדש ריק תמיד עומד בשניהם תוך שני צעדים -
      // guard רק כרשת ביטחון מפני נתוני-קצה לא צפויים).
      let idx = Math.max(plan.length + 1, earliest);
      for (let guard = 0; guard < 12 && !target; guard++, idx++) {
        while (plan.length < idx) plan.push({ index: plan.length + 1, season: semesterSeason(plan.length + 1), ids: [], pts: 0 });
        const sem = plan[idx - 1];
        if (seasons && !seasons.includes(sem.season)) continue;
        if (capPts && sem.pts + coursePts(id) > capAt(capPts, idx)) continue;
        target = sem;
      }
    }
    if (!target) return false; // אין משבצת מתאימה בתוכנית הנוכחית - נשאר "לא משובץ"
    target.ids.push(id);
    target.pts += coursePts(id);
    notes.push({ id, kind: "elective", to: target.index, pool: pool.key,
      reason: "מילוי משבצת בחירה (" + pool.title + ")" });
    return true;
  }

  // גרירה מפורשת בתצוגת "תכנון אופטימלי" (js/flowchart.js) - "must", לא
  // "מועמד": בניגוד ל-placeElectiveNow (מחפש את המשבצת הפנויה הטובה ביותר),
  // כאן הסמסטר כבר נקבע ע"י המשתמש/ת (targetIndex, יחסי - הומר מ-hardPins
  // המוחלט ב-computePlan) - ממוקם שם תמיד, אפילו במחיר חריגה ממכסת הנק'
  // (capPts) - בחירה מפורשת גוברת גם על זה, בדיוק כמו lockedIds/scheduleMandatory.
  // עונה לא-תואמת עדיין מכובדת בפועל (אי אפשר ללמוד מקצוע-חורף בסמסטר אביב) -
  // אם היעד לא בעונה הנכונה, מוזז לסמסטר התואם הקרוב ביותר, עם הערה מסבירה.
  function placeElectiveHardPinned(id, plan, targetIndex, notes, pool) {
    let idx = Math.max(1, targetIndex);
    const seasons = courseSeasons(id);
    while (plan.length < idx) plan.push({ index: plan.length + 1, season: semesterSeason(plan.length + 1), ids: [], pts: 0 });
    if (seasons && !seasons.includes(plan[idx - 1].season)) {
      let i = idx;
      while (!seasons.includes(semesterSeason(i))) i++;
      while (plan.length < i) plan.push({ index: plan.length + 1, season: semesterSeason(plan.length + 1), ids: [], pts: 0 });
      idx = i;
    }
    const dest = plan[idx - 1];
    dest.ids.push(id);
    dest.pts = +(dest.pts + coursePts(id)).toFixed(2);
    notes.push({
      // pool נחוץ כדי שהשיבוץ הזה ייספר לטובת המאגר בחישוב unplacedPools
      // (computePlan) - בלעדיו מקצוע שנגרר ידנית לא נספר כממלא את המכסה
      // והמאגר סומן "לא שובץ" בטעות.
      id, kind: "hard-pin", to: idx, pool: pool.key,
      reason: idx === targetIndex
        ? "נעוץ ידנית לסמסטר הזה (גרירה) - קבוע, לא יוזז אוטומטית"
        : "נגרר לסמסטר שהמקצוע לא ניתן בו בפועל - הוזז לסמסטר התואם הקרוב ביותר, עדיין קבוע"
    });
  }

  // pinnedIds (אופציונלי, Set) - מקצועות בחירה שהמשתמש/ת כבר בחר/ה במפורש
  // (ראו פאנל "מקצועות בחירה" המשותף לשתי התצוגות, js/flowchart.js) - אלה
  // *תמיד* משובצים, קודם לכל מילוי אוטומטי: בחירה מפורשת של המשתמש/ת גוברת
  // על מה שהאלגוריתם היה בוחר לבד. רק אחרי ששיבצנו את כל הבחירות הידניות
  // הרלוונטיות לכל מאגר, ממלאים את מה שעוד חסר (אם בכלל) אוטומטית, בדיוק
  // כמו קודם (בקשת המשתמש, 2026-07-15: "אני צריך לבחור את הקורסים... לא רק
  // בשביל המומלץ").
  // hardPins (אופציונלי, אובייקט id -> מספר-סמסטר יחסי, ראו computePlan) -
  // גרירה מפורשת בתצוגת "תכנון אופטימלי": סמסטר *קבוע*, לא רק "כלול איפשהו"
  // כמו pinnedIds - מטופל ראשון, לפני pinnedIds (אם מקצוע נמצא בשניהם, הסמסטר
  // הקבוע גובר, ראו הסינון `hard[id] == null` בהמשך).
  // preferredIds (אופציונלי, Set) - מקצועות שהמשתמש/ת סימנ/ה "בהמשך" ב-FinDeg:
  // לא "חייבים להישבץ" כמו pinnedIds (הסימון אומר במפורש "לא עכשיו"), אבל אם
  // המאגר עדיין חסר ומשהו *חייב* למלא אותו - אלה באים ראשונים במילוי האוטומטי,
  // לפני מועמדים שרירותיים שהמשתמש/ת מעולם לא בחר/ה (נתפס - בקשת המשתמש/ת,
  // 2026-07-21: "הידרוליקה עדיין נכנסת לתרשים למרות שהיא לא נבחרה - מה שנבחר
  // צריך להופיע במקומה").
  // groupAIds (אופציונלי, Set) - מזהי "קבוצה א'" (ראו computePlan): כשממלאים
  // אוטומטית מאגר שמכיל גם מועמדי קבוצה א' וגם קבוצה ב' (כמו groupAB, סה"כ
  // נקודות משולב), מעדיפים תמיד קבוצה א' - לא משנה למאגר הספציפי הזה איזו
  // מהן, אבל עדיף לא "לבזבז" מקבוצה ב' (בד"כ מוגבלת יותר) כשקבוצה א' עונה
  // באותה קלות (בקשת המשתמש/ת, 2026-07-21).
  function fillElectives(plan, openPools, doneIds, capPts, pinnedIds, frontload, hardPins, preferredIds, groupAIds) {
    let scheduledIds = new Set(plan.flatMap(s => s.ids));
    const notes = [];
    const pinned = pinnedIds || new Set();
    const hard = hardPins || {};
    const groupAPrefer = groupAIds || new Set();
    const preferred = preferredIds || new Set();

    for (const p of openPools) {
      let remaining = p.need;

      // זיכוי: מקצועות מהמאגר הזה שכבר שובצו בתוכנית (ע"י מאגר קודם שחולק
      // איתו מקצועות - בפרט מאגר "סה"כ נקודות בקבוצות א'+ב'" המצטבר, שכל
      // מקצועות קבוצה א'/ב' חברים גם בו) נספרים לטובת הדרישה. בלי זה המאגר
      // המצטבר התחיל תמיד מאפס ומילא *כפול*: גם הבחירות שכבר שובצו בקבוצות
      // עצמן וגם "ממלאי מקום" נוספים שאיש לא בחר - שהאריכו את התוכנית בסמסטרים
      // מיותרים (נתפס - בקשת המשתמש/ת, 2026-07-21: הידרוליקה + מבוא להידרולוגיה
      // נדחסו שתיהן לתוכנית כשקבוצה ב' כבר מולאה ע"י הבחירה של המשתמש/ת).
      let credited = 0;
      for (const id of p.pool) {
        if (!doneIds.has(id) && scheduledIds.has(id)) credited += (p.kind === "points" ? coursePts(id) : 1);
      }
      if (credited > 0) {
        remaining -= credited;
        // הערת-סיכום למאגר (לא לתיבה ספציפית) - נצרכת רק ע"י חישוב unplacedPools
        // ב-computePlan; id סינתטי כדי לא "להידבק" לשום תיבת מקצוע ברינדור.
        notes.push({ id: "_pool_" + p.key, kind: "pool-credit", pool: p.key, amount: credited });
      }

      const hardInPool = p.pool.filter(id => hard[id] != null && !doneIds.has(id) && !scheduledIds.has(id));
      for (const id of hardInPool) {
        placeElectiveHardPinned(id, plan, hard[id], notes, p);
        scheduledIds.add(id);
        remaining -= (p.kind === "points" ? coursePts(id) : 1);
      }

      const pinnedInPool = p.pool.filter(id => pinned.has(id) && hard[id] == null && !doneIds.has(id) && !scheduledIds.has(id));
      for (const id of pinnedInPool) {
        // mustPlace: בחירה מפורשת (נעיצה/"מתוכנן"/"בהמשך") מאריכה את התוכנית
        // אם אין משבצת - לא נופלת בשקט (ראו הערה על placeElectiveNow).
        if (!placeElectiveNow(id, plan, doneIds, capPts, notes, p, frontload, true)) continue;
        scheduledIds.add(id);
        remaining -= (p.kind === "points" ? coursePts(id) : 1);
      }
      if (!(remaining > 0)) continue;

      const candidates = p.pool.filter(id => !doneIds.has(id) && !scheduledIds.has(id));
      // EPS זמין (ad-hoc) לכל מועמד: doneIds מספק EPS=0 מיידי, אבל מקצוע חובה
      // שכבר שובץ לסמסטר X (posOverride, נבנה מחדש כאן כי plan מתעדכן תוך כדי
      // מילוי המאגרים) מספק את הדרישה רק *אחרי* X, לא באופן מיידי כמו doneIds
      const posOverride = {};
      for (const sem of plan) for (const id of sem.ids) posOverride[id] = sem.index;
      const { eps: candEps } = computeEPS(candidates, doneIds, posOverride, true);
      const ranked = candidates.filter(id => Number.isFinite(candEps[id])).sort((a, b) => {
        // בחירה של המשתמש/ת ("בהמשך" ב-FinDeg) גוברת על כל שיקול אלגוריתמי -
        // אם משהו חייב למלא את המכסה, שיהיה מה שנבחר בפועל, לא פיק שרירותי
        const dp = (preferred.has(b) ? 1 : 0) - (preferred.has(a) ? 1 : 0);
        if (dp) return dp;
        // קבוצה א' לפני קבוצה ב' (ראו הערה על groupAIds/groupAPrefer למעלה) -
        // אחרי בחירת-משתמש/ת (preferred) אך לפני כל שיקול אלגוריתמי אחר.
        const dg = (groupAPrefer.has(b) ? 1 : 0) - (groupAPrefer.has(a) ? 1 : 0);
        if (dg) return dg;
        const de = candEps[a] - candEps[b]; // קודם מה שאפשר ללמוד מוקדם
        if (de) return de;
        const ds = seasonFlex(b) - seasonFlex(a); // אח"כ מה שניתן לרוב (בטוח יותר לשבץ)
        if (ds) return ds;
        return (courseDifficulty(a) ?? 3) - (courseDifficulty(b) ?? 3); // אח"כ קל יותר קודם
      });
      for (const id of ranked) {
        if (remaining <= 0) break;
        // חישוב EPS מחדש, "חי", ממש לפני השיבוץ - מועמדים מאותו מאגר עלולים
        // להיות תלויים זה בזה (למשל פרויקט שדורש שני מקצועות אחרים מאותו
        // מאגר בדיוק) - הדירוג הראשוני (candEps) חושב פעם אחת מראש ולא
        // משקף עדכונים שקרו באותה איטרציה עצמה (נתפס ותוקן 2026-07-10).
        if (!placeElectiveNow(id, plan, doneIds, capPts, notes, p, frontload)) continue;
        scheduledIds.add(id);
        remaining -= (p.kind === "points" ? coursePts(id) : 1);
      }
    }
    return notes;
  }

  // ---------- דרישות כלל-טכניוניות (ספורט/מל"ג/בחירה חופשית) ----------
  // אלה לא "מקצועות" עם id קטלוגי (res.general.buckets ב-engine.js, לא
  // res.sections/chains) - בלי הטיפול הבא היו נעדרים *לגמרי* מהתוכנית (נתפס -
  // בקשת המשתמש/ת, 2026-07-17: "אנחנו רק חסרים את המל"ג והבחירה החופשית
  // והספורט"). "נתח" (chunk) גנרי מייצג קורס יחיד בגודל טיפוסי, כי אין כאן
  // id אמיתי אחד - יש מבחר גדול של מקצועות אפשריים בכל קטגוריה.
  // ספורט/בחירה חופשית: אין שום אילוץ אמיתי מלבד capPts - "יש תמיד מספיק
  // מבחר" (בקשת המשתמש/ת) - ממלאים כפילר גמיש לסמסטר הכי פחות עמוס בכל פעם,
  // בדיוק כמו בחירה רגילה במצב "עומס מאוזן" (לא תלוי ב-frontload: אלה לא
  // חלק מהנתיב הקריטי, רק עוזרים לאזן מה שכבר נקבע).
  // מל"ג: הפוך - נרשמים אליו בקושי (מוגבל/תחרותי), אז מקסימום קורס אחד
  // לסמסטר (אילוץ קשיח, לא רק "מועדף"), ולא לפני שנה ב' - לפי מספר-סמסטר
  // נומינלי *מוחלט* (nominalSemester), לא index יחסי לתוכנית הנותרת! סטודנט/ית
  // שכבר בשנה ג' לא "בשנה א'" רק כי index=1 בתוכנית הספציפית הזו. בתוך
  // האילוצים - נדחק כמה שיותר מאוחר (פחות סיכון הרשמה/פחות דחיפות), אבל לא
  // לסמסטר האחרון בתוכנית אם יש ברירה - כדי לא "להיתקע" צריך/ה להיות בקמפוס
  // רק בשביל מל"ג בודד אחרי שכל שאר החובה כבר הושלמה (בקשת המשתמש/ת).
  // pe=1 (לא 2!) - מקצוע חינוך גופני בודד שווה נק' אחת בפועל בטכניון
  // (03940800/03940805/03940806 וכו'), ודרישת ה-pe הכוללת (general.pe,
  // data.js) היא תמיד 2 - כלומר תמיד *שני* מקצועות נפרדים, לא מקצוע אחד
  // בגודל כפול (נתפס - בקשת המשתמש/ת, 2026-07-19: "צריך 2 קורסי ספורט, לא אחד").
  const GENERAL_CHUNK = { free: 3, pe: 1, enrich: 2 };
  // תווית קצרה+ממוספרת לכל תיבה בתרשים (לא ליחידות/עמוד הסיבה בפירוט - שם
  // עדיין b.label המלא, "מל\"ג (העשרה)" וכו') - "מל\"ג 1"/"ספורט 2" וכו',
  // כדי שברור מיד שכל תיבה היא נתח נפרד מאותה דרישה, לא אותו מקצוע כפול
  // (בקשת המשתמש/ת, 2026-07-19: "כתבו מל\"ג 1, מל\"ג 2, מל\"ג 3").
  const GENERAL_SHORT_LABEL = { pe: "ספורט", enrich: 'מל"ג', free: "בחירה חופשית" };

  // planLen (הבסיס הקבוע - אורך התוכנית *לפני* דרישות כלל-טכניוניות, כבר
  // נקבע ע"י חובה+בחירה) הוא תקרה קשיחה כאן: אף אחד משלושת הסלים לא אמור
  // *להאריך* את התואר בעצמו - "מספיק תמיד מבחר" (ספורט/בחירה חופשית) ו"נדחק
  // מאוחר" (מל"ג) הן העדפות-מיקום *בתוך* התוכנית הקיימת, לא סיבה להוסיף עוד
  // סמסטר. נתפס - בקשת המשתמש/ת, 2026-07-23: "בגלל שאמרנו לדחוק את המל"גים
  // הם פשוט נדחקו מעבר למקסימום... זה לא אמור לדחוף כלום קדימה, רק לבחור
  // הכי טוב *מתוך מה שכבר יש*". לכל סל - מדרג העדפות (tiers, מהמחמיר לפחות
  // מחמיר) שנעצר בראשון שיש לו מועמד כלשהו; אף שלב לא קורא ל-extendPlan.
  function scheduleGeneralEd(plan, buckets, capPts, nominalSemester, notes, pointsById, generalNames) {
    if (!buckets) return;
    const planLen = plan.length; // נלכד *לפני* כל תוספת - גם pe/free לא יזיזו את התקרה של enrich
    const addChunk = (id, label, pts, sem) => {
      sem.ids.push(id);
      sem.pts = +(sem.pts + pts).toFixed(2);
      pointsById[id] = pts;
      generalNames[id] = label;
    };
    const fitsCap = (sem, amt) => !capPts || sem.pts + amt <= capAt(capPts, sem.index);
    // בוחר סמסטר לפי הראשון-שמניב-מועמד מבין tiers (מערך פרדיקטים, מהמחמיר
    // ביותר לפחות מחמיר) - "true" גורף בסוף מבטיח שתמיד יימצא יעד (התוכנית
    // עצמה אף פעם לא ריקה), כדי שלעולם לא נצטרך להאריך אותה.
    function pickByTiers(tiers, pickLatest) {
      for (const pred of tiers) {
        const eligible = plan.filter(s => s.index <= planLen && pred(s));
        if (eligible.length) {
          return pickLatest
            ? eligible.reduce((best, s) => (best == null || s.index > best.index) ? s : best, null)
            : eligible.reduce((best, s) => (best == null || s.pts < best.pts) ? s : best, null);
        }
      }
      return plan[plan.length - 1]; // לא אמור לקרות (tier אחרון הוא "true"), רשת ביטחון
    }

    // מקצוע ידני (js/app.js, "הוספת מקצוע") שסומן "מתוכנן" בסל הזה כבר "צורך"
    // חלק מהדרישה - כמו קבוצה א'+ב' למעלה, "הושלם" צורך ראשון (בלי תיבה
    // משלו - כבר גמור) ואז "מתוכנן" צורך בשמו האמיתי (לא כ"מל\"ג N" סינתטי -
    // המשתמש/ת כבר יודע/ת בדיוק אילו מקצוע זה). בלי זה, מקצוע מל"ג/ספורט/
    // בחירה חופשית שכבר סומן הושלם/מתוכנן ב-FinDeg עדיין ייצור את *כל* תיבות
    // המילוי הסינתטיות מחדש בתרשים, כאילו שום דבר לא נעשה (נתפס - בקשת
    // המשתמש/ת, 2026-07-24: "even though they have been done in findeg, all 3
    // are required within the flowchart"). numbering של תיבות הפילר הסינתטיות
    // שנשארות ממשיך מאיפה ש"הושלם"+"מתוכנן" הפסיקו (לא מתאפס ל-1) - כדי
    // שהמספור ישקף כמה "יחידות" מתוך הדרישה הכוללת עדיין חסרות בפועל.
    for (const key of ["pe", "free"]) {
      const b = buckets[key];
      if (!b) continue;
      let consumed = Math.min(b.pts, b.needed);
      for (const c of b.courses.filter(c => c.planned)) {
        if (consumed >= b.needed - 0.01) break;
        const amt = Math.min(c.pts, +(b.needed - consumed).toFixed(2));
        const target = pickByTiers([s => fitsCap(s, amt), () => true], false);
        const id = "gen_" + key + "_manual_" + (c.manualIndex != null ? c.manualIndex : c.name);
        addChunk(id, c.name, amt, target);
        notes.push({ id, kind: "general", to: target.index, reason: 'מילוי דרישת "' + b.label + '" - מקצוע מתוכנן שכבר נוסף ידנית ב-FinDeg' });
        consumed = +(consumed + amt).toFixed(2);
      }
      let remaining = +(b.needed - consumed).toFixed(2);
      let n = Math.floor(consumed / GENERAL_CHUNK[key]) + 1;
      while (remaining > 0.01) {
        const amt = Math.min(GENERAL_CHUNK[key], remaining);
        // הכי פחות עמוס בתוך התקרה; אם אף סמסטר לא עומד בתקרה - מתעלמים
        // ממנה (עדיף לחרוג מעט מ-capPts מאשר להאריך את התואר בשביל פילר).
        const target = pickByTiers([s => fitsCap(s, amt), () => true], false);
        const num = n++;
        const id = "gen_" + key + "_" + num;
        addChunk(id, GENERAL_SHORT_LABEL[key] + " " + num, amt, target);
        notes.push({ id, kind: "general", to: target.index, reason: 'מילוי דרישת "' + b.label + '"' });
        remaining = +(remaining - amt).toFixed(2);
      }
    }

    const b = buckets.enrich;
    if (b) {
      const usedSemesters = new Set();
      const isYearOne = sem => nominalSemester != null && (nominalSemester - 1 + sem.index) <= 2;
      const notUsed = s => !usedSemesters.has(s.index);
      // מדרג: (1) לא בשימוש+לא שנה א'+לא הסמסטר האחרון+בתקרה; (2) מוותרים
      // על "לא שנה א'"; (3) מוותרים גם על "לא אחרון"; (4) מוותרים גם על
      // התקרה; (5) מוותרים גם על "מקסימום אחד לסמסטר" (רק אם ממש נגמר
      // המקום בתוך planLen - התקרה הקשיחה היחידה שנשארת). אותו מדרג גם
      // למקצוע מתוכנן שכבר נוסף ידנית וגם לתיבת-מילוי סינתטית - שניהם "תופסים
      // מקום" מל"ג לכל דבר.
      const enrichTiers = amt => [
        s => notUsed(s) && !isYearOne(s) && s.index !== planLen && fitsCap(s, amt),
        s => notUsed(s) && s.index !== planLen && fitsCap(s, amt),
        s => notUsed(s) && fitsCap(s, amt),
        s => notUsed(s),
        () => true
      ];
      let consumed = Math.min(b.pts, b.needed);
      for (const c of b.courses.filter(c => c.planned)) {
        if (consumed >= b.needed - 0.01) break;
        const amt = Math.min(c.pts, +(b.needed - consumed).toFixed(2));
        const target = pickByTiers(enrichTiers(amt), true);
        const id = "gen_enrich_manual_" + (c.manualIndex != null ? c.manualIndex : c.name);
        addChunk(id, c.name, amt, target);
        usedSemesters.add(target.index);
        notes.push({ id, kind: "general", to: target.index, reason: 'מילוי דרישת "' + b.label + '" - מקצוע מתוכנן שכבר נוסף ידנית ב-FinDeg' });
        consumed = +(consumed + amt).toFixed(2);
      }
      let remaining = +(b.needed - consumed).toFixed(2);
      let n = Math.floor(consumed / GENERAL_CHUNK.enrich) + 1;
      while (remaining > 0.01) {
        const amt = Math.min(GENERAL_CHUNK.enrich, remaining);
        const target = pickByTiers(enrichTiers(amt), true);
        const num = n++;
        const id = "gen_enrich_" + num;
        addChunk(id, GENERAL_SHORT_LABEL.enrich + " " + num, amt, target);
        usedSemesters.add(target.index);
        notes.push({
          id, kind: "general", to: target.index,
          reason: 'מילוי דרישת "' + b.label + '" - קורס אחד לכל היותר בסמסטר, נדחק מאוחר ככל האפשר בתוך אורך התואר הקיים (לא לסמסטר האחרון אם ניתן, ולא מאריך אותו)'
        });
        remaining = +(remaining - amt).toFixed(2);
      }
    }
  }

  /**
   * נקודת הכניסה הראשית. מצפה לתוצאת FINDEG_ENGINE.evaluate() (res) - שואב
   * ממנה את רשימת מקצועות החובה שעוד חסרים ואת מאגרי הבחירה הפתוחים, כדי
   * לא לשכפל את כל לוגיקת "מה כבר הושלם/מתוכנן/חסר" שכבר קיימת שם.
   *
   * options: { trackKey, specialization?, capPts (ברירת מחדל 20),
   *            startSeason? (ברירת מחדל מנוחש מ-parsed),
   *            yearKey? (שנת קטלוג/תחילת לימודים - לחישוב nominalSemester/
   *            overdueIds למטה; בלעדיו מדלגים על ההשוואה הזו, ראו
   *            computeNominalSemester),
   *            frontload? (bool, ברירת מחדל false) - "מצב front-load": מתעלם
   *            משלד/קו-בסיס רשמי (כל מקצוע מתחיל ב-EPS שלו ממש, גם למי שעדיין
   *            לא התחיל/ה) ומדלג על שלב 2/rebalance ב-scheduleMandatory - כל
   *            מקצוע נשאר בסמסטר המוקדם ביותר שלו וזז הלאה רק כשcapPts בפועל
   *            נחרג (שלב 3). "לדחוס כל סמסטר עד התקרה ואז לעבור הלאה", לא
   *            "לפזר נקודות באופן שווה" כמו מצב "עומס מאוזן" הרגיל (בקשת
   *            המשתמש/ת, 2026-07-16).
   *            taper? (bool, ברירת מחדל false) - "מצב מומלץ": כמו frontload,
   *            אבל capPts עצמו הוא תקרה *יורדת* (ראו buildTaperCap) במקום
   *            תקרה שטוחה - עומס כבד (taperPeak, ברירת מחדל 25) עד סמסטר
   *            מוחלט 6 ("ב' של שנה ג'"), ואז מקל בהדרגה (בקשת המשתמש/ת,
   *            2026-07-19). מתעלם מ-options.capPts כשמופעל.
   *            taperPeak? (מספר, ברירת מחדל 25) - תקרת הנק' בשנים הכבדות,
   *            רלוונטי רק כש-taper מופעל.
   *            pinnedIds? (Set/מערך של מזהי מקצועות-בחירה שנעצו ידנית בפאנל
   *            הבחירה המשותף - ראו fillElectives; אלה תמיד משובצים ראשונים,
   *            לפני מילוי אוטומטי),
   *            preferredIds? (Set/מערך - מקצועות שסומנו "בהמשך" ב-FinDeg;
   *            לא חובה לשבץ, אבל מועדפים על פני פיק שרירותי במילוי אוטומטי
   *            של מאגר שעוד חסר - ראו fillElectives) }
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
    // taper (goal "מומלץ") מחליף לגמרי את capPts השטוח בפונקציית-תקרה יורדת -
    // צריך את nominalSemester קודם (ראו buildTaperCap), ולכן מחושב אחריו.
    // capPts=0 הוא ערך תקין ומכוון ("בלי תקרה בכלל", ראו יעד "מינימום סמסטרים"
    // ב-flowchart.js) - לא "לא סופק". `|| 20` היה מחליף 0 בחזרה ב-20 בטעות
    // (0 הוא falsy!), מה שהחזיר תקרה אמיתית בדיוק כשהמטרה הייתה לבטל אותה
    // לגמרי - וגרם לתוכניות "מינימום סמסטרים" להתארך שלא לצורך/לפספס שיבוץ
    // בחירות שהיו אמורות להיכנס בלי שום מגבלת נקודות (נתפס - בקשת המשתמש/ת,
    // 2026-07-17: מעבר למצב "מינימום סמסטרים" האריך את התוכנית במקום לשמר
    // את אורך ה-front-load).
    // עוגן התקרה-היורדת: planAnchorSemester (לא nominalSemester הגולמי) - אותו
    // עוגן שממיר index יחסי למספר-סמסטר מוצג. עם nominalSemester, כשהסמסטר
    // הנוכחי כבר מתוכנן בנפרד (anchor = nominal+1), כל תקרה חושבה על סמסטר
    // אחד מוקדם מדי - סמסטר שמוצג "7" קיבל את התקרה של "6" וכן הלאה.
    const capPts = options.taper ? buildTaperCap(planAnchorSemester ?? nominalSemester, options.taperPeak) : (options.capPts ?? 20);

    // ---- שליפת מקצועות חובה שעוד חסרים, מתוך res (לא לחשב שוב) ----
    // גם אוספים ptsOverride כאן: D().coursePoints לא מכיל מקצועות שמוגדרים
    // רק כ-C(id,pts) בתוך מסלול (רוב מקצועות החובה!) - res כבר "יודע" את
    // הנקודות הנכונות לכל שורה, לכן שואבים משם ולא מהמילון הגלובלי.
    ptsOverride = {};
    const missingMandatory = [];
    // מקצועות-פרויקט (לא רק res.projects של ניהול ובנייה - גם קטע "courses"
    // עם id:"project" כמו הפרויקט המורחב במבנים, ראו הערה על projectIds
    // למטה) - נאספים כאן כדי ש"מומלץ" (taper) יוכל לדחוף אותם לסמסטר האחרון
    // בסוף (בקשת המשתמש/ת, 2026-07-19: "the project should always be at the
    // last semester" - לא רק EPS רגיל, שעלול למקם פרויקט טרמינלי באמצע
    // התוכנית סתם כי דרישות הקדם שלו מתמלאות מוקדם).
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
    // התיקון: מחזירים אותו ל-pool (כדי ש-fillElectives ידע שהוא מועמד תקף)
    // ומצרפים אותו ל-pinnedIds למטה (כדי שהוא *ייבחר* וישובץ תמיד, לא רק
    // "יהיה מועמד") - need נשאר מחושב בלי לספור אותו (כמו ב-doneCount/pts
    // הרגילים), כי ההפחתה היחידה שקורה בפועל היא כש-fillElectives משבץ אותו
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
    // מאגר "סה"כ בחירה בקבוצות א'+ב'" (groupAB, ראו fillElectives): כשיש
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
    // כדי שמה ששובץ כבר דרכן ייזקף לזכות (credited, ראו fillElectives) והמילוי
    // הנוסף כאן יתמקד רק בפער האמיתי שנשאר.
    for (const r of [res.groupA, res.groupAB].filter(Boolean)) {
      const plannedIds = r.hits.filter(h => h.planned).map(h => h.id);
      plannedIds.forEach(id => plannedElectiveIds.add(id));
      if (r.satisfied && !plannedIds.length && !r.misses.some(id => laterWanted.has(id))) continue;
      openPools.push({ key: r.section.id, title: r.section.title, kind: "points",
        need: r.needed - r.pts, pool: [...plannedIds, ...r.misses] });
    }

    if (excludedSet.size) {
      for (const p of openPools) p.pool = p.pool.filter(id => !excludedSet.has(id));
      for (const id of excludedSet) plannedElectiveIds.delete(id);
    }

    // מסלולי ניהול ובנייה/מבנים: שלד ידני (GREEDY_SKELETON) במקום קו הבסיס
    // הרשמי - ראו הערה שם. מסלולים אחרים ממשיכים עם ההתנהגות הקודמת. שני
    // המקורות (שלד/קו-בסיס) הם רק "סדר מומלץ" ל*התחלה מאפס* - סטודנט/ית
    // שכבר סיימ/ה מקצוע כלשהו (doneIds לא ריק) כבר לא מתחיל/ה בדיוק מהסדר
    // הזה בפועל, אז במקום להתאמץ להתאים חלקית לסדר שכבר לא רלוונטי -
    // מתעלמים ממנו לגמרי וסוחטים ישירות ל-EPS (בקשת המשתמש/ת, 2026-07-13).
    // מצב front-load (options.frontload) מתעלם משניהם באותו אופן, גם למי
    // שעדיין לא התחיל/ה - "לדחוס עד התקרה" גובר על "סדר מומלץ עם החברים"
    // (בקשת המשתמש/ת, 2026-07-16). taper (ראו למעלה) מרמז frontload תמיד -
    // שלב 2 (איזון נקודות, ראו scheduleMandatory) ינסה "לפזר" עומס אל
    // הסמסטרים הכבדים המוקדמים בדיוק ההפך ממה שה-taper מתכוון אליו.
    const frontload = !!options.frontload || !!options.taper;
    const hasStarted = doneIds.size > 0;
    const skeletonBlocks = !hasStarted && !frontload && GREEDY_SKELETON[options.trackKey];
    const skeletonLocked = skeletonBlocks ? skeletonLockMap(options.trackKey, remainingIds) : null;
    const baselineMap = (!hasStarted && !skeletonBlocks && !frontload) ? officialBaseline(options.trackKey, options) : null;
    // hardPins (אופציונלי, id -> מספר-סמסטר *מוחלט*, ראו js/flowchart.js) -
    // גרירה מפורשת בתצוגת "תכנון אופטימלי": "must", לא הצעה. ממירים למספר
    // יחסי (index 1 = "הסמסטר הבא") לפי planAnchorSemester - בדיוק אותו עוגן
    // ש-js/flowchart.js משתמש בו כדי להציג מספר-סמסטר מוחלט (semOffset שם),
    // לא nominalSemester הגולמי (ראו הערה על planAnchorSemester למעלה - שונים
    // כש-startSeason נדרס ידנית). בלי עוגן (yearKey לא ידוע) מוחלט==יחסי.
    // חל גם על מקצועות חובה (ממוזג ל-lockedMap, גובר על השלד אם שניהם קיימים
    // לאותו מקצוע) וגם על מועמדי-בחירה (מטופל בנפרד ב-fillElectives) - לא
    // צריך לדעת כאן מראש מי מהשניים זה, שני הצרכנים מסננים לפי מה שרלוונטי להם.
    const hardPinsRelative = {};
    for (const [id, absSem] of Object.entries(options.hardPins || {})) {
      const rel = planAnchorSemester != null ? absSem - planAnchorSemester + 1 : absSem;
      hardPinsRelative[id] = Math.max(1, rel);
    }
    // מקצוע שסומן "מתוכנן" ב-FinDeg (plannedMandatoryIds/plannedElectiveIds,
    // נאספו למעלה) - הצהרה מפורשת "זה מה שאני לוקח/ת עכשיו", לא רק "עוד
    // מועמד". נכנס לסמסטר הבא (relative=1) באותה עדיפות בדיוק כמו נעיצה
    // ידנית - lockedIds (ל-scheduleMandatory) ו-placeElectiveHardPinned (ל-
    // fillElectives) גם מדלגים על בדיקת-EPS הרגילה עבור מקצועות נעוצים, אז
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
    const mergedLocked = { ...(skeletonLocked || {}), ...mandatoryHardPins };
    const lockedMap = Object.keys(mergedLocked).length ? mergedLocked : null;
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
    // מפת "המיקום המומלץ" לשלבי האיזון (prefPosMap, ראו scheduleMandatory):
    // קו-הבסיס הרשמי (סמסטר מוחלט 1-8 של התואר) מומר ליחסי דרך
    // planAnchorSemester - בדיוק אותו עוגן כמו hardPins/minPosMap למעלה.
    // סמסטר מומלץ שכבר חלף (rel<1, מקצוע בפיגור) לא נכנס - אין "מומלץ" אמיתי
    // עבורו יותר, האיזון הרגיל מחליט. רלוונטי בעיקר במצב "עומס מאוזן"
    // (balance=true) לסטודנט/ית שכבר התחיל/ה - שם baselineMap הוא null
    // והמיקום ההתחלתי הוא EPS גרידא, בלי שום זיקה למסלול הרשמי.
    const officialMap = officialBaseline(options.trackKey, options);
    const prefPosMap = {};
    if (officialMap && planAnchorSemester != null) {
      for (const id of remainingIds) {
        if (officialMap[id] == null) continue;
        const rel = officialMap[id] - planAnchorSemester + 1;
        if (rel >= 1) prefPosMap[id] = rel;
      }
    }
    const { plan, eps, lps, notes: structuralNotes, criticalN } =
      scheduleMandatory(remainingIds, doneIds, baselineMap, capPts, lockedMap, minPosMap, !frontload,
        Object.keys(prefPosMap).length ? prefPosMap : null);
    // גבול תחתון אמיתי כולל מאגרי-בחירה (לא רק חובה, ראו computeOpenPoolsMinSemesters
    // למעלה) - criticalN לבדו מתעלם לגמרי ממאגרי בחירה פתוחים, אז סטודנט/ית
    // שנשארו לה בעיקר בחירות (למשל "עוד 6 נק' מקבוצה א' + 3 מקצועות משרשרת
    // חומרים") היה מקבל/ת criticalN נמוך ומטעה, בזמן שהתוכנית בפועל
    // (totalSemesters, אחרי fillElectives) השתרעה על סמסטרים רבים יותר בגלל
    // מקצועות-בחירה ספציפיים שנבחרו אוטומטית ודחקו זה את זה (נתפס - בקשת
    // המשתמש/ת, 2026-07-17: "זה לוקח 4 סמסטרים, כשבאמת אפשר לעשות זאת ב-2").
    const minSemesters = Math.max(criticalN, computeOpenPoolsMinSemesters(openPools, doneIds, eps), 1);
    // pinnedIds "אמיתי" (פאנל הבחירה בתרשים הזרימה, options.pinnedIds) ∪
    // plannedElectiveIds (סונכרן אוטומטית מ-FinDeg למעלה) - שניהם "חייבים
    // להישבץ", רק המקור שונה (בחירה בתרשים מול בחירה שכבר נעשתה ב-FinDeg עצמו).
    // laterWanted מאוחד פנימה: "בהמשך" = בחירה מפורשת שחייבת שיבוץ, בדיוק
    // כמו "מתוכנן" - לא רק העדפת-מילוי (ראו הערה על laterWanted למעלה).
    const pinnedIds = new Set([...(options.pinnedIds || []), ...plannedElectiveIds, ...laterWanted].filter(id => !excludedSet.has(id)));
    const electiveNotes = fillElectives(plan, openPools, doneIds, capPts, pinnedIds, frontload, hardPinsRelative, laterWanted, groupAIds);
    // הבחנה בניסוח בין נעיצה ידנית אמיתית (גרירה, options.hardPins) לבין
    // נעיצה שמקורה בסימון "מתוכנן" ב-FinDeg (plannedMandatoryIds/
    // plannedElectiveIds, שהוזגו לתוך hardPinsRelative למעלה) - שתיהן
    // מתנהגות זהה (relative=1, קבוע) אבל הניסוח "נעוץ ידנית... גרירה" היה
    // מטעה כשהמקור בפועל היה "מתוכנן", לא גרירה בתרשים (בקשת המשתמש/ת,
    // 2026-07-25). מתקנים את electiveNotes בדיעבד (kind:"hard-pin" שיצא
    // מתוך placeElectiveHardPinned, ראו fillElectives) במקום להעביר פרמטר
    // נוסף דרך כל שרשרת הקריאות עד לשם.
    const explicitHardPinIds = new Set(Object.keys(options.hardPins || {}));
    const plannedReason = "סומן \"מתוכנן\" ב-FinDeg - משובץ אוטומטית לסמסטר הבא, קבוע";
    const draggedReason = "נעוץ ידנית לסמסטר הזה (גרירה) - קבוע, לא יוזז אוטומטית";
    for (const n of electiveNotes) {
      if (n.kind === "hard-pin" && !explicitHardPinIds.has(n.id) && plannedElectiveIds.has(n.id) && n.reason === draggedReason) {
        n.reason = plannedReason;
      }
    }
    // מקצועות חובה שנעצו קשיח (mandatoryHardPins) - הערה מסבירה, בדיוק כמו
    // שמועמדי-בחירה נעוצים-קשיח מקבלים בתוך placeElectiveHardPinned. אין צורך
    // לבדוק את המיקום הסופי ב-plan - הוא מובטח להיות בדיוק mandatoryHardPins[id]
    // (lockedIds מדולג מכל שלבי ההזזה ב-scheduleMandatory).
    const mandatoryHardPinNotes = Object.keys(mandatoryHardPins).map(id => ({
      id, kind: "hard-pin", to: mandatoryHardPins[id],
      reason: (!explicitHardPinIds.has(id) && plannedMandatoryIds.has(id)) ? plannedReason : draggedReason
    }));
    // repairPrereqOrder לא אמור לזוז מקצוע שנעוץ קשיח בכלל (מחובה או בחירה) -
    // "must" פירושו קבוע, גם אם דרישת הקדם שלו לא בפועל מתמלאת בסמסטר הזה
    // (בחירת המשתמש/ת המפורשת גוברת, בדיוק כמו lockedIds ב-scheduleMandatory).
    const repairNotes = repairPrereqOrder(plan, doneIds, capPts, new Set(Object.keys(hardPinsRelative)));

    // ---- "מה הייתי אמור/ה כבר להשלים עד עכשיו" - תמיד מול קו-הבסיס הרשמי
    // (flowchart-data.js), גם במסלולים שמתוזמנים בפועל לפי GREEDY_SKELETON -
    // השלד הוא רק העדפת-סדר לתכנון *קדימה*, לא הבטחה שמספרי-הסמסטר שלו
    // תואמים ללוח-הזמנים הרשמי/האמיתי, אז לא מתאים לשמש כאן. ---
    const overdueBaseline = baselineMap || officialMap;
    const overdueIds = (nominalSemester != null && overdueBaseline)
      ? remainingIds.filter(id => overdueBaseline[id] != null && overdueBaseline[id] < nominalSemester)
      : [];
    const overdueNotes = overdueIds.map(id => ({
      id, kind: "overdue",
      reason: "לפי קו-הבסיס הרשמי היה אמור/ה להיות מושלם עד סמסטר " + overdueBaseline[id] +
        " - כרגע בפיגור (נמצא/ת נומינלית בסמסטר " + nominalSemester + ")"
    }));

    // id -> נקודות "נכונות" (ptsOverride למקצועות חובה, אחרת D().coursePoints) -
    // לא רק למי שבאמת שובץ ב-plan, אלא לכל המקצועות ב"יקום" (remainingIds +
    // כל מועמדי-הבחירה שבאיזשהו מאגר פתוח, גם אם fillElectives לא בחר בהם
    // בפועל) - נחוץ לצרכנים חיצוניים (renderManualView, js/flowchart.js)
    // שרוצים להציג נקודות לפי-מקצוע גם למקצועות ב"מגירה" הלא-ממוקמת, בלי
    // לשכפל את היגיון ptsOverride כאן; D().coursePoints לבדו לא מספיק (ראו
    // הערה על ptsOverride בראש הקובץ - רוב מקצועות החובה כלל לא מופיעים שם).
    const pointsById = {};
    for (const id of remainingIds) pointsById[id] = coursePts(id);
    for (const p of openPools) for (const id of p.pool) pointsById[id] = coursePts(id);

    // דרישות כלל-טכניוניות (ספורט/מל"ג/בחירה חופשית) - res.general.buckets
    // (engine.js), לא res.sections/chains: אין להן id קטלוגי אחד, יש מבחר
    // גדול של מקצועות אפשריים בכל קטגוריה - ראו scheduleGeneralEd למעלה.
    // אחרי pointsById (addChunk כותב אליו ישירות בעצמו, למקצועות gen_* שאין
    // להם ייצוג אחר) אבל לפני return. planAnchorSemester (לא nominalSemester
    // הגולמי) לאותה סיבה כמו hardPinsRelative/minPosMap למעלה - עקבי מול
    // דריסת startSeason ידנית (בקשת המשתמש/ת, 2026-07-19: "אנחנו רק חסרים
    // את המל"ג והבחירה החופשית והספורט" - הפונקציה הייתה קיימת אך לא מחוברת).
    const generalNames = {};
    const generalNotes = [];
    if (res.general) scheduleGeneralEd(plan, res.general.buckets, capPts, planAnchorSemester, generalNotes, pointsById, generalNames);

    // "מומלץ" (taper): הפרויקט תמיד בסמסטר האחרון *בפועל* של התוכנית - לא
    // רק "מוקדם ככל שדרישות הקדם מאפשרות" כמו כל מקצוע חובה רגיל (EPS
    // רגיל היה עלול למקם פרויקט טרמינלי באמצע התוכנית סתם כי דרישות הקדם
    // שלו כבר מתמלאות מוקדם) - זו הציפייה הרגילה למי שמתכנן/ת קדימה (בקשת
    // המשתמש/ת, 2026-07-19: "the project should always be at the last
    // semester"). מיושם כהזזה *אחרי* שהתוכנית המלאה (חובה+בחירה+כלל-טכני)
    // כבר נבנתה - לא כחלק מ-EPS/lockedMap הרגילים, כדי לא לסבך את חישוב
    // ה-slack של שאר המקצועות (שום דבר לא באמת תלוי בפרויקט עצמו, הוא
    // תמיד עלה טרמינלי בגרף דרישות הקדם). עונה (season) היא אילוץ קשיח -
    // קיבולת (capPts) רכה, מוותרים עליה אחרי כמה ניסיונות במקום להאריך
    // את התוכנית לנצח בלי סוף.
    if (options.taper && projectIds.size) {
      const projPts = [...projectIds].reduce((s, id) => s + coursePts(id), 0);
      const commonSeasons = [...projectIds].map(id => courseSeasons(id)).filter(Boolean)
        .reduce((a, b) => (a ? a.filter(s => b.includes(s)) : null), null);
      for (const sem of plan) {
        const before = sem.ids.length;
        sem.ids = sem.ids.filter(id => !projectIds.has(id));
        if (sem.ids.length !== before) sem.pts = +sem.ids.reduce((s, id) => s + coursePts(id), 0).toFixed(2);
      }
      const startIndex = Math.max(plan.length, 1);
      let dest = null;
      for (let guard = 0, idx = startIndex; guard < 6; guard++, idx++) {
        while (plan.length < idx) plan.push({ index: plan.length + 1, season: semesterSeason(plan.length + 1), ids: [], pts: 0 });
        const sem = plan[idx - 1];
        if (commonSeasons && !commonSeasons.includes(sem.season)) continue;
        if (!dest) dest = sem; // ברירת מחדל: הראשון שמתאים בעונה, גם אם קיבולת לא
        if (!capPts || sem.pts + projPts <= capAt(capPts, idx)) { dest = sem; break; }
      }
      if (!dest) dest = plan[plan.length - 1]; // לא אמור לקרות (עונה משותפת ריקה) - רשת ביטחון
      for (const id of projectIds) dest.ids.push(id);
      dest.pts = +(dest.pts + projPts).toFixed(2);
      generalNotes.push({
        id: [...projectIds][0], kind: "project-last", to: dest.index,
        reason: "הפרויקט הוזז לסמסטר האחרון בתוכנית - כך נהוג לתכנן קדימה"
      });
    }

    // רשת ביטחון אחרונה - "מומלץ" (taper) לעולם לא אמור להציג יותר מ-8
    // סמסטרים בסך הכול, גם אם שלב כלשהו למעלה (בעיקר תיקוני-דרישות-קדם
    // מדורגים ב-repairPrereqOrder, שכל אחד מהם "תקין" ביחס למיקום-שכבר-הוסט
    // של הקודם לו, ומצטברים למדרגות שחורגות מ-buildTaperCap) בכל זאת האריך
    // את התוכנית מעבר לגבול, בהתנגשות-עומס קיצונית. עדיף למזג הכול לתוך
    // הסמסטר האחרון המותר (גם במחיר חריגה גדולה מ-25 נק') מאשר להאריך את
    // התואר בפועל מעבר ל-8 (בקשת המשתמש/ת, 2026-07-21: "should not resort
    // to extending the path to more than 8 semesters overall [lest it
    // exceeds 25 points a semester]") - לא נוגע בדרישות-קדם/עונות אחרי
    // המיזוג (מוותרים על הדיוק המלא במקרה-קיצון הזה בכוונה, ראו הערה למעלה).
    if (options.taper) {
      const maxRel = nominalSemester != null ? Math.max(1, TAPER_MAX_SEMESTERS - nominalSemester + 1) : TAPER_MAX_SEMESTERS;
      if (plan.length > maxRel) {
        const overflow = plan.splice(maxRel);
        const last = plan[maxRel - 1];
        for (const sem of overflow) {
          last.ids.push(...sem.ids);
          last.pts = +(last.pts + sem.pts).toFixed(2);
        }
        const overflowIds = overflow.flatMap(s => s.ids);
        if (overflowIds.length) {
          generalNotes.push({
            id: overflowIds[0], kind: "capped-8", to: last.index,
            reason: "מוזג לתוך הסמסטר האחרון - התוכנית לא מוארכת מעבר ל-8 סמסטרים גם במחיר חריגה מתקרת הנק'"
          });
        }
      }

      // "שחרור-לחץ" אחרון - אם הסמסטר האחרון בפועל (אחרי המיזוג לעיל, ואחרי
      // שהפרויקט כבר קובע אותו) עדיין עמוס מדי (>TAPER_SPLIT_THRESHOLD נק')
      // וטרם הגענו ל-8 סמסטרים - עדיף לפתוח עוד סמסטר ולפזר מעט מהעומס אליו
      // מאשר להשאיר את הסטודנט/ית עם סמסטר סיום מכביד (בקשת המשתמש/ת,
      // 2026-07-24; תוקן 2026-07-25: הגרסה הראשונה "דחפה" את תוכן הסמסטר
      // האחרון (כולל הפרויקט) לאינדקס+1 בלי לגעת בעונה שלו בפועל - כיוון
      // ש-semesterSeason מתחלף בכל צעד, זה בהכרח *הפך* את העונה של כל מה
      // שכבר היה שם (כולל הפרויקט עצמו!) בלי שום בדיקה שהוא בכלל ניתן בעונה
      // ההפוכה. הגרסה הזו לא נוגעת בכלל בזהות/עונת הסמסטר הקיים - במקום זה
      // רק *הפרויקט עצמו* עובר לסמסטר חדש-לגמרי בסוף התוכנית (index+1,
      // עונה מחושבת נכון מאפס בעצמה) - הזזת פרויקט קדימה תמיד בטוחה (עלה
      // בגרף דרישות הקדם), ורק אם עדיין לא הספיק - גם קצת מהתוכן הגמיש
      // (בחירה/כלל-טכני) של הסמסטר שהתפנה מצטרף אליו, בכפוף לעונה שלו.
      const lastSem = plan[plan.length - 1];
      if (lastSem.pts > TAPER_SPLIT_THRESHOLD && plan.length < maxRel) {
        const stillProject = lastSem.ids.filter(id => projectIds.has(id));
        if (stillProject.length) {
          const newIdx = lastSem.index + 1;
          const newSeason = semesterSeason(newIdx);
          const projSeasons = stillProject.map(id => courseSeasons(id)).filter(Boolean)
            .reduce((a, b) => (a ? a.filter(s => b.includes(s)) : null), null);
          // אם הפרויקט מוגבל לעונה שאינה זו של הסמסטר החדש - אין לאן להזיז
          // אותו בלי לשבור את אילוץ העונה שלו; מוותרים על הפיצול כליל (עדיף
          // סמסטר עמוס מהפרת עונה).
          if (!projSeasons || projSeasons.includes(newSeason)) {
            const projPts = stillProject.reduce((s, id) => s + (pointsById[id] ?? coursePts(id)), 0);
            lastSem.ids = lastSem.ids.filter(id => !projectIds.has(id));
            lastSem.pts = +(lastSem.pts - projPts).toFixed(2);
            const newSem = { index: newIdx, season: newSeason, ids: [...stillProject], pts: projPts };
            plan.push(newSem);
            generalNotes.push({
              id: stillProject[0], kind: "taper-split", to: newSem.index,
              reason: "הפרויקט הוזז לסמסטר נוסף בסוף - הסמסטר הקודם חרג מ-" + TAPER_SPLIT_THRESHOLD + " נק' וניתן היה להוסיף סמסטר בלי לעבור 8 בסך הכול"
            });
            // עדיין עמוס גם בלי הפרויקט - מצטרפים אליו גם מועמדים "בטוחים
            // תמיד" (בחירה/כלל-טכני, gen_*) מתוך מה שנשאר, לפי עונה מתאימה.
            if (lastSem.pts > TAPER_SPLIT_THRESHOLD) {
              const electiveIdSet = new Set(openPools.flatMap(p => p.pool));
              const movable = lastSem.ids
                .filter(id => id.startsWith("gen_") || electiveIdSet.has(id))
                .sort((a, b) => coursePts(b) - coursePts(a));
              for (const id of movable) {
                if (lastSem.pts <= TAPER_SPLIT_THRESHOLD) break;
                const seasons = courseSeasons(id);
                if (seasons && !seasons.includes(newSem.season)) continue;
                const pts = pointsById[id] ?? coursePts(id);
                lastSem.ids = lastSem.ids.filter(x => x !== id);
                lastSem.pts = +(lastSem.pts - pts).toFixed(2);
                newSem.ids.push(id);
                newSem.pts = +(newSem.pts + pts).toFixed(2);
              }
            }
          }
        }
      }
    }

    // מקצועות חובה שנותרו + כל מועמדי-הבחירה הפתוחים (לא רק מי שבאמת שובץ
    // ב-plan) - נחוץ לתצוגת "תכנון ידני" (renderManualView, js/flowchart.js)
    // שרוצה להציג "מגירה" עם כל המקצועות הרלוונטיים לפני שהמשתמש/ת גורר/ת
    // אותם בעצמו/ה לסמסטר, לא רק את מה ש-fillElectives בחר/ה אוטומטית.
    const electivePools = openPools.map(p => ({ key: p.key, title: p.title, kind: p.kind, ids: p.pool }));

    return {
      plan, // [{index, season, ids, pts}] - index יחסי, 1 = "הסמסטר הבא"; ראו nominalSemester להמרה למספר אמיתי
      pointsById,
      // id (gen_pe_1/gen_enrich_2/gen_free_3 וכו', ראו scheduleGeneralEd) ->
      // תווית תצוגה קצרה+ממוספרת ("מל\"ג 2") - למקצועות ספורט/מל"ג/בחירה
      // חופשית שאין להם id קטלוגי אמיתי, כדי ש-js/flowchart.js ידע להציג
      // אותם בתיבה בלי לנסות לחפש אותם ב-D.courseNames (לא ימצא כלום שם).
      generalNames,
      mandatoryIds: remainingIds,
      electivePools,
      totalSemesters: plan.length,
      criticalPathSemesters: minSemesters,
      hasOfficialBaseline: !!(baselineMap || lockedMap),
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
      notes: [...structuralNotes, ...electiveNotes, ...mandatoryHardPinNotes, ...repairNotes, ...overdueNotes, ...generalNotes],
      unplacedPools: openPools.filter(p => {
        // "מולא" = שיבוצים אוטומטיים (elective) + גרירות ידניות (hard-pin) +
        // זיכוי על מקצועות ששובצו כבר דרך מאגר אחר (pool-credit) - כל השלושה
        // מספקים את הדרישה בפועל, לא רק הראשון (ראו fillElectives).
        const filled = electiveNotes
          .filter(n => (n.kind === "elective" || n.kind === "hard-pin") && n.pool === p.key)
          .reduce((s, n) => s + (p.kind === "points" ? coursePts(n.id) : 1), 0);
        const credited = electiveNotes
          .filter(n => n.kind === "pool-credit" && n.pool === p.key)
          .reduce((s, n) => s + n.amount, 0);
        return filled + credited < p.need;
      }).map(p => p.key)
    };
  }

  return { computePlan, computeEPS, inferNextSeason };
})();
