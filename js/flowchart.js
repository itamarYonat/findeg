/* FinDeg – תרשים זרימה: מסלול ניהול ובנייה, מקצועות חובה לפי סמסטר + מקצועות
 * בחירה שאפשר לנעוץ לסמסטר מתאים, עם חצי דרישות קדם/מקצועות צמודים. */
(function () {
  const D = window.FINDEG_DATA;
  const FC = window.FINDEG_FLOWCHART.management;
  const SEM = window.FINDEG_SEMESTERS || {};
  const PREREQ = window.FINDEG_PREREQS || {};

  const $ = sel => document.querySelector(sel);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const cname = id => D.courseNames[id] || id;
  const pts = id => D.coursePoints[id];
  const fmtPts = p => (p == null ? "" : (p % 1 === 0 ? p.toFixed(0) : p.toFixed(1)));
  const seasonLabel = { winter: "חורף", spring: "אביב", summer: "קיץ" };

  function semBadge(id) {
    const s = SEM[id];
    if (!s || !s.length) return '<span class="sem-badge sem-unknown" title="לא נמצא בסמסטרים שנבדקו">?</span>';
    return s.filter(x => x !== "summer").map(x => '<span class="sem-badge sem-' + x + '">' + seasonLabel[x] + "</span>").join("");
  }

  // סמסטרים 5-8 שמתאימים לעונה של מקצוע (חורף -> 5/7, אביב -> 6/8). מקצוע לא-ידוע/רק-קיץ - כולם.
  function eligibleSemesters(id) {
    const s = (SEM[id] || []).filter(x => x !== "summer");
    if (!s.length) return [5, 6, 7, 8];
    const out = [];
    if (s.includes("winter")) out.push(5, 7);
    if (s.includes("spring")) out.push(6, 8);
    return out.length ? out : [5, 6, 7, 8];
  }

  // ---------- מצב ----------
  let yearKey = "5786";
  let pinned = {}; // courseId -> semester num
  let projectKey = "";

  const STORE_KEY = "findeg_flowchart_state";
  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s) { yearKey = s.yearKey || yearKey; pinned = s.pinned || {}; projectKey = s.projectKey || ""; }
    } catch { /* ignore */ }
  }
  function saveState() {
    localStorage.setItem(STORE_KEY, JSON.stringify({ yearKey, pinned, projectKey }));
  }

  // ---------- בניית תוכן העמודות ----------
  function buildColumns() {
    const yearData = D.tracks.management.years[yearKey];
    return FC.semesters.map(s => {
      const mandatory = s.mandatory.slice();
      if (s.yearOnly && s.yearOnly[yearKey]) mandatory.push(...s.yearOnly[yearKey]);
      return {
        num: s.num, season: s.season, mandatory,
        flexible: s.flexible || [], general: s.general || [],
        project: s.project || null
      };
    });
  }

  // סמסטר בפועל של כל מקצוע המוצג כרגע (חובה+גמיש+פרויקט+נעוץ), לשימוש בחישוב
  // שרשרת קריטית אמיתית (במונחי מרחק-סמסטרים, לא רק מספר קפיצות בגרף).
  function computeSemNumMap() {
    const map = {};
    for (const col of buildColumns()) {
      for (const id of col.mandatory) map[id] = col.num;
      for (const id of col.flexible) if (!(id in map)) map[id] = col.num;
      if (col.project) map[col.project] = col.num;
    }
    if (projectKey) {
      const opt = D.tracks.management.projectOptions[projectKey];
      if (opt) for (const id of opt.ids) map[id] = 8;
    }
    for (const [id, sem] of Object.entries(pinned)) map[id] = sem;
    return map;
  }

  // שרשרת הדרישות-קדם הארוכה ביותר: המדד הראשי הוא מספר הקפיצות (מקצועות
  // בשרשרת עצמה) - לא מרחק סמסטרים גולמי, כי שני מקצועות שממוקמים רחוק זה מזה
  // בתוכנית הלימודים (בלי שום קשר תלות אמיתי ביניהם, סתם ככה) היו "מנצחים" שרשרת
  // אמיתית וארוכה יותר. מרחק הסמסטרים (span) משמש רק כשובר-שוויון בין שרשראות
  // באותו אורך - כך שמקצוע "פעם בשנה" שיוצר דילוג עדיין בא לידי ביטוי.
  function computeCriticalPath(semNumMap) {
    const adj = {};
    for (const id of Object.keys(PREREQ)) {
      if (!(id in semNumMap)) continue;
      const p = PREREQ[id];
      for (const src of [...(p.prereq || []), ...(p.adjoining || [])]) {
        if (!(src in semNumMap)) continue;
        const weight = Math.max(1, semNumMap[id] - semNumMap[src]);
        (adj[src] = adj[src] || []).push({ to: id, weight });
      }
    }
    const memo = {};
    const visiting = new Set();
    function longestFrom(id) {
      if (memo[id]) return memo[id];
      if (visiting.has(id)) return { hops: 0, span: 0, path: [id] }; // הגנה מפני מעגל (לא צפוי בפועל)
      visiting.add(id);
      let best = { hops: 0, span: 0, path: [id] };
      for (const { to, weight } of (adj[id] || [])) {
        const sub = longestFrom(to);
        const hops = sub.hops + 1, span = sub.span + weight;
        if (hops > best.hops || (hops === best.hops && span > best.span)) {
          best = { hops, span, path: [id, ...sub.path] };
        }
      }
      visiting.delete(id);
      memo[id] = best;
      return best;
    }
    let overall = { hops: 0, span: 0, path: [] };
    for (const id of Object.keys(semNumMap)) {
      const r = longestFrom(id);
      if (r.hops > overall.hops || (r.hops === overall.hops && r.span > overall.span)) overall = r;
    }
    const edges = new Set();
    for (let i = 0; i < overall.path.length - 1; i++) edges.add(overall.path[i] + "->" + overall.path[i + 1]);
    return { nodes: new Set(overall.path), edges, span: overall.span };
  }

  // שרשרת קריטית נוכחית (מחושבת מחדש בתחילת כל render, ראו computeCriticalPath) -
  // ברמת המודול כדי שכל פונקציות הרינדור/ציור החצים יוכלו לגשת אליה בלי להעביר בפרמטרים.
  let criticalNodes = new Set();
  let criticalEdges = new Set();
  let criticalSpan = 0;

  function courseBox(id, semNum, extraCls, noteHtml) {
    const isCrit = criticalNodes.has(id);
    const box = el("div", "fc-box" + (extraCls ? " " + extraCls : "") + (isCrit ? " fc-critical" : ""));
    box.dataset.courseId = id;
    box.dataset.semNum = semNum;
    const p = pts(id);
    box.innerHTML = (p != null ? '<span class="fc-pts">' + fmtPts(p) + "</span>" : "") +
      "<b>" + esc(cname(id)) + "</b>" +
      '<span class="fc-code">' + id.slice(2, 8) + "</span>" + semBadge(id) +
      (noteHtml || "");
    return box;
  }

  function renderGrid() {
    const grid = $("#fc-grid");
    grid.innerHTML = "";
    const columns = buildColumns();
    const track = D.tracks.management;
    const projOpt = projectKey ? track.projectOptions[projectKey] : null;

    for (const col of columns) {
      const rowEl = el("div", "fc-row");
      rowEl.dataset.semNum = col.num;
      rowEl.appendChild(el("div", "fc-row-head" + (col.season === "spring" ? " spring" : ""),
        "סמסטר " + col.num + " · " + seasonLabel[col.season]));
      const boxesEl = el("div", "fc-row-boxes");

      for (const id of col.mandatory) boxesEl.appendChild(courseBox(id, col.num));

      for (const id of col.flexible) {
        boxesEl.appendChild(courseBox(id, col.num, "fc-flexible",
          '<div class="section-note" style="margin:2px 0 0;font-size:.75rem">גמיש - לרוב סמ\' 1-2, תלוי בסיווג</div>'));
      }

      if (col.project) {
        boxesEl.appendChild(courseBox(col.project, col.num, "fc-project"));
        if (projOpt) {
          for (const id of projOpt.ids) {
            boxesEl.appendChild(courseBox(id, col.num, "fc-project",
              '<div class="section-note" style="margin:2px 0 0;font-size:.75rem">' + esc(projOpt.label) + "</div>"));
          }
        }
      }

      for (const g of col.general) {
        boxesEl.appendChild(el("div", "fc-box fc-general", fmtPts(g.pts) + ' נק\' · ' + esc(g.label)));
      }

      // מקצועות בחירה שנעוצו לסמסטר הזה
      for (const [id, sem] of Object.entries(pinned)) {
        if (sem !== col.num) continue;
        const box = courseBox(id, col.num, "fc-elective");
        const un = el("button", "fc-unpin", "✕");
        un.title = "בטל נעיצה";
        un.dataset.unpin = id;
        box.appendChild(un);
        boxesEl.appendChild(box);
      }

      rowEl.appendChild(boxesEl);
      grid.appendChild(rowEl);
    }
  }

  // ---------- פאנל מקצועות בחירה ----------
  function chainPools(yearData) {
    const chains = yearData.chains || {};
    const groups = [];
    for (const [key, chain] of Object.entries(chains)) {
      const pool = [...new Set([...(chain.core || []), ...((chain.chooseFrom && chain.chooseFrom.pool) || [])])];
      groups.push({
        key, title: chain.title, note: chain.note,
        minNote: chain.chooseFrom ? "לבחור לפחות " + chain.chooseFrom.min + " מהרשימה" : "",
        pool
      });
    }
    const groupBSection = yearData.sections.find(s => s.id === "groupB");
    if (groupBSection) {
      groups.push({
        key: "groupB", title: groupBSection.title, note: groupBSection.note,
        minNote: "לבחור לפחות " + groupBSection.min + " מהרשימה",
        pool: groupBSection.pool
      });
    }
    return groups;
  }

  function renderElectives() {
    const yearData = D.tracks.management.years[yearKey];
    const wrap = $("#fc-electives");
    wrap.innerHTML = "";
    wrap.appendChild(el("h2", null, "מקצועות בחירה"));
    wrap.appendChild(el("p", "section-note",
      'בחרו סמסטר מהתפריט הנפתח ליד כל מקצוע כדי לנעוץ אותו בתרשים למעלה; "— לא נבחר —" מחזיר אותו לכאן.'));

    for (const group of chainPools(yearData)) {
      if (!group.pool.length) continue;
      const chainEl = el("div", "fc-chain");
      chainEl.appendChild(el("h3", null, esc(group.title)));
      if (group.minNote) chainEl.appendChild(el("p", "fc-chain-note", group.minNote));
      const row = el("div", "fc-chip-row");
      for (const id of group.pool) {
        const isPinned = pinned[id] != null;
        const chip = el("span", "fc-chip" + (isPinned ? " pinned" : ""));
        const p = pts(id);
        chip.innerHTML = (isPinned ? "📌 " : "") + esc(cname(id)) +
          ' <small>(' + id.slice(2, 8) + (p != null ? " · " + fmtPts(p) + " נק'" : "") + ')</small> ' + semBadge(id);
        const select = el("select");
        select.dataset.pinSelect = id;
        const noneOpt = el("option", null, "— לא נבחר —");
        noneOpt.value = "";
        select.appendChild(noneOpt);
        for (const semNum of eligibleSemesters(id)) {
          const o = el("option", null, "סמסטר " + semNum);
          o.value = String(semNum);
          if (pinned[id] === semNum) o.selected = true;
          select.appendChild(o);
        }
        chip.appendChild(select);
        row.appendChild(chip);
      }
      chainEl.appendChild(row);
      wrap.appendChild(chainEl);
    }
  }

  // ---------- חצים (SVG) ----------
  // רוחב השוליים השמאליים השמורים לנתיב מעברי-חיצים ארוכי-טווח (ראו padding-left ב-.fc-grid)
  const LANE_MARGIN = 150;
  const LANE_STEP = 10;

  function drawArrows() {
    const svg = $("#fc-svg");
    const page = $("#fc-page");
    svg.innerHTML = "";
    const pageRect = page.getBoundingClientRect();
    svg.setAttribute("width", page.scrollWidth);
    svg.setAttribute("height", page.scrollHeight);

    const boxes = {};
    document.querySelectorAll("#fc-page [data-course-id]").forEach(elm => {
      const id = elm.dataset.courseId;
      const r = elm.getBoundingClientRect();
      // אם אותו מקצוע מוצג כמה פעמים (למשל מקום פנוי + פינוי), משתמשים בהופעה הראשונה
      if (!boxes[id]) {
        boxes[id] = {
          x: r.left - pageRect.left, y: r.top - pageRect.top, w: r.width, h: r.height,
          semNum: elm.dataset.semNum ? +elm.dataset.semNum : null
        };
      }
    });

    const rows = {};
    document.querySelectorAll("#fc-page .fc-row").forEach(rowElm => {
      const r = rowElm.getBoundingClientRect();
      rows[+rowElm.dataset.semNum] = { top: r.top - pageRect.top, bottom: r.bottom - pageRect.top };
    });

    const visibleIds = Object.keys(boxes);
    const critical = criticalEdges;

    svg.innerHTML =
      '<defs>' +
      '<marker id="fc-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="var(--accent)"/></marker>' +
      '<marker id="fc-arrow-crit" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="var(--bad)"/></marker>' +
      "</defs>";

    // קו ישר בלבד (מקטעים אנכיים/אופקיים), לא עקומה - וכשהמעבר חוצה יותר משורה
    // אחת, יוצא לנתיב שמור בשוליים השמאליים (מחוץ לתיבות) כדי לא לחצות אותן.
    function buildPoints(a, b, laneX) {
      const x1 = a.x + a.w / 2, y1 = a.y + a.h;
      const x2 = b.x + b.w / 2, y2 = b.y;
      const rowDiff = (b.semNum != null && a.semNum != null) ? b.semNum - a.semNum : null;

      if (rowDiff == null) {
        // אחד הצדדים אינו בתוך הרשת (למשל מקצוע בחירה שטרם ננעץ) - קו ישר פשוט
        return [[x1, y1], [x2, y2]];
      }
      if (rowDiff <= 1) {
        const gutterY = a.semNum != null && rows[a.semNum + 1]
          ? (rows[a.semNum].bottom + rows[a.semNum + 1].top) / 2
          : (y1 + y2) / 2;
        return [[x1, y1], [x1, gutterY], [x2, gutterY], [x2, y2]];
      }
      // מעבר מרובה-שורות: יוצאים לנתיב בשוליים השמאליים (מחוץ לכל התיבות)
      const y1gutter = rows[a.semNum + 1] ? (rows[a.semNum].bottom + rows[a.semNum + 1].top) / 2 : y1 + 20;
      const y2gutter = rows[b.semNum - 1] ? (rows[b.semNum - 1].bottom + rows[b.semNum].top) / 2 : y2 - 20;
      return [[x1, y1], [x1, y1gutter], [laneX, y1gutter], [laneX, y2gutter], [x2, y2gutter], [x2, y2]];
    }

    function addLine(fromId, toId, dashed, laneIndex) {
      const a = boxes[fromId], b = boxes[toId];
      if (!a || !b) return;
      const isCrit = critical.has(fromId + "->" + toId);
      const laneX = 24 + (laneIndex % 8) * LANE_STEP;
      const pts2 = buildPoints(a, b, Math.min(laneX, LANE_MARGIN - 30));
      const d = pts2.map((p, i) => (i === 0 ? "M" : "L") + p[0] + "," + p[1]).join(" ");
      const baseOpacity = isCrit ? 1 : 0.3;
      const baseWidth = isCrit ? 2.5 : 1;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", isCrit ? "var(--bad)" : "var(--accent)");
      path.setAttribute("stroke-width", baseWidth);
      path.setAttribute("stroke-linejoin", "round");
      if (dashed) path.setAttribute("stroke-dasharray", "5,4");
      path.setAttribute("marker-end", isCrit ? "url(#fc-arrow-crit)" : "url(#fc-arrow)");
      path.setAttribute("opacity", baseOpacity);
      path.dataset.from = fromId;
      path.dataset.to = toId;
      path.dataset.crit = isCrit ? "1" : "0";
      path.dataset.baseOpacity = baseOpacity;
      path.dataset.baseWidth = baseWidth;
      svg.appendChild(path);
    }

    let laneIndex = 0;
    for (const id of visibleIds) {
      const p = PREREQ[id];
      if (!p) continue;
      for (const src of (p.prereq || [])) if (boxes[src]) addLine(src, id, false, laneIndex++);
      for (const src of (p.adjoining || [])) if (boxes[src]) addLine(src, id, true, laneIndex++);
    }
  }

  // ---------- הדגשה בהעברת עכבר: מבודד את החצים של מקצוע אחד ----------
  function highlightCourse(id) {
    document.querySelectorAll("#fc-svg path[data-from]").forEach(p => {
      const related = p.dataset.from === id || p.dataset.to === id;
      p.setAttribute("opacity", related ? "1" : "0.06");
      p.setAttribute("stroke-width", related ? (p.dataset.crit === "1" ? "3" : "2") : p.dataset.baseWidth);
    });
  }
  function clearHighlight() {
    document.querySelectorAll("#fc-svg path[data-from]").forEach(p => {
      p.setAttribute("opacity", p.dataset.baseOpacity);
      p.setAttribute("stroke-width", p.dataset.baseWidth);
    });
  }
  function setupHoverHighlight() {
    document.getElementById("fc-page").addEventListener("mouseover", e => {
      const box = e.target.closest("[data-course-id]");
      if (box) highlightCourse(box.dataset.courseId);
    });
    document.getElementById("fc-page").addEventListener("mouseout", e => {
      const box = e.target.closest("[data-course-id]");
      if (!box) return;
      const to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest("[data-course-id]");
      if (!to) clearHighlight();
    });
  }

  // ---------- רינדור מלא ----------
  function render() {
    const semNumMap = computeSemNumMap();
    const crit = computeCriticalPath(semNumMap);
    criticalNodes = crit.nodes;
    criticalEdges = crit.edges;
    criticalSpan = crit.span;
    renderGrid();
    renderElectives();
    const note = $("#fc-crit-note");
    if (note) {
      note.textContent = criticalSpan
        ? "השרשרת המסומנת באדום: " + (criticalNodes.size) + " מקצועות, מרחק של " + criticalSpan + " סמסטרים בין הראשון לאחרון."
        : "";
    }
    // חצים מחושבים אחרי שהדפדפן סידר את הלייאאוט
    requestAnimationFrame(drawArrows);
  }

  // ---------- אתחול תפריטים ----------
  function initToolbar() {
    const ys = $("#fc-year");
    ys.innerHTML = "";
    for (const [key, label] of Object.entries(D.yearLabels)) {
      if (!D.tracks.management.years[key]) continue;
      const o = el("option", null, esc(label));
      o.value = key;
      ys.appendChild(o);
    }
    ys.value = yearKey;

    const refreshProjectOptions = () => {
      const yearData = D.tracks.management.years[yearKey];
      const ps = $("#fc-project");
      ps.innerHTML = "";
      const none = el("option", null, "עוד לא החלטתי");
      none.value = "";
      ps.appendChild(none);
      for (const key of yearData.projects.chooseOne) {
        const o = el("option", null, esc(D.tracks.management.projectOptions[key].label));
        o.value = key;
        ps.appendChild(o);
      }
      if ([...ps.options].some(o => o.value === projectKey)) ps.value = projectKey;
      else projectKey = "";
    };
    refreshProjectOptions();

    ys.addEventListener("change", () => { yearKey = ys.value; refreshProjectOptions(); saveState(); render(); });
    $("#fc-project").addEventListener("change", e => { projectKey = e.target.value; saveState(); render(); });
    $("#fc-reset").addEventListener("click", () => {
      if (!confirm("לאפס את כל המקצועות שנעוצו?")) return;
      pinned = {}; projectKey = ""; saveState(); render();
    });
  }

  document.addEventListener("change", e => {
    const sel = e.target.closest("[data-pin-select]");
    if (!sel) return;
    const id = sel.dataset.pinSelect;
    if (sel.value) pinned[id] = +sel.value; else delete pinned[id];
    saveState();
    render();
  });
  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-unpin]");
    if (!btn) return;
    delete pinned[btn.dataset.unpin];
    saveState();
    render();
  });

  window.addEventListener("resize", () => drawArrows());
  setupHoverHighlight();

  loadState();
  initToolbar();
  render();
})();
