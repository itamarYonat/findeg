/* FinDeg – שלד "barebones" לפקולטה חדשה שעדיין לא מולאה בנתונים אמיתיים.
 * זהו *תבנית*, לא פקולטה אמיתית - אינה רשומה ב-faculties/registry.js ולכן
 * אף תדפיס לא יופנה אליה אוטומטית; מגיעים אליה רק בקישור ישיר, כדי לראות
 * את הצורה המינימלית שפקולטה חדשה צריכה לפני שממלאים אותה בנתונים אמיתיים.
 *
 * ההבדל מפקולטה "מלאה" (ראו faculties/civil/data.js להשוואה): בלי מעקב
 * מקצועות-חובה ספציפי בכלל (sections: []) - כל הדרישה מתבטאת כסה"כ נק'
 * נדרש בסל "בחירה חופשית" הגנרי (engine.js כבר תומך בזה במלואו, בלי שום
 * שינוי קוד - ראו options.manual/"הוספת מקצוע" ב-app.js), עד שמישהו יפרק
 * את הדרישה האמיתית של הפקולטה למקצועות/מסלולים ספציפיים כמו ב-civil.
 *
 * למילוי אמיתי: מעתיקים תיקייה זו (faculties/<id>/), מחליפים את TOTAL_POINTS
 * וה-name למטה, ובהמשך - כשיש נתוני קטלוג אמיתיים - מוסיפים sections/
 * chains/projects כמו ב-civil/data.js, וקובץ faculties/<id>/detect.js
 * (ראו civil/detect.js) לזיהוי-מסלול אוטומטי מהתדפיס.
 */
window.FINDEG_DATA = (function () {
  // עדכנו לסה"כ הנקודות הנדרש בפועל לתואר בפקולטה הזו.
  const TOTAL_POINTS = 160;

  const tracks = {
    general: {
      name: "מסלול כללי (תבנית - עדיין לא מולאו דרישות ספציפיות)",
      supported: true,
      years: {
        placeholder: {
          sections: [],
          general: { pe: 0, enrichment: 0, free: TOTAL_POINTS },
          total: TOTAL_POINTS
        }
      }
    }
  };

  return {
    courseNames: {},
    coursePoints: {},
    equivGroups: [],
    combos: [],
    coursePrereqs: {},
    courseDifficulty: {},
    courseLastGrade: {},
    tracks,
    yearCatalogs: {}, // אין עדיין זיהוי-שנה אוטומטי לפקולטה הזו - בוחרים ידנית
    yearLabels: { placeholder: "קטלוג כללי (תבנית)" },
    registrarBranches: {},
    courseNamesEn: {}
  };
})();
