/* FinDeg – standby: מסלול "הנדסת מחשבים (משותף עם הפקולטה למדעי המחשב)", הפקולטה להנדסת חשמל ומחשבים.
 * TODO: למלא דרישות אמיתיות מהקטלוג (ראו faculties/civil/data.js לדוגמה מלאה של צורת track
 * אמיתי - sections/general/total, ואופציונלית chains/groupAPool/projects/specializations).
 * מסלול משותף - אותם מקצועות (וזיהוי דרישות-קדם) ישרתו גם
 * faculties/computer-science/tracks/computer-eng-joint-electrical/requirements.js - לא להעתיק את נתוני המקצועות, רק להפנות
 * לאותו מאגר משותף (ראו faculties/_courses/README.md) כשהוא ימולא.
 * נרשם לתוך window.FINDEG_TRACK_DEFS['electrical-computer']['computer-eng-joint-cs'] - נאסף
 * ע"י ../../data.js אחרי שכל קובצי tracks/<track>/requirements.js של הפקולטה נטענו.
 */
window.FINDEG_TRACK_DEFS = window.FINDEG_TRACK_DEFS || {};
window.FINDEG_TRACK_DEFS['electrical-computer'] = window.FINDEG_TRACK_DEFS['electrical-computer'] || {};
window.FINDEG_TRACK_DEFS['electrical-computer']['computer-eng-joint-cs'] = {
  name: "הנדסת מחשבים (משותף עם הפקולטה למדעי המחשב)",
  supported: false, // הפכו ל-true אחרי שממלאים years/sections/general/total אמיתיים
  years: {}
};
