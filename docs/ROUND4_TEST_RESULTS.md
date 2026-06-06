# Round 4 Test Results — 2026-06-05

## Baseline: ✅ ALL PASSING
- `npm install` → clean
- `npm run build` → 0 errors
- `node server.js` → starts (known duplicate column warnings only)
- Login → returns token
- Dashboard stats → real data
- Roadmaps → real data with nodes
- Sessions → real data
- Assignments → real data
- Schedule → real data (reminder_sent_at column present)
- Courses → real data (verified, rating, etc.)
- Community threads → real data

## New Features: Issues Found

### CRITICAL — Route Mounting Order in server.js
**Problem:** `app.use('/api/courses', courseRoutes)` at line 67 is BEFORE `app.use('/api', requireAuth)` at line 70.
**Effect:** ALL routes in courses.js that need `req.userId` fail (modules, lessons, progress, verification).
**Fix:** Move `app.use('/api/courses', courseRoutes)` to after line 70, alongside other protected routes. The original `GET /` (course browse) in courses.js doesn't use requireAuth, and `GET /:slug` uses it but will now work correctly after the auth middleware runs.

### §3.1 PR Onboarding Wizard
- **Backend:** ✅ `onboarded_at` column exists in user_settings
- **Frontend:** ✅ `Onboarding.jsx` created and wired into `App.jsx`
- **Test needed:** Register new account → verify onboarding appears → submit → verify roadmap generates
- **Risk:** `checkOnboarding()` in App.jsx calls `API.getRoadmaps()` and `API.getUserSettings()` — both should work for new users (empty roadmaps, no settings row yet). The `getUserSettings` route in users.js should handle missing rows gracefully.

### §3.2 Course Modules/Lessons
- **Backend:** Routes created in courses.js, tables created via migration
- **Issue:** Route mounting order blocks all module/lesson endpoints (see CRITICAL above)
- **After fix:** Test `GET /api/courses/ml-foundations/modules` → should return any backfilled modules
- **Syllabus backfill:** Migration runs but needs verification

### §3.3 File Uploads
- **Backend:** ✅ `POST /api/uploads` created with multer, mounted after `requireAuth`
- **Issue:** Uploads route at `/api/uploads` IS after auth (line 73) — should work
- **Test:** `curl -X POST -H "Authorization: Bearer $TOKEN" -F "file=@test.png" /api/uploads`
- **Frontend:** Not yet wired (file pickers needed in Community, Settings, CreateCourseModal)

### §3.5 LLM Grading
- **Backend:** ✅ `assignment_submissions` table, `gradeSubmission()` function, `POST /api/assignments/:id/submit`
- **Issue:** Assignment routes mounted at `/api/assignments` which IS after auth — should work
- **Test:** `POST /api/assignments/a5/submit {"body_md":"test"}` → should return submission row
- **Frontend:** Not yet wired (submission textarea not in AssignmentWorkModal)

### §3.6 AN Re-planning
- **Backend:** ✅ `checkAndReplan()` in analytics.js, `replanNode()` in curriculum.js, `last_replanned_at` column
- **Test:** Needs 2+ completed sessions on same node with low mastery, then complete another session → verify remedial node inserted

### §3.7 In-Session Citations
- **Backend:** ✅ Chat route augmented with node_resources
- **Frontend:** ✅ MarkdownText component with citation support (`[N]` → clickable superscript)
- **Test:** Open session on a node with verified resources, ask a question, verify `[N]` citations appear

### §3.8 Schedule Reminders
- **Backend:** ✅ `GET /api/schedule/due` endpoint, `reminder_sent_at` column
- **Issue:** Schedule routes mounted after auth → should work after server.js fix
- **Frontend:** Not yet wired (needs 60s polling in App.jsx)

### §3.9 Admin Course Verification
- **Backend:** ✅ `POST /api/courses/:slug/verify` and `/unverify` with admin role guard
- **Test:** Non-admin gets 403, admin gets success
- **Frontend:** Not yet wired (verify button conditional on user.role === 'admin')

### §3.10 Whiteboard Persistence
- **Backend:** ✅ `whiteboard_strokes` table, GET/POST/DELETE routes in sessions.js
- **Frontend:** Not yet wired (strokes still in-memory only in WhiteboardView)

### §3.11 Manual Roadmap Node Editing
- **Backend:** ✅ `POST /api/roadmaps/:id/nodes` and `DELETE` routes
- **Frontend:** Not yet wired (needs add/edit/delete modals)

### §3.12 Profile Customization
- **Backend:** ✅ `users.bio`, `users.avatar_url`, `users.links_json` columns
- **Frontend:** Not yet wired (profile form needed in Settings)

### §3.13 Password Reset + Email
- **Backend:** ✅ `email_verifications`, `password_resets` tables; `forgot`/`reset`/`verify` routes
- **Issue:** `/api/auth/forgot` returned "Missing token" — needs investigation after server.js fix
- **Register:** Verification token generation added to register route
- **Frontend:** Not yet wired (forgot password link, reset password form)

### §3.14 SSRF Protection
- **Backend:** ✅ `isPublicUrl()` + `resolvesToPublicIp()` in research.js
- **Issue:** Test resource seeding failed (node not found via API) — needs re-test after server.js fix
- **Expected behavior:** Seeding `http://169.254.169.254/` and running verifier → `status='rejected'`

## Priority Fix List for Next Agent

1. **Fix server.js route mounting** — Move `app.use('/api/courses', courseRoutes)` after `app.use('/api', requireAuth)` (around line 107, before `/api/schedule`)
2. **Re-test all new endpoints** after fix
3. **Wire frontend for §3.3** — file upload in Community thread form, course thumbnails, user avatar
4. **Wire frontend for §3.8** — 60s polling in App.jsx for schedule reminders
5. **Wire frontend for §3.13** — forgot password link on login form, reset password screen
6. **Wire frontend for §3.2** — CourseDetail module/lesson editor for authors, lesson reader + progress for learners
7. **Wire frontend for §3.5** — submission textarea in AssignmentWorkModal, grading poll + feedback display
8. **Wire frontend for §3.9** — verify button for admin users
9. **Wire frontend for §3.10** — whiteboard stroke persistence in Session.jsx
10. **Wire frontend for §3.11** — add/edit/delete node modals in Roadmap.jsx
11. **Wire frontend for §3.12** — profile form in Settings, Avatar component update

## Files Not Yet Fully Verified
- `routes/uploads.js` — needs multer test
- `routes/email.js` — needs Resend/dev test
- `ai/agents/assessment.js` gradeSubmission() — needs job test
- `ai/agents/curriculum.js` replanNode() — needs integration test
- `ai/agents/research.js` SSRF check — needs verifier test
