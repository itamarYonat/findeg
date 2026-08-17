/* FinDeg – standby: מסלול "הנדסת ביוטכנולוגיה ומזון", הפקולטה להנדסת ביוטכנולוגיה ומזון.
 * TODO: למלא דרישות אמיתיות מהקטלוג (ראו faculties/civil/data.js לדוגמה מלאה של צורת track
 * אמיתי - sections/general/total, ואופציונלית chains/groupAPool/projects/specializations).
 * נרשם לתוך window.FINDEG_TRACK_DEFS['biotech-food']['biotech-food-eng'] - נאסף
 * ע"י ../../data.js אחרי שכל קובצי tracks/<track>/requirements.js של הפקולטה נטענו.
 */
window.FINDEG_TRACK_DEFS = window.FINDEG_TRACK_DEFS || {};
window.FINDEG_TRACK_DEFS['biotech-food'] = window.FINDEG_TRACK_DEFS['biotech-food'] || {};
window.FINDEG_TRACK_DEFS['biotech-food']['biotech-food-eng'] = {
  name: "הנדסת ביוטכנולוגיה ומזון",
  supported: false, // הפכו ל-true אחרי שממלאים years/sections/general/total אמיתיים
  years: {}
};
