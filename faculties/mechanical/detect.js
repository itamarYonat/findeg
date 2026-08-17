/* FinDeg – standby: זיהוי-מסלול בתוך הפקולטה להנדסת מכונות. עדיין אין הבחנה בין המסלולים שלמעלה
 * מתוך כותרת התדפיס (TODO) - כרגע כולם נשארים ללא זיהוי אוטומטי, בוחרים ידנית (בדיוק כמו
 * מסלול לא-מזוהה בכל פקולטה אחרת). ראו faculties/civil/detect.js לדוגמה מלאה.
 */
window.FINDEG_FACULTY_DETECT = (function () {
  function detectTrack(head) {
    return null; // TODO: הוסיפו זיהוי לכל מסלול בפועל, בדומה ל-civil/detect.js
  }
  return { detectTrack };
})();
