/* FinDeg – standby: מסלול "הנדסת מחשבים (משותף עם הפקולטה להנדסת חשמל ומחשבים)", הפקולטה למדעי המחשב.
 * TODO: למלא דרישות אמיתיות מהקטלוג (ראו faculties/civil/data.js לדוגמה מלאה של צורת track
 * אמיתי - sections/general/total, ואופציונלית chains/groupAPool/projects/specializations).
 * מסלול משותף - אותם מקצועות (וזיהוי דרישות-קדם) ישרתו גם
 * faculties/electrical-computer/tracks/computer-eng-joint-cs/requirements.js - לא להעתיק את נתוני המקצועות, רק להפנות
 * לאותו מאגר משותף (ראו faculties/_courses/README.md) כשהוא ימולא.
 * נרשם לתוך window.FINDEG_TRACK_DEFS['computer-science']['computer-eng-joint-electrical'] - נאסף
 * ע"י ../../data.js אחרי שכל קובצי tracks/<track>/requirements.js של הפקולטה נטענו.
 */
window.FINDEG_TRACK_DEFS = window.FINDEG_TRACK_DEFS || {};
window.FINDEG_TRACK_DEFS['computer-science'] = window.FINDEG_TRACK_DEFS['computer-science'] || {};
window.FINDEG_TRACK_DEFS['computer-science']['computer-eng-joint-electrical'] = {
  name: "הנדסת מחשבים (משותף עם הפקולטה להנדסת חשמל ומחשבים)",
  supported: false, // הפכו ל-true אחרי שממלאים years/sections/general/total אמיתיים
  years: {}
};
