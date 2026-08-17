/* FinDeg – זיהוי מסלול (הפקולטה להנדסה אזרחית וסביבתית) מתוך כותרת התדפיס.
 * מוזרק ל-js/parser.js דרך opts.detectTrack (js/app.js מעביר את
 * window.FINDEG_FACULTY_DETECT.detectTrack, אם קיים) - שם גלובלי אחיד לכל
 * פקולטה, כדי ש-app.js המשותף לא יצטרך לדעת איזו פקולטה נטענה בפועל. תלוי
 * ב-FINDEG_PARSER.hasHeb (js/parser.js) - חייב להיטען אחריו ב-HTML.
 * זיהוי *ברמת הפקולטה עצמה* (לא המסלול) חי בנפרד ב-faculties/registry.js -
 * הדף הזה כבר לא צריך לבדוק את זה, הוא נטען רק אחרי שכבר ידוע שמדובר
 * בפקולטה הזו.
 */
window.FINDEG_FACULTY_DETECT = (function () {
  const hasHeb = (text, needle) => window.FINDEG_PARSER.hasHeb(text, needle);

  // בתדפיס שהוצא באנגלית הכותרת הכללית ("BACHELOR OF SCIENCE IN CIVIL
  // ENGINEERING") אכן לא חושפת את המסלול - civil הוא הכי גנרי, כמו "אזרחית"
  // בעברית; אם לא זוהה כלום המשתמש/ת בוחר/ת ידנית. שימו לב: שם הפקולטה עצמו
  // הוא תמיד "Civil and Environmental Engineering" (לכל הסטודנטים, לא רק
  // להתמחות סביבה!) - אסור לבדוק "environmental"/"management"/"structural"/
  // "mapping" מול כל הכותרת בלי דוגמה אמיתית מאומתת, כי זה יתפוס חיובי-שווא
  // על שם הפקולטה. אבל שם *התואר המדויק* (לא הפקולטה) כן מסתיים לפעמים
  // בסיומת מסלול מפורשת, למשל "BACHELOR OF SCIENCE IN CIVIL ENGINEERING
  // -STRUCTURES" - דוגמה אמיתית מאומתת (2026-07). בודקים רק בתוך הסיומת אחרי
  // "CIVIL ENGINEERING", לא כל הכותרת, כדי לא להיתפס על שם הפקולטה כנ"ל.
  function detectTrack(head) {
    const degreeSuffix = (head.match(/CIVIL ENGINEERING\s*[-–]\s*([A-Z][A-Z\s]*)/i) || [])[1] || "";
    if (hasHeb(head, "ניהול ובני") || hasHeb(head, "לוהינ") || /MANAGEMENT/i.test(degreeSuffix)) return "management";
    if (hasHeb(head, "מבנים") || /STRUCTURE/i.test(degreeSuffix)) return "structures";
    if (hasHeb(head, "סביבה")) return "environment";
    if (hasHeb(head, "מיפוי")) return "mapping";
    if (hasHeb(head, "אזרחית") || /civil engineering/i.test(head)) return "civil";
    return null;
  }

  return { detectTrack };
})();
