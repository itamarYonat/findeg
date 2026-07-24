/* FinDeg – מנוע השוואת דרישות: מה הושלם ומה נשאר. */
window.FINDEG_ENGINE = (function () {
  const D = () => window.FINDEG_DATA;

  // מפת שקילויות: id -> קבוצת המזהים השקולים לו (כולל עצמו)
  function equivSet(id) {
    for (const g of D().equivGroups) if (g.includes(id)) return g;
    return [id];
  }

  function makePassedIndex(courses, overrides) {
    const passed = new Map(); // id -> record
    for (const c of courses) if (c.passed) passed.set(c.id, c);
    const isDone = (id) => {
      if (overrides && overrides[id] === "done") return true;
      for (const e of equivSet(id)) if (passed.has(e)) return true;
      // צירופים (למשל: חומרי בנייה + מבוא להנדסת חומרים = יסודות חומרי בנייה)
      for (const combo of D().combos) {
        if (combo.gives !== id) continue;
        const ok = combo.needs.every(n => equivSet(n).some(e => passed.has(e)));
        if (ok) return true;
      }
      return false;
    };
    // מציאת הרשומה שמימשה דרישה (לתצוגת ציון/נקודות)
    const findRec = (ids) => {
      for (const id of ids) for (const e of equivSet(id)) if (passed.has(e)) return passed.get(e);
      return null;
    };
    return { passed, isDone, findRec };
  }

  // הערה: משמש תמיד לרשימות חובה (לא בחירה) - אין כאן סטטוס "בהמשך", מקצוע חובה
  // "יילמד בהמשך" באופן טאוטולוגי כל עוד לא הושלם, אין בזה מידע חדש.
  function evalCoursesSection(section, idx, overrides) {
    const rows = section.items.map(item => {
      const done = item.ids.some(id => idx.isDone(id));
      const rec = idx.findRec(item.ids);
      const planned = !done && overrides && item.ids.some(id => overrides[id] === "planned");
      const manual = !rec && overrides && item.ids.some(id => overrides[id] === "done");
      return { item, done, rec, planned, manual };
    });
    const doneCount = rows.filter(r => r.done).length;
    const plannedCount = rows.filter(r => r.planned).length;
    const missing = rows.filter(r => !r.done);
    const donePts = rows.filter(r => r.done).reduce((s, r) => s + r.item.pts, 0);
    const totalPts = rows.reduce((s, r) => s + r.item.pts, 0);
    return { kind: "courses", section, rows, doneCount, plannedCount, total: rows.length, missing, donePts, totalPts };
  }

  function poolHits(pool, idx, overrides) {
    const hits = [], misses = [];
    for (const id of pool) {
      const rec = idx.findRec([id]);
      if (rec) hits.push({ id, rec, planned: false });
      else if (overrides && overrides[id] === "done") {
        hits.push({ id, rec: { pts: D().coursePoints[id] || 0 }, planned: false, manual: true });
      } else if (overrides && overrides[id] === "planned") {
        hits.push({ id, rec: { pts: D().coursePoints[id] || 0 }, planned: true });
      } else misses.push(id);
    }
    return { hits, misses };
  }

  // "hits" כולל גם מקצועות מתוכננים (עדיין לא הושלמו בפועל) - הם נספרים בתצוגה
  // (סרגל/רשימה) אבל לא כלפי מילוי הדרישה עצמה, בדיוק כמו בטבלת מקצועות חובה.
  function evalChooseCourses(section, idx, overrides) {
    const { hits, misses } = poolHits(section.pool, idx, overrides);
    const doneCount = hits.filter(h => !h.planned).length;
    return {
      kind: "chooseCourses", section, hits, misses,
      doneCount, needed: section.min,
      satisfied: doneCount >= section.min
    };
  }

  function evalChoosePoints(section, idx, overrides) {
    const { hits, misses } = poolHits(section.pool, idx, overrides);
    const pts = hits.filter(h => !h.planned).reduce((s, h) => s + (h.rec.pts || 0), 0);
    const plannedPts = hits.filter(h => h.planned).reduce((s, h) => s + (h.rec.pts || 0), 0);
    return {
      kind: "choosePoints", section, hits, misses,
      pts, plannedPts, needed: section.minPts, satisfied: pts >= section.minPts
    };
  }

  // שורת פרויקט (מחייב/אפשרות): תומכת ביותר ממקצוע אחד (למשל פרויקט מעבדתי
  // בשני חלקים) המסומנים/מתוכננים יחד כיחידה אחת.
  // כאשר לפרויקט כמה מקצועות, כל אחד מהם עשוי להיות במצב שונה (הושלם בפועל/
  // סומן ידנית/מתוכנן/כלום) - "mixed" מסמן התנגשות כזו כדי שהתצוגה לא תציג
  // סטטוס אחיד שגוי (למשל "מתוכנן" כשחלק כבר הושלם בפועל).
  function buildProjectRow(ids, idx, overrides) {
    const done = ids.every(id => idx.isDone(id));
    const rec = idx.findRec(ids);
    const planned = !done && overrides && ids.some(id => overrides[id] === "planned");
    const later = !done && !planned && overrides && ids.some(id => overrides[id] === "later");
    const manual = done && ids.every(id => !idx.passed.has(id));
    const pts = ids.reduce((s, id) => s + (D().coursePoints[id] || 0), 0);
    const statuses = ids.map(id => {
      if (equivSet(id).some(e => idx.passed.has(e))) return "real";
      if (overrides && overrides[id] === "done") return "manual";
      if (overrides && overrides[id] === "planned") return "planned";
      if (overrides && overrides[id] === "later") return "later";
      return "none";
    });
    const counts = { real: 0, manual: 0, planned: 0, later: 0, none: 0 };
    statuses.forEach(s => counts[s]++);
    const mixed = ids.length > 1 && new Set(statuses).size > 1;
    return { ids, done, rec, planned, later, manual, pts, mixed, counts };
  }

  // ענף רישום ברשם המהנדסים - עצמאי לגמרי מדרישות התואר, אותה בדיקת isDone/overrides
  // בלבד. מקצוע עם ids ריק (untracked) לא זוהה בקטלוג שלנו ולא נכלל בבדיקת "הושלם".
  function evalRegistrarBranch(branch, idx, overrides) {
    const coreRows = branch.core.map(item => {
      if (!item.ids.length) return { item, untracked: true, done: false, planned: false, manual: false, rec: null };
      const done = item.ids.some(id => idx.isDone(id));
      const rec = idx.findRec(item.ids);
      const planned = !done && overrides && item.ids.some(id => overrides[id] === "planned");
      const manual = !rec && overrides && item.ids.some(id => overrides[id] === "done");
      return { item, untracked: false, done, rec, planned, manual };
    });
    const trackableCore = coreRows.filter(r => !r.untracked);
    const coreSatisfied = trackableCore.every(r => r.done);

    let electiveResult = null;
    if (branch.elective) {
      const hits = [], misses = [];
      for (const p of branch.elective.pool) {
        const rec = idx.findRec([p.id]);
        if (rec) hits.push({ id: p.id, label: p.label, rec: { pts: p.pts }, planned: false });
        else if (overrides && overrides[p.id] === "done") hits.push({ id: p.id, label: p.label, rec: { pts: p.pts }, planned: false, manual: true });
        else if (overrides && overrides[p.id] === "planned") hits.push({ id: p.id, label: p.label, rec: { pts: p.pts }, planned: true });
        else misses.push(p);
      }
      const pts = hits.filter(h => !h.planned).reduce((s, h) => s + (h.rec.pts || 0), 0);
      electiveResult = {
        hits, misses, pts, needed: branch.elective.minPts, satisfied: pts >= branch.elective.minPts,
        untracked: branch.elective.untracked || []
      };
    }
    return {
      title: branch.title, note: branch.note, coreRows, electiveResult,
      satisfied: coreSatisfied && (!electiveResult || electiveResult.satisfied)
    };
  }

  /**
   * חישוב מצב התואר.
   * @param parsed  תוצאת הפרסר (courses)
   * @param trackKey מסלול, yearKey קטלוג
   * @param options  { specialization, projectKey, overrides: {id:"planned"|"done"}, categories, manual }
   */
  function evaluate(parsed, trackKey, yearKey, options) {
    options = options || {};
    const overrides = options.overrides || {};
    const track = D().tracks[trackKey];
    if (!track || !track.supported) return { unsupported: true, track };
    const yearData = track.years[yearKey];
    if (!yearData) return { noYear: true, track };

    let sections, general, total;
    if (track.hasSpecialization) {
      const spec = yearData.specializations[options.specialization || "water"];
      sections = spec.sections.slice();
      general = spec.general;
      total = yearData.total;
    } else {
      sections = yearData.sections.slice();
      general = yearData.general;
      total = yearData.total;
    }

    const idx = makePassedIndex(parsed.courses, overrides);
    const results = [];
    const usedIds = new Set(); // מקצועות פקולטיים שנספרו בדרישות

    // פרויקטים (ניהול ובנייה): חובה + בחירת פרויקט שני
    let projectResult = null;
    if (yearData.projects) {
      const projOpts = track.projectOptions;
      const chosenKey = options.projectKey && yearData.projects.chooseOne.includes(options.projectKey)
        ? options.projectKey : null;
      const mand = yearData.projects.mandatoryCourse;
      const mandRow = buildProjectRow(mand.ids, idx, overrides);

      const optionRows = yearData.projects.chooseOne.map(k => ({
        key: k, opt: projOpts[k], row: buildProjectRow(projOpts[k].ids, idx, overrides)
      }));
      const chosen = chosenKey ? optionRows.find(o => o.key === chosenKey) : null;

      projectResult = {
        mandatory: { item: mand, ...mandRow },
        options: optionRows,
        chosen: chosen ? { key: chosen.key, opt: chosen.opt, ...chosen.row } : null,
        anyDone: optionRows.some(o => o.row.done)
      };
      mand.ids.forEach(id => usedIds.add(id));
      yearData.projects.chooseOne.forEach(k => projOpts[k].ids.forEach(id => usedIds.add(id)));
    }

    for (const s of sections) {
      let r;
      if (s.type === "courses") r = evalCoursesSection(s, idx, overrides);
      else if (s.type === "chooseCourses") r = evalChooseCourses(s, idx, overrides);
      else if (s.type === "choosePoints") r = evalChoosePoints(s, idx, overrides);
      results.push(r);
      const ids = s.type === "courses" ? s.items.flatMap(i => i.ids) : s.pool;
      ids.forEach(id => equivSet(id).forEach(e => usedIds.add(e)));
    }

    // מקצועות שנוצלו בצירוף (קומבינציה) שסגר דרישה – נחשבים כמנוצלים
    for (const combo of D().combos) {
      if (!usedIds.has(combo.gives)) continue;
      const directlyPassed = equivSet(combo.gives).some(e => idx.passed.has(e));
      const comboFired = combo.needs.every(n => equivSet(n).some(e => idx.passed.has(e)));
      if (!directlyPassed && comboFired) {
        combo.needs.forEach(n => equivSet(n).forEach(e => usedIds.add(e)));
      }
    }

    // ---- שרשראות משנה של קבוצה א' (ניהול ובנייה/חומרים/מבנים/קרקע-דרכים/תחבורה) ----
    // "ניהול ובנייה" גלויה תמיד (חובה לכולם); היתר נחשפות רק כשנבחר בפועל פרויקט
    // התלוי בהן - לא רק כי נלמד/סומן מקצוע כלשהו מתוכן (כדי לא להציג "חסר" שווא
    // לסטודנט שלא מתכנן ללכת בכיוון הזה). מקצועות משרשראות שלא נבחרו מוצגים
    // באסופה "שרשראות אחרות". תצוגה בלבד - אינן מוסיפות דרישת נקודות משלהן,
    // המקצועות כבר נספרים בקבוצה א'/א'+ב'.
    const chainResults = [];
    if (yearData.chains) {
      const projectChain = options.projectKey && track.projectChainMap ? track.projectChainMap[options.projectKey] : null;
      for (const [key, chain] of Object.entries(yearData.chains)) {
        const triggered = chain.alwaysOn || projectChain === key;
        if (!triggered) continue;
        const coreRows = chain.core.map(id => {
          const done = idx.isDone(id);
          const rec = idx.findRec([id]);
          const planned = !done && overrides[id] === "planned";
          const manual = !rec && overrides[id] === "done";
          return { id, pts: D().coursePoints[id] || (rec ? rec.pts : 0), done, rec, planned, manual };
        });
        let chooseResult = null;
        if (chain.chooseFrom) {
          const { hits, misses } = poolHits(chain.chooseFrom.pool, idx, overrides);
          const doneCount = hits.filter(h => !h.planned).length;
          const plannedCount = hits.filter(h => h.planned).length;
          chooseResult = { min: chain.chooseFrom.min, hits, misses, doneCount, plannedCount, satisfied: doneCount >= chain.chooseFrom.min };
        }
        const coreSatisfied = coreRows.every(r => r.done);
        chainResults.push({
          key, title: chain.title, note: chain.note, coreRows, chooseResult,
          satisfied: coreSatisfied && (!chooseResult || chooseResult.satisfied)
        });
      }
    }

    // ---- התקדמות מצטברת קבוצה א' / א'+ב' (רק תצוגת נקודות, בלי כפילות רשימות) ----
    const chainHasId = (chainResult, id) =>
      chainResult.coreRows.some(r => r.id === id) ||
      (chainResult.chooseResult && (
        chainResult.chooseResult.hits.some(h => h.id === id) || chainResult.chooseResult.misses.includes(id)));

    let groupAResult = null, groupABResult = null, otherChainsResult = null;
    if (yearData.groupAPool) {
      yearData.groupAPool.forEach(id => usedIds.add(id));
      (yearData.groupBPool || []).forEach(id => usedIds.add(id));
      groupAResult = evalChoosePoints(
        { id: "groupA", title: "קבוצה א'", minPts: yearData.groupAMinPts, pool: yearData.groupAPool }, idx, overrides);
      groupABResult = evalChoosePoints(
        {
          id: "groupAB", title: "קבוצה א'+ב'", minPts: yearData.groupABMinPts,
          pool: [...new Set([...yearData.groupAPool, ...(yearData.groupBPool || [])])]
        }, idx, overrides);
      // מקצועות משרשראות שעדיין לא נחשפו כתת-מסגרת (לא נגעו בהן)
      const otherPool = yearData.groupAPool.filter(id => !chainResults.some(c => chainHasId(c, id)));
      otherChainsResult = { pool: otherPool, ...poolHits(otherPool, idx, overrides) };
    }

    // ---- נקודות שנצברו כתוצאה מסימון ידני "הושלם" (בכל סעיף) ----
    const creditedOverrideIds = new Set();
    let overrideDonePts = 0;
    const creditOverride = (id, pts) => {
      if (!id || creditedOverrideIds.has(id)) return;
      creditedOverrideIds.add(id);
      overrideDonePts += pts || 0;
    };
    for (const r of results) {
      if (r.kind === "courses") {
        for (const row of r.rows) {
          if (row.manual) creditOverride(row.item.ids.find(id => overrides[id] === "done"), row.item.pts);
        }
      } else {
        for (const h of r.hits) if (h.manual) creditOverride(h.id, h.rec.pts);
      }
    }
    for (const c of chainResults) {
      for (const row of c.coreRows) if (row.manual) creditOverride(row.id, row.pts);
      if (c.chooseResult) for (const h of c.chooseResult.hits) if (h.manual) creditOverride(h.id, h.rec.pts);
    }
    if (otherChainsResult) for (const h of otherChainsResult.hits) if (h.manual) creditOverride(h.id, h.rec.pts);
    if (projectResult) {
      if (projectResult.mandatory.manual) creditOverride(projectResult.mandatory.item.ids[0], projectResult.mandatory.pts);
      for (const o of projectResult.options) if (o.row.manual) creditOverride(o.opt.ids[0], o.row.pts);
    }

    // הקצאת מקצועות שלא שויכו לסלים: ספורט / מל"ג (העשרה) / בחירה חופשית
    // options.categories: {id: "pe"|"enrich"|"free"} – שיוך ידני
    // options.manual: [{name, pts, cat}] – מקצועות שהוספו ידנית
    const cats = options.categories || {};
    const manualCourses = options.manual || [];
    const buckets = {
      pe: { label: "ספורט (חינוך גופני)", needed: general.pe, courses: [] },
      enrich: { label: "מל\"ג (העשרה)", needed: general.enrichment, courses: [] },
      free: { label: "בחירה חופשית", needed: general.free, courses: [] }
    };
    const zeroCredit = [];
    for (const c of parsed.courses) {
      if (!c.passed || usedIds.has(c.id)) continue;
      if (c.pts <= 0) { zeroCredit.push(c); continue; }
      const cat = cats[c.id] || (c.id.startsWith("039") ? "pe" : "free");
      buckets[cat].courses.push({ id: c.id, pts: c.pts, fromTranscript: true });
    }
    manualCourses.forEach((m, i) => {
      if (buckets[m.cat]) {
        buckets[m.cat].courses.push({
          name: m.name, pts: +m.pts || 0, manualIndex: i,
          planned: m.status === "planned", later: m.status === "later"
        });
        // מקצוע שנוסף ידנית וסומן "הושלם" (לא "מתוכנן"/"בהמשך") נספר גם בסך
        // הנקודות שנצברו, בדיוק כמו סימון "הושלם" על דרישה קיימת - אחרת הסל מציג
        // "מלא" בעוד הסיכום הכללי לא זז, מה שנראה כאילו המקצוע "לא נספר" בכלל.
        // "בהמשך" לא נספר בשום מקום - הוא לא התקדמות, רק תזכורת עתידית.
        if (m.status === "done") overrideDonePts += +m.pts || 0;
      }
    });
    // נקודות "עודפות" מקבוצה א'+ב' (מעבר ל-20 הנדרשות) נספרות אוטומטית בבחירה חופשית
    if (groupABResult && groupABResult.pts > groupABResult.needed) {
      const overflow = +(groupABResult.pts - groupABResult.needed).toFixed(1);
      buckets.free.courses.push({ name: "עודף נקודות מקבוצה א'+ב'", pts: overflow, overflow: true });
    }
    for (const b of Object.values(buckets)) {
      b.pts = b.courses.filter(c => !c.planned && !c.later).reduce((s, c) => s + c.pts, 0);
      b.done = Math.min(b.pts, b.needed);
      b.satisfied = b.pts >= b.needed;
    }

    // נקודות שנצברו: מהתדפיס + סימוני "הושלם" ידניים (פטורים/שקילויות שאושרו)
    const creditedFromTranscript = parsed.courses.filter(c => c.passed).reduce((s, c) => s + c.pts, 0);
    const creditedPts = +(creditedFromTranscript + overrideDonePts).toFixed(1);

    const failed = parsed.courses.filter(c => !c.passed && c.status === "graded");

    // ---- סיכום המקצועות המתוכננים (נק"ז לסמסטרים הקרובים) ----
    const upcoming = new Map(); // key -> {id, name, pts, source}
    const addUpcoming = (id, pts, source) => { if (!upcoming.has(id)) upcoming.set(id, { id, pts, source }); };
    let manualUpcomingSeq = 0;
    const addUpcomingManual = (name, pts, source) =>
      upcoming.set("manual_" + (manualUpcomingSeq++), { id: null, name, pts, source });
    for (const r of results) {
      if (r.kind === "courses") {
        for (const row of r.rows) {
          if (!row.planned) continue;
          const id = row.item.ids.find(i => overrides[i] === "planned") || row.item.ids[0];
          addUpcoming(id, row.item.pts || D().coursePoints[id] || 0, r.section.title);
        }
      } else {
        for (const h of r.hits) if (h.planned) addUpcoming(h.id, h.rec.pts || 0, r.section.title);
      }
    }
    for (const c of chainResults) {
      for (const row of c.coreRows) if (row.planned) addUpcoming(row.id, row.pts, c.title);
      if (c.chooseResult) for (const h of c.chooseResult.hits) if (h.planned) addUpcoming(h.id, h.rec.pts || 0, c.title);
    }
    if (otherChainsResult) for (const h of otherChainsResult.hits) if (h.planned) addUpcoming(h.id, h.rec.pts || 0, "שרשראות אחרות");
    if (projectResult) {
      if (projectResult.mandatory.planned) addUpcoming(projectResult.mandatory.item.ids[0], projectResult.mandatory.pts, "פרויקטים");
      for (const o of projectResult.options) if (o.row.planned) addUpcoming(o.opt.ids[0], o.row.pts, "פרויקטים");
      // הפרויקט השני שנבחר בתפריט, אם עדיין לא בוצע וגם לא סומן מתוכנן במפורש
      if (projectResult.chosen && !projectResult.chosen.done && !projectResult.chosen.planned) {
        addUpcoming(projectResult.chosen.opt.ids[0], projectResult.chosen.pts, "פרויקטים");
      }
    }
    for (const b of Object.values(buckets)) {
      for (const c of b.courses) if (c.planned) addUpcomingManual(c.name, c.pts, b.label);
    }
    const upcomingList = [...upcoming.values()];
    const upcomingPts = upcomingList.reduce((s, u) => s + u.pts, 0);

    // ---- ענפי רישום ברשם המהנדסים והאדריכלים (עצמאי מדרישות התואר) ----
    // ענף "הבית" נקבע לפי מסלול/התמחות; ענף נוסף אופציונלי נבחר ידנית ע"י המשתמש
    let registrarHomeKey = null;
    if (trackKey === "management") registrarHomeKey = "management";
    else if (trackKey === "structures") registrarHomeKey = "structures";
    else if (trackKey === "civil" && options.specialization === "transport") registrarHomeKey = "transport";

    const registrarSecondKey = options.registrarSecond && options.registrarSecond !== registrarHomeKey &&
      D().registrarBranches[options.registrarSecond] ? options.registrarSecond : null;

    const registrarResults = [];
    if (registrarHomeKey) {
      registrarResults.push({ key: registrarHomeKey, home: true, ...evalRegistrarBranch(D().registrarBranches[registrarHomeKey], idx, overrides) });
    }
    if (registrarSecondKey) {
      registrarResults.push({ key: registrarSecondKey, home: false, ...evalRegistrarBranch(D().registrarBranches[registrarSecondKey], idx, overrides) });
    }

    return {
      trackKey, yearKey, track, total,
      sections: results,
      projects: projectResult,
      chains: chainResults,
      groupA: groupAResult, groupAB: groupABResult, otherChains: otherChainsResult,
      general: { conf: general, buckets, zeroCredit },
      registrar: { homeKey: registrarHomeKey, results: registrarResults },
      points: {
        credited: creditedPts, total, fromTranscript: +creditedFromTranscript.toFixed(1),
        overrideBonus: +overrideDonePts.toFixed(1),
        remaining: Math.max(0, +(total - creditedPts).toFixed(1))
      },
      upcoming: {
        list: upcomingList,
        pts: +upcomingPts.toFixed(1),
        remainingAfter: Math.max(0, +(total - creditedPts - upcomingPts).toFixed(1))
      },
      failed
    };
  }

  return { evaluate, equivSet };
})();
