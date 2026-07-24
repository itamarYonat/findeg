/* FinDeg – פענוח תדפיס ציונים (PDF) בצד הלקוח בלבד. */
window.FINDEG_PARSER = (function () {

  const rev = s => [...s].reverse().join("");

  // בדיקת הימצאות מחרוזת עברית בטקסט, בשני הכיוונים (חלק מקוראי ה-PDF מחזירים עברית הפוכה)
  function hasHeb(text, needle) {
    return text.includes(needle) || text.includes(rev(needle));
  }

  async function extractLines(arrayBuffer) {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const lines = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      // קיבוץ לפי שורות (Y מעוגל) ומיון לפי X עולה
      const rows = new Map();
      for (const item of content.items) {
        if (!item.str || !item.str.trim()) continue;
        const y = Math.round(item.transform[5] / 3) * 3;
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y).push({ x: item.transform[4], str: item.str });
      }
      const ys = [...rows.keys()].sort((a, b) => b - a); // מלמעלה למטה
      for (const y of ys) {
        const parts = rows.get(y).sort((a, b) => a.x - b.x);
        lines.push(parts.map(o => o.str).join(" ").replace(/\s+/g, " ").trim());
      }
    }
    return lines;
  }

  const SEASONS = [
    { key: "winter", heb: "חורף", en: "Winter", ord: 0 },
    { key: "spring", heb: "אביב", en: "Spring", ord: 1 },
    { key: "summer", heb: "קיץ", en: "Summer", ord: 2 }
  ];
  // בדיקת מילת מפתח בעברית (בשני הכיוונים) או באנגלית (לא תלוית רישיות) - לתמיכה
  // בתדפיסים שהוצאו באנגלית (Technion מאפשר ייצוא בשתי השפות)
  function hasKw(text, heb, en) {
    if (heb && hasHeb(text, heb)) return true;
    if (en && text.toLowerCase().includes(en.toLowerCase())) return true;
    return false;
  }

  // שם הסטודנט תמיד מופיע צמוד ל"ת.ז" בכותרת התעודה/הגיליון. חילוץ הטקסט מה-PDF
  // לפעמים מסדר את קבוצות המילים בשורה בסדר הפוך (למשל "...ת.ז.: אחרק עידו תעודת
  // ציונים של" - השם מופיע *אחרי* התווית, לא לפניה) - בודקים גם לפני וגם אחרי.
  const NAME_ID_LABELS = ["ת.ז", "ת\"ז", "ת”ז"];
  const NAME_STRIP_WORDS = ["תעודת", "ציונים", "גיליון", "של", "עבור"];
  function isPlausibleName(s) {
    if (!s || s.length > 40) return false;
    const words = s.trim().split(/\s+/);
    if (words.length > 5) return false;
    return /^[א-ת\s'"׳״-]+$/.test(s) || /^[A-Za-z\s.'-]+$/.test(s);
  }
  // תדפיס באנגלית: השם צמוד ל"ID:" בכותרת, בסדר רגיל (לא הפוך) - "NAME ID: 123...".
  // טכניון מדפיס את השם באותיות גדולות בלבד ("ASSAF BEZERANO MAGAL"), בעוד הטקסט
  // שלפניו ("Transcript of Academic Records") הוא Title Case - לוקחים את רצף
  // המילים באותיות גדולות שצמוד ל-ID: מימין, כדי לא לקלוט טקסט כותרת קודם בטעות.
  function extractStudentNameEn(head) {
    const idx = head.indexOf("ID:");
    if (idx === -1) return null;
    const before = head.slice(Math.max(0, idx - 60), idx).trim();
    const words = before.split(/\s+/).filter(Boolean);
    const nameWords = [];
    for (let i = words.length - 1; i >= 0; i--) {
      if (/^[A-Z.'-]+$/.test(words[i])) nameWords.unshift(words[i]);
      else break;
    }
    const name = nameWords.join(" ").trim();
    return name.length >= 3 && isPlausibleName(name) ? name : null;
  }
  function extractStudentName(head) {
    const en = extractStudentNameEn(head);
    if (en) return en;
    for (const lbl of NAME_ID_LABELS) {
      const idx = head.indexOf(lbl);
      if (idx === -1) continue;
      // מקרה רגיל: "...תעודת ציונים של NAME ת.ז..." - השם צמוד לתווית משמאלה,
      // אחרי מילות כותרת שמסירים מתחילת הקטע
      const before = head.slice(Math.max(0, idx - 40), idx).trim();
      const beforeWords = before.split(/\s+/).filter(Boolean);
      while (beforeWords.length && NAME_STRIP_WORDS.includes(beforeWords[0])) beforeWords.shift();
      const nameBefore = beforeWords.join(" ").trim();
      if (isPlausibleName(nameBefore)) return nameBefore;

      // מקרה הפוך: "...ת.ז.: NAME תעודת ציונים של" - השם צמוד לתווית מימינה,
      // ואחריו (הרחק ממנה) מילות הכותרת - לוקחים מילים מההתחלה עד שנתקלים בהן.
      // מדלגים תחילה על סימני פיסוק שנשארו מהתווית עצמה (למשל "ת.ז.: ")
      const after = head.slice(idx + lbl.length, idx + lbl.length + 40).trim();
      const afterWords = after.split(/\s+/).filter(Boolean);
      const nameAfterWords = [];
      let started = false;
      for (const w of afterWords) {
        if (!started) {
          if (!/[א-ת]/.test(w)) continue;
          started = true;
        }
        if (NAME_STRIP_WORDS.includes(w) || /\d/.test(w)) break;
        nameAfterWords.push(w);
      }
      // סדר המילים בתוך שם הסטודנט עצמו מתגלה הפוך (שם משפחה ואז שם פרטי) באותה
      // תופעת חילוץ - מיישרים
      const nameAfter = nameAfterWords.reverse().join(" ").trim();
      if (isPlausibleName(nameAfter)) return nameAfter;
    }
    return null;
  }

  // התאמת שם למקצוע לא-מזוהה: אם המילה הראשונה בשם המקצוע (מהתדפיס) מזהה
  // ביחידות רק מקצוע קטלוגי אחד (למשל "אלגברה"), רואים בזה אותו מקצוע גם אם
  // קוד המקצוע שונה - שימושי לקודים ישנים/חלופיים שלא נוספו עדיין ל-equivGroups.
  // כשהמילה הראשונה לבד לא ייחודית (למשל "תכנון", שמופיע בכמה מקצועות) בודקים
  // גם צירוף של שתי המילים המשמעותיות הראשונות (למשל "תכנון ובקרה" כן ייחודי,
  // ומספיק כדי לזהות "תכנון ובקרה של פרויקטים בבנייה" כאותו מקצוע כמו
  // "תכנון ובקרה של פרויקטי בנייה" למרות ניסוח מעט שונה).
  const NAME_STOPWORDS_MATCH = new Set([
    "של", "עם", "בין", "או", "עבור",
    "of", "to", "and", "the", "in", "for", "with", "a", "an"
  ]);
  function significantWords(name, count) {
    const clean = String(name).replace(/["'׳״()]/g, "").trim();
    return clean.split(/\s+/).filter(w => w && !NAME_STOPWORDS_MATCH.has(w) && !NAME_STOPWORDS_MATCH.has(w.toLowerCase())).slice(0, count);
  }
  function leadingWord(name) {
    const w = significantWords(name, 1)[0];
    return w && w.length >= 3 ? w.toLowerCase() : null;
  }
  function twoWordSignature(name) {
    const ws = significantWords(name, 2);
    if (ws.length < 2) return null;
    const sig = ws.join(" ").toLowerCase();
    return sig.length >= 5 ? sig : null;
  }
  function buildMatchMaps(namesDict) {
    const oneCounts = {}, oneFirstId = {}, twoCounts = {}, twoFirstId = {};
    for (const [id, name] of Object.entries(namesDict)) {
      const lead = leadingWord(name);
      if (lead) {
        oneCounts[lead] = (oneCounts[lead] || 0) + 1;
        if (!(lead in oneFirstId)) oneFirstId[lead] = id;
      }
      const sig = twoWordSignature(name);
      if (sig) {
        twoCounts[sig] = (twoCounts[sig] || 0) + 1;
        if (!(sig in twoFirstId)) twoFirstId[sig] = id;
      }
    }
    const oneWord = {}, twoWord = {};
    for (const [k, c] of Object.entries(oneCounts)) if (c === 1) oneWord[k] = oneFirstId[k];
    for (const [k, c] of Object.entries(twoCounts)) if (c === 1) twoWord[k] = twoFirstId[k];
    return { oneWord, twoWord };
  }
  let matchMapsCache = null;
  function getMatchMaps() {
    if (!matchMapsCache) matchMapsCache = buildMatchMaps(FINDEG_DATA.courseNames);
    return matchMapsCache;
  }
  // אותו רעיון, אבל מול תרגום אנגלי חלקי (courseNamesEn) - לתדפיסים שהוצאו
  // באנגלית, כשם המקצוע בתדפיס באנגלית ולא ניתן להשוות מול הקטלוג העברי
  let matchMapsEnCache = null;
  function getMatchMapsEn() {
    if (!matchMapsEnCache) matchMapsEnCache = buildMatchMaps(FINDEG_DATA.courseNamesEn || {});
    return matchMapsEnCache;
  }

  // ניקוי שורת מקצוע לשם קריא: מסירים תאריך/סמסטר/סטטוס/מספרים, ומיישרים כיוון
  // (התדפיסים לפעמים מגיעים הפוכים תו-אחר-תו - orientationHint הוא ניחוש גלובלי
  // למסמך, וניחוש מקומי מהשורה עצמה גובר עליו כשיש).
  const NAME_NOISE_WORDS = ["פטור", "ללא ניקוד", "ללא", "ניקוד", "עם", "עובר", ...SEASONS.map(s => s.heb)];
  // מילות רעש באנגלית (תדפיס שהוצא באנגלית) - הביטויים הארוכים קודם, כדי שלא
  // ישאירו שאריות ("without points"/"with points" לפני "Exemption" לבדה)
  const NAME_NOISE_WORDS_EN = [
    "Exemption without points", "Exemption with points", "Exemption",
    "without points", "with points", "Pass", ...SEASONS.map(s => s.en)
  ];
  function detectOrientation(text, needle) {
    if (text.includes(needle)) return "normal";
    if (text.includes(rev(needle))) return "reversed";
    return null;
  }
  function extractCourseName(rest, orientationHint) {
    let s = rest.replace(/\b(20\d{2})\s*-\s*(20\d{2})\b/g, " ");
    let orientation = null;
    for (const w of NAME_NOISE_WORDS) {
      const o = detectOrientation(s, w);
      if (o) { orientation = o; break; }
    }
    if (!orientation) orientation = orientationHint;
    for (const w of NAME_NOISE_WORDS) {
      s = s.split(w).join(" ").split(rev(w)).join(" ");
    }
    for (const w of NAME_NOISE_WORDS_EN) {
      const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      s = s.replace(re, " ");
    }
    // תווית שנה אקדמית עברית (תשפ"ד/תשפ"ה/תשפ"ו/תשפ"ז...) שמופיעה לצד הסמסטר
    s = s.replace(/תשפ["׳״]?[א-ת]/g, " ").replace(/ד"פשת|ה"פשת|ו"פשת|ז"פשת|ג"פשת|ח"פשת/g, " ");
    s = s.replace(/\d+(?:\.\d+)?/g, " ").replace(/\s+/g, " ").trim();
    if (orientation === "reversed") s = rev(s);
    return s;
  }

  function parseTranscript(lines) {
    const result = {
      courses: [],          // {id, pts, grade, status, year, season}
      track: null,          // מפתח מסלול
      trackText: null,
      startYear: null,      // שנה לועזית של סמסטר החורף הראשון
      catalogYear: null,
      declared: null,       // {done, required} אם זוהה מהכותרת
      warnings: []
    };

    const head = lines.slice(0, 8).join(" ");
    // זיהוי מסלול מכותרת התעודה. בתדפיס שהוצא באנגלית הכותרת הכללית
    // ("BACHELOR OF SCIENCE IN CIVIL ENGINEERING") אכן לא חושפת את המסלול -
    // civil הוא הכי גנרי, כמו "אזרחית" בעברית; אם לא זוהה כלום המשתמש בוחר ידנית.
    // שימו לב: שם הפקולטה עצמו הוא תמיד "Civil and Environmental Engineering" (לכל
    // הסטודנטים, לא רק להתמחות סביבה!) - אסור לבדוק "environmental"/"management"/
    // "structural"/"mapping" מול כל הכותרת בלי דוגמה אמיתית מאומתת, כי זה יתפוס
    // חיובי-שווא על שם הפקולטה. אבל שם *התואר המדויק* (לא הפקולטה) כן מסתיים
    // לפעמים בסיומת מסלול מפורשת, למשל "BACHELOR OF SCIENCE IN CIVIL ENGINEERING
    // -STRUCTURES" - דוגמה אמיתית מאומתת (2026-07). בודקים רק בתוך הסיומת אחרי
    // "CIVIL ENGINEERING", לא כל הכותרת, כדי לא להיתפס על שם הפקולטה כנ"ל.
    const degreeSuffix = (head.match(/CIVIL ENGINEERING\s*[-–]\s*([A-Z][A-Z\s]*)/i) || [])[1] || "";
    if (hasHeb(head, "ניהול ובני") || hasHeb(head, "לוהינ") || /MANAGEMENT/i.test(degreeSuffix)) result.track = "management";
    else if (hasHeb(head, "מבנים") || /STRUCTURE/i.test(degreeSuffix)) result.track = "structures";
    else if (hasHeb(head, "סביבה")) result.track = "environment";
    else if (hasHeb(head, "מיפוי")) result.track = "mapping";
    else if (hasHeb(head, "אזרחית") || /civil engineering/i.test(head)) result.track = "civil";

    result.studentName = extractStudentName(head);

    // תדפיס שהוצא באנגלית (טכניון תומך בשתי השפות) - כשאין עברית בכלל במסמך,
    // משתמשים בזיהוי מילות מפתח באנגלית ומוותרים על הדרישה לעברית בכל שורה
    const hasAnyHebrew = lines.some(l => /[֐-׿]/.test(l));

    // כיוון הטקסט של המסמך (ראו extractCourseName) - מנחשים פעם אחת מכל
    // המסמך, לפי מילת עונה שנמצאה באיזושהי שורה, ומשתמשים בזה כברירת מחדל
    // לשורות שבהן אין רמז מקומי משלהן.
    let docOrientation = null;
    for (const line of lines) {
      for (const s of SEASONS) {
        const o = detectOrientation(line, s.heb);
        if (o) { docOrientation = o; break; }
      }
      if (docOrientation) break;
    }

    // שורת "וצבר X נקודות מתוך Y" – ניקח את המספרים כבדיקה צולבת
    // (בתעודת ציונים; בגיליון ציונים אין "מתוך", רק "נקודות מצטברות")
    for (const line of lines.slice(0, 10)) {
      if (hasHeb(line, "מתוך") && hasHeb(line, "נקודות")) {
        let m = line.match(/וצבר\s+(\d+(?:\.\d+)?)\s+נקודות\s+מתוך\s+(\d+(?:\.\d+)?)/);
        if (m) { result.declared = { done: +m[1], required: +m[2] }; break; }
        m = line.match(/(\d+(?:\.\d+)?)\s+ךותמ\s+תודוקנ\s+(\d+(?:\.\d+)?)\s+רבצו/);
        if (m) { result.declared = { done: +m[2], required: +m[1] }; break; }
        break;
      }
      if (hasHeb(line, "נקודות מצטברות")) {
        const m = line.match(/(\d+(?:\.\d+)?)\s*:?\s*תורבטצמ\s*תודוקנ/);
        if (m) { result.declared = { done: +m[1], required: null }; break; }
      }
    }

    const seen = new Map(); // id -> index in courses (לטיפול בחזרות על מקצוע)
    // מקצועות חינוך גופני (קידומת "039") ניתנים לחזרה עם זיכוי נפרד בכל פעם (למשל
    // אותה קבוצת "הגנה עצמית" שנלקחה גם בחורף וגם באביב) - בניגוד למקצוע אקדמי רגיל
    // שחוזר על עצמו בתדפיס (למשל נכשל ואז חזר ועבר), שבו רק ניסיון אחד אמור להיספר.
    // ראו engine.js: אותה קידומת כבר משמשת שם לשיוך אוטומטי לסל "ספורט".
    const isRepeatable = id => id.startsWith("039");

    // מזהה שורת כותרת סמסטר בגיליונות המקובצים לפי סמסטר (לדוגמה "2025-2026 ףרוח ו"פשת"),
    // שבהם התאריך מופיע פעם אחת לכל קבוצת מקצועות ולא בכל שורה בנפרד.
    const YEAR_RANGE_RE = /\b(20\d{2})\s*-\s*(20\d{2})\b/;
    let curYear = null, curSeason = null;

    for (const line of lines) {
      const idMatch = line.match(/\b(\d{6,8})\b/);
      const hdrYearMatch = line.match(YEAR_RANGE_RE);
      const hdrSeason = SEASONS.find(s => hasKw(line, s.heb, s.en));
      if (!idMatch && hdrYearMatch && hdrSeason) {
        curYear = parseInt(hdrYearMatch[1], 10);
        curSeason = hdrSeason.key;
        continue;
      }
      if (!idMatch) continue;
      const rawId = idMatch[1];
      const id = rawId.padStart(8, "0");
      // לא שורת מקצוע אם אין עברית בכלל (בתדפיס עברי) - מסנן שורות רעש כמו
      // מספרי עמוד/תאריכים בלבד. בתדפיס אנגלי אין בדיקה מקבילה: שם מקצוע ארוך
      // לפעמים עובר לשורה נפרדלגמרי (Y שונה) ומשאיר שורה כמו "3140536 2 96"
      // בלי אף אות באנגלית - הבדיקה על ציון/סטטוס בהמשך כבר מסננת רעש אמיתי.
      if (hasAnyHebrew && !/[֐-׿]/.test(line)) continue;

      const rest = line.replace(rawId, " ");
      const rawName = extractCourseName(rest, docOrientation);
      // אם הקוד לא מוכר אך שם המקצוע (מהתדפיס) מזהה ביחידות מקצוע קטלוגי
      // אחד (למשל "אלגברה") - מתייחסים אליו כאותו מקצוע, גם אם הקוד שונה
      // (קודים ישנים/חלופיים שלא נוספו עדיין ל-equivGroups). שם עברי בודקים
      // מול הקטלוג העברי, שם אנגלי (בתדפיס שהוצא באנגלית) מול courseNamesEn.
      let finalId = id;
      if (!FINDEG_DATA.courseNames[id] && rawName) {
        const isHebName = /[֐-׿]/.test(rawName);
        const maps = isHebName ? getMatchMaps() : getMatchMapsEn();
        const lead = leadingWord(rawName);
        const twoSig = twoWordSignature(rawName);
        if (lead && maps.oneWord[lead]) finalId = maps.oneWord[lead];
        else if (twoSig && maps.twoWord[twoSig]) finalId = maps.twoWord[twoSig];
      }
      // סמסטר: קודם מהשורה עצמה, ואם חסר - מכותרת הסמסטר האחרונה שנקראה
      const yearMatch = rest.match(YEAR_RANGE_RE);
      let year = null, season = null;
      if (yearMatch) year = parseInt(yearMatch[1], 10);
      for (const s of SEASONS) if (hasKw(rest, s.heb, s.en)) season = s.key;
      if (year === null) year = curYear;
      if (season === null) season = curSeason;

      // סטטוס
      let status = null;
      const isExempt = hasKw(rest, "פטור", "Exemption");
      const noCredit = hasHeb(rest, "ללא ניקוד") || (hasHeb(rest, "ללא") && hasHeb(rest, "ניקוד") && !hasHeb(rest, "עם")) ||
        /without points/i.test(rest);
      if (isExempt) status = noCredit ? "exempt_nocredit" : "exempt_credit";
      else if (hasHeb(rest, "עובר") || /\bpass\b/i.test(rest)) status = "pass_binary";

      // מספרים שאינם שנים: ציון (55-100 שלם) וניקוד (0.5-9, כפולות חצי)
      const numTokens = (rest.replace(/\b20\d\d\s*-\s*20\d\d\b/g, " ").match(/\d+(?:\.\d+)?/g) || [])
        .map(Number).filter(n => n <= 120);
      let grade = null, pts = null;
      const ptsCands = numTokens.filter(n => n > 0 && n <= 9 && (n * 2) % 1 === 0);
      const gradeCands = numTokens.filter(n => Number.isInteger(n) && n >= 10 && n <= 100);
      if (gradeCands.length) grade = gradeCands[gradeCands.length - 1];
      if (ptsCands.length) {
        // סדר העמודות בשורה תלוי בכיוון המסמך: בעברית הניקוד מופיע *לפני* שם
        // המקצוע (שבסוף השורה) - הראשון הוא הניקוד האמיתי. באנגלית הסדר רגיל
        // (מקצוע ואז ניקוד ואז ציון) - ומספרים בתוך שם המקצוע עצמו (כמו "Physics 1"
        // או "Calculus 1M") מקדימים את הניקוד האמיתי - האחרון הוא הניקוד האמיתי.
        pts = hasAnyHebrew ? ptsCands[0] : ptsCands[ptsCands.length - 1];
      }
      if (!status && grade === null) continue; // שורה ללא תוצאה (למשל כותרת)
      if (status && noCredit) pts = 0;
      if (status === "pass_binary" && pts === null) pts = 0;
      if (pts === null) pts = 0;

      const passed = status === "exempt_credit" || status === "exempt_nocredit" ||
        status === "pass_binary" || (grade !== null && grade >= 55);

      const rec = { id: finalId, pts, grade, status: status || "graded", passed, year, season, name: rawName || null };
      if (seen.has(finalId) && !isRepeatable(finalId)) {
        const prev = result.courses[seen.get(finalId)];
        // עדיפות לרשומה עוברת; אחרת לאחרונה
        if (!prev.passed || rec.passed) result.courses[seen.get(finalId)] = rec;
      } else {
        if (!seen.has(finalId)) seen.set(finalId, result.courses.length);
        result.courses.push(rec);
      }
    }

    // שנת תחילת לימודים: השנה המוקדמת ביותר (+התחשבות בעונה: חורף של 2024-2025 => 2024)
    const years = result.courses.filter(c => c.year).map(c => c.year);
    if (years.length) result.startYear = Math.min(...years);
    if (result.startYear && FINDEG_DATA.yearCatalogs[result.startYear]) {
      result.catalogYear = FINDEG_DATA.yearCatalogs[result.startYear];
    }

    if (!result.courses.length) {
      result.warnings.push("לא זוהו מקצועות בקובץ. ודאו שהועלה תדפיס ציונים רשמי של הטכניון (PDF עם טקסט, לא סריקה).");
    }
    return result;
  }

  async function parsePdf(arrayBuffer) {
    const lines = await extractLines(arrayBuffer);
    return parseTranscript(lines);
  }

  return { parsePdf, parseTranscript, extractLines };
})();
