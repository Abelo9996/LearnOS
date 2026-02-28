"""
SQLite persistence layer for LearnOS.
Uses aiosqlite for async access. Complex nested objects stored as JSON.
"""

import aiosqlite
import json
import os
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

logger = logging.getLogger("learnos.db")

DB_PATH = os.getenv("DATABASE_PATH", "learnos.db")

# ──────────────────── helpers ────────────────────

def _now() -> str:
    return datetime.now().isoformat()

def _json(obj: Any) -> str:
    if obj is None:
        return "null"
    if hasattr(obj, "model_dump"):
        return json.dumps(obj.model_dump(), default=str)
    if hasattr(obj, "dict"):
        return json.dumps(obj.dict(), default=str)
    return json.dumps(obj, default=str)

def _load(text: Optional[str]) -> Any:
    if text is None:
        return None
    return json.loads(text)

# ──────────────────── init ────────────────────

async def init_database():
    """Create tables if they don't exist."""
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.executescript("""
            CREATE TABLE IF NOT EXISTS courses (
                course_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                goal TEXT,
                difficulty_level TEXT DEFAULT 'intermediate',
                target_weeks INTEGER DEFAULT 12,
                start_date TEXT,
                target_completion_date TEXT,
                actual_completion_date TEXT,
                status TEXT DEFAULT 'planning',
                progress_percentage REAL DEFAULT 0.0,
                roadmap_id TEXT,
                assignment_ids TEXT DEFAULT '[]',
                onboarding_completed INTEGER DEFAULT 0,
                custom_preferences TEXT DEFAULT '{}',
                total_time_spent_minutes INTEGER DEFAULT 0,
                sessions_count INTEGER DEFAULT 0,
                concepts_mastered TEXT DEFAULT '[]',
                created_at TEXT,
                updated_at TEXT,
                last_accessed TEXT,
                generated_by_ai INTEGER DEFAULT 0,
                ai_model_used TEXT
            );

            CREATE TABLE IF NOT EXISTS roadmaps (
                roadmap_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                course_id TEXT,
                goal TEXT,
                milestones TEXT DEFAULT '[]',
                total_estimated_hours REAL DEFAULT 0,
                estimated_completion_weeks INTEGER DEFAULT 0,
                adapted_to_profile INTEGER DEFAULT 1,
                adapted_to_habits INTEGER DEFAULT 1,
                difficulty_level TEXT DEFAULT 'intermediate',
                learning_strategy TEXT DEFAULT '',
                success_tips TEXT DEFAULT '[]',
                potential_challenges TEXT DEFAULT '[]',
                mitigation_strategies TEXT DEFAULT '[]',
                generated_at TEXT,
                last_updated TEXT,
                ai_model TEXT DEFAULT 'gpt-4'
            );

            CREATE TABLE IF NOT EXISTS openai_configs (
                user_id TEXT PRIMARY KEY,
                api_key TEXT NOT NULL,
                model TEXT DEFAULT 'gpt-4o-mini',
                max_tokens INTEGER DEFAULT 4000,
                temperature REAL DEFAULT 0.7,
                enabled INTEGER DEFAULT 1,
                created_at TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS feature_toggles (
                user_id TEXT PRIMARY KEY,
                ai_assignments INTEGER DEFAULT 1,
                ai_roadmaps INTEGER DEFAULT 1,
                habit_adaptation INTEGER DEFAULT 1,
                content_retrieval INTEGER DEFAULT 1,
                socratic_enhancement INTEGER DEFAULT 1,
                progress_insights INTEGER DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS assignments (
                assignment_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                course_id TEXT,
                milestone_id TEXT,
                roadmap_id TEXT,
                concept TEXT,
                assignment_type TEXT DEFAULT 'essay',
                title TEXT,
                description TEXT,
                learning_objectives TEXT DEFAULT '[]',
                instructions TEXT DEFAULT '[]',
                requirements TEXT DEFAULT '[]',
                questions TEXT DEFAULT '[]',
                starter_materials TEXT,
                starter_code TEXT,
                test_cases TEXT DEFAULT '[]',
                rubric TEXT DEFAULT '[]',
                hints TEXT DEFAULT '[]',
                resources TEXT DEFAULT '[]',
                solution_approach TEXT DEFAULT '',
                common_mistakes TEXT DEFAULT '[]',
                estimated_time_hours REAL DEFAULT 2.0,
                difficulty TEXT DEFAULT 'intermediate',
                requires_libraries TEXT DEFAULT '[]',
                status TEXT DEFAULT 'not_started',
                submission TEXT,
                submission_date TEXT,
                score REAL,
                feedback TEXT,
                created_at TEXT,
                completed_at TEXT,
                generated_by TEXT DEFAULT 'gpt-4',
                generation_prompt TEXT DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS learning_sessions (
                session_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                course_id TEXT,
                start_time TEXT,
                end_time TEXT,
                duration_minutes INTEGER,
                concepts_covered TEXT DEFAULT '[]',
                questions_answered INTEGER DEFAULT 0,
                correct_answers INTEGER DEFAULT 0,
                attention_score REAL DEFAULT 0.8,
                engagement_level TEXT DEFAULT 'medium',
                time_of_day TEXT DEFAULT 'morning',
                day_of_week TEXT DEFAULT 'Monday',
                device_type TEXT DEFAULT 'desktop',
                interruptions INTEGER DEFAULT 0,
                mastery_gained REAL DEFAULT 0.0,
                completed INTEGER DEFAULT 0,
                notes TEXT
            );

            CREATE TABLE IF NOT EXISTS learning_habits (
                user_id TEXT PRIMARY KEY,
                habit_id TEXT,
                preferred_time_of_day TEXT DEFAULT 'morning',
                average_session_duration INTEGER DEFAULT 30,
                sessions_per_week INTEGER DEFAULT 5,
                most_productive_days TEXT DEFAULT '[]',
                concepts_mastered_per_week REAL DEFAULT 2.0,
                average_assignment_completion_time REAL DEFAULT 3.5,
                preferred_break_frequency INTEGER DEFAULT 25,
                drop_off_signals TEXT DEFAULT '[]',
                peak_performance_conditions TEXT DEFAULT '[]',
                successful_adaptations TEXT DEFAULT '[]',
                unsuccessful_adaptations TEXT DEFAULT '[]',
                last_updated TEXT
            );

            CREATE TABLE IF NOT EXISTS learner_profiles (
                user_id TEXT PRIMARY KEY,
                data TEXT DEFAULT '{}'
            );

            CREATE TABLE IF NOT EXISTS habit_adaptations (
                adaptation_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                adaptation_type TEXT DEFAULT 'general',
                current_behavior TEXT,
                observed_pattern TEXT,
                suggested_change TEXT,
                reasoning TEXT,
                expected_benefit TEXT,
                confidence REAL DEFAULT 0.7,
                implementation_steps TEXT DEFAULT '[]',
                trial_period_days INTEGER DEFAULT 7,
                success_metrics TEXT DEFAULT '[]',
                status TEXT DEFAULT 'suggested',
                user_feedback TEXT,
                actual_outcome TEXT,
                created_at TEXT,
                ai_model TEXT DEFAULT 'gpt-4'
            );

            CREATE TABLE IF NOT EXISTS ai_insights (
                insight_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                insight_type TEXT DEFAULT 'progress',
                title TEXT,
                description TEXT,
                supporting_data TEXT DEFAULT '[]',
                actionable INTEGER DEFAULT 1,
                suggested_actions TEXT DEFAULT '[]',
                priority TEXT DEFAULT 'medium',
                related_concepts TEXT DEFAULT '[]',
                time_frame TEXT DEFAULT 'past_week',
                generated_at TEXT,
                expires_at TEXT,
                ai_model TEXT DEFAULT 'gpt-4'
            );

            CREATE TABLE IF NOT EXISTS retrieved_content (
                content_id TEXT PRIMARY KEY,
                concept TEXT,
                user_id TEXT NOT NULL,
                title TEXT,
                url TEXT,
                content_type TEXT DEFAULT 'article',
                author TEXT,
                relevance_score REAL DEFAULT 0.8,
                difficulty_level TEXT DEFAULT 'intermediate',
                estimated_reading_time INTEGER DEFAULT 15,
                key_topics TEXT DEFAULT '[]',
                summary TEXT DEFAULT '',
                key_takeaways TEXT DEFAULT '[]',
                recommended_for_expertise TEXT DEFAULT '[]',
                complements_concepts TEXT DEFAULT '[]',
                best_consumed_at TEXT DEFAULT 'beginning',
                viewed INTEGER DEFAULT 0,
                rating INTEGER,
                helpful INTEGER,
                retrieved_at TEXT,
                ai_model TEXT DEFAULT 'gpt-4'
            );

            CREATE INDEX IF NOT EXISTS idx_courses_user ON courses(user_id);
            CREATE INDEX IF NOT EXISTS idx_roadmaps_user ON roadmaps(user_id);
            CREATE INDEX IF NOT EXISTS idx_assignments_user ON assignments(user_id);
            CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_user ON learning_sessions(user_id);
        """)
        await conn.commit()
    logger.info("Database initialized at %s", DB_PATH)


# ──────────────────── COURSES ────────────────────

async def save_course(course_dict: dict):
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("""
            INSERT OR REPLACE INTO courses
            (course_id, user_id, title, description, goal, difficulty_level,
             target_weeks, start_date, target_completion_date, actual_completion_date,
             status, progress_percentage, roadmap_id, assignment_ids,
             onboarding_completed, custom_preferences, total_time_spent_minutes,
             sessions_count, concepts_mastered, created_at, updated_at,
             last_accessed, generated_by_ai, ai_model_used)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            course_dict["course_id"], course_dict["user_id"],
            course_dict["title"], course_dict.get("description", ""),
            course_dict.get("goal", ""), course_dict.get("difficulty_level", "intermediate"),
            course_dict.get("target_weeks", 12),
            course_dict.get("start_date"), course_dict.get("target_completion_date"),
            course_dict.get("actual_completion_date"),
            course_dict.get("status", "planning"),
            course_dict.get("progress_percentage", 0.0),
            course_dict.get("roadmap_id"),
            _json(course_dict.get("assignment_ids", [])),
            1 if course_dict.get("onboarding_completed") else 0,
            _json(course_dict.get("custom_preferences", {})),
            course_dict.get("total_time_spent_minutes", 0),
            course_dict.get("sessions_count", 0),
            _json(course_dict.get("concepts_mastered", [])),
            course_dict.get("created_at", _now()),
            course_dict.get("updated_at", _now()),
            course_dict.get("last_accessed", _now()),
            1 if course_dict.get("generated_by_ai") else 0,
            course_dict.get("ai_model_used"),
        ))
        await conn.commit()

async def get_course(course_id: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute("SELECT * FROM courses WHERE course_id = ?", (course_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        return _course_from_row(dict(row))

async def list_courses(user_id: str, status: Optional[str] = None) -> List[dict]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        if status:
            cursor = await conn.execute(
                "SELECT * FROM courses WHERE user_id = ? AND status = ? ORDER BY last_accessed DESC",
                (user_id, status))
        else:
            cursor = await conn.execute(
                "SELECT * FROM courses WHERE user_id = ? ORDER BY last_accessed DESC",
                (user_id,))
        rows = await cursor.fetchall()
        return [_course_from_row(dict(r)) for r in rows]

def _course_from_row(row: dict) -> dict:
    row["assignment_ids"] = _load(row.get("assignment_ids", "[]")) or []
    row["custom_preferences"] = _load(row.get("custom_preferences", "{}")) or {}
    row["concepts_mastered"] = _load(row.get("concepts_mastered", "[]")) or []
    row["onboarding_completed"] = bool(row.get("onboarding_completed"))
    row["generated_by_ai"] = bool(row.get("generated_by_ai"))
    row["progress_percentage"] = float(row.get("progress_percentage", 0))
    return row

async def delete_course(course_id: str):
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("DELETE FROM courses WHERE course_id = ?", (course_id,))
        await conn.commit()


# ──────────────────── ROADMAPS ────────────────────

async def save_roadmap(roadmap_dict: dict):
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("""
            INSERT OR REPLACE INTO roadmaps
            (roadmap_id, user_id, course_id, goal, milestones,
             total_estimated_hours, estimated_completion_weeks,
             adapted_to_profile, adapted_to_habits, difficulty_level,
             learning_strategy, success_tips, potential_challenges,
             mitigation_strategies, generated_at, last_updated, ai_model)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            roadmap_dict["roadmap_id"], roadmap_dict["user_id"],
            roadmap_dict.get("course_id"),
            roadmap_dict.get("goal", ""),
            _json(roadmap_dict.get("milestones", [])),
            roadmap_dict.get("total_estimated_hours", 0),
            roadmap_dict.get("estimated_completion_weeks", 0),
            1 if roadmap_dict.get("adapted_to_profile") else 0,
            1 if roadmap_dict.get("adapted_to_habits") else 0,
            roadmap_dict.get("difficulty_level", "intermediate"),
            roadmap_dict.get("learning_strategy", ""),
            _json(roadmap_dict.get("success_tips", [])),
            _json(roadmap_dict.get("potential_challenges", [])),
            _json(roadmap_dict.get("mitigation_strategies", [])),
            roadmap_dict.get("generated_at", _now()),
            roadmap_dict.get("last_updated", _now()),
            roadmap_dict.get("ai_model", "gpt-4"),
        ))
        await conn.commit()

async def get_roadmap(roadmap_id: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute("SELECT * FROM roadmaps WHERE roadmap_id = ?", (roadmap_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        return _roadmap_from_row(dict(row))

async def list_roadmaps(user_id: str) -> List[dict]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute("SELECT * FROM roadmaps WHERE user_id = ?", (user_id,))
        rows = await cursor.fetchall()
        return [_roadmap_from_row(dict(r)) for r in rows]

async def delete_roadmap(roadmap_id: str):
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("DELETE FROM roadmaps WHERE roadmap_id = ?", (roadmap_id,))
        await conn.commit()

def _roadmap_from_row(row: dict) -> dict:
    row["milestones"] = _load(row.get("milestones", "[]")) or []
    row["success_tips"] = _load(row.get("success_tips", "[]")) or []
    row["potential_challenges"] = _load(row.get("potential_challenges", "[]")) or []
    row["mitigation_strategies"] = _load(row.get("mitigation_strategies", "[]")) or []
    row["adapted_to_profile"] = bool(row.get("adapted_to_profile"))
    row["adapted_to_habits"] = bool(row.get("adapted_to_habits"))
    return row


# ──────────────────── OPENAI CONFIG ────────────────────

async def save_openai_config(config_dict: dict):
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("""
            INSERT OR REPLACE INTO openai_configs
            (user_id, api_key, model, max_tokens, temperature, enabled, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?)
        """, (
            config_dict["user_id"], config_dict["api_key"],
            config_dict.get("model", "gpt-4o-mini"),
            config_dict.get("max_tokens", 4000),
            config_dict.get("temperature", 0.7),
            1 if config_dict.get("enabled", True) else 0,
            config_dict.get("created_at", _now()),
            config_dict.get("updated_at", _now()),
        ))
        await conn.commit()

async def get_openai_config(user_id: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute("SELECT * FROM openai_configs WHERE user_id = ?", (user_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        d = dict(row)
        d["enabled"] = bool(d.get("enabled"))
        return d

async def delete_openai_config(user_id: str):
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("DELETE FROM openai_configs WHERE user_id = ?", (user_id,))
        await conn.commit()


# ──────────────────── FEATURE TOGGLES ────────────────────

async def save_feature_toggles(toggles_dict: dict):
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("""
            INSERT OR REPLACE INTO feature_toggles
            (user_id, ai_assignments, ai_roadmaps, habit_adaptation,
             content_retrieval, socratic_enhancement, progress_insights)
            VALUES (?,?,?,?,?,?,?)
        """, (
            toggles_dict["user_id"],
            1 if toggles_dict.get("ai_assignments", True) else 0,
            1 if toggles_dict.get("ai_roadmaps", True) else 0,
            1 if toggles_dict.get("habit_adaptation", True) else 0,
            1 if toggles_dict.get("content_retrieval", True) else 0,
            1 if toggles_dict.get("socratic_enhancement", True) else 0,
            1 if toggles_dict.get("progress_insights", True) else 0,
        ))
        await conn.commit()

async def get_feature_toggles(user_id: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute("SELECT * FROM feature_toggles WHERE user_id = ?", (user_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        d = dict(row)
        for k in ["ai_assignments", "ai_roadmaps", "habit_adaptation", "content_retrieval", "socratic_enhancement", "progress_insights"]:
            d[k] = bool(d.get(k))
        return d


# ──────────────────── ASSIGNMENTS ────────────────────

async def save_assignment(a: dict):
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("""
            INSERT OR REPLACE INTO assignments
            (assignment_id, user_id, course_id, milestone_id, roadmap_id,
             concept, assignment_type, title, description,
             learning_objectives, instructions, requirements, questions,
             starter_materials, starter_code, test_cases, rubric, hints,
             resources, solution_approach, common_mistakes,
             estimated_time_hours, difficulty, requires_libraries,
             status, submission, submission_date, score, feedback,
             created_at, completed_at, generated_by, generation_prompt)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            a["assignment_id"], a["user_id"], a.get("course_id"),
            a.get("milestone_id"), a.get("roadmap_id"),
            a.get("concept", ""), a.get("assignment_type", "essay"),
            a.get("title", ""), a.get("description", ""),
            _json(a.get("learning_objectives", [])),
            _json(a.get("instructions", [])),
            _json(a.get("requirements", [])),
            _json(a.get("questions", [])),
            a.get("starter_materials"), a.get("starter_code"),
            _json(a.get("test_cases", [])),
            _json(a.get("rubric", [])),
            _json(a.get("hints", [])),
            _json(a.get("resources", [])),
            a.get("solution_approach", ""),
            _json(a.get("common_mistakes", [])),
            a.get("estimated_time_hours", 2.0),
            a.get("difficulty", "intermediate"),
            _json(a.get("requires_libraries", [])),
            a.get("status", "not_started"),
            a.get("submission"), a.get("submission_date"),
            a.get("score"), a.get("feedback"),
            a.get("created_at", _now()), a.get("completed_at"),
            a.get("generated_by", "gpt-4"), a.get("generation_prompt", ""),
        ))
        await conn.commit()

async def get_assignment(assignment_id: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute("SELECT * FROM assignments WHERE assignment_id = ?", (assignment_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        return _assignment_from_row(dict(row))

async def list_assignments(user_id: str, course_id: Optional[str] = None) -> List[dict]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        if course_id:
            cursor = await conn.execute(
                "SELECT * FROM assignments WHERE user_id = ? AND course_id = ? ORDER BY created_at DESC",
                (user_id, course_id))
        else:
            cursor = await conn.execute(
                "SELECT * FROM assignments WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,))
        rows = await cursor.fetchall()
        return [_assignment_from_row(dict(r)) for r in rows]

def _assignment_from_row(row: dict) -> dict:
    for k in ["learning_objectives", "instructions", "requirements", "questions",
              "test_cases", "rubric", "hints", "resources", "common_mistakes", "requires_libraries"]:
        row[k] = _load(row.get(k, "[]")) or []
    return row


# ──────────────────── LEARNING SESSIONS ────────────────────

async def save_learning_session(s: dict):
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("""
            INSERT OR REPLACE INTO learning_sessions
            (session_id, user_id, course_id, start_time, end_time,
             duration_minutes, concepts_covered, questions_answered,
             correct_answers, attention_score, engagement_level,
             time_of_day, day_of_week, device_type, interruptions,
             mastery_gained, completed, notes)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            s["session_id"], s["user_id"], s.get("course_id"),
            s.get("start_time", _now()), s.get("end_time"),
            s.get("duration_minutes"), _json(s.get("concepts_covered", [])),
            s.get("questions_answered", 0), s.get("correct_answers", 0),
            s.get("attention_score", 0.8), s.get("engagement_level", "medium"),
            s.get("time_of_day", "morning"), s.get("day_of_week", "Monday"),
            s.get("device_type", "desktop"), s.get("interruptions", 0),
            s.get("mastery_gained", 0.0),
            1 if s.get("completed") else 0, s.get("notes"),
        ))
        await conn.commit()

async def list_learning_sessions(user_id: str, limit: int = 50) -> List[dict]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute(
            "SELECT * FROM learning_sessions WHERE user_id = ? ORDER BY start_time DESC LIMIT ?",
            (user_id, limit))
        rows = await cursor.fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["concepts_covered"] = _load(d.get("concepts_covered", "[]")) or []
            d["completed"] = bool(d.get("completed"))
            results.append(d)
        return results

async def get_learning_session(session_id: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute("SELECT * FROM learning_sessions WHERE session_id = ?", (session_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        d = dict(row)
        d["concepts_covered"] = _load(d.get("concepts_covered", "[]")) or []
        d["completed"] = bool(d.get("completed"))
        return d


# ──────────────────── LEARNING HABITS ────────────────────

async def save_learning_habit(h: dict):
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("""
            INSERT OR REPLACE INTO learning_habits
            (user_id, habit_id, preferred_time_of_day, average_session_duration,
             sessions_per_week, most_productive_days, concepts_mastered_per_week,
             average_assignment_completion_time, preferred_break_frequency,
             drop_off_signals, peak_performance_conditions,
             successful_adaptations, unsuccessful_adaptations, last_updated)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            h["user_id"], h.get("habit_id", ""),
            h.get("preferred_time_of_day", "morning"),
            h.get("average_session_duration", 30),
            h.get("sessions_per_week", 5),
            _json(h.get("most_productive_days", [])),
            h.get("concepts_mastered_per_week", 2.0),
            h.get("average_assignment_completion_time", 3.5),
            h.get("preferred_break_frequency", 25),
            _json(h.get("drop_off_signals", [])),
            _json(h.get("peak_performance_conditions", [])),
            _json(h.get("successful_adaptations", [])),
            _json(h.get("unsuccessful_adaptations", [])),
            h.get("last_updated", _now()),
        ))
        await conn.commit()

async def get_learning_habit(user_id: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute("SELECT * FROM learning_habits WHERE user_id = ?", (user_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        d = dict(row)
        for k in ["most_productive_days", "drop_off_signals", "peak_performance_conditions",
                   "successful_adaptations", "unsuccessful_adaptations"]:
            d[k] = _load(d.get(k, "[]")) or []
        return d


# ──────────────────── LEARNER PROFILES ────────────────────

async def save_learner_profile(user_id: str, profile_data: dict):
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute(
            "INSERT OR REPLACE INTO learner_profiles (user_id, data) VALUES (?,?)",
            (user_id, _json(profile_data)))
        await conn.commit()

async def get_learner_profile(user_id: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute("SELECT data FROM learner_profiles WHERE user_id = ?", (user_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        return _load(dict(row)["data"])


# ──────────────────── HABIT ADAPTATIONS ────────────────────

async def save_habit_adaptation(a: dict):
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("""
            INSERT OR REPLACE INTO habit_adaptations
            (adaptation_id, user_id, adaptation_type, current_behavior,
             observed_pattern, suggested_change, reasoning, expected_benefit,
             confidence, implementation_steps, trial_period_days,
             success_metrics, status, user_feedback, actual_outcome,
             created_at, ai_model)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            a["adaptation_id"], a["user_id"],
            a.get("adaptation_type", "general"),
            a.get("current_behavior", ""), a.get("observed_pattern", ""),
            a.get("suggested_change", ""), a.get("reasoning", ""),
            a.get("expected_benefit", ""), a.get("confidence", 0.7),
            _json(a.get("implementation_steps", [])),
            a.get("trial_period_days", 7),
            _json(a.get("success_metrics", [])),
            a.get("status", "suggested"),
            a.get("user_feedback"), a.get("actual_outcome"),
            a.get("created_at", _now()), a.get("ai_model", "gpt-4"),
        ))
        await conn.commit()

async def list_habit_adaptations(user_id: str, status: Optional[str] = None) -> List[dict]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        if status:
            cursor = await conn.execute(
                "SELECT * FROM habit_adaptations WHERE user_id = ? AND status = ?",
                (user_id, status))
        else:
            cursor = await conn.execute(
                "SELECT * FROM habit_adaptations WHERE user_id = ?", (user_id,))
        rows = await cursor.fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["implementation_steps"] = _load(d.get("implementation_steps", "[]")) or []
            d["success_metrics"] = _load(d.get("success_metrics", "[]")) or []
            results.append(d)
        return results

async def get_habit_adaptation(adaptation_id: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute(
            "SELECT * FROM habit_adaptations WHERE adaptation_id = ?", (adaptation_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        d = dict(row)
        d["implementation_steps"] = _load(d.get("implementation_steps", "[]")) or []
        d["success_metrics"] = _load(d.get("success_metrics", "[]")) or []
        return d


# ──────────────────── AI INSIGHTS ────────────────────

async def save_ai_insight(i: dict):
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("""
            INSERT OR REPLACE INTO ai_insights
            (insight_id, user_id, insight_type, title, description,
             supporting_data, actionable, suggested_actions, priority,
             related_concepts, time_frame, generated_at, expires_at, ai_model)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            i["insight_id"], i["user_id"],
            i.get("insight_type", "progress"),
            i.get("title", ""), i.get("description", ""),
            _json(i.get("supporting_data", [])),
            1 if i.get("actionable", True) else 0,
            _json(i.get("suggested_actions", [])),
            i.get("priority", "medium"),
            _json(i.get("related_concepts", [])),
            i.get("time_frame", "past_week"),
            i.get("generated_at", _now()), i.get("expires_at"),
            i.get("ai_model", "gpt-4"),
        ))
        await conn.commit()

async def list_ai_insights(user_id: str, insight_type: Optional[str] = None) -> List[dict]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        if insight_type:
            cursor = await conn.execute(
                "SELECT * FROM ai_insights WHERE user_id = ? AND insight_type = ? ORDER BY generated_at DESC",
                (user_id, insight_type))
        else:
            cursor = await conn.execute(
                "SELECT * FROM ai_insights WHERE user_id = ? ORDER BY generated_at DESC",
                (user_id,))
        rows = await cursor.fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["supporting_data"] = _load(d.get("supporting_data", "[]")) or []
            d["suggested_actions"] = _load(d.get("suggested_actions", "[]")) or []
            d["related_concepts"] = _load(d.get("related_concepts", "[]")) or []
            d["actionable"] = bool(d.get("actionable"))
            results.append(d)
        return results


# ──────────────────── RETRIEVED CONTENT ────────────────────

async def save_retrieved_content(c: dict):
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("""
            INSERT OR REPLACE INTO retrieved_content
            (content_id, concept, user_id, title, url, content_type, author,
             relevance_score, difficulty_level, estimated_reading_time,
             key_topics, summary, key_takeaways, recommended_for_expertise,
             complements_concepts, best_consumed_at, viewed, rating, helpful,
             retrieved_at, ai_model)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            c["content_id"], c.get("concept", ""), c["user_id"],
            c.get("title", ""), c.get("url", ""),
            c.get("content_type", "article"), c.get("author"),
            c.get("relevance_score", 0.8), c.get("difficulty_level", "intermediate"),
            c.get("estimated_reading_time", 15),
            _json(c.get("key_topics", [])),
            c.get("summary", ""),
            _json(c.get("key_takeaways", [])),
            _json(c.get("recommended_for_expertise", [])),
            _json(c.get("complements_concepts", [])),
            c.get("best_consumed_at", "beginning"),
            1 if c.get("viewed") else 0,
            c.get("rating"), 1 if c.get("helpful") else (0 if c.get("helpful") is False else None),
            c.get("retrieved_at", _now()), c.get("ai_model", "gpt-4"),
        ))
        await conn.commit()

async def get_retrieved_content(content_id: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute("SELECT * FROM retrieved_content WHERE content_id = ?", (content_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        return _content_from_row(dict(row))

async def list_retrieved_content(user_id: str, concept: Optional[str] = None) -> List[dict]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        if concept:
            cursor = await conn.execute(
                "SELECT * FROM retrieved_content WHERE user_id = ? AND concept = ? ORDER BY relevance_score DESC",
                (user_id, concept))
        else:
            cursor = await conn.execute(
                "SELECT * FROM retrieved_content WHERE user_id = ? ORDER BY relevance_score DESC",
                (user_id,))
        rows = await cursor.fetchall()
        return [_content_from_row(dict(r)) for r in rows]

def _content_from_row(row: dict) -> dict:
    for k in ["key_topics", "key_takeaways", "recommended_for_expertise", "complements_concepts"]:
        row[k] = _load(row.get(k, "[]")) or []
    row["viewed"] = bool(row.get("viewed"))
    if row.get("helpful") is not None:
        row["helpful"] = bool(row["helpful"])
    return row
