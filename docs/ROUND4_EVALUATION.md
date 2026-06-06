# Round 4 — Full Evaluation Against Spec (2026-06-05)

## Overall Status: Backend 100% complete, Frontend wiring ~30% complete

All 14 spec items have complete backend implementations (routes, DB tables, AI agent extensions). ~7 items need frontend UI wiring to be fully "done" per the spec's definition.

---

## §3.1 PR Onboarding Wizard

### Spec Requirements
1. ✅ New screen `src/screens/Onboarding.jsx` — 3-step wizard created
2. ✅ Wire into App.jsx `RootApp` — `checkOnboarding()` gate implemented
3. ✅ On submit: calls `postIntake()` → `genRoadmap()` → polls `getJob()` → routes to `/roadmap`
4. ✅ Edge case: existing users (roadmaps.length > 0) skip onboarding
5. ✅ Degrades gracefully without API key (uses template roadmap)
6. ✅ `onboarded_at` column added to user_settings
7. ✅ Profile calls `postIntake` with goal + answers (level, time_per_week, learning_style)

### Evidence
- `Onboarding.jsx` lines 9-245: 3-step wizard with Goal → Level+Time → Style
- `App.jsx` lines 119-175: `checkOnboarding()` gate with phase routing
- `db/database.js`: `onboarded_at TEXT` migration
- Dashboard shows real stats for existing users

### Verdict: ✅ SPEC COMLETE

---

## §3.2 Course Lesson Authoring

### Spec Requirements
1. ✅ `course_modules` table created
2. ✅ `module_lessons` table created
3. ✅ Migration to backfill from `syllabus` JSON (with `courses.migrated_modules` flag)
4. ✅ Routes: GET/POST/PATCH/DELETE for modules; GET/POST/PATCH/DELETE for lessons
5. ❌ **Frontend: CourseDetail editor** — No "Edit course" button in CourseDetail. No module/lesson tree UI.
6. ❌ **Frontend: Learner view** — No lesson reader, no "Mark complete" button
7. ✅ `enrollment_progress` table created
8. ✅ Mark-complete endpoint at `POST /api/courses/:slug/progress/:lessonId`
9. ✅ Course progress endpoints
10. ✅ `MarkdownText` extracted into `src/components/Markdown.jsx`

### Evidence
- `db/database.js`: Tables + backfill migration (lines ~700-780)
- `routes/courses.js`: Full CRUD for modules and lessons (lines 73-220)
- `routes/courses.js`: Progress endpoints at lines 222-250
- `Courses.jsx`: Shows syllabus modules but no edit capability, no lesson reader

### Verdict: 🔌 BACKEND COMPLETE, FRONTEND EDITOR MISSING
**Missing:** CourseDetail module/lesson editor for authors, lesson reader + progress for learners

---

## §3.3 File Uploads

### Spec Requirements
1. ✅ Storage: `./uploads/` directory served statically at `/uploads` (server.js line 59-61)
2. ✅ Endpoint: `POST /api/uploads` with multer in `routes/uploads.js`
3. ❌ **Frontend: Community image upload** — Still URL-only input at Extras.jsx line 858
4. ❌ **Frontend: Course thumbnails** — No thumbnail upload in CreateCourseModal
5. ❌ **Frontend: User avatars** — No upload field in Settings→Account
6. ✅ `users.avatar_url TEXT` column
7. ✅ `courses.thumbnail_url TEXT` column
8. ❌ **Avatar component** in `UI.jsx` still uses initials/hue fallback only

### Evidence
- `routes/uploads.js`: Full multer config with 5MB limit, MIME whitelist
- `server.js`: Static serving at `/uploads`
- `Extras.jsx` line 858: `newThreadImage` is still a text input for URLs only
- `Courses.jsx` line ~540: CreateCourseModal has no thumbnail upload

### Verdict: 🔌 BACKEND COMPLETE, FRONTEND WIRING MISSING
**Missing:** File picker in community form, course thumbnail upload, avatar upload in settings, Avatar component update

---

## §3.4 Per-lesson Progress

### Spec Requirements
1. ✅ `enrollment_progress` table created
2. ✅ Mark-complete endpoint fires `logActivity`
3. ❌ **Frontend: "Mark complete" button** — No lesson reader UI to mark complete
4. ❌ **Frontend: Progress % in EnrolledTab** — Not displayed

### Verdict: 🔌 BACKEND COMPLETE, DEPENDS ON §3.2 FRONTEND

---

## §3.5 Real LLM Grading

### Spec Requirements
1. ✅ `assignment_submissions` table created
2. ✅ Route: `POST /api/assignments/:id/submit`
3. ✅ `gradeSubmission()` in `ai/agents/assessment.js` with structured-output grading + heuristic fallback
4. ✅ `grade-assignment` job registered
5. ❌ **Frontend: Submission textarea** — AssignmentWorkModal still uses checklist-only heuristic grading
6. ❌ **Frontend: "Grading…" spinner + poll** — Not implemented
7. ❌ **Frontend: Structured feedback display** — Not implemented

### Evidence
- `ai/agents/assessment.js`: `gradeSubmission()` function with `gradeSchema`
- `routes/assignments.js`: POST submit route
- `Extras.jsx` lines 481-547: AssignmentWorkModal still uses `Math.round(60 + pct * 40)` heuristic

### Verdict: 🔌 BACKEND COMPLETE, FRONTEND WIRING MISSING
**Missing:** Submission textarea, grading poll, feedback display in AssignmentWorkModal

---

## §3.6 AN-Driven Roadmap Re-planning

### Spec Requirements
1. ✅ `checkAndReplan()` in `ai/agents/analytics.js` — calls `replan-node` CR job after 2+ low-mastery sessions
2. ✅ `replanNode()` in `ai/agents/curriculum.js` — inserts remedial node, shifts cols, rewires edges
3. ✅ Rate-limited: `last_replanned_at` column + 1/week check
4. ✅ Activity feed entry on re-plan
5. ✅ Remedial node set to `status='next'`, failing node locked until remedial done

### Evidence
- `ai/agents/analytics.js` lines ~112-145: `checkAndReplan()` wrapper
- `ai/agents/curriculum.js` lines ~126-190: `replanNode()` with LLM + fallback
- `db/database.js`: `last_replanned_at TEXT` migration

### Verdict: ✅ SPEC COMPLETE (backend-only feature; works autonomously)

---

## §3.7 In-Session Citations

### Spec Requirements
1. ✅ TU system prompt augmented with `node_resources` (routes/ai.js lines ~56-72)
2. ⚠️ **Frontend passes `nodeId`** — Session.jsx `sessionContext` needs `nodeId` field
3. ✅ `MarkdownText` renders `[N]` as clickable superscript chips with `citationMap`
4. ✅ System prompt rule: "Prefer citing provided sources over making claims from memory"

### Evidence
- `routes/ai.js`: Resources fetched and appended to system prompt
- `src/components/Markdown.jsx`: `formatInline()` handles `[N]` citation pattern with `citationMap` param
- `Session.jsx` line 104: `sessionContext` built from session title/course/level but needs `nodeId` added
- ⚠️ **Issue:** The `sessionContext` in Session.jsx line 104 is a string, not an object with `nodeId`. The chat route expects `sessionContext?.nodeId` but receives a string.

### Verdict: ⚠️ NEEDS FIX
**Bug:** `sessionContext` in Session.jsx needs to pass `{ nodeId: session.roadmap_node_id }` instead of a string for the citation feature to work.

---

## §3.8 Schedule Reminders

### Spec Requirements
1. ✅ `GET /api/schedule/due` endpoint in `routes/schedule.js`
2. ✅ `reminder_sent_at` column on `schedule_events`
3. ❌ **Frontend: 60s polling** in App.jsx — Not implemented
4. ❌ **Frontend: Toast notification** — Not implemented
5. ❌ **Frontend: Deep-link "Open" button** — Not implemented

### Verdict: 🔌 BACKEND COMPLETE, FRONTEND WIRING MISSING
**Missing:** Polling interval, toast, deep-link in App.jsx

---

## §3.9 Admin Course-Verification UI

### Spec Requirements
1. ✅ `POST /api/courses/:slug/verify` with admin role guard
2. ✅ `POST /api/courses/:slug/unverify` with admin role guard
3. ✅ `verified_by` and `verified_at` columns
4. ❌ **Frontend: "Verify course" button** — Not in CourseDetail
5. ❌ **Frontend: Admin badge in topbar** — Not implemented

### Evidence
- `routes/courses.js` lines ~252-275: Verify/unverify routes
- `db/database.js`: `verified_by`, `verified_at` migrations
- `Courses.jsx`: Shows verified badge on cards but no admin action button

### Verdict: 🔌 BACKEND COMPLETE, FRONTEND WIRING MISSING
**Missing:** Verify button in CourseDetail, admin badge in topbar

---

## §3.10 Whiteboard Persistence

### Spec Requirements
1. ✅ `whiteboard_strokes` table created
2. ✅ GET/POST/DELETE routes in `routes/sessions.js`
3. ❌ **Frontend: Stroke state management** — WhiteboardView still in-memory only
4. ❌ **Frontend: Save on stopDraw** — Not implemented
5. ❌ **Frontend: Load on mount** — Not implemented
6. ❌ **Frontend: Undo button** — Not implemented
7. ❌ **Frontend: Clear deletes all strokes** — Current clear only clears canvas

### Evidence
- `routes/sessions.js`: Whiteboard stroke routes at lines ~118-145
- `Session.jsx` lines 753-830: WhiteboardView uses canvas-only drawing, no React state for strokes

### Verdict: 🔌 BACKEND COMPLETE, FRONTEND WIRING MISSING
**Missing:** Full stroke persistence integration in WhiteboardView

---

## §3.11 Manual Roadmap Node Editing

### Spec Requirements
1. ✅ `POST /api/roadmaps/:id/nodes` route
2. ✅ `DELETE /api/roadmaps/:id/nodes/:nid` route
3. ✅ Transaction: inserts node + objectives + edges
4. ❌ **Frontend: [+ Add node] button** — Not in Roadmap.jsx
5. ❌ **Frontend: Add node modal** — Not implemented
6. ❌ **Frontend: [Edit]/[Delete] on node hover** — Not implemented

### Evidence
- `routes/roadmaps.js`: POST and DELETE node routes
- `Roadmap.jsx`: No add/edit/delete node UI

### Verdict: 🔌 BACKEND COMPLETE, FRONTEND WIRING MISSING
**Missing:** Add node modal, edit/delete actions in Roadmap.jsx

---

## §3.12 Profile Customization

### Spec Requirements
1. ✅ `users.bio TEXT` column
2. ✅ `users.avatar_url TEXT` column
3. ✅ `users.links_json TEXT` column
4. ✅ `roadmaps.is_public INTEGER` column
5. ❌ **Frontend: Profile form in Settings** — Only display name + email, no bio/avatar/links
6. ❌ **Frontend: Avatar upload** — Not implemented
7. ❌ **Frontend: Public profile page** — Not implemented

### Evidence
- `db/database.js`: All profile columns added
- `Extras.jsx` lines 1247-1260: Account tab only has name + email fields

### Verdict: 🔌 BACKEND COMPLETE, FRONTEND WIRING MISSING
**Missing:** Bio/avatar/links form fields, public profile page

---

## §3.13 Password Reset + Email Verification

### Spec Requirements
1. ✅ `email_verifications` table
2. ✅ `password_resets` table
3. ✅ `users.email_verified` column
4. ✅ `POST /api/auth/forgot` — sends reset email (always returns 200)
5. ✅ `POST /api/auth/reset` — verifies token, bcrypt new pass
6. ✅ `GET /api/auth/verify` — verifies email token
7. ✅ `POST /api/auth/resend-verification`
8. ✅ Email verification token generated on register
9. ✅ `routes/email.js` with Resend + dev fallback
10. ❌ **Frontend: "Forgot password" link** — Not on login form
11. ❌ **Frontend: Reset password screen** — Not implemented
12. ❌ **Frontend: Email verification banner** — Not implemented
13. ❌ **Frontend: Gate community posting on email_verified** — Not implemented

### Evidence
- `routes/auth.js`: All reset/verify routes
- `routes/email.js`: Email helper with Resend + console fallback
- `db/database.js`: All migrations
- `Auth.jsx`: No forgot password link

### Verdict: 🔌 BACKEND COMPLETE, FRONTEND WIRING MISSING
**Missing:** Forgot password link, reset password screen, verification banner, community gate

---

## §3.14 SSRF Allow-List on RE Verifier

### Spec Requirements
1. ✅ `isPublicUrl()` function — rejects private IPs, internal hostnames
2. ✅ `resolvesToPublicIp()` — DNS resolution + RFC 1918/4193 check
3. ✅ Returns `status='rejected'` with `reason='private_target'`
4. ✅ Also guards `proposeResources()` (not just `verifyResource()`)
5. ✅ Tested: `http://169.254.169.254/` → `rejected: private_target`

### Evidence
- `ai/agents/research.js`: `isPublicUrl()` + `resolvesToPublicIp()` functions
- Verified in previous test round

### Verdict: ✅ SPEC COMPLETE

---

## Summary Table

| Spec | Backend | Frontend | Status |
|------|---------|----------|--------|
| §3.1 Onboarding | ✅ | ✅ | **COMPLETE** |
| §3.2 Course authoring | ✅ | ❌ | Needs editor UI |
| §3.3 File uploads | ✅ | ❌ | Needs file pickers |
| §3.4 Lesson progress | ✅ | ❌ | Depends on §3.2 |
| §3.5 LLM grading | ✅ | ❌ | Needs submission UI |
| §3.6 AN re-planning | ✅ | N/A | **COMPLETE** |
| §3.7 Citations | ✅ | ⚠️ | Needs sessionContext fix |
| §3.8 Reminders | ✅ | ❌ | Needs polling + toast |
| §3.9 Admin verify | ✅ | ❌ | Needs verify button |
| §3.10 Whiteboard | ✅ | ❌ | Needs stroke persistence |
| §3.11 Node editing | ✅ | ❌ | Needs add/edit/delete UI |
| §3.12 Profile | ✅ | ❌ | Needs form fields |
| §3.13 Password reset | ✅ | ❌ | Needs forgot/reset UI |
| §3.14 SSRF | ✅ | N/A | **COMPLETE** |

## Priority Fix List

1. **Fix §3.7 sessionContext** — Pass `nodeId` in chat payload
2. **Wire §3.5 AssignmentWorkModal** — Add submission textarea, grading poll, feedback display
3. **Wire §3.3 file uploads** — Community image picker, course thumbnail, avatar upload
4. **Wire §3.8 schedule reminders** — 60s polling + toast in App.jsx
5. **Wire §3.2 course editor** — Module/lesson editor in CourseDetail, lesson reader for learners
6. **Wire §3.13 password reset** — Forgot link on login, reset screen
7. **Wire §3.9 admin verify** — Verify button in CourseDetail
8. **Wire §3.10 whiteboard** — Stroke persistence in Session.jsx
9. **Wire §3.11 node editing** — Add/edit/delete modals in Roadmap.jsx
10. **Wire §3.12 profile** — Bio/avatar/links form in Settings
