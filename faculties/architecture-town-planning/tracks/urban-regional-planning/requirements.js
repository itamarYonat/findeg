/* FinDeg – standby: מסלול "תכנון ערים ואזורים", הפקולטה לארכיטקטורה ובינוי ערים.
 * TODO: למלא דרישות אמיתיות מהקטלוג (ראו faculties/civil/data.js לדוגמה מלאה של צורת track
 * אמיתי - sections/general/total, ואופציונלית chains/groupAPool/projects/specializations).
 * נרשם לתוך window.FINDEG_TRACK_DEFS['architecture-town-planning']['urban-regional-planning'] - נאסף
 * ע"י ../../data.js אחרי שכל קובצי tracks/<track>/requirements.js של הפקולטה נטענו.
 */
window.FINDEG_TRACK_DEFS = window.FINDEG_TRACK_DEFS || {};
window.FINDEG_TRACK_DEFS['architecture-town-planning'] = window.FINDEG_TRACK_DEFS['architecture-town-planning'] || {};
window.FINDEG_TRACK_DEFS['architecture-town-planning']['urban-regional-planning'] = {
  name: "תכנון ערים ואזורים",
  supported: false, // הפכו ל-true אחרי שממלאים years/sections/general/total אמיתיים
  years: {}
};
