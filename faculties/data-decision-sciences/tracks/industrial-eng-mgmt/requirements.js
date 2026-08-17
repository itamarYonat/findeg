/* FinDeg – standby: מסלול "הנדסת תעשייה וניהול", הפקולטה למדעי הנתונים וההחלטות.
 * TODO: למלא דרישות אמיתיות מהקטלוג (ראו faculties/civil/data.js לדוגמה מלאה של צורת track
 * אמיתי - sections/general/total, ואופציונלית chains/groupAPool/projects/specializations).
 * נרשם לתוך window.FINDEG_TRACK_DEFS['data-decision-sciences']['industrial-eng-mgmt'] - נאסף
 * ע"י ../../data.js אחרי שכל קובצי tracks/<track>/requirements.js של הפקולטה נטענו.
 */
window.FINDEG_TRACK_DEFS = window.FINDEG_TRACK_DEFS || {};
window.FINDEG_TRACK_DEFS['data-decision-sciences'] = window.FINDEG_TRACK_DEFS['data-decision-sciences'] || {};
window.FINDEG_TRACK_DEFS['data-decision-sciences']['industrial-eng-mgmt'] = {
  name: "הנדסת תעשייה וניהול",
  supported: false, // הפכו ל-true אחרי שממלאים years/sections/general/total אמיתיים
  years: {}
};
