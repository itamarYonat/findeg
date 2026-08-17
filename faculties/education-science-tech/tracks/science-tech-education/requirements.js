/* FinDeg – standby: מסלול "חינוך למדע וטכנולוגיה (7 מגמות הוראה: מתמטיקה/פיזיקה/כימיה/ביולוגיה-מדעי הסביבה/מדעי המחשב/טכנולוגיה-מכונות/אלקטרוניקה-חשמל)", הפקולטה לחינוך למדע וטכנולוגיה.
 * TODO: למלא דרישות אמיתיות מהקטלוג (ראו faculties/civil/data.js לדוגמה מלאה של צורת track
 * אמיתי - sections/general/total, ואופציונלית chains/groupAPool/projects/specializations).
 * נרשם לתוך window.FINDEG_TRACK_DEFS['education-science-tech']['science-tech-education'] - נאסף
 * ע"י ../../data.js אחרי שכל קובצי tracks/<track>/requirements.js של הפקולטה נטענו.
 */
window.FINDEG_TRACK_DEFS = window.FINDEG_TRACK_DEFS || {};
window.FINDEG_TRACK_DEFS['education-science-tech'] = window.FINDEG_TRACK_DEFS['education-science-tech'] || {};
window.FINDEG_TRACK_DEFS['education-science-tech']['science-tech-education'] = {
  name: "חינוך למדע וטכנולוגיה (7 מגמות הוראה: מתמטיקה/פיזיקה/כימיה/ביולוגיה-מדעי הסביבה/מדעי המחשב/טכנולוגיה-מכונות/אלקטרוניקה-חשמל)",
  supported: false, // הפכו ל-true אחרי שממלאים years/sections/general/total אמיתיים
  years: {}
};
