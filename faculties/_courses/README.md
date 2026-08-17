# Shared course data (`faculties/_courses/`)

This folder is where **course data** (name, points, prerequisites, offered
seasons) lives when it's shared by more than one track or faculty — most
commonly a joint/dual-degree track that spans two faculties (e.g. "הנדסת
מחשבים" is taught jointly by Electrical & Computer Engineering and by
Computer Science; see `faculties/electrical-computer/tracks/computer-eng-joint-cs/`
and `faculties/computer-science/tracks/computer-eng-joint-electrical/`).

The split is: **course identity vs. degree requirements.**

- A course's own data (its name, points, prerequisites, which semesters it's
  offered) is a fact about the course, independent of who requires it.
- A track's *requirements* (which courses are mandatory, which are electives,
  how many points of what) are specific to one degree path.

Two tracks can require overlapping courses without that course ever being
defined twice — the track's `requirements.js` just references course IDs
that live here, instead of embedding its own copy of the course's name/points/
prereqs.

## Folder key: department code

Every Technion course ID is 8 digits. The **department code** — which unit
actually teaches/owns the course — is digits 2-4 (1-indexed), e.g.:

```
00140107  →  department code "014"  (Civil & Environmental Engineering)
00160512  →  department code "016"  (a materials-related sub-unit, cross-listed
                                       into Civil's own elective pools even
                                       though Civil itself is "014")
```

This is the *real* partition already used by the catalog itself — not an
invented subject-area label — so folders here should be named by department
code once populated: `faculties/_courses/014/`, `faculties/_courses/016/`,
etc., each holding that department's `courseNames`/`coursePoints`/
`coursePrereqs`/season data in the same shape `engine.js`/`optimizer.js`
already expect from `FINDEG_DATA` (see `faculties/civil/data.js` for the
exact shape — nothing about `engine.js`/`optimizer.js` needs to change to
consume data from here instead of a single per-faculty file).

**No department-code folders exist yet.** Civil's own course data still lives
entirely inside `faculties/civil/data.js` (left as-is, not migrated — it
already works). This folder is scaffolding for the *new* faculties: as real
course data gets exported from the catalog, put it here keyed by department
code, and have each track's `requirements.js` (in `faculties/<faculty>/tracks/<track>/`)
reference the course IDs it needs rather than redefining them. A faculty's
own `data.js` is responsible for merging whichever `_courses/<code>/` pools
its tracks actually use (see the comment in any generated `data.js` for the
exact merge point).

## Not shared here: מל"ג / בחירה חופשית / ספורט

These are **not** course pools and don't belong here. The catalog itself
states the מל"ג (enrichment) course list "changes and is published every
semester" (it's a national Council-for-Higher-Education list, not part of
the annual catalog), and "בחירה חופשית" is explicitly defined as *any*
course from *any* faculty. Both are already handled generically, for every
faculty, by `engine.js`'s point-total buckets (`general.pe`/`general.enrichment`/
`general.free`) plus the "add a course manually" mechanism in `app.js` — no
faculty-specific code exists or is needed for these today. The only thing
worth sharing is the *typical point values* (pe=2, enrichment=6, seen
repeated across every faculty section checked so far) — worth a small shared
constants file once several real faculties are filled in, not urgent now.
