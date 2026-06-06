# ⚠️ ARCHIVED — superseded by docs/SPEC.md

This audit was the source of truth prior to 2026-06-05. It is kept for historical
reference only. For current product intent, see ../SPEC.md. For build status, see
../STATUS.md. For remaining work, see ../BACKLOG.md.

---

# LearnOS — Complete Product Audit

## What Is LearnOS?

LearnOS is an AI-powered learning management system. Think of it as a personal AI tutor platform where students learn through interactive sessions with specialized AI agents, track progress through roadmaps, complete assignments, review flashcards, earn certificates, and engage with a community of learners.

The product has a React frontend (Vite) + Express/SQLite backend with JWT auth. ~6,159 lines of source code across 16 files.

---

## Database Schema (16 tables)

### Core Identity
- **users** — id, name, email, password_hash, role, avatar_hue, level, xp, xp_to_next, streak, best_streak, plan
- **revoked_tokens** — jti, expires_at (for JWT logout)
- **user_settings** — user_id, theme, density, font_size, local_only

### Learning Content
- **roadmaps** — id, user_id, title, subtitle, authored_by, mastery, total_modules, completed_modules, status, color, icon, next_module, modules_left
- **roadmap_nodes** — id, roadmap_id, title, col, row_idx, mastery, status (done/active/next/locked)
- **roadmap_edges** — roadmap_id, from_node, to_node (DAG edges between nodes)
- **courses** — slug, title, blurb, author, verified, rating, stars, forks, hours, version, tags
- **enrollments** — user_id, course_slug, progress, status

### Learning Activity
- **sessions** — id, user_id, roadmap_id, roadmap_node_id, title, subtitle, agent, course, level, session_index, total_sessions, duration_seconds, status, mastery_score
- **session_messages** — id, session_id, role, agent_code, body, kind, user_rating
- **assignments** — id, user_id, title, course, status, progress, grade, priority, estimated_minutes, due_date
- **flashcards** — id, user_id, deck, front, back, interval_days, ease_factor, reps, next_review
- **flashcard_reviews** — id, card_id, grade, ease_factor, interval_days

### Social & Gamification
- **certificates** — id, user_id, title, mastery, color, id_short, issued_at
- **badges** — id, user_id, label, glyph, earned_at
- **activity_log** — id, user_id, kind, text, sub, xp, agent
- **starred_items** — user_id, item_type, item_id

### Scheduling & Agents
- **schedule_events** — id, user_id, title, event_type, agent, day_of_week, start_hour, duration_hours
- **agent_status** — agent_code, display_name, short_desc, color, icon, status_text, is_active
- **agent_routing** — user_id, agent_code, model
- **api_keys** — id, user_id, provider, encrypted_key, model, is_active

### Relationships
- users → roadmaps (1:N), sessions (1:N), assignments (1:N), flashcards (1:N), certificates (1:N), badges (1:N), activity_log (1:N), schedule_events (1:N), starred_items (1:N), enrollments (1:N)
- roadmaps → roadmap_nodes (1:N), roadmap_edges (1:N)
- sessions → session_messages (1:N)
- flashcards → flashcard_reviews (1:N)
- courses → enrollments (1:N)

---

## Feature Map (17 features across 6 screens + global)

### 1. AUTHENTICATION
**Files:** Auth.jsx, routes/auth.js, middleware/auth.js
**DB:** users, revoked_tokens
**Flow:** Login form → POST /api/auth/login → JWT stored in localStorage → subsequent requests use Bearer token
**Status:** ✅ Fully working. Login, register, token refresh on app load, logout clears token.

### 2. DASHBOARD
**Files:** Dashboard.jsx
**Data:** getStats(), getRoadmaps(), getSessions(), getActivity()
**Sections:**
- Welcome header with streak card
- Stats row: streak, mastery score, sessions count, pending assignments (all from API)
- Roadmaps: active roadmaps with progress bars, levels, next module (from API)
- Upcoming sessions: recent sessions list (from API)
- Recent activity: activity feed (from API), empty state when none
- Learning progress: weekly chart (hardcoded data for chart shape)
- Quick actions: start session, open roadmaps, browse courses, review flashcards
- Agent activity strip: 5 agents with status from DB
**Status:** ✅ Data loads from API. Roadmap cards navigate to Roadmap. Session cards navigate to Session. Quick actions navigate. "View Progress" opens popup modal.

### 3. SESSIONS (AI Tutor Chat)
**Files:** Session.jsx, routes/sessions.js
**DB:** sessions, session_messages, api_keys (for actual AI calls)
**Flow:**
- On mount: loads most recent session from DB or creates new one
- Messages saved to session_messages table
- User sends message → saved to DB → agent generates contextual reply based on keywords
- Supports: text replies, quiz cards, visualization triggers, source citations
- Session can be ended (status → completed) or restarted
- Export transcript downloads .txt file
**Right Rail:** Session outline, concepts covered, homework, mastery signals, export
**Visualizer Panel:** Model complexity chart, code view, interactive whiteboard
**Status:** ✅ Messages persist to DB. Quiz cards work. Rating (like/dislike) saves to API. Whiteboard works. Export works.

### 4. ROADMAPS
**Files:** Roadmap.jsx, routes/roadmaps.js
**DB:** roadmaps, roadmap_nodes, roadmap_edges
**Views:** Graph (SVG node diagram), List (table), Kanban (3-column board)
**Flow:** Loads first active roadmap with nodes/edges → renders interactive graph → click node to select → shows detail panel with mastery ring
**Actions:** Fork (creates copy in DB), Resume/Start (navigates to session), Locked info
**Status:** ✅ Graph renders from DB data. Node selection works. Fork calls API. Three view modes work.

### 5. COURSES
**Files:** Courses.jsx, routes/courses.js
**DB:** courses, enrollments, starred_items
**Flow:** Load courses + starred items → display grid → search filters → click card opens detail view → enroll/unenroll toggles state
**Detail View:** Cover viz, syllabus (5 fixed modules), version history, enrollment status, star/unstar
**Sidebar:** Fork banner, featured courses, version/forking history, top contributors
**Status:** ✅ Browse, search, star, enroll all work. Syllabus items open module modal. Featured courses show detail modal with real enroll. Top contributors open profile modal. Star persists to DB.

### 6. SCHEDULE
**Files:** Extras.jsx (Schedule), routes/schedule.js
**DB:** schedule_events
**Flow:** Load events → render weekly calendar grid → click cell opens "New Time Block" modal → click event opens "Edit" modal → create/update/delete all persist to DB
**Features:** 7-day week view, 8am-5pm grid, color-coded event types, quick-add sidebar buttons
**Status:** ✅ Full CRUD. Click-to-add on empty cells. Click-to-edit existing events. Delete works. All persist to DB.

### 7. ASSIGNMENTS
**Files:** Extras.jsx (Assignments), routes/assignments.js
**DB:** assignments
**Flow:** Load assignments → filter by tab (all/todo/graded) and priority → Start/Submit/Graded actions → expand for details
**Status:** ✅ Start (→ in-progress), Submit (→ graded), Generate practice set all call API and reload. Feedback modal shows grade-based text. Expand/collapse works.

### 8. FLASHCARDS (Spaced Review)
**Files:** Extras.jsx (Flashcards), routes/flashcards.js
**DB:** flashcards, flashcard_reviews
**Flow:** Load due cards → flip to reveal answer → grade (Again/Hard/Good/Easy) → next card → session complete
**Algorithm:** Simple SM-2: grade → call review API → next_review date updated in DB
**Status:** ✅ Load due cards, flip, grade with API call, progression through deck, empty state, caught-up state.

### 9. CERTIFICATES & BADGES
**Files:** Extras.jsx (Certificates), routes/certificates.js, routes/badges.js
**DB:** certificates, badges
**Flow:** Load issued certificates + badges → display grid → export, share, verify actions
**Status:** ✅ Display from DB. Export downloads cert data as text. Share copies link. Verify opens modal with cert details and validity status. Badge grid renders.

### 10. COMMUNITY
**Files:** Extras.jsx (Community) — static data for discussions
**DB:** None (DISCUSSIONS, LEADERBOARD, FEED are hardcoded in data.js)
**Flow:** Load static discussions → filter by tab (Recent/Top/Unanswered/Following) → search → click opens thread modal → upvote increments local state → reply form adds to local state → new thread form adds to list
**Status:** ✅ Thread creation works (local state). Reply works (local state). Upvote works (local state). Filters work. Search works. Thread detail modal with reply form. Leaderboard shows static data.

### 11. FEED (Activity Log)
**Files:** Extras.jsx (Feed), routes/activity.js
**DB:** activity_log
**Flow:** Load activity → display chronologically → summary sidebar with XP/quiz/cert counts
**Status:** ✅ Loads from API. Empty state. Summary stats computed.

### 12. STARRED
**Files:** Extras.jsx (Starred), routes/starred.js
**DB:** starred_items, courses
**Flow:** Load starred items + courses → filter to starred courses → display cards → enroll/unstar
**Status:** ✅ Loads from API. Unstar persists. Enroll works. Empty state.

### 13. SETTINGS
**Files:** Extras.jsx (Settings), routes/users.js
**DB:** users, user_settings, api_keys, agent_routing, agent_status
**Tabs:**
- Account: name/email display, save calls patchUserProfile ✅
- API Keys: list/add/remove keys, persisted to DB ✅
- Agents: per-agent model routing dropdown, persisted to DB ✅
- Appearance: theme/density/font size, persisted to DB ✅
- Data: export downloads JSON backup of all user data, sign out ✅
- Billing: shows "Free (All Features)" ✅
**Status:** ✅ All tabs functional. All data persists to DB.

### 14. AGENTS PAGE
**Files:** Extras.jsx (AgentsPage), routes/users.js
**DB:** agent_status, agent_routing (via /api/users/agents)
**Flow:** Load agent statuses → display cards with status/dot/model → expand shows activity detail → button navigates to Settings for routing
**Status:** ✅ Loads from API. Status dots animate. Expand works. Button navigates to settings.

### 15. GLOBAL SEARCH
**Files:** App.jsx (TopBarSearch)
**Data:** Searches courses, roadmaps, assignments, sessions via API
**Flow:** Type query → 300ms debounce → parallel API calls → dropdown results grouped by type → click navigates to relevant page → ⌘K shortcut focuses search
**Status:** ✅ Fully working. Debounced. Dropdown with categorized results. Keyboard shortcut. Click-to-navigate.

### 16. NOTIFICATIONS
**Files:** App.jsx (TopBar)
**Data:** getActivity() for notification items
**Flow:** Click bell → toggle dropdown → load activity items → display with kind icons → click dismisses popup → unread badge clears on open
**Status:** ✅ Loads from API. Dismiss on click. No more false "View all" navigation.

### 17. SIDEBAR & NAVIGATION
**Files:** App.jsx (Sidebar, NavItem, ScreenRouter)
**Features:** Collapsible sidebar, nav groups (LEARN/BUILD/COMMUNITY/ANALYTICS), progress badge in sidebar showing XP/level, user area with logout, learning progress card with View Progress popup
**Status:** ✅ All navigation works. Collapse/animations. Screen router wraps all views. Progress popup shows stats from API. Logout in both sidebar and topbar user menu.

---

## API Endpoint Inventory (42 endpoints)

| Method | Path | Feature | Status |
|--------|------|---------|--------|
| POST | /auth/login | Auth | ✅ |
| POST | /auth/register | Auth | ✅ |
| GET | /auth/me | Auth | ✅ |
| POST | /auth/logout | Auth | ✅ |
| GET | /stats | Dashboard stats | ✅ |
| GET | /roadmaps | Roadmap list | ✅ |
| GET | /roadmaps/:id | Roadmap with nodes/edges | ✅ |
| PATCH | /roadmaps/:id | Roadmap update | ✅ |
| POST | /roadmaps/:id/fork | Fork roadmap | ✅ |
| PATCH | /roadmaps/:rid/nodes/:nid | Node mastery/status | ✅ |
| GET | /sessions | Session list | ✅ |
| GET | /sessions/:id | Session with messages | ✅ |
| POST | /sessions | Create session | ✅ |
| PATCH | /sessions/:id | End/update session | ✅ |
| POST | /sessions/:id/messages | Add message | ✅ |
| PATCH | /sessions/:id/messages/:mid | Rate message | ✅ |
| GET | /activity | Activity feed | ✅ |
| POST | /activity | Log activity | ✅ |
| GET | /assignments | Assignment list | ✅ |
| POST | /assignments | Create assignment | ✅ |
| PATCH | /assignments/:id | Update assignment | ✅ |
| DELETE | /assignments/:id | Delete assignment | ✅ |
| GET | /flashcards | All flashcards | ✅ |
| GET | /flashcards/due | Due flashcards | ✅ |
| POST | /flashcards | Create flashcard | ✅ |
| POST | /flashcards/:id/review | Review flashcard | ✅ |
| DELETE | /flashcards/:id | Delete flashcard | ✅ |
| GET | /courses | Course catalog | ✅ |
| GET | /courses/:slug | Course detail | ✅ |
| POST | /courses/:slug/enroll | Enroll | ✅ |
| DELETE | /courses/:slug/enroll | Unenroll | ✅ |
| GET | /schedule | Schedule events | ✅ |
| POST | /schedule | Create event | ✅ |
| PATCH | /schedule/:id | Update event | ✅ |
| DELETE | /schedule/:id | Delete event | ✅ |
| GET | /certificates | Certificates | ✅ |
| GET | /badges | Badges | ✅ |
| GET | /users/starred | Starred items | ✅ |
| POST | /users/starred | Add starred | ✅ |
| DELETE | /users/starred/:type/:id | Remove starred | ✅ |
| GET | /users/profile | User profile | ✅ |
| PATCH | /users/profile | Update profile | ✅ |
| GET | /users/settings | User settings | ✅ |
| PATCH | /users/settings | Update settings | ✅ |
| GET | /users/apikeys | API keys | ✅ |
| POST | /users/apikeys | Add API key | ✅ |
| DELETE | /users/apikeys/:id | Remove API key | ✅ |
| PATCH | /users/apikeys/:id | Update API key | ✅ |
| GET | /users/agent-routing | Agent routing | ✅ |
| PATCH | /users/agent-routing/:code | Update routing | ✅ |
| GET | /users/agents | Agent statuses | ✅ |

---

## Known Issues / Rough Edges

1. **Community is all local state** — discussions, threads, replies, votes are all in frontend data.js or local React state. Nothing persists to DB. No backend routes for community features.

2. **Learning Progress chart** — Dashboard's weekly progress chart uses hardcoded data (STREAK_BARS from data.js), not real activity data.

3. **Flashcard algorithm** — Reviews are saved but the next_review scheduling logic is basic. The flashcards/due endpoint filters by `next_review <= today` so it depends on the review updating this field correctly.

4. **Session agent responses** — Not connected to a real LLM. Uses keyword matching to generate contextual text responses. The agent routing and API keys infrastructure exists but isn't wired to actual LLM calls.

5. **Mastery tracking** — Roadmap node mastery values exist in DB but there's no automated mechanism to update them based on session completion/quiz scores. Would need manual updates or a scoring algorithm.

6. **XP/Level system** — XP values exist in the DB schema and user model, but no backend logic awards XP for completing assignments, sessions, or quizzes.

7. **Certificate issuance** — No automated certificate generation when completing a roadmap. Would need a trigger when all nodes are marked done.

8. **Streak tracking** — Streak count exists but no backend logic to increment/decrement based on daily activity.

9. **Course content** — No actual lesson content or video hosting. Syllabus items are placeholder text.

10. **Whiteboard persistence** — Canvas drawings are in-memory only, not saved to any backend.

---

## Architecture Summary

```
┌──────────────────────────────────────────────────────────────┐
│                     React SPA (Vite)                        │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ Auth    │ │Dashboard │ │ Sessions │ │   Courses      │  │
│  │ Screen  │ │ (stats,  │ │ (chat,   │ │ (browse,       │  │
│  │         │ │ roadmaps,│ │ quiz,    │ │  enroll,       │  │
│  │         │ │ activity)│ │ viz)     │ │  detail)       │  │
│  └─────────┘ └──────────┘ └──────────┘ └────────────────┘  │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │Schedule │ │Assign-   │ │Flash-    │ │ Certificates   │  │
│  │(calendar│ │ments     │ │cards     │ │ & Badges       │  │
│  │ CRUD)   │ │(CRUD)    │ │(review)  │ │                │  │
│  └─────────┘ └──────────┘ └──────────┘ └────────────────┘  │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │Communi- │ │  Feed    │ │ Starred  │ │   Settings     │  │
│  │ty(local)│ │(activity)│ │(saved)   │ │ (account,API,  │  │
│  │         │ │          │ │          │  │  agents,data)  │  │
│  └─────────┘ └──────────┘ └──────────┘ └────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Global: Sidebar, TopBar (search + notifs), Modals    │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                            │ HTTP/JSON
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                  Express 5 Server                            │
│  ┌──────────┐ ┌───────────┐ ┌────────────┐ ┌────────────┐  │
│  │ Auth     │ │ Protected │ │   SPA      │ │  Error     │  │
│  │ Routes   │ │ API       │ │  Catch-all │ │  Handler   │  │
│  │ (/auth)  │ │ (/api/*)  │ │  (index.html)│ │           │  │
│  └──────────┘ └───────────┘ └────────────┘ └────────────┘  │
│  JWT bcrypt  │ 50+ endpoints │ static serve │  logging     │
└──────────────────────────────────────────────────────────────┘
                            │ SQL
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                   SQLite (learnos.db)                        │
│  16 tables │ WAL mode │ Foreign keys │ 7 indexes            │
│  Seed data: 1 user, 4 sessions, 3 roadmaps, 11 nodes,     │
│  5 assignments, 4 flashcards, 6 courses, 2 enrollments,   │
│  4 starred, 3 certificates, 6 badges, 7 activities,        │
│  10 schedule events, 7 agents, 2 API keys                   │
└──────────────────────────────────────────────────────────────┘
```

## Codebase Stats
- **Total source:** 6,159 lines across 16 files
- **Frontend:** 5,563 lines (React JSX)
- **Backend:** 596 lines (Express routes + middleware)
- **DB Schema:** 249 lines (16 tables, 7 indexes)
- **Seed Data:** 158 lines
- **API client:** 171 lines (50+ endpoint functions)
- **Static data:** 265 lines (courses, agents, quiz, etc.)
