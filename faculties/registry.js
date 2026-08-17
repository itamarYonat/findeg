/* FinDeg – רשימת הפקולטות הנתמכות, לזיהוי-פקולטה מכותרת התדפיס (לא זיהוי-
 * מסלול - זה קורה בשלב הבא, בתוך דף הפקולטה עצמה, ראו faculties/<id>/detect.js).
 * נטען *רק* ע"י דף הנחיתה הראשי (index.html/js/landing.js) - לא ע"י דפי
 * הפקולטות עצמן, שכבר יודעות איזו פקולטה הן. תלוי ב-FINDEG_PARSER.hasHeb
 * (js/parser.js) - חייב להיטען אחריו ב-HTML.
 *
 * להוספת פקולטה חדשה:
 *   1. יוצרים תיקייה faculties/<id>/ עם data.js/semesters.js/prereqs.js/
 *      prereq-overrides.js/flowchart-data.js/index.html/flowcharts.html
 *      (ראו faculties/_template/ לשלד מינימלי - "barebones", בלי מעקב
 *      מקצועות-חובה אמיתי, רק סה"כ נק' נדרשות דרך הסל "בחירה חופשית").
 *   2. אופציונלי: faculties/<id>/detect.js לזיהוי-מסלול בתוך הפקולטה (ראו
 *      faculties/civil/detect.js) - בלי זה המשתמש/ת פשוט בוחר/ת מסלול ידנית.
 *   3. מוסיפים כאן רשומה עם detect() ברמת-הפקולטה (מספיק ביטוי אחד יציב
 *      שמופיע בכותרת התדפיס של *כל* הסטודנטים בפקולטה, לא תלוי-מסלול -
 *      ראו הדוגמה של civil, "הנדסה אזרחית וסביבתית"/"Civil and Environmental
 *      Engineering" מופיע אצל כולם, כולל סביבה/מיפוי/וכו').
 */
window.FINDEG_FACULTY_REGISTRY = (function () {
  const hasHeb = (text, needle) => window.FINDEG_PARSER.hasHeb(text, needle);

  return [
    {
      id: "civil",
      name: "הפקולטה להנדסה אזרחית וסביבתית",
      folder: "faculties/civil/",
      // שם הפקולטה עצמו קבוע וזהה לכל הסטודנטים בה (כל ההתמחויות/מסלולים) -
      // ראו הערה מקבילה ב-faculties/civil/detect.js על אותה עובדה ברמת-מסלול.
      detect: headerText => hasHeb(headerText, "הנדסה אזרחית וסביבתית") ||
        /civil and environmental engineering/i.test(headerText)
    },
    {
      id: "mechanical",
      name: "הפקולטה להנדסת מכונות",
      folder: "faculties/mechanical/",
      // standby: השלד קיים, אבל דרישות אמיתיות עדיין לא הוזנו (ראו
      // faculties/mechanical/tracks/*/requirements.js) - הזיהוי כאן כבר עובד.
      detect: headerText => hasHeb(headerText, "הנדסת מכונות")
    },
    {
      id: "electrical-computer",
      name: "הפקולטה להנדסת חשמל ומחשבים",
      folder: "faculties/electrical-computer/",
      // standby: השלד קיים, אבל דרישות אמיתיות עדיין לא הוזנו (ראו
      // faculties/electrical-computer/tracks/*/requirements.js) - הזיהוי כאן כבר עובד.
      detect: headerText => hasHeb(headerText, "הנדסת חשמל ומחשבים")
    },
    {
      id: "chemical",
      name: "הפקולטה להנדסה כימית",
      folder: "faculties/chemical/",
      // standby: השלד קיים, אבל דרישות אמיתיות עדיין לא הוזנו (ראו
      // faculties/chemical/tracks/*/requirements.js) - הזיהוי כאן כבר עובד.
      detect: headerText => hasHeb(headerText, "הפקולטה להנדסה כימית")
    },
    {
      id: "biotech-food",
      name: "הפקולטה להנדסת ביוטכנולוגיה ומזון",
      folder: "faculties/biotech-food/",
      // standby: השלד קיים, אבל דרישות אמיתיות עדיין לא הוזנו (ראו
      // faculties/biotech-food/tracks/*/requirements.js) - הזיהוי כאן כבר עובד.
      detect: headerText => hasHeb(headerText, "הנדסת ביוטכנולוגיה ומזון")
    },
    {
      id: "aerospace",
      name: "הפקולטה להנדסת אוירונוטיקה וחלל",
      folder: "faculties/aerospace/",
      // standby: השלד קיים, אבל דרישות אמיתיות עדיין לא הוזנו (ראו
      // faculties/aerospace/tracks/*/requirements.js) - הזיהוי כאן כבר עובד.
      detect: headerText => hasHeb(headerText, "הנדסת אוירונוטיקה וחלל")
    },
    {
      id: "data-decision-sciences",
      name: "הפקולטה למדעי הנתונים וההחלטות",
      folder: "faculties/data-decision-sciences/",
      // standby: השלד קיים, אבל דרישות אמיתיות עדיין לא הוזנו (ראו
      // faculties/data-decision-sciences/tracks/*/requirements.js) - הזיהוי כאן כבר עובד.
      detect: headerText => hasHeb(headerText, "מדעי הנתונים וההחלטות")
    },
    {
      id: "mathematics",
      name: "הפקולטה למתמטיקה",
      folder: "faculties/mathematics/",
      // standby: השלד קיים, אבל דרישות אמיתיות עדיין לא הוזנו (ראו
      // faculties/mathematics/tracks/*/requirements.js) - הזיהוי כאן כבר עובד.
      detect: headerText => hasHeb(headerText, "הפקולטה למתמטיקה")
    },
    {
      id: "physics",
      name: "הפקולטה לפיזיקה",
      folder: "faculties/physics/",
      // standby: השלד קיים, אבל דרישות אמיתיות עדיין לא הוזנו (ראו
      // faculties/physics/tracks/*/requirements.js) - הזיהוי כאן כבר עובד.
      detect: headerText => hasHeb(headerText, "הפקולטה לפיזיקה")
    },
    {
      id: "chemistry",
      name: "הפקולטה לכימיה",
      folder: "faculties/chemistry/",
      // standby: השלד קיים, אבל דרישות אמיתיות עדיין לא הוזנו (ראו
      // faculties/chemistry/tracks/*/requirements.js) - הזיהוי כאן כבר עובד.
      detect: headerText => hasHeb(headerText, "הפקולטה לכימיה")
    },
    {
      id: "biology",
      name: "הפקולטה לביולוגיה",
      folder: "faculties/biology/",
      // standby: השלד קיים, אבל דרישות אמיתיות עדיין לא הוזנו (ראו
      // faculties/biology/tracks/*/requirements.js) - הזיהוי כאן כבר עובד.
      detect: headerText => hasHeb(headerText, "הפקולטה לביולוגיה")
    },
    {
      id: "architecture-town-planning",
      name: "הפקולטה לארכיטקטורה ובינוי ערים",
      folder: "faculties/architecture-town-planning/",
      // standby: השלד קיים, אבל דרישות אמיתיות עדיין לא הוזנו (ראו
      // faculties/architecture-town-planning/tracks/*/requirements.js) - הזיהוי כאן כבר עובד.
      detect: headerText => hasHeb(headerText, "ארכיטקטורה ובינוי ערים")
    },
    {
      id: "education-science-tech",
      name: "הפקולטה לחינוך למדע וטכנולוגיה",
      folder: "faculties/education-science-tech/",
      // standby: השלד קיים, אבל דרישות אמיתיות עדיין לא הוזנו (ראו
      // faculties/education-science-tech/tracks/*/requirements.js) - הזיהוי כאן כבר עובד.
      detect: headerText => hasHeb(headerText, "לחינוך למדע וטכנולוגיה")
    },
    {
      id: "computer-science",
      name: "הפקולטה למדעי המחשב",
      folder: "faculties/computer-science/",
      // standby: השלד קיים, אבל דרישות אמיתיות עדיין לא הוזנו (ראו
      // faculties/computer-science/tracks/*/requirements.js) - הזיהוי כאן כבר עובד.
      detect: headerText => hasHeb(headerText, "הפקולטה למדעי המחשב")
    },
    {
      id: "medicine",
      name: "הפקולטה לרפואה",
      folder: "faculties/medicine/",
      // standby: השלד קיים, אבל דרישות אמיתיות עדיין לא הוזנו (ראו
      // faculties/medicine/tracks/*/requirements.js) - הזיהוי כאן כבר עובד.
      detect: headerText => hasHeb(headerText, "הפקולטה לרפואה")
    },
    {
      id: "materials-science-eng",
      name: "הפקולטה למדע והנדסה של חומרים",
      folder: "faculties/materials-science-eng/",
      // standby: השלד קיים, אבל דרישות אמיתיות עדיין לא הוזנו (ראו
      // faculties/materials-science-eng/tracks/*/requirements.js) - הזיהוי כאן כבר עובד.
      detect: headerText => hasHeb(headerText, "מדע והנדסה של חומרים")
    },
    {
      id: "biomedical-eng",
      name: "הפקולטה להנדסה ביו-רפואית",
      folder: "faculties/biomedical-eng/",
      // standby: השלד קיים, אבל דרישות אמיתיות עדיין לא הוזנו (ראו
      // faculties/biomedical-eng/tracks/*/requirements.js) - הזיהוי כאן כבר עובד.
      detect: headerText => hasHeb(headerText, "הנדסה ביו-רפואית")
    }
    // standby (16 פקולטות, שלד בלבד - ראו כל faculties/<id>/tracks/*/requirements.js)
    // נוספו כאן; רשומות אמיתיות נוספות (אם יתווספו עוד פקולטות) יתווספו כאן.
  ];
})();
