/* FinDeg – סמסטרים בהם כל מקצוע ניתן בפועל.
 * שני מקורות ציבוריים, ללא צורך בהתחברות, שעליהם מבוסס גם CheeseFork:
 * (1) technion-sap-info-fetcher - קבוצות הוראה מתוזמנות בפועל (SAP), לסמסטרים
 *     האחרונים/הקרובים בלבד - זהו מקור "קדימה", לא תמיד מייצג (למשל קבוצה
 *     בודדת שנפתחה מנהלתית ולא כהיצע אמיתי).
 * (2) technion-histograms - היסטוגרמות ציונים רשמיות ואמיתיות ששיתפו סטודנטים
 *     - קיום היסטוגרמה שלמה לסמסטר הוא הוכחה חזקה בהרבה שהמקצוע אכן ניתן
 *     (אי אפשר לקבל ציונים אמיתיים למקצוע שלא התקיים). זהו האות "מאומת"
 *     (confirmed:true) ומקבל עדיפות; מוגבל לשנים שהקטלוגים שלנו מכסים בפועל
 *     (ראו yearCatalogs ב-data.js) - היסטוריה ישנה יותר עלולה להטעות אם דפוס
 *     ההיצע השתנה (זה קרה בפועל לפחות למקצוע אחד עם מעבר הקטלוג לתשפ"ד).
 * מקצוע עם confirmed:false מסתמך רק על המקור ה"קדימה" (אין לו היסטוריית
 * ציונים משותפת בכלל) - פחות אמין. מקצוע שלא מופיע כאן כלל - אין לו אות
 * מאף אחד משני המקורות.
 * קובץ זה מיוצר אוטומטית ע"י tools/fetch_course_semesters.py - אין לערוך ידנית.
 */
window.FINDEG_SEMESTERS = {
  "00140003": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140004": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140005": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140006": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140008": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140102": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140104": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140101": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140107": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140108": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140131": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140132": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140143": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140145": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140146": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140147": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140148": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140149": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140150": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140151": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140153": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140163": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00140201": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140202": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140205": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140212": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140214": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140302": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140305": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00140309": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140313": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00140316": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140321": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140325": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00140327": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140332": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00140333": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00140405": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140409": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140411": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140412": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140501": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140503": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140504": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140505": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140506": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140513": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00140520": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00140600": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00140601": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140603": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140609": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140613": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00140615": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140616": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140617": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140618": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140619": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140621": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140630": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140631": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140632": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140702": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140709": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140710": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140719": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140720": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140721": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140722": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140723": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140724": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140725": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140726": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00140728": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140730": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140731": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140733": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140734": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140735": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00140779": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140814": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140829": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140831": {
    "confirmed": true,
    "seasons": [
      "summer"
    ]
  },
  "00140841": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140842": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140843": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140845": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140846": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140848": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140849": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140851": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140852": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00140853": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140855": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00140856": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00140857": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00140859": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140866": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140867": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140868": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140869": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140875": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140876": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140877": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140878": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140879": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140881": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140882": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00140885": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00140888": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140889": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00140890": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00140935": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00140940": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140941": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00140942": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00140943": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00140952": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00140956": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140966": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00140972": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00140977": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140978": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00140979": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00150001": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00150007": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00150017": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00150019": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00160111": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00160122": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00160142": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00160144": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00160203": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00160206": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00160210": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00160211": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00160223": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00160303": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00160304": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00160306": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00160329": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00160336": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00160338": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00160339": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00160421": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00160503": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00160504": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00160505": {
    // תיקון ידני (2026-07-29, דיווח ישיר של המשתמש/ת): בנייה בעץ - חומרים
    // וטכנולוגיה ניתן בפועל רק בחורף - מבטל תיקון קודם (2026-07-24) שקבע אביב
    // בטעות. ראו הערה מקבילה בראש tools/fetch_course_semesters.py: הרצה
    // חוזרת של הסקריפט תדרוס את התיקון הזה בחזרה עד שהבעיה שם תיפתר.
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00160512": {
    // תיקון ידני (2026-07-24, דיווח ישיר של המשתמש/ת): אקוסטיקה בבניינים ניתנת
    // בפועל רק באביב, לא בחורף כפי שהונח מהנתונים שנשלפו - ראו הערה מקבילה
    // בראש tools/fetch_course_semesters.py (00140619/00140520): הרצה חוזרת של
    // הסקריפט תדרוס את התיקון הזה בחזרה עד שהבעיה שם תיפתר.
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00160513": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00160619": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00160630": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00160709": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00160713": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00160801": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00160815": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00160818": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00160819": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00160820": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00160828": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00160829": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00160833": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00160834": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00160837": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00170001": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00170012": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00340035": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00540203": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00540310": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00540314": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00540316": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00540323": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00540374": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00540400": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00540410": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00540452": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00540478": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00560379": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00940202": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00940219": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00940241": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00940314": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00940591": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00940594": {
    "confirmed": true,
    "seasons": [
      "winter",
      "summer"
    ]
  },
  "00960411": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00960553": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "01030015": {
    "confirmed": false,
    "seasons": [
      "summer"
    ]
  },
  "01040003": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "01040018": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "01040019": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "01040022": {
    "confirmed": true,
    "seasons": [
      "winter",
      "summer"
    ]
  },
  "01040042": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "01040044": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "01040131": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring",
      "summer"
    ]
  },
  "01040228": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring",
      "summer"
    ]
  },
  "01140051": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring",
      "summer"
    ]
  },
  "01140052": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring",
      "summer"
    ]
  },
  "01140054": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring",
      "summer"
    ]
  },
  "01140077": {
    "confirmed": true,
    "seasons": [
      "winter",
      "summer"
    ]
  },
  "01140078": {
    "confirmed": true,
    "seasons": [
      "spring",
      "summer"
    ]
  },
  "01240120": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "01240503": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "01240801": {
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "01250001": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "01340019": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "01340058": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring",
      "summer"
    ]
  },
  "02050598": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "02070600": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "02340128": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring",
      "summer"
    ]
  },
  "03140535": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "03140536": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "03240032": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "03240033": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring",
      "summer"
    ]
  },
  "03240053": {
    "confirmed": false,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "03240267": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "03940800": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "03940805": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "03940806": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  }
};
