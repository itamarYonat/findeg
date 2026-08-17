/* FinDeg – standby: מסלול "הנדסת חשמל-פיזיקה (משותף עם הפקולטה לפיזיקה)", הפקולטה להנדסת חשמל ומחשבים.
 * TODO: למלא דרישות אמיתיות מהקטלוג (ראו faculties/civil/data.js לדוגמה מלאה של צורת track
 * אמיתי - sections/general/total, ואופציונלית chains/groupAPool/projects/specializations).
 * נרשם לתוך window.FINDEG_TRACK_DEFS['electrical-computer']['electrical-physics'] - נאסף
 * ע"י ../../data.js אחרי שכל קובצי tracks/<track>/requirements.js של הפקולטה נטענו.
 */
window.FINDEG_TRACK_DEFS = window.FINDEG_TRACK_DEFS || {};
window.FINDEG_TRACK_DEFS['electrical-computer'] = window.FINDEG_TRACK_DEFS['electrical-computer'] || {};
window.FINDEG_TRACK_DEFS['electrical-computer']['electrical-physics'] = {
  name: "הנדסת חשמל-פיזיקה (משותף עם הפקולטה לפיזיקה)",
  supported: false, // הפכו ל-true אחרי שממלאים years/sections/general/total אמיתיים
  years: {}
};
