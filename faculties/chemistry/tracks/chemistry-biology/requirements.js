/* FinDeg – standby: מסלול "כימיה וביולוגיה (דו-חוגי)", הפקולטה לכימיה.
 * TODO: למלא דרישות אמיתיות מהקטלוג (ראו faculties/civil/data.js לדוגמה מלאה של צורת track
 * אמיתי - sections/general/total, ואופציונלית chains/groupAPool/projects/specializations).
 * נרשם לתוך window.FINDEG_TRACK_DEFS['chemistry']['chemistry-biology'] - נאסף
 * ע"י ../../data.js אחרי שכל קובצי tracks/<track>/requirements.js של הפקולטה נטענו.
 */
window.FINDEG_TRACK_DEFS = window.FINDEG_TRACK_DEFS || {};
window.FINDEG_TRACK_DEFS['chemistry'] = window.FINDEG_TRACK_DEFS['chemistry'] || {};
window.FINDEG_TRACK_DEFS['chemistry']['chemistry-biology'] = {
  name: "כימיה וביולוגיה (דו-חוגי)",
  supported: false, // הפכו ל-true אחרי שממלאים years/sections/general/total אמיתיים
  years: {}
};
