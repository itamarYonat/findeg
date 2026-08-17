# FinDeg — Platform Logic Reference

Context-handoff document, written to carry into a fresh chat. Covers what the
platform does, how the code is organized, and the non-obvious behaviors baked
into it from real user feedback. The codebase itself (comments, UI, course
data) is entirely in Hebrew; this document is in English for portability.

## What it is

A **fully static, client-side, no-backend** degree-progress and course-planning
tool for the Technion's Faculty of Civil and Environmental Engineering. Two
pages:

- **`index.html`** ("FinDeg") — upload a grade transcript (PDF), the tool
  parses it client-side (pdf.js), auto-detects track/catalog year, and shows
  what degree requirements are done vs. missing.
- **`flowcharts.html`** ("תרשימי זרימה") — three ways to plan remaining
  semesters: a fixed recommended flowchart, an automatic scheduling optimizer,
  and a drag-and-drop manual planner.

No server, no accounts, no analytics. Everything lives in the browser
(`localStorage`); the PDF is never uploaded anywhere. Repo:
`github.com/itamarYonat/findeg` (currently private).

Supported tracks (all with catalog years תשפ"ד/ה/ו = 2023–2025 start):
ניהול ובנייה (management), הנדסת מבנים (structures), הנדסה אזרחית
water/transport specializations (civil), הנדסת סביבה (environment),
הנדסת מיפוי (mapping).

## File map & load order

```
index.html            FinDeg main page
flowcharts.html        flowchart planning page
css/style.css          all styling, incl. dark mode
vendor/pdf.min.js      pdf.js (local, works offline)

js/data.js              degree-requirement database (courses, tracks×years, equivalences)
js/semesters.js         auto-generated: which seasons each course is actually offered
js/prereqs.js           auto-generated: flat prereq/adjoining graph (for drawing arrows)
js/prereq-overrides.js  hand-patches to js/prereqs.js (see below)
js/flowchart-data.js    hand-built "official recommended" semester-by-semester layout
js/nav-menu.js          fills the hover nav menu (track/spec × view-mode links)
js/parser.js            PDF transcript → structured course list
js/engine.js            compares parsed transcript against requirements
js/optimizer.js         auto-scheduling engine (EPS/LPS, elective filling, goals)
js/app.js               index.html UI controller
js/flowchart.js         flowcharts.html UI controller (all 3 views)

tools/fetch_course_semesters.py   regenerates js/semesters.js from public Technion data
tools/course_semesters.json       raw fetched data backing semesters.js
```

`index.html` loads: pdf.js → data.js → semesters.js → flowchart-data.js →
nav-menu.js → parser.js → engine.js → optimizer.js → app.js.
`flowcharts.html` loads: data.js → semesters.js → prereqs.js →
prereq-overrides.js → flowchart-data.js → nav-menu.js → engine.js →
optimizer.js → flowchart.js.
(Note: `index.html` does *not* load `prereqs.js`/`prereq-overrides.js` — those
only matter for drawing arrows in the flowchart UI, not for requirement
evaluation.)

Everything is attached to `window` as IIFE-returned namespaces:
`FINDEG_DATA`, `FINDEG_SEMESTERS`, `FINDEG_PREREQS`, `FINDEG_PREREQ_OVERRIDES`,
`FINDEG_FLOWCHART`, `FINDEG_PARSER`, `FINDEG_ENGINE`, `FINDEG_OPTIMIZER`.
No build step, no bundler — cache-busted via a manually-incremented `?v=N`
query string on every `<script>`/`<link>` tag in both HTML files (bump it
whenever you touch css/js).

## Data layer (`js/data.js`)

Returns: `{ courseNames, coursePoints, equivGroups, combos, coursePrereqs,
courseDifficulty, courseLastGrade, tracks, yearCatalogs, yearLabels,
registrarBranches, courseNamesEn }`.

- **Course IDs** are 8-digit zero-padded strings (transcript format), e.g.
  `"00140107"`.
- **`equivGroups`**: arrays of IDs treated as the same course (old/new catalog
  codes, e.g. חדו"א 1מ/1מ2). `FINDEG_ENGINE.equivSet(id)` returns the group.
- **`combos`**: "course A + course B together count as required course C"
  (e.g. חומרי בנייה + מבוא להנדסת חומרים = יסודות חומרי בנייה).
- **`coursePrereqs`**: OR-of-AND prereq structure — `[[a,b],[c]]` means
  "(a AND b) OR c". This is the *authoritative* prereq source for scheduling
  (optimizer.js), distinct from the flatter `js/prereqs.js` used only for
  drawing arrows.
- **`tracks[trackKey]`**: `{ name, supported, hasSpecialization, years: {
  [yearKey]: { sections, general, total, chains?, groupAPool?, projects? } },
  projectOptions?, projectChainMap? }`. Tracks with specializations (civil)
  nest an extra `specializations` level instead of `sections` directly.
- **Section types** (built with helper `C(ids, pts)` for mandatory rows):
  `"courses"` (mandatory list), `"chooseCourses"` (pick ≥N from a pool),
  `"choosePoints"` (accumulate ≥N points from a pool).
- **`registrarBranches`**: independent of degree requirements — tracks
  registration-with-the-engineers-registrar progress (ענפי רישום ברשם
  המהנדסים), built with helper `R(ids, label, note)`.

`js/semesters.js` / `js/prereqs.js` are **auto-generated** by
`tools/fetch_course_semesters.py` / a prereqs-fetch script from public
Technion data (SAP schedule feed + histograms); don't hand-edit them — edit
`prereq-overrides.js` instead for prereq-graph corrections, or add a comment
+ manual patch pattern like it for other generated files if needed.

`js/prereq-overrides.js` is a small hand-maintained patch layer (`remove`/`add`
arrays of `[fromId, toId]` pairs) applied at runtime on top of `prereqs.js`,
for cases where the officially-fetched prereq data doesn't match reality as
reported directly by students in the program (each entry has a dated
justification comment).

`js/flowchart-data.js` is the hand-built "here's the order everyone actually
takes courses in" skeleton per track, extracted from the faculty's own
official flowchart images + verified against `data.js`. Only covers mandatory
courses per semester slot (1–8); electives/generals show as separate "bubbles"
in the UI, not slotted here.

## `js/parser.js` — PDF transcript parsing

Pure client-side text extraction via pdf.js, then heuristic parsing. Notable
robustness handling (all learned from real transcript edge cases):

- **Bidi/reversed text**: some PDF text extractors return Hebrew
  character-reversed. `hasHeb()` checks both directions; `docOrientation` is
  guessed once globally from a season keyword, with per-line override.
- **English-language transcripts**: Technion supports exporting transcripts in
  English — parallel keyword/name-extraction paths (`hasKw`, `NAME_NOISE_WORDS_EN`,
  `courseNamesEn`) handle this. Numeric-column order differs by language
  (Hebrew: points-before-name; English: points-after, but numbers *inside* the
  course name like "Physics 1" can confuse it — last numeric token wins there).
- **Student name extraction**: looks for text adjacent to "ת.ז"/"ID:" labels,
  handling both normal and reversed word order.
- **Unknown course codes**: if an ID isn't in `courseNames`, tries matching by
  leading word or two-word signature of the transcript's own course name text
  (handles old/alternate catalog codes not yet added to `equivGroups`).
- **Repeatable courses**: PE courses (ID prefix `"039"`) can appear multiple
  times with separate credit; everything else keeps only the best attempt.
- Grouped-by-semester transcript formats (year+season header once per group,
  not per line) are handled via `curYear`/`curSeason` carry-forward state.

Output: `{ courses: [{id, pts, grade, status, year, season, name}],
track, startYear, catalogYear, declared, studentName, warnings }`.

## `js/engine.js` — requirement evaluation

Single entry point: `FINDEG_ENGINE.evaluate(parsed, trackKey, yearKey, options)`.
`options.overrides` is a map `id -> "done"|"planned"|"later"` (manual
overrides for exemptions/approved equivalences, or forward planning).

Computes, per section (mandatory list / choose-N-courses / choose-N-points),
what's done/missing/planned, then aggregates:

- **Projects** (management track): mandatory + chosen second-project, each
  auto-pulling its own prerequisite courses in via `chains`.
- **Chains** (קבוצה א' sub-groups: ניהול ובנייה/חומרים/מבנים/קרקע-דרכים/
  תחבורה): "ניהול ובנייה" chain is always visible; others only reveal once
  the student's chosen project implies them (via `track.projectChainMap`) —
  intentional, to avoid showing irrelevant "missing" requirements.
- **General buckets** (ספורט/מל"ג/בחירה חופשית): any passed course not
  consumed by a specific requirement gets auto-bucketed (PE by ID prefix
  `"039"`, else free-elective by default) or manually re-bucketed via
  `options.categories`. `options.manual` supports fully hand-entered courses
  (no catalog ID) for gaps the tool can't auto-detect.
- **Upcoming/planned points**: separate rollup of everything marked
  `"planned"` (not `"later"` — "later" is explicitly excluded from progress
  math, it's just a reminder).
- **Registrar branches**: independent evaluation for the separate
  professional-registration tracking (not part of degree points).

Returns a big result object consumed by both `app.js` (renders it) and
`optimizer.js` (`computePlan` takes this `res` object as its "what's still
missing" source of truth — it does not re-derive requirements itself).

## `js/app.js` — FinDeg main page controller

Orchestrates: PDF upload → `FINDEG_PARSER.parsePdf()` → track/year
auto-select → `FINDEG_ENGINE.evaluate()` → render results. Also owns manual
override UI (mark done/planned/later, re-bucket general courses, add
untracked manual courses).

**`localStorage` keys** (all app.js-owned unless noted):
| Key | Purpose |
|---|---|
| `findeg_last_parse` | last parsed transcript + track/year/spec/project selections, so refresh/revisit doesn't require re-upload |
| `findeg_overrides_<studentName>_<track>_<year>` | manual done/planned/later overrides, namespaced per transcript so different people's data on the same browser don't collide |
| `findeg_extras_<studentName>_<track>_<year>` | general-bucket category assignments + manually-added courses + secondary registrar branch choice |
| `findeg_flowchart_sync` | **write-only from app.js, read by flowchart.js** — live handoff: `{trackKey, yearKey, projectKey, specialization, passedIds, overrides, manual, studentName}`, rewritten on every render so flowcharts.html can auto-follow FinDeg's current state without any server round-trip |

## `js/flowchart.js` — flowchart planning UI (3 modes)

Single controller for all three tabs on `flowcharts.html`, switched via
`mode` (`"intended"` / `"optimizer"` / `"manual"`) — `renderCurrent()`
dispatches to the right render function and always also re-renders the shared
electives panel at the bottom (`renderElectives`, used by all 3 modes for
"which electives do I want" checkboxes/dropdown).

1. **המסלול המומלץ (intended)** — pure display of `FINDEG_FLOWCHART`'s
   hand-built layout, with electives synced in from `js/app.js`'s
   done/planned/later overrides (`computeSyncedElectives`) and prereq arrows
   drawn from `js/prereqs.js` + `prereq-overrides.js`. Only exists for tracks
   that have a `FINDEG_FLOWCHART` entry (management/structures/civil so far).

2. **תכנון אופטימלי (optimizer)** — calls `FINDEG_OPTIMIZER.computePlan()`
   to auto-schedule everything remaining across N semesters, per a chosen
   goal (recommended/semesters/points/frontload — see optimizer section
   below). Electives can be pinned/excluded via the shared panel; the
   algorithm places the rest. Courses can also be **dragged** between
   semester columns as a hard override (`hardPins`, absolute semester
   numbers, survives semester-number drift).

3. **תכנון ידני (manual)** — nothing is auto-placed. All remaining courses
   start in an unplaced "drawer" (`fcm-tray`); the student drags each one to
   whichever semester column they want (`manualPos`, id → relative semester
   index). `computePlan()` still runs underneath (frontload, capPts=0) purely
   to source the *universe* of remaining mandatory/elective IDs — its own
   suggested positions are discarded, only the id list matters.
   - Column count (`colCount`) = the plan's required minimum columns
     (`criticalPathSemesters`, or further out if a course was manually placed
     past it) **plus** `manualExtraCols`, an additive counter driven by the
     "+ הוסף סמסטר" / "− הסר סמסטר" toolbar buttons (fixed this session — see
     "Recent changes" below).
   - Courses synced from FinDeg as done/planned/"later" (בהמשך) get the same
     colored-border treatment in the tray as they do in the electives panel
     below and in the recommended flowchart (`fc-synced-done`/
     `fc-synced-planned`/`fc-later-elective` CSS classes) — added this
     session.

**State persistence**: `findeg_flowchart_state_<studentName>` (or `"unknown"`
before a transcript is synced — auto-migrated to the real name once known),
holding `{trackKey, yearKey, specKey, pinned, projectKey, optStartSeason,
optGoal, optCapPts, optFrontloadCapPts, manualPos, manualExtraCols, hardPins,
excluded}`. Read/written via `loadState()`/`saveState()`. Cross-tab live
sync: a `storage` event listener reloads state + re-syncs from FinDeg if
`findeg_flowchart_sync` changes in another tab.

Other notable pieces: `computeEPS`-adjacent `nextAvailableSemester`/
`eligibleSemesters` helpers for pinning dropdowns; `computeCompletedSemesters`
for the "fog" overlay on past semesters (real wall-clock date vs. catalog
start year, via `semesterStartDate`); barycenter-heuristic row reordering
(`reorderRowsForCrossings`) to reduce arrow crossings in the fixed flowchart
view; SVG arrow-drawing (`drawArrows`/`drawOptimizerArrows`/`drawManualArrows`).

## `js/optimizer.js` — auto-scheduling engine

Core idea (see file's own header comment, dated 2026-07-13): every remaining
mandatory course is first squeezed to its **EPS** (Earliest Possible
Semester — the earliest semester its prerequisites, OR-of-AND aware, are
satisfiable), which also defines `criticalPathSemesters` (max EPS among
remaining courses = the theoretical minimum program length). Two refinement
passes run on top of that baseline:

1. **Critical-path protection**: courses with zero slack (on the chain that
   determines `criticalPathSemesters`) that got pushed later by baseline/
   balancing get pulled back to their EPS.
2. **Point balancing**: courses with slack (`LPS - EPS > 0`) get moved within
   their `[EPS, LPS]` window toward whichever semester currently has fewer
   accumulated points — spreads load instead of always front-loading by EPS
   order alone.

One exception: a student who hasn't started at all (`doneIds` empty) and is
on a track with a hand-built "recommended order"
(`GREEDY_SKELETON`/`officialBaseline`, ~`flowchart-data.js`) starts from that
social/recommended order instead of raw EPS, so far as possible — "go with
what your friends are doing" — unless `frontload`/`taper` overrides it.

**Electives** don't get a "correct" position up front — `fillElectives`
places them into whatever "open slots" (still-unmet count/points pools)
remain each semester, weighing prereqs/offered-seasons/difficulty, which is
what keeps the overall problem tractable.

**Four planning goals** (`options.goal`, surfaced in the optimizer view's UI):
- `"recommended"` (default): front-loaded early (up to a *tapering* points
  cap that decreases from year 3 onward — `buildTaperCap`), eases up later —
  matches how most students actually plan.
  actually plan.
- `"semesters"`: minimize semester *count* first, no points cap — may cram a
  lot into one semester.
- `"points"`: flat adjustable points-per-semester cap, actively balances load
  across semesters even at the cost of more semesters (`optCapPts`).
- `"frontload"`: flat adjustable cap, but *no* balancing — cram every course
  into the earliest semester that fits under the cap, then move on
  (`optFrontloadCapPts`). Independent variable from `"points"`'s cap — user
  explicitly asked these not to interfere with each other (2026-07-21).

Also handles: FinDeg-synced done/planned/"later" electives (auto-merged into
`pinnedIds` so they always get scheduled, not just "eligible"); hard pins
(explicit drag in the optimizer view — absolute semester number, converted to
relative via `planAnchorSemester`); `MIN_OFFERING_YEAR` floor constraints for
courses that don't exist yet in older catalogs; nominal-semester tracking
(real wall-clock date vs. catalog start → "what semester are you nominally in
right now" + overdue-course flagging); capped-8-semester overflow handling and
"push the final project to the very last semester" special-casing
(`project-last`/`taper-split` note kinds — now suppressed from the UI, see
below, they were internal reasoning noise).

Single entry point: `FINDEG_OPTIMIZER.computePlan(res, parsed, options)` →
`{ plan, notes, mandatoryIds, electivePools, pointsById, criticalPathSemesters,
totalSemesters, nominalSemester, planAnchorSemester, overdueIds,
unplacedPools, generalNames, ... }`.

## Load-bearing invariants (don't casually change these)

Curated from the extensive dated Hebrew comments throughout the code — these
encode specific bugs that were found and fixed, so reverting them silently
reintroduces the bug:

- **`D().coursePrereqs`** (OR-of-AND) is the only correct source for
  scheduling math; `js/prereqs.js`/`FINDEG_PREREQS` (flat) is *display-only*
  for arrows and must never be used for EPS/LPS.
- **`equivSet()`** must be consulted anywhere an ID is looked up across
  modules (old/new catalog codes) — several past bugs were exactly "course
  scheduled under its old code, lookup used the new code, silently missed".
- **`capPts = 0`** is a valid, meaningful value ("no cap at all" for
  "minimum semesters" goal) — must never be replaced by `|| 20`, since `0` is
  falsy in JS and that exact bug reintroduced an unwanted cap.
- **`strict` mode in `computeEPS`**: elective candidates must use strict EPS
  (unverifiable prereq ⇒ `Infinity`, i.e. disqualified), while mandatory
  courses must NOT (some source data has minor prereq-graph errors that
  shouldn't fail the whole course) — the two must stay separate.
- **`planAnchorSemester`**, not raw `nominalSemester`, is the anchor for
  converting between relative (index 1 = "next semester") and absolute
  displayed semester numbers everywhere (hard pins, `MIN_OFFERING_YEAR`
  floors, taper cap, flowchart.js's `semOffset`) — mixing the two anchors was
  a recurring bug source.
- **"later" (בהמשך) electives** are deliberately never auto-placed anywhere
  in any view — only flagged with a yellow badge/border, exactly like FinDeg
  itself. Only "done"/"planned" get auto-placed.
- **`manualExtraCols`** in the manual planning view must be **additive** on
  top of the plan's required column count, not `Math.max`'d against it — see
  "Recent changes" below, this was broken until this session.
- Hebrew RTL + bidi PDF text extraction quirks in `parser.js` are extensively
  battle-tested against real transcripts (both Hebrew- and English-issued) —
  changes there need real transcript samples to validate, not just synthetic
  ones.

## `localStorage` key reference (all keys, both pages)

| Key pattern | Written by | Read by |
|---|---|---|
| `findeg_last_parse` | app.js | app.js |
| `findeg_overrides_<name>_<track>_<year>` | app.js | app.js |
| `findeg_extras_<name>_<track>_<year>` | app.js | app.js |
| `findeg_flowchart_sync` | app.js (every render) | flowchart.js |
| `findeg_flowchart_state_<name\|"unknown">` | flowchart.js | flowchart.js |

No cookies, no server, no analytics — this table is the entire persistence
surface of the app.

## Recent changes (this session)

1. **Manual-plan "+ הוסף סמסטר" was silently broken** — `colCount` was
   `Math.max(criticalPathSemesters, manualExtraCols)` instead of additive, so
   clicks did nothing until enough clicks made `manualExtraCols` exceed
   `criticalPathSemesters`. Fixed to `baseCols + manualExtraCols`
   ([flowchart.js](js/flowchart.js), `renderManualView`).
2. Added a **"− הסר סמסטר" (remove semester)** button, symmetric to add:
   blocked from going below the plan's required baseline, and blocked if the
   last (extra) column still has a manually-placed course in it.
3. **FinDeg-synced highlighting in the manual-plan drawer**: courses already
   marked done/planned/"later" in FinDeg now get the same colored border in
   the unplaced-courses tray as they already had in the recommended
   flowchart and the electives panel below.
4. **Suppressed internal scheduling-reasoning notes** (`project-last`/
   `taper-split` note kinds) from displaying under project boxes in the
   optimizer view — same category as `"general"` notes already suppressed
   per earlier feedback ("not relevant to the end user, just noise").
5. Committed and pushed a large batch of previously-uncommitted work (the
   entire flowchart/optimizer/manual-planning feature set, nav menu, etc.) —
   repo was 2 commits behind what was actually built locally.

## Deployment status

- GitHub repo `itamarYonat/findeg` is currently **private**, pushed up to
  date as of this session.
- Plan in progress: host via **Netlify** (chosen over GitHub Pages
  specifically to avoid making the repo public) connected to the private
  GitHub repo — no build command needed, publish directory is repo root.
  Not yet completed as of writing this document.
- `README.md`'s own "מבנה הקוד" section is stale (predates flowcharts.html/
  optimizer.js/flowchart.js entirely) — worth updating if picked back up.

## Known rough edges / things worth knowing before touching more code

- `tools/course_semesters.json` + `tools/fetch_course_semesters.py` re-scrape
  public (unauthenticated) Technion SAP/histogram data — re-running them
  updates `js/semesters.js`; there's a similar (not currently in this repo
  listing under `tools/`) prereqs-fetch script backing `js/prereqs.js` per
  its own header comment — locate it before assuming it doesn't exist.
  test-data/ (sample transcript — real personal data) is gitignored, verify
  it never gets committed.
- Several specialization/track sections in `flowchart-data.js` are
  self-flagged as medium/low confidence (hand-placed by pattern-matching
  against official images, not independently re-verified) — see inline
  comments on the `civil` track entries specifically before treating those
  semester placements as ground truth.
- No automated tests exist anywhere in the repo — verification has been
  entirely manual (browser interaction) each session.
