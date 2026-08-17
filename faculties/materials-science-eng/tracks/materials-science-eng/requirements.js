/* FinDeg – standby: מסלול "מדע והנדסה של חומרים", הפקולטה למדע והנדסה של חומרים.
 * TODO: למלא דרישות אמיתיות מהקטלוג (ראו faculties/civil/data.js לדוגמה מלאה של צורת track
 * אמיתי - sections/general/total, ואופציונלית chains/groupAPool/projects/specializations).
 * נרשם לתוך window.FINDEG_TRACK_DEFS['materials-science-eng']['materials-science-eng'] - נאסף
 * ע"י ../../data.js אחרי שכל קובצי tracks/<track>/requirements.js של הפקולטה נטענו.
 */
window.FINDEG_TRACK_DEFS = window.FINDEG_TRACK_DEFS || {};
window.FINDEG_TRACK_DEFS['materials-science-eng'] = window.FINDEG_TRACK_DEFS['materials-science-eng'] || {};
window.FINDEG_TRACK_DEFS['materials-science-eng']['materials-science-eng'] = {
  name: "מדע והנדסה של חומרים",
  supported: false, // הפכו ל-true אחרי שממלאים years/sections/general/total אמיתיים
  years: {}
};
