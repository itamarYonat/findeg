/* FinDeg – standby: מסלול "מדעי המחשב ורפואה (תואר כפול)", הפקולטה למדעי המחשב.
 * TODO: למלא דרישות אמיתיות מהקטלוג (ראו faculties/civil/data.js לדוגמה מלאה של צורת track
 * אמיתי - sections/general/total, ואופציונלית chains/groupAPool/projects/specializations).
 * נרשם לתוך window.FINDEG_TRACK_DEFS['computer-science']['cs-medicine'] - נאסף
 * ע"י ../../data.js אחרי שכל קובצי tracks/<track>/requirements.js של הפקולטה נטענו.
 */
window.FINDEG_TRACK_DEFS = window.FINDEG_TRACK_DEFS || {};
window.FINDEG_TRACK_DEFS['computer-science'] = window.FINDEG_TRACK_DEFS['computer-science'] || {};
window.FINDEG_TRACK_DEFS['computer-science']['cs-medicine'] = {
  name: "מדעי המחשב ורפואה (תואר כפול)",
  supported: false, // הפכו ל-true אחרי שממלאים years/sections/general/total אמיתיים
  years: {}
};
