/* FinDeg – חיווט ממשק המשתמש. */
(function () {
  const D = window.FINDEG_DATA;
  pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";

  const $ = sel => document.querySelector(sel);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // אם הקוד לא מוכר, נופלים לשם שהתדפיס עצמו סיפק (name) לפני התג הגנרי עם המספר
  const cname = id => D.courseNames[id] ||
    (parsed && parsed.courses.find(c => c.id === id && c.name) || {}).name ||
    "מקצוע " + id;
  const fmtPts = p => (p % 1 === 0 ? p.toFixed(0) : p.toFixed(1));
  // תגית "חורף"/"אביב"/"קיץ" לפי הסמסטרים בהם המקצוע ניתן בפועל (js/semesters.js,
  // ראו tools/fetch_course_semesters.py). כל מקצוע מסומן confirmed:true אם יש לו
  // הוכחה חזקה - היסטוגרמת ציונים אמיתית ומושלמת מהשנים שהקטלוגים שלנו מכסים - או
  // confirmed:false אם ההיצע ידוע רק מרשומת תזמון קדימה (SAP) בלי גיבוי כזה (פחות
  // אמין - למשל קבוצה בודדת שנפתחה מנהלתית ולא כהיצע אמיתי). תגיות לא-מאומתות
  // מסומנות בעיצוב עמום + "~" ותיאור בטולטיפ, לא מוסתרות. מקצוע שלא נמצא כלל (קוד
  // ישן/מקצוע לא-אמיתי/לא ניתן כל סמסטר) מקבל תגית "לא ידוע" ולא מוסתר - כדי לא
  // ליצור רושם מוטעה שהמקצוע לא קיים.
  const SEM = window.FINDEG_SEMESTERS || {};
  function semBadge(id) {
    const entry = SEM[id];
    if (!entry || !entry.seasons || !entry.seasons.length) {
      return '<span class="sem-badge sem-unknown" title="לא נמצא בסמסטרים/היסטוריית ציונים שנבדקו - ייתכן קוד ישן או מקצוע שלא ניתן כל סמסטר">?</span>';
    }
    const labels = { winter: "חורף", spring: "אביב", summer: "קיץ" };
    const cls = "sem-badge" + (entry.confirmed ? "" : " sem-unconfirmed");
    const title = entry.confirmed
      ? "מאומת מול היסטוריית ציונים אמיתית"
      : "לא מאומת מול היסטוריית ציונים - ידוע רק מתזמון SAP קדימה, ייתכן שאינו היצע מלא/יציב";
    return entry.seasons
      .map(season => `<span class="${cls} sem-${season}" title="${title}">${labels[season] || ""}${entry.confirmed ? "" : "~"}</span>`)
      .join("");
  }

  let parsed = null;
  let overrides = {}; // דרישות שסומנו ידנית כהושלמו/מתוכננות
  let extras = { categories: {}, manual: [], registrarSecond: null }; // שיוך סלים + מקצועות שהוספו ידנית + ענף רישום נוסף

  // שומרים את התדפיס המפוענח + הבחירות (מסלול/שנה/התמחות/פרויקט) כדי שמעבר בין
  // FinDeg לתרשימי הזרימה (או רענון הדף) לא יאלץ העלאה מחדש של הקובץ. עד "נקה
  // תדפיס שנטען" מוחק את זה, כל כניסה חדשה לעמוד משחזרת אוטומטית את המצב האחרון.
  const LAST_PARSE_KEY = "findeg_last_parse";
  function persistParsed() {
    if (!parsed) return;
    try {
      localStorage.setItem(LAST_PARSE_KEY, JSON.stringify({
        parsed,
        selections: {
          track: $("#track-select").value,
          year: $("#year-select").value,
          spec: $("#spec-select") ? $("#spec-select").value : null,
          project: $("#project-select") ? $("#project-select").value : null
        }
      }));
    } catch { /* localStorage מלא/חסום - לא קריטי, פשוט לא יישמר */ }
  }
  function restoreLastParse() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(LAST_PARSE_KEY)); } catch { saved = null; }
    if (!saved || !saved.parsed) return false;
    parsed = saved.parsed;
    $("#dz-text").textContent = "✓ התדפיס האחרון נטען אוטומטית. אפשר להעלות קובץ אחר בכל שלב.";
    initSettings();
    const sel = saved.selections || {};
    if (sel.track) $("#track-select").value = sel.track;
    if (sel.year) $("#year-select").value = sel.year;
    updateDynamicSelectors();
    if (sel.spec && $("#spec-select")) $("#spec-select").value = sel.spec;
    if (sel.project && $("#project-select")) $("#project-select").value = sel.project;
    $("#settings-card").classList.remove("hidden");
    $("#clear-transcript").classList.remove("hidden");
    render();
    return true;
  }

  // כולל את שם הסטודנט/ית (מהתדפיס) כדי שסימונים ידניים של תדפיס אחד לא "ידבקו"
  // לתדפיס של מישהו אחר עם אותו מסלול/שנה - זו הייתה בעיה אמיתית שנתקלנו בה
  const storageSuffix = () => {
    const name = (parsed && parsed.studentName) ? parsed.studentName.replace(/\s+/g, "_") : "unknown";
    return name + "_" + ($("#track-select").value || "") + "_" + ($("#year-select").value || "");
  };
  const overrideKey = () => "findeg_overrides_" + storageSuffix();
  const extrasKey = () => "findeg_extras_" + storageSuffix();
  function loadOverrides() {
    try { overrides = JSON.parse(localStorage.getItem(overrideKey())) || {}; } catch { overrides = {}; }
    // תאימות לאחור: בעבר נשמר true, שמשמעותו בטבלת החובה "הושלם" ובמאגרים "מתוכנן"
    for (const [k, v] of Object.entries(overrides)) if (v === true) overrides[k] = "planned";
    try { extras = JSON.parse(localStorage.getItem(extrasKey())) || { categories: {}, manual: [], registrarSecond: null }; }
    catch { extras = { categories: {}, manual: [], registrarSecond: null }; }
    if (!extras.categories) extras.categories = {};
    if (!extras.manual) extras.manual = [];
    if (extras.registrarSecond === undefined) extras.registrarSecond = null;
  }
  function saveOverrides() {
    localStorage.setItem(overrideKey(), JSON.stringify(overrides));
    localStorage.setItem(extrasKey(), JSON.stringify(extras));
  }

  // ---------- תזכורת צפה: בחירת פרויקט ----------
  let nudgeDismissed = false;
  function updateProjectNudge(trackKey) {
    const nudge = $("#project-nudge");
    if (!nudge) return;
    const track = D.tracks[trackKey];
    const needsProject = track && track.hasProjectChoice && !$("#project-select").value;
    nudge.classList.toggle("hidden", !needsProject || nudgeDismissed);
  }
  $("#project-nudge").addEventListener("click", e => {
    if (e.target.closest("#nudge-close")) {
      nudgeDismissed = true;
      $("#project-nudge").classList.add("hidden");
      return;
    }
    $("#project-select").focus();
    $("#project-wrap").scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // ---------- העלאה ----------
  const dz = $("#dropzone"), fi = $("#file-input");
  dz.addEventListener("click", () => fi.click());
  dz.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") fi.click(); });
  ["dragover", "dragenter"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("dragover"); }));
  dz.addEventListener("drop", e => { if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
  fi.addEventListener("change", () => { if (fi.files[0]) handleFile(fi.files[0]); });

  async function handleFile(file) {
    $("#parse-error").classList.add("hidden");
    $("#dz-text").textContent = "מעבד את " + file.name + "…";
    try {
      const buf = await file.arrayBuffer();
      await loadFromBuffer(buf, file.name);
    } catch (err) {
      console.error(err);
      showError("שגיאה בקריאת הקובץ: " + err.message);
      $("#dz-text").textContent = "גרירת קובץ PDF לכאן / לחיצה לבחירה";
    }
  }

  async function loadFromBuffer(buf, name) {
    parsed = await FINDEG_PARSER.parsePdf(buf);
    $("#dz-text").textContent = "✓ " + (name || "קובץ") + " נטען. אפשר להעלות קובץ אחר בכל שלב.";
    if (parsed.warnings.length) showError(parsed.warnings.join(" "));
    initSettings();
    $("#settings-card").classList.remove("hidden");
    $("#clear-transcript").classList.remove("hidden");
    render();
    persistParsed();
    $("#settings-card").scrollIntoView({ behavior: "smooth" });
  }

  function showError(msg) {
    const box = $("#parse-error");
    box.textContent = msg;
    box.classList.remove("hidden");
  }

  // ---------- הגדרות ----------
  function initSettings() {
    const ts = $("#track-select");
    ts.innerHTML = "";
    for (const [key, t] of Object.entries(D.tracks)) {
      const o = el("option", null, esc(t.name) + (t.supported ? "" : " (בקרוב)"));
      o.value = key;
      ts.appendChild(o);
    }
    if (parsed.track) ts.value = parsed.track;

    const ys = $("#year-select");
    ys.innerHTML = "";
    for (const [key, label] of Object.entries(D.yearLabels)) {
      const o = el("option", null, esc(label));
      o.value = key;
      ys.appendChild(o);
    }
    if (parsed.catalogYear) ys.value = parsed.catalogYear;

    updateDynamicSelectors();

    const heading = $("#settings-card h2");
    heading.textContent = parsed.studentName ? "פרטי המסלול — " + parsed.studentName : "פרטי המסלול";

    const bits = [];
    if (parsed.track && D.tracks[parsed.track]) bits.push('זוהה מסלול: <span class="chip">' + esc(D.tracks[parsed.track].name) + "</span>");
    if (parsed.startYear) bits.push('תחילת לימודים: <span class="chip">חורף ' + (D.yearLabels[parsed.catalogYear] || parsed.startYear) + "</span>");
    if (parsed.declared) bits.push('לפי התדפיס: <span class="chip">' + parsed.declared.done + " / " + parsed.declared.required + " נק'</span>");
    bits.push('זוהו <span class="chip">' + parsed.courses.length + " מקצועות</span>");
    $("#detect-summary").innerHTML = bits.join(" · ") + "<br><small>אפשר לתקן ידנית אם הזיהוי שגוי.</small>";
  }

  function updateDynamicSelectors() {
    const trackKey = $("#track-select").value;
    const yearKey = $("#year-select").value;
    const track = D.tracks[trackKey];

    // התמחות (אזרחית / מיפוי) - אפשרויות הבחירה נגזרות מתוך specializations
    // של השנה/מסלול הנוכחיים, כדי שכל מסלול עם hasSpecialization יוכל להגדיר
    // שמות/מפתחות משלו (לא רק "מים"/"תחבורה" הקבועים של אזרחית).
    const specWrap = $("#spec-wrap");
    const hasSpec = track && track.hasSpecialization && track.years[yearKey] && track.years[yearKey].specializations;
    specWrap.classList.toggle("hidden", !hasSpec);
    if (hasSpec) {
      const ss = $("#spec-select");
      const current = ss.value;
      ss.innerHTML = "";
      for (const [key, spec] of Object.entries(track.years[yearKey].specializations)) {
        const o = el("option", null, esc(spec.name));
        o.value = key;
        ss.appendChild(o);
      }
      if ([...ss.options].some(o => o.value === current)) ss.value = current;
    }

    // בחירת פרויקט (ניהול ובנייה)
    const pw = $("#project-wrap");
    if (track && track.hasProjectChoice && track.years[yearKey]) {
      pw.classList.remove("hidden");
      const ps = $("#project-select");
      const current = ps.value;
      ps.innerHTML = "";
      const none = el("option", null, "עוד לא החלטתי");
      none.value = "";
      ps.appendChild(none);
      for (const key of track.years[yearKey].projects.chooseOne) {
        const o = el("option", null, esc(track.projectOptions[key].label));
        o.value = key;
        ps.appendChild(o);
      }
      if ([...ps.options].some(o => o.value === current)) ps.value = current;
    } else {
      pw.classList.add("hidden");
    }
  }

  ["#track-select", "#year-select", "#spec-select", "#project-select"].forEach(sel => {
    document.addEventListener("change", e => {
      if (!e.target.matches(sel)) return;
      if (sel === "#track-select" || sel === "#year-select") updateDynamicSelectors();
      render();
      persistParsed();
    });
  });
  document.addEventListener("change", e => {
    if (!e.target.matches("#registrar-second")) return;
    extras.registrarSecond = e.target.value || null;
    saveOverrides();
    render();
  });

  // מסלול/קטלוג/פרויקט + אילו מקצועות עברו (מזהים בלבד, לא ציונים) + סימונים
  // ידניים - נשמר תחת מפתח משותף (לא תלוי בשם הסטודנט) כדי שדף תרשים הזרימה
  // יוכל לקרוא אותו ולהישאר מסונכרן, בלי לשלוח שום דבר לשרת (הכול עדיין נשאר
  // רק ב-localStorage של הדפדפן). התדפיס עצמו (ציונים) עדיין לא נשמר בשום מקום.
  function syncFlowchart(trackKey, yearKey, projectKey, specialization) {
    const passedIds = [...new Set(parsed.courses.filter(c => c.passed).map(c => c.id))];
    // studentName כאן רק כדי שדף תרשים הזרימה יוכל לתייג את השמירה *שלו* (נעיצות
    // וכו', STORE_KEY ב-flowchart.js) לפי שם - לא משנה את סמנטיקת "סנכרון החי"
    // עצמה (עדיין מפתח אחד, לא תלוי-שם, בכוונה - ראו הערה למעלה).
    // extras.manual (מקצועות "הוספת מקצוע" - שם חופשי, בלי מזהה קטלוגי, ראו
    // renderGeneral/#mc-add למעלה) - בלי זה, תרשים הזרימה לא יודע שהם קיימים
    // בכלל ולא יכול לצמצם לפיהם את בועות "כלל טכניוני"/"ח. גופני" (ראו
    // REDUCIBLE_GENERAL_LABELS ב-flowchart.js).
    localStorage.setItem("findeg_flowchart_sync",
      JSON.stringify({ trackKey, yearKey, projectKey, specialization, passedIds, overrides, manual: extras.manual, studentName: parsed.studentName || null }));
  }

  // ---------- רינדור ----------
  let openDetails = new Set();
  function render() {
    if (!parsed) return;
    openDetails = new Set([...document.querySelectorAll("#results details[open]")].map(d => d.dataset.key));
    loadOverrides();
    const trackKey = $("#track-select").value;
    const yearKey = $("#year-select").value;
    updateProjectNudge(trackKey);
    syncFlowchart(trackKey, yearKey, $("#project-select") ? $("#project-select").value : "", $("#spec-select") ? $("#spec-select").value : "");
    const res = FINDEG_ENGINE.evaluate(parsed, trackKey, yearKey, {
      specialization: $("#spec-select").value,
      projectKey: $("#project-select") ? $("#project-select").value : null,
      overrides,
      categories: extras.categories,
      manual: extras.manual,
      registrarSecond: extras.registrarSecond
    });
    const root = $("#results");
    root.innerHTML = "";
    root.classList.remove("hidden");

    if (res.unsupported) {
      root.appendChild(el("div", "card",
        "<h2>" + esc(res.track ? res.track.name : "מסלול לא מזוהה") + "</h2>" +
        '<div class="warn-box">המסלול הזה עדיין לא נתמך בכלי (כרגע: אזרחית, מבנים, ניהול ובנייה). בחרו מסלול אחר או פנו למחבר להוספתו.</div>'));
      return;
    }
    if (res.noYear) {
      root.appendChild(el("div", "card", '<div class="warn-box">אין נתוני קטלוג לשנה שנבחרה.</div>'));
      return;
    }

    root.appendChild(renderSummary(res));
    if (res.upcoming && res.upcoming.list.length) root.appendChild(renderUpcoming(res));
    for (const r of res.sections) {
      if (r.kind === "courses") root.appendChild(renderCoursesSection(r));
      else root.appendChild(renderPoolSection(r));
    }
    if (res.groupA) root.appendChild(renderGroupAB(res));
    if (res.chains) for (const c of res.chains) root.appendChild(renderChainBracket(c));
    if (res.otherChains) { const oc = renderOtherChains(res); if (oc) root.appendChild(oc); }
    if (res.projects) root.appendChild(renderProjects(res));
    root.appendChild(renderGeneral(res));
    if (res.failed.length) root.appendChild(renderFailed(res));
    root.appendChild(renderRegistrar(res)); // רישום ברשם המהנדסים - נפרד מדרישות התואר, ממש לפני הסיכום
    root.appendChild(renderSummary(res)); // עותק בתחתית העמוד, שלא יהיה צריך לגלול למעלה
    root.appendChild(renderMissingRoundup(res)); // תמצית "מה עוד חסר" - רק בתחתית
    root.appendChild(renderFlowchartLink()); // כפתור מעבר לתרשים זרימה - ממש בתחתית העמוד
  }

  // איסוף כל הפערים הפתוחים מכל סעיף, לתמצית "מה עוד חסר" בתחתית העמוד
  // כל פריט מקבל status לפי מה שכבר סומן על החוסר: "" (אדום, לא נגעו),
  // "manual" (סגול, יש בו סימון ידני כהושלם שעדיין לא מספיק) או "planned" (כחול, מתוכנן)
  // מפצל רשימת "חסרים" מעורבת (חלק מתוכנן, חלק לא נגעו בו כלל) לשתי תת-רשימות
  // לפי צבע, כל אחת עם המקצועות הרלוונטיים לה בלבד - כדי שלא תיפול תחת צבע אחד שגוי.
  function splitByPlanned(list, nameOf) {
    const groups = { "": [], planned: [], later: [] };
    for (const it of list) (it.planned ? groups.planned : it.later ? groups.later : groups[""]).push(it);
    return Object.entries(groups)
      .filter(([, g]) => g.length)
      .map(([status, g]) => ({ status, names: g.map(nameOf) }));
  }

  function computeMissing(res) {
    const items = [];
    // מקבילה ל-splitByPlanned עבור דרישות "מאגר" (נק'/ספירה מתוך פול, לא רשימה
    // בדידה): במקום שורה אחת מעורבת ("חסרות 12, מתוכן 10 מתוכננות") - שתי שורות
    // נפרדות, בדיוק כמו שרשימת מקצועות בודדים כבר מפוצלת: אדום = מה שבאמת עוד לא
    // טופל, כחול = מה שכבר מתוכנן ויסגור את זה.
    function poolGapItems(covered, plannedAmount, laterAmount, needed, fmtRemaining, fmtPlanned, fmtLater) {
      const gap = Math.max(0, needed - covered);
      const effPlanned = Math.min(plannedAmount, gap);
      const afterPlanned = gap - effPlanned;
      const effLater = Math.min(laterAmount || 0, afterPlanned);
      const stillMissing = afterPlanned - effLater;
      const out = [];
      if (stillMissing > 0) out.push({ status: "", detail: fmtRemaining(stillMissing) });
      if (effLater > 0) out.push({ status: "later", detail: fmtLater(effLater) });
      if (effPlanned > 0) out.push({ status: "planned", detail: fmtPlanned(effPlanned) });
      return out;
    }
    // כמה מתוך "המחסור" בפול הזה מסומן ידנית "בהמשך" - לא נספר כ-hit ב-poolHits
    // (בכוונה - זו לא התקדמות), אז צריך לסרוק את המחסור (misses) עצמו
    function laterAmountFromMisses(misses, usePts) {
      let amount = 0;
      for (const id of misses) {
        if (overrides[id] !== "later") continue;
        amount += usePts ? (D.coursePoints[id] || 0) : 1;
      }
      return amount;
    }
    for (const r of res.sections) {
      if (r.kind === "courses") {
        if (r.missing.length) {
          for (const g of splitByPlanned(r.missing, m => m.item.name || cname(m.item.ids[0]))) {
            items.push({
              title: r.section.title,
              detail: g.names.join(", "),
              anchor: "section_" + r.section.id, status: g.status
            });
          }
        }
      } else if (!r.satisfied) {
        const b = poolBreakdown(r.hits, r.kind === "choosePoints");
        const covered = r.kind === "choosePoints" ? r.pts : r.doneCount;
        const isPts = r.kind === "choosePoints";
        const laterAmt = laterAmountFromMisses(r.misses, isPts);
        for (const g of poolGapItems(covered, b.planned, laterAmt, r.needed,
          n => isPts ? "חסרות " + fmtPts(n) + " נק'" : "חסר/ה עוד " + n + " מהרשימה",
          n => isPts ? fmtPts(n) + " נק' מתוכננות" : n + " מתוכננים מהרשימה",
          n => isPts ? fmtPts(n) + " נק' לבהמשך" : n + " לבהמשך מהרשימה")) {
          items.push({ title: r.section.title, anchor: "section_" + r.section.id, ...g });
        }
      }
    }
    // שרשראות פתוחות (לא הושלמו) - נבדק בהמשך כדי לא להציג את קבוצה א'/א'+ב' כ"בעיה"
    // נפרדת כשהיא בעצם אותה בעיה שכבר מוצגת ברמת השרשרת הספציפית (אותם מקצועות
    // בדיוק נספרים גם וגם) - למשל דרישת "עוד מקצוע אחד" בשרשרת חומרים כבר סוגרת
    // גם את הפער בקבוצה א' וגם בקבוצה א'+ב', אין טעם להציג את זה כשלוש בעיות.
    const openChainPoolIds = new Set();
    if (res.chains) {
      for (const c of res.chains) {
        if (c.chooseResult && !c.chooseResult.satisfied) {
          for (const h of c.chooseResult.hits) openChainPoolIds.add(h.id);
          for (const id of c.chooseResult.misses) openChainPoolIds.add(id);
        }
      }
    }
    for (const gr of [res.groupA, res.groupAB]) {
      if (gr && !gr.satisfied) {
        const b = poolBreakdown(gr.hits, true);
        const poolIds = [...gr.hits.map(h => h.id), ...gr.misses];
        const coveredByOpenChain = poolIds.some(id => openChainPoolIds.has(id));
        const laterAmt = laterAmountFromMisses(gr.misses, true);
        for (const g of poolGapItems(gr.pts, b.planned, laterAmt, gr.needed,
          n => "חסרות " + fmtPts(n) + " נק'",
          n => fmtPts(n) + " נק' מתוכננות",
          n => fmtPts(n) + " נק' לבהמשך")) {
          // מדלגים על השורה האדומה (עוד לא טופל) אם היא כבר מיוצגת ע"י שרשרת פתוחה
          // ספציפית יותר - נשארת רק אם יש בה תוכן חדש (למשל תוכנן) שלא מופיע שם
          if (g.status === "" && coveredByOpenChain) continue;
          items.push({ title: gr.section.title, anchor: "groupAB", ...g });
        }
      }
    }
    if (res.chains) {
      for (const c of res.chains) {
        if (c.satisfied) continue;
        const missingCore = c.coreRows.filter(row => !row.done);
        if (missingCore.length) {
          for (const g of splitByPlanned(missingCore, row => cname(row.id))) {
            items.push({ title: c.title, detail: g.names.join(", "), anchor: "chain_" + c.key, status: g.status });
          }
        }
        if (c.chooseResult && !c.chooseResult.satisfied) {
          const chb = poolBreakdown(c.chooseResult.hits, false);
          const laterAmt = laterAmountFromMisses(c.chooseResult.misses, false);
          for (const g of poolGapItems(c.chooseResult.doneCount, chb.planned, laterAmt, c.chooseResult.min,
            n => "חסר/ה עוד " + n + " מהרשימה",
            n => n + " מתוכננים מהרשימה",
            n => n + " לבהמשך מהרשימה")) {
            items.push({ title: c.title, anchor: "chain_" + c.key, ...g });
          }
        }
      }
    }
    if (res.projects) {
      const p = res.projects;
      // כל פרויקט חסר נכנס כערך שמי לרשימה, ואז מקובצים לפי סטטוס (כמו מקצועות
      // חובה) - כדי לא להציג את אותה קטגוריה "פרויקטים" פעמיים כשלשניהם אותו צבע
      const entries = [];
      if (!p.mandatory.done) {
        entries.push({ name: cname(p.mandatory.item.ids[0]) + " (חובה לכולם)", status: missingStatus(p.mandatory.counts.manual, p.mandatory.counts.planned) });
      }
      if (!(p.anyDone || (p.chosen && p.chosen.done))) {
        const chosenKey = p.chosen ? p.chosen.key : null;
        const relevant = p.options.filter(o => o.row.counts.manual > 0 || o.row.counts.planned > 0 || o.row.counts.later > 0 || chosenKey === o.key);
        if (relevant.length) {
          for (const o of relevant) entries.push({ name: o.opt.label, status: missingStatus(o.row.counts.manual, o.row.counts.planned, o.row.counts.later) });
        } else {
          entries.push({ name: "פרויקט שני (טרם נבחר מהרשימה)", status: "" });
        }
      }
      const byStatus = {};
      for (const e of entries) (byStatus[e.status] = byStatus[e.status] || []).push(e);
      for (const [status, list] of Object.entries(byStatus)) {
        items.push({ title: "פרויקטים", detail: list.map(e => e.name).join(", "), anchor: "projects", status });
      }
    }
    for (const [key, b] of Object.entries(res.general.buckets)) {
      if (!b.satisfied) {
        const bd = bucketBreakdown(b);
        for (const g of poolGapItems(b.pts, bd.planned, bd.later, b.needed,
          n => key === "enrich" ? "חסרים " + Math.ceil(n / 2) + ' מקצועות מל"ג (' + fmtPts(n) + " נק')" : "חסרות " + fmtPts(n) + " נק'",
          n => fmtPts(n) + " נק' מתוכננות",
          n => fmtPts(n) + " נק' לבהמשך")) {
          items.push({ title: "בחירה כלל-טכניונית - " + b.label, anchor: "general", ...g });
        }
      }
    }
    // "בהמשך" ו"מתוכנן" מתמזגים לצבע/קבוצה אחת בתמצית הזו בלבד: שניהם אומרים
    // "כבר התקבלה החלטה, לא בסיכון להישכח" - בניגוד למקצוע/בחירה שעדיין לא נגעו
    // בהם כלל. ההבחנה בין "בקרוב" ל"בהמשך" עדיין מוצגת בכל שורת דרישה עצמה
    // (התג הצהוב), רק לא בתמצית המרוכזת הזו.
    return items.map(it => it.status === "later" ? { ...it, status: "planned" } : it);
  }

  function missingList(items) {
    const list = el("div", "missing-list");
    for (const it of items) {
      const row = el("button", "missing-item" + (it.status ? " st-" + it.status : ""));
      row.dataset.jumpTo = it.anchor;
      row.innerHTML = "<b>" + esc(it.title) + "</b><span>" + esc(it.detail) + "</span>";
      list.appendChild(row);
    }
    return list;
  }

  // קיבוץ תמצית "מה עוד חסר" לפי צבע: כל הפריטים באותו צבע מבונים יחד (גם אם
  // הם חלק מאותה דרישה, כמו "מקצועות חובה" שמפוצל לכמה מקצועות מתוכננים וכמה
  // שלא נגעו בהם כלל) - כדי לא להטביע דחיפות אמיתית (אדום) בתוך דברים שכבר מטופלים.
  // "planned" ("כבר בתוכנית") כולל גם מה שסומן "בהמשך" - ראו הנרמול בסוף
  // computeMissing: ברמת התקציר הזה, "יתבצע בקרוב" ו"יתבצע בהמשך" הם אותו דבר
  // (כבר התקבלה החלטה, לא בסיכון להישכח) - ההבדל ביניהם עדיין מוצג בכל שורת
  // דרישה בנפרד, רק לא בקיבוץ המרוכז הזה.
  const MISSING_GROUPS = [
    { key: "", caption: "עדיין לא טופל" },
    { key: "manual", caption: "כבר סומן ידנית כהושלם - נשאר רק לוודא שיופיע בתדפיס" },
    { key: "planned", caption: "כבר בתוכנית - מתוכנן לסמסטר קרוב או לביצוע בהמשך" }
  ];

  // כפתור בתחתית העמוד למעבר לתרשים הזרימה - flowcharts.html כבר קורא את
  // findeg_flowchart_sync (נשמר ב-syncFlowchart, ראו render למעלה) בטעינה,
  // אז מסלול/קטלוג/פרויקט מסונכרנים אוטומטית, בלי צורך בפרמטרים ב-URL כאן.
  function renderFlowchartLink() {
    const card = el("section", "card flowchart-link-card");
    const link = el("a", "add-btn", "🗺️ עבור לתרשים זרימה");
    link.href = "flowcharts.html";
    card.appendChild(link);
    return card;
  }

  // צבע המסגרת של כל הכרטיס = הצבע "הכי דחוף" מבין הפריטים: אדום (לא טופל, היחיד
  // שבאמת בסיכון להישכח) גרוע מכחול (כבר בתוכנית), שגרוע מסגול (סומן ידנית), שגרוע מירוק (הכול הושלם).
  function worstMissingColor(items) {
    if (!items.length) return "green";
    if (items.some(it => !it.status)) return "red";
    if (items.some(it => it.status === "planned")) return "blue";
    return "manual";
  }

  function renderMissingRoundup(res) {
    const items = computeMissing(res);
    const card = el("section", "card missing-roundup mr-" + worstMissingColor(items));
    card.appendChild(el("h2", null, "📋 מה עוד חסר?"));
    if (!items.length) {
      card.appendChild(el("p", "section-note", "🎉 כל מה שהכלי בודק הושלם! ודאו מול מזכירות לימודי הסמכה שהכול תקין לפני סגירת התואר."));
      return card;
    }
    let renderedAny = false;
    for (const g of MISSING_GROUPS) {
      const groupItems = items.filter(it => (it.status || "") === g.key);
      if (!groupItems.length) continue;
      if (renderedAny) card.appendChild(el("div", "chain-caption missing-caption", g.caption));
      card.appendChild(missingList(groupItems));
      renderedAny = true;
    }
    return card;
  }

  function statusBadge(ok, partial) {
    if (ok) return '<span class="badge ok">הושלם ✓</span>';
    if (partial) return '<span class="badge part">בתהליך</span>';
    return '<span class="badge miss">חסר</span>';
  }

  // פס התקדמות מקוטע: ירוק=הושלם בפועל, סגול=סומן ידנית כהושלם, כחול=מתוכנן
  // later (אופציונלי) - מקצועות שסומנו "בהמשך": נספרים כמקטע רביעי (צהוב,
  // --later) בסרגל, אחרי "מתוכנן" - סימון "בהמשך" הוא עדיין התקדמות-תכנון
  // שמכסה את הדרישה, רק רחוקה יותר, ובלי מקטע משלה הסרגל נראה כאילו הסימון
  // "לא עשה כלום" (נתפס - בקשת המשתמש/ת, 2026-07-22: "מסמנים בהמשך וזה לא
  // מתווסף למד - צריך להיות אינטואיטיבי").
  function segBar(doneReal, manual, planned, total, big, later) {
    if (!total || total <= 0) return "";
    const pReal = Math.min(100, doneReal / total * 100);
    const pManual = Math.min(100 - pReal, manual / total * 100);
    const pPlanned = Math.min(100 - pReal - pManual, planned / total * 100);
    const pLater = Math.min(100 - pReal - pManual - pPlanned, (later || 0) / total * 100);
    return '<div class="seg-bar' + (big ? " big" : "") + '"><div class="seg seg-done" style="width:' + pReal + '%"></div>' +
      '<div class="seg seg-manual" style="width:' + pManual + '%"></div>' +
      '<div class="seg seg-planned" style="width:' + pPlanned + '%"></div>' +
      (pLater > 0 ? '<div class="seg seg-later" style="width:' + pLater + '%"></div>' : "") + '</div>';
  }
  // סכום ה"בהמשך" בתוך misses של מאגר (מקצועות שסומנו later נשארים ב-misses
  // בכוונה - הם לא hit, ראו poolHits ב-engine.js - אז נאספים כאן מ-overrides)
  function laterInMisses(missIds, usePts) {
    return missIds.filter(id => overrides[id] === "later")
      .reduce((s, id) => s + (usePts ? (D.coursePoints[id] || 0) : 1), 0);
  }
  // תג "(+N בהמשך)" ליד הסרגל/המונה, באותו סגנון כמו num-planned
  function laterNote(later, usePts) {
    return later > 0 ? ' <span class="num-later">(+' + (usePts ? fmtPts(later) + " נק'" : later) + " בהמשך)</span>" : "";
  }
  // פירוק hits (מ-poolHits) לשלוש הקבוצות, לפי ספירה או נק' (usePts)
  function poolBreakdown(hits, usePts) {
    let doneReal = 0, manual = 0, planned = 0;
    for (const h of hits) {
      const v = usePts ? (h.rec ? h.rec.pts : 0) : 1;
      if (h.planned) planned += v; else if (h.manual) manual += v; else doneReal += v;
    }
    return { doneReal, manual, planned };
  }
  // פירוק rows (מטבלת מקצועות: חובה/ליבת שרשרת) לפי ספירה
  function rowsBreakdown(rows) {
    let doneReal = 0, manual = 0, planned = 0;
    for (const row of rows) {
      if (row.manual) manual++; else if (row.done) doneReal++; else if (row.planned) planned++;
    }
    return { doneReal, manual, planned };
  }
  // פירוק מקצועות סל (בחירה כלל-טכניונית) לפי נק' - הושלם בפועל/סומן ידנית/מתוכנן/בהמשך
  function bucketBreakdown(bucket) {
    let doneReal = 0, manual = 0, planned = 0, later = 0;
    for (const c of bucket.courses) {
      if (c.planned) planned += c.pts;
      else if (c.later) later += c.pts;
      else if (c.manualIndex !== undefined) manual += c.pts;
      else doneReal += c.pts;
    }
    return { doneReal, manual, planned, later };
  }
  // סטטוס-צבע לפי מה שכבר סומן על החוסר: אדום=לא נגעו, סגול=סומן ידנית כהושלם, כחול=מתוכנן, צהוב=בהמשך
  function missingStatus(manual, planned, later) {
    if (manual > 0) return "manual";
    if (planned > 0) return "planned";
    if (later > 0) return "later";
    return "";
  }
  function renderSummary(res) {
    const pct = Math.min(100, Math.round(res.points.credited / res.total * 100));
    // ספירת חובות חסרות
    const missingMand = res.sections.filter(r => r.kind === "courses")
      .flatMap(r => r.missing.map(m => m.item));
    const upcomingPts = res.upcoming ? res.upcoming.pts : 0;
    const projectedTotal = +(res.points.credited + upcomingPts).toFixed(1);
    const projectedPct = Math.min(100, Math.round(projectedTotal / res.total * 100));

    const card = el("section", "card summary-hero");
    card.innerHTML =
      "<h2>סיכום — " + esc(res.track.name) + " · קטלוג " + esc(D.yearLabels[res.yearKey]) + "</h2>" +
      segBar(res.points.fromTranscript, res.points.overrideBonus, upcomingPts, res.total, true) +
      '<div class="big-nums">' +
      '<div class="big-num"><div class="n">' + fmtPts(res.points.credited) + '</div><div class="l">נק\' שהושלמו</div></div>' +
      '<div class="big-num"><div class="n">' + fmtPts(res.points.remaining) + '</div><div class="l">נק\' שנותרו (מתוך ' + fmtPts(res.total) + ')</div></div>' +
      '<div class="big-num"><div class="n">' + missingMand.length + '</div><div class="l">מקצועות חובה חסרים</div></div>' +
      '<div class="big-num"><div class="n">' + pct + '%</div><div class="l">מהתואר הושלם</div></div>' +
      "</div>" +
      '<div class="legend"><span><i class="dot dot-done"></i>הושלם בפועל</span>' +
      '<span><i class="dot dot-manual"></i>סומן ידנית כהושלם</span>' +
      '<span><i class="dot dot-planned"></i>מתוכנן</span></div>' +
      '<div class="proj-row">' +
      '<div class="proj-stat proj-manual"><div class="n">' + fmtPts(res.points.overrideBonus) + '</div><div class="l">נק\' שנוספו ע"י סימון ידני</div></div>' +
      '<div class="proj-stat proj-planned"><div class="n">' + fmtPts(upcomingPts) + '</div><div class="l">נק\' מתוכננות לסמסטרים קרובים</div></div>' +
      '<div class="proj-stat proj-total"><div class="n">' + fmtPts(projectedTotal) + '</div><div class="l">סה"כ צפוי אם הכול יושלם (' + projectedPct + '%)</div></div>' +
      "</div>" +
      (parsed.declared && Math.abs(parsed.declared.done - res.points.fromTranscript) > 0.6
        ? '<div class="warn-box">שימו לב: לפי התדפיס נצברו ' + parsed.declared.done + " נק' ואילו החישוב כאן מצא " + fmtPts(res.points.fromTranscript) + " – ייתכן ששורה לא פוענחה כראוי.</div>"
        : "");
    return card;
  }

  function renderCoursesSection(r) {
    const card = el("section", "card");
    card.dataset.anchor = "section_" + r.section.id;
    const head = el("div", "section-head",
      "<h2>" + esc(r.section.title) + "</h2>" +
      statusBadge(r.doneCount === r.total, r.doneCount > 0) +
      ' <span class="badge ' + (r.doneCount === r.total ? "ok" : "part") + '">' + r.doneCount + " / " + r.total + "</span>" +
      (r.plannedCount ? ' <span class="badge plan">+' + r.plannedCount + " מתוכננים</span>" : ""));
    card.appendChild(head);
    { const b = rowsBreakdown(r.rows); card.appendChild(el("div", null, segBar(b.doneReal, b.manual, b.planned, r.total))); }
    if (r.section.note) card.appendChild(el("p", "section-note", esc(r.section.note)));

    const table = el("table", "req");
    table.innerHTML = "<thead><tr><th>מקצוע</th><th>נק'</th><th>סטטוס</th><th></th></tr></thead>";
    const tb = el("tbody");
    for (const row of r.rows) {
      const ids = row.item.ids;
      const ovDone = ids.some(id => overrides[id] === "done");
      const tr = el("tr", row.done ? "done" : (row.planned ? "planned-row" : ""));
      // item.name (אופציונלי) - שם מאוחד לשורה רב-קודית שהיא מקצוע אחד בפועל
      // (כמו הפרויקט המורחב במבנים, חלק א'+ב') - במקום צירוף "א או ב" הארוך
      const names = row.item.name
        ? esc(row.item.name) + " <small>(" + ids.map(id => id.slice(2, 8)).join("+") + ")</small>" + (row.done ? "" : semBadge(ids[ids.length - 1]))
        : ids.map(id => esc(cname(id)) + " <small>(" + id.slice(2, 8) + ")</small>" + (row.done ? "" : semBadge(id))).join(" <b>או</b> ");
      let statusHtml, btns;
      if (row.done && row.rec) {
        const g = row.rec.status === "exempt_credit" ? "פטור" :
          row.rec.status === "exempt_nocredit" ? "פטור ללא נק'" :
          row.rec.status === "pass_binary" ? "עובר" : "ציון " + row.rec.grade;
        statusHtml = '<span class="status-ok">✓ ' + g + "</span>";
        if (!ids.includes(row.rec.id)) statusHtml += ' <small>(דרך ' + esc(cname(row.rec.id)) + ")</small>";
        btns = "";
      } else if (row.done) {
        statusHtml = '<span class="status-ok">✓ הושלם (סימון ידני)</span>';
        btns = '<button class="override-btn" data-ov-done="' + ids[0] + '">בטל</button>';
      } else if (row.planned) {
        statusHtml = '<span class="status-plan">🕒 מתוכנן</span>';
        btns = '<button class="override-btn" data-ov-plan="' + ids.find(id => overrides[id] === "planned") + '">בטל תכנון</button>';
      } else {
        statusHtml = '<span class="status-miss">✗ חסר</span>';
        btns = '<button class="override-btn" data-ov-plan="' + ids[0] + '">מתוכנן</button> ' +
          '<button class="override-btn" data-ov-done="' + ids[0] + '">הושלם</button>';
      }
      tr.innerHTML = '<td class="cname">' + names + "</td><td>" + (row.item.pts ? fmtPts(row.item.pts) : "–") +
        "</td><td>" + statusHtml + "</td><td>" + btns + "</td>";
      tb.appendChild(tr);
    }
    table.appendChild(tb);
    card.appendChild(table);
    return card;
  }

  function renderUpcoming(res) {
    const card = el("section", "card upcoming-card");
    card.appendChild(el("div", "section-head",
      "<h2>🕒 מתוכנן לסמסטרים הקרובים</h2>" +
      '<span class="badge plan">' + fmtPts(res.upcoming.pts) + " נק'</span>"));
    const table = el("table", "req");
    table.innerHTML = "<thead><tr><th>מקצוע</th><th>נק'</th><th>במסגרת</th></tr></thead>";
    const tb = el("tbody");
    for (const u of res.upcoming.list) {
      const tr = el("tr");
      const name = u.id ? esc(cname(u.id)) + " <small>(" + u.id.slice(2, 8) + ")</small>" : "✎ " + esc(u.name) + " <small>(נוסף ידנית)</small>";
      tr.innerHTML = '<td class="cname">' + name + "</td>" +
        "<td>" + fmtPts(u.pts) + "</td><td><small>" + esc(u.source) + "</small></td>";
      tb.appendChild(tr);
    }
    table.appendChild(tb);
    card.appendChild(table);
    card.appendChild(el("p", "section-note",
      "סה\"כ נק\"ז מתוכנן: <b>" + fmtPts(res.upcoming.pts) + "</b> · אם הכול יושלם — יישארו <b>" +
      fmtPts(res.upcoming.remainingAfter) + " נק'</b> לתואר (מתוך " + fmtPts(res.points.remaining) + " שנותרו כיום)."));
    return card;
  }

  function renderPoolSection(r) {
    const card = el("section", "card");
    card.dataset.anchor = "section_" + r.section.id;
    const isPts = r.kind === "choosePoints";
    const progress = isPts ? fmtPts(r.pts) + " / " + fmtPts(r.needed) + " נק'" : r.doneCount + " / " + r.needed;
    const poolLater = laterInMisses(r.misses, isPts);
    card.appendChild(el("div", "section-head",
      "<h2>" + esc(r.section.title) + "</h2>" +
      statusBadge(r.satisfied, isPts ? r.pts > 0 : r.hits.length > 0) +
      ' <span class="badge ' + (r.satisfied ? "ok" : "part") + '">' + progress + "</span>" +
      laterNote(poolLater, isPts)));
    { const b = poolBreakdown(r.hits, isPts); card.appendChild(el("div", null, segBar(b.doneReal, b.manual, b.planned, r.needed, false, poolLater))); }
    if (r.section.note) card.appendChild(el("p", "section-note", esc(r.section.note)));

    const list = el("div", "pool-list");
    for (const h of r.hits) {
      if (h.planned) {
        const b = el("button", "pool-item planned", "🕒 " + esc(cname(h.id)) + " (" + fmtPts(h.rec.pts) + ") מתוכנן");
        b.dataset.ovPlan = h.id;
        b.title = "לחיצה מבטלת את הסימון";
        list.appendChild(b);
      } else if (h.manual) {
        const b = el("button", "pool-item hit manual", "✓ " + esc(cname(h.id)) + " (" + fmtPts(h.rec.pts) + ") הושלם - סימון ידני");
        b.dataset.ovDone = h.id;
        b.title = "לחיצה מבטלת את הסימון";
        list.appendChild(b);
      } else {
        list.appendChild(el("span", "pool-item hit", "✓ " + esc(cname(h.id)) + " (" + fmtPts(h.rec.pts) + ")"));
      }
    }
    card.appendChild(list);

    const det = el("details", "pool");
    det.dataset.key = "pool_" + r.section.id;
    if (openDetails.has(det.dataset.key)) det.open = true;
    det.innerHTML = "<summary>מקצועות אפשריים להשלמה (" + r.misses.length +
      ") — סמנו מתוכנן (סמסטר קרוב) או הושלם (למשל פטור שאושר)</summary>";
    const ml = el("div", "pool-rows");
    for (const id of r.misses) {
      const isLater = overrides[id] === "later";
      const row = el("div", "pool-item-row" + (isLater ? " later" : ""));
      row.innerHTML = '<span class="pi-name">' + esc(cname(id)) +
        " <small>(" + id.slice(2, 8) + " · " + fmtPts(D.coursePoints[id] || 0) + " נק')</small>" + semBadge(id) +
        (isLater ? ' <span class="status-later">🗓️ בהמשך</span>' : "") + "</span>" +
        '<span class="pi-actions"><button class="override-btn" data-ov-plan="' + id + '">מתוכנן</button>' +
        '<button class="override-btn" data-ov-later="' + id + '">' + (isLater ? "בטל" : "בהמשך") + "</button>" +
        '<button class="override-btn" data-ov-done="' + id + '">הושלם</button></span>';
      ml.appendChild(row);
    }
    det.appendChild(ml);
    card.appendChild(det);
    return card;
  }

  function coreRowHtml(row) {
    let statusHtml, btns;
    if (row.done && row.rec) {
      const g = row.rec.status === "exempt_credit" ? "פטור" :
        row.rec.status === "exempt_nocredit" ? "פטור ללא נק'" :
        row.rec.status === "pass_binary" ? "עובר" : "ציון " + row.rec.grade;
      statusHtml = '<span class="status-ok">✓ ' + g + "</span>";
      btns = "";
    } else if (row.done) {
      statusHtml = '<span class="status-ok">✓ הושלם (סימון ידני)</span>';
      btns = '<button class="override-btn" data-ov-done="' + row.id + '">בטל</button>';
    } else if (row.planned) {
      statusHtml = '<span class="status-plan">🕒 מתוכנן</span>';
      btns = '<button class="override-btn" data-ov-plan="' + row.id + '">בטל תכנון</button>';
    } else {
      statusHtml = '<span class="status-miss">✗ חסר</span>';
      btns = '<button class="override-btn" data-ov-plan="' + row.id + '">מתוכנן</button> ' +
        '<button class="override-btn" data-ov-done="' + row.id + '">הושלם</button>';
    }
    return { statusHtml, btns };
  }

  function renderChainBracket(c) {
    const card = el("section", "card chain-card");
    card.dataset.anchor = "chain_" + c.key;
    const anyProgress = c.coreRows.some(r => r.done || r.planned) ||
      (c.chooseResult && c.chooseResult.hits.length > 0);
    card.appendChild(el("div", "section-head",
      "<h2>🔗 " + esc(c.title) + "</h2>" + statusBadge(c.satisfied, anyProgress)));
    if (c.note) card.appendChild(el("p", "section-note", esc(c.note)));

    if (c.coreRows.length) {
      card.appendChild(el("div", "chain-caption", "מקצועות חובה"));
      { const b = rowsBreakdown(c.coreRows); card.appendChild(el("div", null, segBar(b.doneReal, b.manual, b.planned, c.coreRows.length))); }
      const table = el("table", "req");
      table.innerHTML = "<thead><tr><th>מקצוע</th><th>נק'</th><th>סטטוס</th><th></th></tr></thead>";
      const tb = el("tbody");
      for (const row of c.coreRows) {
        const tr = el("tr", row.done ? "done" : (row.planned ? "planned-row" : ""));
        const { statusHtml, btns } = coreRowHtml(row);
        tr.innerHTML = '<td class="cname">' + esc(cname(row.id)) + " <small>(" + row.id.slice(2, 8) + ")</small></td>" +
          "<td>" + fmtPts(row.pts) + "</td><td>" + statusHtml + "</td><td>" + btns + "</td>";
        tb.appendChild(tr);
      }
      table.appendChild(tb);
      card.appendChild(table);
    }

    if (c.chooseResult) {
      const cr = c.chooseResult;
      card.appendChild(el("div", "chain-caption", cr.min > 0 ? "בחירה" : "מקצועות נוספים (לא חובה)"));
      if (cr.min > 0) {
        const plannedNote = cr.plannedCount ? ' <span class="num-planned">(+' + cr.plannedCount + " מתוכנן)</span>" : "";
        const chainLater = laterInMisses(cr.misses, false);
        card.appendChild(el("p", "section-note",
          statusBadge(cr.satisfied, cr.hits.length > 0) + " " + cr.doneCount + " / " + cr.min + " מהרשימה" + plannedNote + laterNote(chainLater, false)));
        const b = poolBreakdown(cr.hits, false);
        card.appendChild(el("div", null, segBar(b.doneReal, b.manual, b.planned, cr.min, false, chainLater)));
      } else if (cr.hits.length) {
        card.appendChild(el("p", "section-note", cr.hits.length + " מקצועות נוספים מהשרשרת נספרים בקבוצה א'"));
      }
      const list = el("div", "pool-list");
      for (const h of cr.hits) {
        const pts = " (" + fmtPts(h.rec.pts || 0) + " נק')";
        if (h.planned) {
          const b = el("button", "pool-item planned", "🕒 " + esc(cname(h.id)) + pts + " מתוכנן");
          b.dataset.ovPlan = h.id;
          list.appendChild(b);
        } else if (h.manual) {
          const b = el("button", "pool-item hit manual", "✓ " + esc(cname(h.id)) + pts + " הושלם - סימון ידני");
          b.dataset.ovDone = h.id;
          list.appendChild(b);
        } else {
          list.appendChild(el("span", "pool-item hit", "✓ " + esc(cname(h.id)) + pts));
        }
      }
      card.appendChild(list);

      const det = el("details", "pool");
      det.dataset.key = "chain_" + c.key;
      if (openDetails.has(det.dataset.key)) det.open = true;
      det.innerHTML = "<summary>מקצועות נוספים לבחירה (" + cr.misses.length + ")</summary>";
      const ml = el("div", "pool-rows");
      for (const id of cr.misses) {
        const isLater = overrides[id] === "later";
        const row = el("div", "pool-item-row" + (isLater ? " later" : ""));
        row.innerHTML = '<span class="pi-name">' + esc(cname(id)) +
          " <small>(" + id.slice(2, 8) + " · " + fmtPts(D.coursePoints[id] || 0) + " נק')</small>" +
          (isLater ? ' <span class="status-later">🗓️ בהמשך</span>' : "") + "</span>" +
          '<span class="pi-actions"><button class="override-btn" data-ov-plan="' + id + '">מתוכנן</button>' +
          '<button class="override-btn" data-ov-later="' + id + '">' + (isLater ? "בטל" : "בהמשך") + "</button>" +
          '<button class="override-btn" data-ov-done="' + id + '">הושלם</button></span>';
        ml.appendChild(row);
      }
      det.appendChild(ml);
      card.appendChild(det);
    }
    return card;
  }

  // שורת פרויקט (יחיד/מרובה-מקצועות): מצב + כפתורי בתכנון/הושלם המסמנים את כל המקצועות שבו יחד.
  // כשיש כמה מקצועות באותו פרויקט ("mixed") והם במצבים שונים (אחד הושלם בפועל,
  // השני מתוכנן וכו') - לא בוחרים סטטוס אחד שגוי, אלא מציגים פילוג צבעים בתוך אותה
  // תגית סטטוס עצמה (לא מפצלים לשתי שורות/תיבות).
  function projectRowHtml(row, allowLater) {
    let statusHtml, btns;
    const idsStr = row.ids.join(",");
    if (row.mixed) {
      const n = row.ids.length;
      const parts = [];
      if (row.counts.real) parts.push('<span class="split-done">' + row.counts.real + "/" + n + " ✓</span>");
      if (row.counts.manual) parts.push('<span class="split-manual">' + row.counts.manual + "/" + n + " ✓ ידני</span>");
      if (row.counts.planned) parts.push('<span class="split-planned">' + row.counts.planned + "/" + n + " 🕒</span>");
      if (allowLater && row.counts.later) parts.push('<span class="split-later">' + row.counts.later + "/" + n + " 🗓️</span>");
      if (row.counts.none) parts.push('<span class="split-none">' + row.counts.none + "/" + n + " ✗</span>");
      statusHtml = '<span class="status-split">' + parts.join(" + ") + "</span>";
      btns = '<button class="override-btn" data-ov-plan-multi="' + idsStr + '">סנכרן כמתוכנן</button> ' +
        (allowLater ? '<button class="override-btn" data-ov-later-multi="' + idsStr + '">סנכרן כבהמשך</button> ' : "") +
        '<button class="override-btn" data-ov-done-multi="' + idsStr + '">סנכרן כהושלם</button>';
    } else if (row.done && row.rec && !row.manual) {
      const g = row.rec.status === "exempt_credit" ? "פטור" :
        row.rec.status === "exempt_nocredit" ? "פטור ללא נק'" :
        row.rec.status === "pass_binary" ? "עובר" : "ציון " + row.rec.grade;
      statusHtml = '<span class="status-ok">✓ ' + g + "</span>";
      btns = "";
    } else if (row.done) {
      statusHtml = '<span class="status-ok">✓ הושלם (סימון ידני)</span>';
      btns = '<button class="override-btn" data-ov-done-multi="' + idsStr + '">בטל</button>';
    } else if (row.planned) {
      statusHtml = '<span class="status-plan">🕒 בתכנון</span>';
      btns = '<button class="override-btn" data-ov-plan-multi="' + idsStr + '">בטל תכנון</button>';
    } else if (allowLater && row.later) {
      statusHtml = '<span class="status-later">🗓️ בהמשך</span>';
      btns = '<button class="override-btn" data-ov-later-multi="' + idsStr + '">בטל</button>';
    } else {
      statusHtml = '<span class="status-miss">✗ חסר</span>';
      btns = '<button class="override-btn" data-ov-plan-multi="' + idsStr + '">בתכנון</button> ' +
        (allowLater ? '<button class="override-btn" data-ov-later-multi="' + idsStr + '">בהמשך</button> ' : "") +
        '<button class="override-btn" data-ov-done-multi="' + idsStr + '">הושלם</button>';
    }
    return { statusHtml, btns };
  }

  // כל פרויקט מקבל "סלוט" נפרד משלו (תיבה עצמאית) במקום שורת טבלה משותפת -
  // המקצוע חובה והמקצוע הנוסף שנבחר לא דומים מספיק כדי שכדאי לחלוק ביניהם עיצוב אחד.
  // allowLater=false לפרויקט החובה (חובה לכולם, "בהמשך" חסר משמעות שם - ראו
  // evalCoursesSection) - true לפרויקט השני שנבחר מרשימה, שם זו בחירה אמיתית.
  function projectSlot(name, tag, row, allowLater) {
    const { statusHtml, btns } = projectRowHtml(row, allowLater);
    const later = allowLater && row.later;
    const slot = el("div", "project-slot" + (row.mixed ? " mixed" : row.done ? " done" : row.planned ? " planned" : later ? " later" : ""));
    slot.innerHTML =
      '<div class="project-slot-row"><span class="cname">' + esc(name) +
      (tag ? ' <span class="badge part">' + esc(tag) + "</span>" : "") + "</span>" +
      '<span class="ps-pts">' + fmtPts(row.pts) + " נק'</span></div>" +
      '<div class="project-slot-row">' + statusHtml + '<span class="ps-actions">' + btns + "</span></div>";
    return slot;
  }

  function renderProjects(res) {
    const p = res.projects;
    const card = el("section", "card");
    card.dataset.anchor = "projects";
    const ok = p.mandatory.done && (p.anyDone || (p.chosen && p.chosen.done));
    card.appendChild(el("div", "section-head",
      "<h2>פרויקטים</h2>" + statusBadge(ok, p.mandatory.done || p.anyDone)));

    const list = el("div", "project-list");
    list.appendChild(projectSlot(cname(p.mandatory.item.ids[0]), "חובה לכולם", p.mandatory, false));

    // מציגים רק את הפרויקט שנבחר בתפריט, או כאלה שכבר הושלמו/מתוכננים בפועל -
    // לא את כל התפריט (בדומה לשרשראות: לא מציגים אפשרויות שלא נגעו בהן)
    const chosenKey = p.chosen ? p.chosen.key : null;
    const relevant = p.options.filter(o => o.row.done || o.row.planned || o.row.later || chosenKey === o.key);
    for (const o of relevant) {
      const tag = chosenKey === o.key && !o.row.done ? "נבחר בתפריט" : null;
      list.appendChild(projectSlot(o.opt.label, tag, o.row, true));
    }
    card.appendChild(list);
    if (!relevant.length) {
      card.appendChild(el("p", "section-note", "בחרו פרויקט שני מהתפריט למעלה כדי לראות אותו כאן."));
    }
    card.appendChild(el("p", "section-note",
      "נדרש: פרויקט בניהול הבנייה + פרויקט אחד נוסף מהרשימה. סימון \"הושלם\" מוסיף את נקודות הפרויקט לסך שנצבר; בחירת הפרויקט למעלה תציג את שרשרת מקצועות הקדם שהוא גורר."));
    return card;
  }

  function renderGroupAB(res) {
    const card = el("section", "card group-ab-card");
    card.dataset.anchor = "groupAB";
    card.appendChild(el("h2", null, "התקדמות קבוצה א' + ב'"));
    for (const { label, r } of [
      { label: "קבוצה א' (שרשראות)", r: res.groupA },
      { label: "קבוצה א'+ב' (סה\"כ)", r: res.groupAB }
    ]) {
      const b = poolBreakdown(r.hits, true);
      const plannedNote = r.plannedPts ? ' <span class="num-planned">(+' + fmtPts(r.plannedPts) + " מתוכנן)</span>" : "";
      const gabLater = laterInMisses(r.misses, true);
      const row = el("div", "gab-row");
      row.innerHTML = '<div class="gab-label"><span>' + esc(label) + "</span>" +
        statusBadge(r.satisfied, r.pts > 0) +
        ' <span class="badge ' + (r.satisfied ? "ok" : "part") + '">' + fmtPts(r.pts) + " / " + fmtPts(r.needed) + " נק'</span>" + plannedNote + laterNote(gabLater, true) + "</div>" +
        segBar(b.doneReal, b.manual, b.planned, r.needed, false, gabLater);
      card.appendChild(row);
    }
    return card;
  }

  function renderOtherChains(res) {
    const oc = res.otherChains;
    if (!oc || !oc.pool.length) return null;
    const card = el("section", "card");
    const det = el("details", "pool other-chains");
    det.dataset.key = "otherChains";
    if (openDetails.has(det.dataset.key)) det.open = true;
    det.innerHTML = "<summary>➕ הוספת מקצועות משרשראות אחרות (" + oc.pool.length + ")</summary>";
    const wrap = el("div", "other-chains-body");
    if (oc.hits.length) {
      const list = el("div", "pool-list");
      for (const h of oc.hits) {
        const pts = " (" + fmtPts(h.rec.pts || 0) + " נק')";
        if (h.planned) {
          const b = el("button", "pool-item planned", "🕒 " + esc(cname(h.id)) + pts + " מתוכנן");
          b.dataset.ovPlan = h.id;
          list.appendChild(b);
        } else if (h.manual) {
          const b = el("button", "pool-item hit manual", "✓ " + esc(cname(h.id)) + pts + " הושלם - סימון ידני");
          b.dataset.ovDone = h.id;
          list.appendChild(b);
        } else {
          list.appendChild(el("span", "pool-item hit", "✓ " + esc(cname(h.id)) + pts));
        }
      }
      wrap.appendChild(list);
    }
    const ml = el("div", "pool-rows");
    for (const id of oc.misses) {
      const isLater = overrides[id] === "later";
      const row = el("div", "pool-item-row" + (isLater ? " later" : ""));
      row.innerHTML = '<span class="pi-name">' + esc(cname(id)) +
        " <small>(" + id.slice(2, 8) + " · " + fmtPts(D.coursePoints[id] || 0) + " נק')</small>" + semBadge(id) +
        (isLater ? ' <span class="status-later">🗓️ בהמשך</span>' : "") + "</span>" +
        '<span class="pi-actions"><button class="override-btn" data-ov-plan="' + id + '">מתוכנן</button>' +
        '<button class="override-btn" data-ov-later="' + id + '">' + (isLater ? "בטל" : "בהמשך") + "</button>" +
        '<button class="override-btn" data-ov-done="' + id + '">הושלם</button></span>';
      ml.appendChild(row);
    }
    wrap.appendChild(ml);
    det.appendChild(wrap);
    card.appendChild(det);
    return card;
  }

  const CAT_LABELS = { pe: "ספורט", enrich: "מל\"ג", free: "בחירה חופשית" };

  function catSelect(current, attr, val) {
    const opts = Object.entries(CAT_LABELS).map(([k, l]) =>
      '<option value="' + k + '"' + (k === current ? " selected" : "") + ">" + l + "</option>").join("");
    return '<select class="cat-select" ' + attr + '="' + esc(val) + '">' + opts + "</select>";
  }

  function renderGeneral(res) {
    const g = res.general;
    const card = el("section", "card");
    card.dataset.anchor = "general";
    const totalNeeded = Object.values(g.buckets).reduce((s, b) => s + b.needed, 0);
    const totalDone = Object.values(g.buckets).reduce((s, b) => s + b.done, 0);
    card.appendChild(el("div", "section-head",
      "<h2>בחירה כלל-טכניונית</h2>" +
      statusBadge(totalDone >= totalNeeded, totalDone > 0) +
      ' <span class="badge ' + (totalDone >= totalNeeded ? "ok" : "part") + '">' + fmtPts(totalDone) + " / " + fmtPts(totalNeeded) + " נק'</span>"));

    // שלושת הסלים - כל סל עם פירוט הושלם בפועל/סומן ידנית/מתוכנן משלו
    const bucketsRow = el("div", "gen-buckets");
    for (const [key, b] of Object.entries(g.buckets)) {
      const bd = bucketBreakdown(b);
      const parts = ['<b class="num-done">' + fmtPts(bd.doneReal) + "</b>"];
      if (bd.manual > 0) parts.push('<b class="num-manual">' + fmtPts(bd.manual) + "</b>");
      if (bd.planned > 0) parts.push('<b class="num-planned">' + fmtPts(bd.planned) + "</b>");
      if (bd.later > 0) parts.push('<b class="num-later">' + fmtPts(bd.later) + "</b>");
      // "מלא" גם אם רק התכנון מביא לסך הנדרש - זה עדיין סימן שהמסלול מכוסה (לא כולל "בהמשך" - זה לא באמת תוכנן קרוב)
      const covered = bd.doneReal + bd.manual + bd.planned >= b.needed;
      bucketsRow.appendChild(el("div", "gen-bucket" + (covered ? " full" : ""),
        "<b>" + esc(b.label) + "</b><span>" + parts.join(" + ") + " / " + fmtPts(b.needed) + " נק'</span>"));
    }
    card.appendChild(bucketsRow);
    card.appendChild(el("p", "section-note",
      "מקצועות מהתדפיס שלא שויכו לדרישה אחרת מופיעים כאן — אפשר לשנות את הסל של כל אחד. " +
      "מקצועות שנוספו ידנית נספרים בסלים אך לא בנקודות שנצברו (עד שיופיעו בתדפיס)."));

    // מקצועות בסלים עם בחירת קטגוריה
    const list = el("div", "gen-course-list");
    for (const [key, b] of Object.entries(g.buckets)) {
      for (const c of b.courses) {
        const row = el("div", "gen-course");
        if (c.overflow && c.planned) {
          row.innerHTML = '<span class="status-plan">🕒 ' + esc(c.name) + " (" + fmtPts(c.pts) + " נק') <small>מתוכנן - עודף מעבר לדרישת קבוצה א'+ב'</small></span>";
        } else if (c.overflow && c.later) {
          row.innerHTML = '<span class="status-later">🗓️ ' + esc(c.name) + " (" + fmtPts(c.pts) + " נק') <small>בהמשך - עודף מעבר לדרישת קבוצה א'+ב'</small></span>";
        } else if (c.overflow) {
          row.innerHTML = '<span class="status-manual">➕ ' + esc(c.name) + " (" + fmtPts(c.pts) + " נק') <small>נספר אוטומטית - עודף מעבר לדרישת קבוצה א'+ב'</small></span>";
        } else if (c.fromTranscript) {
          row.innerHTML = "<span>✓ " + esc(cname(c.id)) + " (" + fmtPts(c.pts) + " נק')</span>" +
            catSelect(key, "data-cat", c.id);
        } else if (c.planned) {
          row.innerHTML = '<span class="status-plan">🕒 ' + esc(c.name) + " (" + fmtPts(c.pts) + " נק') <small>מתוכנן · נוסף ידנית</small></span>" +
            '<button class="override-btn" data-del-manual="' + c.manualIndex + '">הסר</button>';
        } else if (c.later) {
          row.innerHTML = '<span class="status-later">🗓️ ' + esc(c.name) + " (" + fmtPts(c.pts) + " נק') <small>בהמשך · נוסף ידנית</small></span>" +
            '<button class="override-btn" data-del-manual="' + c.manualIndex + '">הסר</button>';
        } else {
          row.innerHTML = '<span class="status-manual">✓ ' + esc(c.name) + " (" + fmtPts(c.pts) + " נק') <small>הושלם - סימון ידני · נוסף ידנית</small></span>" +
            '<button class="override-btn" data-del-manual="' + c.manualIndex + '">הסר</button>';
        }
        list.appendChild(row);
      }
    }
    card.appendChild(list);

    // טופס הוספת מקצוע - הושלם (למשל מל"ג/פטור שלא הופיע בתדפיס) או מתוכנן לסמסטר קרוב
    const form = el("div", "add-course-form");
    form.innerHTML =
      "<b>הוספת מקצוע</b> (שם חופשי - למשל מל\"ג, קורס מסמסטר עתידי, או פטור שלא הופיע בתדפיס): " +
      '<div class="add-course-fields">' +
      '<input type="text" id="mc-name" placeholder="שם המקצוע">' +
      '<input type="number" id="mc-pts" min="0" max="10" step="0.5" placeholder="נק\'">' +
      '<select id="mc-cat">' +
      Object.entries(CAT_LABELS).map(([k, l]) => '<option value="' + k + '">' + l + "</option>").join("") +
      "</select>" +
      '<select id="mc-status">' +
      '<option value="done">הושלם</option>' +
      '<option value="planned">מתוכנן</option>' +
      '<option value="later">בהמשך</option>' +
      "</select>" +
      '<button id="mc-add" class="add-btn">הוסף</button>' +
      "</div>";
    card.appendChild(form);

    if (g.zeroCredit.length) {
      const det = el("details", "pool");
      det.innerHTML = "<summary>מקצועות ללא נקודות זכות (" + g.zeroCredit.length + ")</summary>";
      const ml = el("div", "pool-list");
      for (const c of g.zeroCredit) ml.appendChild(el("span", "pool-item", esc(cname(c.id))));
      det.appendChild(ml);
      card.appendChild(det);
    }
    return card;
  }

  // שורת מקצוע בענף רישום: זהה בעיקרון לשורת פרויקט (תומכת כמה ids/"או"), רק
  // עם מצב נוסף - "untracked" (מקצוע מהרשימה הרשמית שלא זוהה בקטלוג שלנו)
  function registrarRowHtml(row) {
    if (row.untracked) return { statusHtml: '<span class="status-untracked">לא ניתן למעקב אוטומטי</span>', btns: "" };
    const ids = row.item.ids;
    const idsStr = ids.join(",");
    if (row.done && row.rec) {
      const g = row.rec.status === "exempt_credit" ? "פטור" :
        row.rec.status === "exempt_nocredit" ? "פטור ללא נק'" :
        row.rec.status === "pass_binary" ? "עובר" : "ציון " + row.rec.grade;
      return { statusHtml: '<span class="status-ok">✓ ' + g + "</span>", btns: "" };
    }
    if (row.done) {
      return { statusHtml: '<span class="status-ok">✓ הושלם (סימון ידני)</span>', btns: '<button class="override-btn" data-ov-done-multi="' + idsStr + '">בטל</button>' };
    }
    if (row.planned) {
      return { statusHtml: '<span class="status-plan">🕒 מתוכנן</span>', btns: '<button class="override-btn" data-ov-plan-multi="' + idsStr + '">בטל תכנון</button>' };
    }
    return {
      statusHtml: '<span class="status-miss">✗ חסר</span>',
      btns: '<button class="override-btn" data-ov-plan-multi="' + idsStr + '">מתוכנן</button> ' +
        '<button class="override-btn" data-ov-done-multi="' + idsStr + '">הושלם</button>'
    };
  }

  function renderRegistrarBranch(rb) {
    const wrap = el("div", "registrar-branch" + (rb.home ? " home" : ""));
    const tag = rb.home ? '<span class="badge part">ענף הבית שלך</span>' : '<span class="badge part">ענף נוסף שבחרת</span>';
    wrap.appendChild(el("div", "section-head",
      "<h3>" + esc(rb.title) + "</h3>" + tag + " " + statusBadge(rb.satisfied, rb.coreRows.some(r => r.done || r.planned))));
    if (rb.note) wrap.appendChild(el("p", "section-note", "⚠️ " + esc(rb.note)));

    const table = el("table", "req");
    table.innerHTML = "<thead><tr><th>מקצוע</th><th>סטטוס</th><th></th></tr></thead>";
    const tb = el("tbody");
    for (const row of rb.coreRows) {
      const tr = el("tr", row.untracked ? "" : row.done ? "done" : (row.planned ? "planned-row" : ""));
      const { statusHtml, btns } = registrarRowHtml(row);
      const noteHtml = row.item.note ? ' <small class="reg-note">(' + esc(row.item.note) + ")</small>" : "";
      tr.innerHTML = '<td class="cname">' + esc(row.item.label) + noteHtml + "</td><td>" + statusHtml + "</td><td>" + btns + "</td>";
      tb.appendChild(tr);
    }
    table.appendChild(tb);
    wrap.appendChild(table);

    if (rb.electiveResult) {
      const er = rb.electiveResult;
      // misses כאן הם אובייקטים {id,label,pts} (רשם המהנדסים, לא ids גולמיים) -
      // סכימת ה"בהמשך" ידנית ולא דרך laterInMisses
      const regLater = er.misses.filter(p => overrides[p.id] === "later").reduce((s, p) => s + (p.pts || 0), 0);
      wrap.appendChild(el("div", "chain-caption", "מקצועות בחירה"));
      wrap.appendChild(el("p", "section-note",
        statusBadge(er.satisfied, er.pts > 0) + " " + fmtPts(er.pts) + " / " + fmtPts(er.needed) + " נק'" + laterNote(regLater, true)));
      if (er.untracked && er.untracked.length) {
        const broad = er.untracked.filter(u => u.broad).map(u => u.label);
        const specific = er.untracked.filter(u => !u.broad).map(u => u.label);
        if (broad.length) wrap.appendChild(el("p", "section-note",
          "ℹ️ ככל הנראה ניתנים בפקולטה אחרת (למשל הנדסת תעשייה וניהול) ולכן לא בקטלוג שלנו - " +
          "אפשר ככל הנראה ללמוד כבחירה חופשית ולהוסיף ידנית: " + esc(broad.join(", "))));
        if (specific.length) wrap.appendChild(el("p", "section-note",
          "⚠️ מקצועות ספציפיים לתחום שלא זוהו בקטלוג - כנראה שאינם ניתנים כיום בטכניון (או נקראים אחרת), " +
          "יש לוודא מול הפקולטה: " + esc(specific.join(", "))));
      }
      const b = poolBreakdown(er.hits, true);
      wrap.appendChild(el("div", null, segBar(b.doneReal, b.manual, b.planned, er.needed, false, regLater)));
      const list = el("div", "pool-list");
      for (const h of er.hits) {
        const pts = " (" + fmtPts(h.rec.pts || 0) + " נק')";
        if (h.planned) {
          const btn = el("button", "pool-item planned", "🕒 " + esc(h.label) + pts + " מתוכנן");
          btn.dataset.ovPlan = h.id;
          list.appendChild(btn);
        } else if (h.manual) {
          const btn = el("button", "pool-item hit manual", "✓ " + esc(h.label) + pts + " הושלם - סימון ידני");
          btn.dataset.ovDone = h.id;
          list.appendChild(btn);
        } else {
          list.appendChild(el("span", "pool-item hit", "✓ " + esc(h.label) + pts));
        }
      }
      wrap.appendChild(list);
      const ml = el("div", "pool-rows");
      for (const p of er.misses) {
        const isLater = overrides[p.id] === "later";
        const row = el("div", "pool-item-row" + (isLater ? " later" : ""));
        row.innerHTML = '<span class="pi-name">' + esc(p.label) + " <small>(" + fmtPts(p.pts) + " נק')</small>" + semBadge(p.id) +
          (isLater ? ' <span class="status-later">🗓️ בהמשך</span>' : "") + "</span>" +
          '<span class="pi-actions"><button class="override-btn" data-ov-plan="' + p.id + '">מתוכנן</button>' +
          '<button class="override-btn" data-ov-later="' + p.id + '">' + (isLater ? "בטל" : "בהמשך") + "</button>" +
          '<button class="override-btn" data-ov-done="' + p.id + '">הושלם</button></span>';
        ml.appendChild(row);
      }
      wrap.appendChild(ml);
    }
    return wrap;
  }

  function renderRegistrar(res) {
    const card = el("section", "card");
    card.dataset.anchor = "registrar";
    card.appendChild(el("h2", null, "🪪 רישום ברשם המהנדסים והאדריכלים"));
    card.appendChild(el("p", "section-note",
      "דרישות רישום מקצועי (נפרד לגמרי מדרישות התואר) - הכלי אינו מסמך רשמי, יש לוודא מול רשם המהנדסים והאדריכלים. " +
      "ענף הבית שלכם (לפי המסלול/התמחות) מוצג אוטומטית למטה; אפשר גם לבדוק ענף נוסף."));

    const homeKey = res.registrar.homeKey;
    const secondKey = (res.registrar.results.find(r => !r.home) || {}).key || "";
    const opts = Object.entries(D.registrarBranches)
      .filter(([key]) => key !== homeKey)
      .map(([key, b]) => '<option value="' + key + '"' + (key === secondKey ? " selected" : "") + ">" + esc(b.title) + "</option>")
      .join("");
    const selWrap = el("div", "add-course-form");
    selWrap.innerHTML = '<b>בדיקת ענף רישום נוסף:</b> <select id="registrar-second"><option value="">— ללא —</option>' + opts + "</select>";
    card.appendChild(selWrap);

    if (!res.registrar.results.length) {
      card.appendChild(el("p", "section-note", "לא זוהה ענף בית אוטומטית עבור המסלול/ההתמחות שלכם. בחרו ענף לבדיקה מהתפריט למעלה."));
    }
    for (const rb of res.registrar.results) card.appendChild(renderRegistrarBranch(rb));
    return card;
  }

  function renderFailed(res) {
    const card = el("section", "card");
    card.appendChild(el("h2", null, "מקצועות שנכשלו (יש לחזור עליהם אם הם נדרשים)"));
    const list = el("div", "pool-list");
    for (const c of res.failed) {
      list.appendChild(el("span", "pool-item", esc(cname(c.id)) + " – ציון " + c.grade));
    }
    card.appendChild(list);
    return card;
  }

  // סימון ידני של דרישה כמתוכננת/הושלמה (בטבלת החובה ובמאגרי הבחירה)
  document.addEventListener("click", e => {
    const jumpBtn = e.target.closest("[data-jump-to]");
    if (jumpBtn) {
      const target = document.querySelector('[data-anchor="' + jumpBtn.dataset.jumpTo + '"]');
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const planMultiBtn = e.target.closest("[data-ov-plan-multi]");
    if (planMultiBtn) {
      const ids = planMultiBtn.dataset.ovPlanMulti.split(",");
      const allPlanned = ids.every(id => overrides[id] === "planned");
      ids.forEach(id => { if (allPlanned) delete overrides[id]; else overrides[id] = "planned"; });
      saveOverrides();
      render();
      return;
    }
    const laterMultiBtn = e.target.closest("[data-ov-later-multi]");
    if (laterMultiBtn) {
      const ids = laterMultiBtn.dataset.ovLaterMulti.split(",");
      const allLater = ids.every(id => overrides[id] === "later");
      ids.forEach(id => { if (allLater) delete overrides[id]; else overrides[id] = "later"; });
      saveOverrides();
      render();
      return;
    }
    const doneMultiBtn = e.target.closest("[data-ov-done-multi]");
    if (doneMultiBtn) {
      const ids = doneMultiBtn.dataset.ovDoneMulti.split(",");
      const allDone = ids.every(id => overrides[id] === "done");
      ids.forEach(id => { if (allDone) delete overrides[id]; else overrides[id] = "done"; });
      saveOverrides();
      render();
      return;
    }
    const planBtn = e.target.closest("[data-ov-plan]");
    if (planBtn) {
      const id = planBtn.dataset.ovPlan;
      if (overrides[id] === "planned") delete overrides[id];
      else overrides[id] = "planned";
      saveOverrides();
      render();
      return;
    }
    const laterBtn = e.target.closest("[data-ov-later]");
    if (laterBtn) {
      const id = laterBtn.dataset.ovLater;
      if (overrides[id] === "later") delete overrides[id];
      else overrides[id] = "later";
      saveOverrides();
      render();
      return;
    }
    const doneBtn = e.target.closest("[data-ov-done]");
    if (doneBtn) {
      const id = doneBtn.dataset.ovDone;
      if (overrides[id] === "done") delete overrides[id];
      else overrides[id] = "done";
      saveOverrides();
      render();
      return;
    }
    const del = e.target.closest("[data-del-manual]");
    if (del) {
      extras.manual.splice(+del.dataset.delManual, 1);
      saveOverrides();
      render();
      return;
    }
    if (e.target.closest("#mc-add")) {
      const name = $("#mc-name").value.trim();
      const pts = parseFloat($("#mc-pts").value);
      const cat = $("#mc-cat").value;
      const status = $("#mc-status").value;
      if (!name) { $("#mc-name").focus(); return; }
      if (!(pts >= 0)) { $("#mc-pts").focus(); return; }
      extras.manual.push({ name, pts, cat, status });
      saveOverrides();
      render();
    }
  });

  // שינוי סל (מל"ג / בחירה חופשית / ספורט) למקצוע מהתדפיס
  document.addEventListener("change", e => {
    const sel = e.target.closest("[data-cat]");
    if (!sel) return;
    extras.categories[sel.dataset.cat] = sel.value;
    saveOverrides();
    render();
  });

  $("#clear-transcript").addEventListener("click", () => {
    if (!confirm("לנקות את התדפיס שנטען ולהתחיל מחדש?")) return;
    localStorage.removeItem(LAST_PARSE_KEY);
    parsed = null;
    fi.value = "";
    $("#dz-text").textContent = "גרירת קובץ PDF לכאן / לחיצה לבחירה";
    $("#settings-card").classList.add("hidden");
    $("#results").classList.add("hidden");
    $("#results").innerHTML = "";
    $("#parse-error").classList.add("hidden");
    $("#clear-transcript").classList.add("hidden");
  });

  // מצב בדיקה: ?test=<url של pdf>. אם המשתמש כבר העלה קובץ ידנית בזמן שהבקשה
  // הזו עדיין רצה ברקע - לא דורסים את מה שהוא העלה.
  const testUrl = new URLSearchParams(location.search).get("test");
  if (testUrl) {
    fetch(testUrl).then(r => r.arrayBuffer()).then(b => { if (!parsed) loadFromBuffer(b, testUrl.split("/").pop()); })
      .catch(err => showError("טעינת קובץ הבדיקה נכשלה: " + err.message));
  } else {
    restoreLastParse();
  }
  window.findegLoadUrl = url =>
    fetch(url).then(r => r.arrayBuffer()).then(b => loadFromBuffer(b, url.split("/").pop()));
})();
