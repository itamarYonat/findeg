/* FinDeg – standby: מסלול "הנדסת חומרים/כימיה (תכנית משולבת)", הפקולטה לכימיה.
 * TODO: למלא דרישות אמיתיות מהקטלוג (ראו faculties/civil/data.js לדוגמה מלאה של צורת track
 * אמיתי - sections/general/total, ואופציונלית chains/groupAPool/projects/specializations).
 * נרשם לתוך window.FINDEG_TRACK_DEFS['chemistry']['materials-chemistry'] - נאסף
 * ע"י ../../data.js אחרי שכל קובצי tracks/<track>/requirements.js של הפקולטה נטענו.
 */
window.FINDEG_TRACK_DEFS = window.FINDEG_TRACK_DEFS || {};
window.FINDEG_TRACK_DEFS['chemistry'] = window.FINDEG_TRACK_DEFS['chemistry'] || {};
window.FINDEG_TRACK_DEFS['chemistry']['materials-chemistry'] = {
  name: "הנדסת חומרים/כימיה (תכנית משולבת)",
  supported: false, // הפכו ל-true אחרי שממלאים years/sections/general/total אמיתיים
  years: {}
};
