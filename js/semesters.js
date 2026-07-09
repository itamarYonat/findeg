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
    "confirmed": true,
    "seasons": [
      "spring"
    ]
  },
  "00140132": {
    "confirmed": true,
    "seasons": [
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
      "spring"
    ]
  },
  "00140153": {
    "confirmed": true,
    "seasons": [
      "spring"
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
  "00140305": {
    "confirmed": false,
    "seasons": [
      "winter"
    ]
  },
  "00140316": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
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
      "spring"
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
  "00140721": {
    "confirmed": true,
    "seasons": [
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
    "confirmed": true,
    "seasons": [
      "winter"
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
  "00140841": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
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
  "00140857": {
    "confirmed": false,
    "seasons": [
      "spring"
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
  "00160306": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00160421": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00160503": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00160504": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00160505": {
    "confirmed": false,
    "seasons": [
      "winter"
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
  "00160837": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "00170012": {
    "confirmed": false,
    "seasons": [
      "spring"
    ]
  },
  "00940202": {
    "confirmed": true,
    "seasons": [
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
  "00940591": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
    ]
  },
  "00960411": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
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
  "01240503": {
    "confirmed": true,
    "seasons": [
      "winter"
    ]
  },
  "01250001": {
    "confirmed": true,
    "seasons": [
      "winter",
      "spring"
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
