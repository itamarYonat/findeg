/* FinDeg – standby: מסלול "הנדסה כימית (5 מגמות: כללית/חומרים/קיימות/ניתוח וחישוביות/תרופות ומערכות ביוכימיות)", הפקולטה להנדסה כימית.
 * TODO: למלא דרישות אמיתיות מהקטלוג (ראו faculties/civil/data.js לדוגמה מלאה של צורת track
 * אמיתי - sections/general/total, ואופציונלית chains/groupAPool/projects/specializations).
 * נרשם לתוך window.FINDEG_TRACK_DEFS['chemical']['chemical-eng'] - נאסף
 * ע"י ../../data.js אחרי שכל קובצי tracks/<track>/requirements.js של הפקולטה נטענו.
 */
window.FINDEG_TRACK_DEFS = window.FINDEG_TRACK_DEFS || {};
window.FINDEG_TRACK_DEFS['chemical'] = window.FINDEG_TRACK_DEFS['chemical'] || {};
window.FINDEG_TRACK_DEFS['chemical']['chemical-eng'] = {
  name: "הנדסה כימית (5 מגמות: כללית/חומרים/קיימות/ניתוח וחישוביות/תרופות ומערכות ביוכימיות)",
  supported: false, // הפכו ל-true אחרי שממלאים years/sections/general/total אמיתיים
  years: {}
};
