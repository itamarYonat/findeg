/* FinDeg – standby: מסלול "הנדסת מכונות", הפקולטה להנדסת מכונות.
 * TODO: למלא דרישות אמיתיות מהקטלוג (ראו faculties/civil/data.js לדוגמה מלאה של צורת track
 * אמיתי - sections/general/total, ואופציונלית chains/groupAPool/projects/specializations).
 * נרשם לתוך window.FINDEG_TRACK_DEFS['mechanical']['mechanical-eng'] - נאסף
 * ע"י ../../data.js אחרי שכל קובצי tracks/<track>/requirements.js של הפקולטה נטענו.
 */
window.FINDEG_TRACK_DEFS = window.FINDEG_TRACK_DEFS || {};
window.FINDEG_TRACK_DEFS['mechanical'] = window.FINDEG_TRACK_DEFS['mechanical'] || {};
window.FINDEG_TRACK_DEFS['mechanical']['mechanical-eng'] = {
  name: "הנדסת מכונות",
  supported: false, // הפכו ל-true אחרי שממלאים years/sections/general/total אמיתיים
  years: {}
};
