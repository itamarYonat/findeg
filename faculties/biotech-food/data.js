/* FinDeg – הפקולטה להנדסת ביוטכנולוגיה ומזון: standby, שלד בלבד - אין עדיין דרישות תואר אמיתיות.
 * מרכיב את tracks של הפקולטה הזו מתוך window.FINDEG_TRACK_DEFS['biotech-food'] - נבנה ע"י כל
 * אחד מקבצי faculties/biotech-food/tracks/<track>/requirements.js (נטענים לפני קובץ זה,
 * ראו סדר ה-<script> ב-index.html/flowcharts.html). כל מסלול הוא supported:false כרגע
 * ("בקרוב" בתפריט הבחירה, ראו app.js) עד שיוזנו דרישות אמיתיות בקובץ ה-requirements.js שלו.
 *
 * למילוי אמיתי: ראו faculties/civil/data.js כדוגמה מלאה, ו-faculties/_courses/README.md
 * להסבר על שיתוף נתוני מקצועות בין מסלולים/פקולטות (למשל מסלולים משותפים).
 */
window.FINDEG_DATA = (function () {
  const tracks = (window.FINDEG_TRACK_DEFS && window.FINDEG_TRACK_DEFS['biotech-food']) || {};
  return {
    courseNames: {},
    coursePoints: {},
    equivGroups: [],
    combos: [],
    coursePrereqs: {},
    courseDifficulty: {},
    courseLastGrade: {},
    tracks,
    yearCatalogs: {},
    yearLabels: {},
    registrarBranches: {},
    courseNamesEn: {}
  };
})();
