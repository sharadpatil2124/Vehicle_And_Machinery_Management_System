# VMMS — Issue Tracker

This is the **control panel** for fixing the issues found by the full-project test run of **2026-10-24**: status, phases, priorities and results.

Full explanations live in **`ISSUE_DETAILS_AND_WORKFLOW.txt`**: cause, impact, advantages and disadvantages of each solution, side effects, and the step-by-step workflow (PART 2), the exact instruction phrases (PART 3), and every issue in detail (PART 5). Issue IDs are the same in both files and never change.

**Ground rules:**
- No code changes until an issue is explicitly assigned.
- One issue at a time; nothing unrelated is touched.
- Every fix is tested, then recorded here.

---

## 1. Current status

*Updated after every issue.*

| Item | Value |
|------|-------|
| Baseline test run (2026-10-24) | 203 tests · **144 pass · 59 fail** |
| Latest test run | Same as baseline (no fixes yet) |
| Issues closed | 0 of 29 (+ 3 decisions open) |
| Phase in progress | Not started — Step 0 pending |
| Next action | You: Step 0.1 (save current work in git). Then say **"Do T-1"**, and assign the first issue. |

## 2. Step 0 — before the first fix

| # | Task | Owner | Status |
|---|------|-------|--------|
| 0.1 | Save the current uncommitted work in git: 76 modified + 12 new files on `main`. Fixes then show up as separate, revertible changes. | You (or ask me: "Commit current work") | ☐ Open |
| 0.2 | **T-1:** copy the 203 tests from the temporary session folder into the project (`server/tests/`, Node's built-in runner, no new packages), so every fix is checked the same way | Me, after "Do T-1" | ☐ Open |
| 0.3 | Test database `vmms_unittest` (built from the repo migrations; your dev DB `vmms` is never used by tests) | Me | ☑ Ready |
| 0.4 | Answer the decisions in §6. Not all at once: only before the related issue. | You | ☐ Open |

## 3. Legends

| Status | Meaning |
|--------|---------|
| `Open` | Ready to be assigned |
| `Needs decision` | You must choose an option first (see §6) |
| `Planned` | Plan given, waiting for your go-ahead |
| `In progress` | Being fixed now |
| `Fixed – verified` | Fixed and all tests pass; waiting for your review |
| `Closed` | You accepted it |
| `Deferred` / `Won't fix` | Postponed / will not be changed (reason in the results log) |

| Severity | Meaning |
|----------|---------|
| Critical | Corrupts data or breaks core work under normal use |
| High | Wrong data, a broken endpoint, or a crash on input users can send |
| Medium | Wrong in specific situations, or security hardening |
| Low | Edge case, consistency, dead code |

| Effort | Meaning |
|--------|---------|
| S | One or two files, no migration |
| M | Several files, or a small client change |
| L | A migration plus several modules |

**Priority** is the order of work: the phase, then the position inside the phase. It accounts for severity, dependencies and effort.

## 4. Phases

| Phase | Goal | Issues, in the recommended order | Status | Done on |
|-------|------|----------------------------------|--------|---------|
| 1 | Quick, isolated fixes: remove crashes and dead code without changing business rules | 03 → 29 → 25 → 14 → 23 → 09a → 09b → 09c → 09d → 09e | Not started | — |
| 2 | Stock integrity. Order matters: 01 and 05 must come before 02. | 01 → 05 → 02 (+22) → 04 | Not started | — |
| 3 | Data-integrity guards | 08 → 07 → 16 → 10 → 15b → 18 → 19 → 20 → 21 → 28 | Not started | — |
| 4 | Session and client | 13 → 11 → 24 | Not started | — |
| 5 | Business-rule decisions | 06, 15a, 17, 26, 27, 12, D-01, D-02, D-03 | Not started | — |

## 5. Master issue list

*"Tests" = how many of the 59 baseline failures belong to the issue (§8).*

| ID | Issue | Severity | Phase · order | Reachable from the UI? | Effort | Depends on | Tests | Decision? | Status | Result |
|----|-------|----------|---------------|------------------------|--------|------------|-------|-----------|--------|--------|
| 01 | Receiving a purchase/transfer twice adds stock twice | Critical | 2 · 1 | Yes (2 users/tabs) | M | — | 1 (+1 to add) | — | Open | — |
| 02 | Simultaneous creates deadlock/fail (auto-numbering) | Critical | 2 · 3 | Yes | L | 01, 05 | 4 | Yes | Needs decision | — |
| 03 | 7 report endpoints always return 500 | High | 1 · 1 | No (API) | S | — | 3 | — | Open | — |
| 04 | Transfers exceed stock, get stuck, can't be cancelled | High | 2 · 4 | Yes | M | — | 2 | — | Open | — |
| 05 | Repeated lines over-reverse / double-adjust stock | High | 2 · 2 | Count: yes · Reversal: API | M | — | 2 | — | Open | — |
| 06 | Partial and excess purchase receipts | Medium | 5 | No (API) | S / L | — | 2 | Yes | Needs decision | — |
| 07 | Site/item/location still in use can be archived | High | 3 · 2 | Yes | M | 08 | 2 | Yes | Needs decision | — |
| 08 | Item unit / location site can change while holding stock | High | 3 · 1 | Yes | S | — | 2 | — | Open | — |
| 09 | Bad input crashes the server (500) — 5 sub-items | High | 1 · 6–10 | Partly | M | — | 14 | — | Open | — |
| 09a | · Text in id filters (`?siteId=abc`) | | 1 · 6 | API | S | — | 4 | — | Open | — |
| 09b | · Impossible dates (`2026-02-30`) | | 1 · 7 | API | S | — | 4 (+1 shared) | — | Open | — |
| 09c | · Numbers too large for the column | | 1 · 8 | Yes | S | — | 3 (+1 shared) | — | Open | — |
| 09d | · Invalid parts-issue date/time | | 1 · 9 | API | S | — | 1 | — | Open | — |
| 09e | · Upload file name > 255 characters | | 1 · 10 | Yes | S | — | 1 | — | Open | — |
| 10 | Tyre position and serial-number conflicts | Medium | 3 · 4 | Yes | S | — | 3 | — | Open | — |
| 11 | Login tokens valid after logout / password reset | Medium | 4 · 2 | Yes | M | — | 2 | Yes | Needs decision | — |
| 12 | Supervisors added at signup have no site | Low | 5 | Yes | S | — | 1 | Yes | Needs decision | — |
| 13 | Client keeps a supervisor's old site | Medium | 4 · 1 | Yes | S | — | 1 | — | Open | — |
| 14 | Non-English file names garbled | Medium | 1 · 4 | Yes | S | — | 1 | — | Open | — |
| 15a | Fuel fill below the vehicle odometer accepted | Medium | 5 | Yes | S | — | 1 | Yes | Needs decision | — |
| 15b | Moving a fuel entry's date wrongly rejected | Medium | 3 · 5 | Yes | S | — | 1 | — | Open | — |
| 16 | Archived assets editable / can receive parts | Medium | 3 · 3 | URL / API | S | — | 2 | — | Open | — |
| 17 | Registration numbers not normalised | Medium | 5 | Yes | M | — | 1 | Yes | Needs decision | — |
| 18 | Item edit can set max stock below min | Low | 3 · 6 | Yes | S | — | 1 | — | Open | — |
| 19 | Model year accepts fractions / far future | Low | 3 · 7 | Yes | S | — | 1 | — | Open | — |
| 20 | Purchase/count/transfer dates accept the future | Low | 3 · 8 | Yes | S | 09b | 1 | — | Open | — |
| 21 | Numeric validator accepts blanks and arrays | Low | 3 · 9 | API | S | — | 2 | — | Open | — |
| 22 | Reference numbers break after 999,999 | Low | 2 · 3 | — | via 02 | 02 | 1 | — | Open | — |
| 23 | IDs like `19abc` open record 19 | Low | 1 · 5 | API | S | — | 1 | — | Open | — |
| 24 | Uploads trust the declared file type | Low | 4 · 3 | Yes | S | — | 1 | — | Open | — |
| 25 | Machinery edit ignores compliance JSON string | Low | 1 · 3 | API | S | — | 1 | — | Open | — |
| 26 | Deleting completed preventive leaves schedule advanced | Low | 5 | Yes | S | — | 1 | Yes | Needs decision | — |
| 27 | No fuel stock correction; misleading message | Low | 5 | Yes | S / L | — | 1 | Yes | Needs decision | — |
| 28 | Simultaneous compliance saves return 409 | Low | 3 · 10 | Rare | S | — | 1 | — | Open | — |
| 29 | Dead client code calls 11 missing endpoints | Low | 1 · 2 | — | S | — | 1 | — | Open | — |
| D-01 | Registration/chassis unique across organizations | Decision | 5 | — | — | — | 1 | Yes | Needs decision | — |
| D-02 | Stock count can't add stock where the site has none | Decision | 5 | — | — | — | 0 | Yes | Needs decision | — |
| D-03 | Login and password reset share one rate limit | Decision | 5 | — | — | — | 0 | Yes | Needs decision | — |

## 6. Decisions log

| Ref | Question | Options (details in the .txt) | Recommended | Your answer | Date |
|-----|----------|-------------------------------|-------------|-------------|------|
| 02 | May reference numbers have gaps when a save fails? | A: counters, gaps allowed · B: gap-free counters · C: retry only | A | — | — |
| 06 | Do you need partial purchase receipts? | A: full receipt only (API matches UI) · B: partial receipts feature | A, unless needed | — | — |
| 07 | What blocks archiving a site? | Assets, supervisors, stock, fuel stock, tyre stock, open transfers/collections, open maintenance | All of them | — | — |
| 11 | Does "Log out" sign out all devices? | A: token version (all devices) · B: denylist (this device) · C: shorter tokens | A | — | — |
| 12 | Supervisors on the signup page? | a: remove section · b: keep · c: friendly waiting screen | a | — | — |
| 15a | Reject a fill below the odometer? | Today's entries only · all entries · never | Today's entries only | — | — |
| 17 | Store registrations as `MH12AB1234`? | Canonical stored · comparison key only · leave | Canonical stored | — | — |
| 26 | Completed preventive maintenance: delete? | a: block delete · b: roll back schedule | a | — | — |
| 27 | Fuel stock correction? | a: fix message now · b: build the feature | a now, b later | — | — |
| D-01 | Cross-organization uniqueness? | Keep · exclude archived · per organization (as the spec says) | Ask the client | — | — |
| D-02 | Allow counting stock into a site with none? | Allow · keep blocked | Allow | — | — |
| D-03 | Separate login and reset rate limits? | Separate · keep shared | Optional | — | — |

## 7. Testing phases

*Applied to every issue. Details in the .txt, PART 7.*

| Stage | What is checked | Pass criteria |
|-------|-----------------|---------------|
| T1 Issue tests | The baseline failing tests for this issue (§8), plus any new test written for it | All pass |
| T2 Full regression | All suites, on a freshly rebuilt test DB | Every test that passed before still passes. The fail count drops by exactly this issue's tests. |
| T3 Build & static | Client production build (if client code changed); controller/service wiring check | Build succeeds; 0 wiring problems |
| T4 Migration (if any) | Migration up, down, and up again on the test DB | All three succeed |
| T5 Manual check | Short click-through steps I give you, for issues reachable from the UI | You confirm |
| Sign-off | You review the change | "Accept ISSUE-xx" → `Closed` |

If T2 shows **any** new failure, the fix is not finished: I correct or revert it before reporting.

## 8. Baseline failures → issue map

*59 failing tests on 2026-10-24.*

| Suite | Failing test | Issue |
|-------|--------------|-------|
| 00 unit | requireNumber rejects whitespace-only strings | 21 |
| 00 unit | requireNumber rejects arrays | 21 |
| 00 unit | requireBusinessDate rejects 2026-02-30 | 09b |
| 00 unit | optionalDateFilter rejects 2025-04-31 | 09b |
| 00 unit | next code after 999999 | 22 |
| 01 auth | supervisors invited at signup get a usable site | 12 |
| 01 auth | /auth/me returns the supervisor site | 13 |
| 01 auth | token rejected after logout | 11 |
| 01 auth | password reset invalidates earlier sessions | 11 |
| 03 assets | archiving a site with assets/supervisor is blocked | 07 |
| 03 assets | out-of-range numbers → 400 | 09c |
| 03 assets | fractional / far-future year rejected | 19 |
| 03 assets | registrations differing only by spaces | 17 |
| 03 assets | archived vehicle keeps blocking its registration | D-01 |
| 03 assets | archived vehicles not editable | 16 |
| 03 assets | "1abc"-style ids don't alias | 23 |
| 03 assets | file name > 255 characters → 400 | 09e |
| 03 assets | declared MIME type is trusted | 24 |
| 03 assets | upload/replace with a non-English file name | 14 |
| 03 assets | machinery update accepts a compliance JSON string | 25 |
| 03 assets | compliance date 2026-02-30 → 400 | 09b |
| 04 inventory | partial update max below min | 18 |
| 04 inventory | base unit change with stock blocked | 08 |
| 04 inventory | archiving an item with stock blocked | 07 |
| 04 inventory | location with stock: move/archive blocked | 08 (archive part: 07) |
| 04 inventory | partial receipt remainder can be received | 06 |
| 04 inventory | receiving more than ordered rejected | 06 |
| 04 inventory | far-future purchase date rejected | 20 |
| 04 inventory | huge quantities → 400 | 09c |
| 04 inventory | invalid issueDateTime → 400 | 09d |
| 04 inventory | no parts to an archived asset | 16 |
| 04 inventory | same line twice in one reversal | 05 |
| 04 inventory | same item twice in one count | 05 |
| 04 inventory | transfer above stock rejected at dispatch | 04 |
| 04 inventory | stuck transfer can be cancelled | 04 |
| 04 inventory | non-numeric filters never 500 | 09a |
| 04 inventory | stock register / purchases by-supplier route | 03 |
| 05 fuel | absurd can counts → 400 | 09c |
| 05 fuel | fuel stock correction path exists | 27 |
| 05 fuel | fill far below the odometer rejected | 15a |
| 05 fuel | moving an entry to a later date allowed | 15b |
| 05 fuel | non-numeric query params never 500 | 09a |
| 05 fuel | site register / by-station route | 03 |
| 06 tyres | occupied position rejected | 10 |
| 06 tyres | same position twice in one request | 10 |
| 06 tyres | serial number on two vehicles | 10 |
| 06 tyres | non-numeric query params never 500 | 09a |
| 06 tyres | report sub-routes wired | 03 |
| 07 maintenance | deleting completed preventive rolls back schedule | 26 |
| 07 maintenance | bad query params never 500 | 09a |
| 08 fuzz | malformed body values never 500 | 09b + 09c (shared) |
| 08 fuzz | odd query values (`dateFrom=2026-02-30`) | 09b |
| 09 concurrency | 8 parallel vehicle creates | 02 |
| 09 concurrency | 8 parallel item creates | 02 |
| 09 concurrency | parallel issues of different items | 02 |
| 09 concurrency | transfer received 4× in parallel | 01 |
| 09 concurrency | parallel issues of the last units | 02 |
| 09 concurrency | parallel compliance saves | 28 |
| 10 client | no client call hits "Route not found" | 29 |

> Tests for "Needs decision" issues encode the recommended behavior. If you choose differently, I update that test to match your decision and note it in §9.

## 9. Results log

*One row per finished issue, newest at the bottom.*

| Date | Issue | What changed | Files changed | Tests after (pass / fail) | Result | Accepted |
|------|-------|--------------|---------------|---------------------------|--------|----------|
| — | — | — | — | — | — | — |

## 10. Supporting tasks

| ID | Task | Status |
|----|------|--------|
| T-1 | Copy the test suites into `server/tests/` and add a `npm test` script (the only `package.json` change). Needs your "Do T-1". | Open |
| T-2 | Rebuild `vmms_unittest` from migrations before each full regression run (≈15 s) | Process rule |

## 11. Tracker history

| Date | Change |
|------|--------|
| 2026-10-24 | Created from the test report |
| 2026-10-24 | Detailed explanations moved to `ISSUE_DETAILS_AND_WORKFLOW.txt`. Added the testing stages, the test → issue map and the results log. Issue 15 split into 15a/15b. 15b and 28 moved to Phase 3; 23 and 25 moved to Phase 1. |
