/* FinDeg – standby: מסלול "הנדסת אוירונוטיקה וחלל", הפקולטה להנדסת אוירונוטיקה וחלל.
 * TODO: למלא דרישות אמיתיות מהקטלוג (ראו faculties/civil/data.js לדוגמה מלאה של צורת track
 * אמיתי - sections/general/total, ואופציונלית chains/groupAPool/projects/specializations).
 * נרשם לתוך window.FINDEG_TRACK_DEFS['aerospace']['aerospace-eng'] - נאסף
 * ע"י ../../data.js אחרי שכל קובצי tracks/<track>/requirements.js של הפקולטה נטענו.
 */
window.FINDEG_TRACK_DEFS = window.FINDEG_TRACK_DEFS || {};
window.FINDEG_TRACK_DEFS['aerospace'] = window.FINDEG_TRACK_DEFS['aerospace'] || {};
window.FINDEG_TRACK_DEFS['aerospace']['aerospace-eng'] = {
  name: "הנדסת אוירונוטיקה וחלל",
  supported: false, // הפכו ל-true אחרי שממלאים years/sections/general/total אמיתיים
  years: {}
};
