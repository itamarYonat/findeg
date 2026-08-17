/* FinDeg – standby: מסלול "הנדסה ביו-רפואית", הפקולטה להנדסה ביו-רפואית.
 * TODO: למלא דרישות אמיתיות מהקטלוג (ראו faculties/civil/data.js לדוגמה מלאה של צורת track
 * אמיתי - sections/general/total, ואופציונלית chains/groupAPool/projects/specializations).
 * נרשם לתוך window.FINDEG_TRACK_DEFS['biomedical-eng']['biomedical-eng'] - נאסף
 * ע"י ../../data.js אחרי שכל קובצי tracks/<track>/requirements.js של הפקולטה נטענו.
 */
window.FINDEG_TRACK_DEFS = window.FINDEG_TRACK_DEFS || {};
window.FINDEG_TRACK_DEFS['biomedical-eng'] = window.FINDEG_TRACK_DEFS['biomedical-eng'] || {};
window.FINDEG_TRACK_DEFS['biomedical-eng']['biomedical-eng'] = {
  name: "הנדסה ביו-רפואית",
  supported: false, // הפכו ל-true אחרי שממלאים years/sections/general/total אמיתיים
  years: {}
};
