/* FinDeg – standby: מסלול "הנדסת מחשבים ותכנה", הפקולטה להנדסת חשמל ומחשבים.
 * TODO: למלא דרישות אמיתיות מהקטלוג (ראו faculties/civil/data.js לדוגמה מלאה של צורת track
 * אמיתי - sections/general/total, ואופציונלית chains/groupAPool/projects/specializations).
 * נרשם לתוך window.FINDEG_TRACK_DEFS['electrical-computer']['computer-eng-software'] - נאסף
 * ע"י ../../data.js אחרי שכל קובצי tracks/<track>/requirements.js של הפקולטה נטענו.
 */
window.FINDEG_TRACK_DEFS = window.FINDEG_TRACK_DEFS || {};
window.FINDEG_TRACK_DEFS['electrical-computer'] = window.FINDEG_TRACK_DEFS['electrical-computer'] || {};
window.FINDEG_TRACK_DEFS['electrical-computer']['computer-eng-software'] = {
  name: "הנדסת מחשבים ותכנה",
  supported: false, // הפכו ל-true אחרי שממלאים years/sections/general/total אמיתיים
  years: {}
};
