-- LearnOS Database Schema
-- User profile, settings, learning data, sessions, assignments, etc.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Learner',
  email TEXT NOT NULL DEFAULT 'learner@learnos.dev',
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  avatar_hue INTEGER DEFAULT 295,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  xp_to_next INTEGER DEFAULT 500,
  streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  plan TEXT DEFAULT 'Free',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'dark',
  density TEXT DEFAULT 'regular',
  font_size INTEGER DEFAULT 14,
  local_only INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  model TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_routing (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_code TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'anthropic/claude-haiku-4.5',
  PRIMARY KEY (user_id, agent_code)
);

CREATE TABLE IF NOT EXISTS roadmaps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  authored_by TEXT,
  mastery REAL DEFAULT 0,
  total_modules INTEGER DEFAULT 0,
  completed_modules INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  color TEXT DEFAULT '#7c3aed',
  icon TEXT DEFAULT 'box',
  next_module TEXT,
  modules_left INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS roadmap_nodes (
  id TEXT PRIMARY KEY,
  roadmap_id TEXT NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  col INTEGER DEFAULT 0,
  row_idx INTEGER DEFAULT 0,
  mastery REAL DEFAULT 0,
  status TEXT DEFAULT 'locked',
  CONSTRAINT valid_status CHECK (status IN ('done','active','next','locked'))
);

CREATE TABLE IF NOT EXISTS roadmap_edges (
  roadmap_id TEXT NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
  from_node TEXT NOT NULL,
  to_node TEXT NOT NULL,
  PRIMARY KEY (roadmap_id, from_node, to_node)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  roadmap_id TEXT REFERENCES roadmaps(id),
  roadmap_node_id TEXT,
  title TEXT NOT NULL,
  subtitle TEXT,
  agent TEXT NOT NULL DEFAULT 'TU',
  course TEXT,
  level TEXT,
  session_index INTEGER DEFAULT 1,
  total_sessions INTEGER DEFAULT 12,
  duration_seconds INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  mastery_score REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS session_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  agent_code TEXT,
  body TEXT NOT NULL,
  kind TEXT DEFAULT 'text',
  user_rating INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  course TEXT NOT NULL,
  status TEXT DEFAULT 'todo',
  progress REAL DEFAULT 0,
  grade INTEGER,
  priority TEXT DEFAULT 'med',
  estimated_minutes INTEGER DEFAULT 60,
  due_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS flashcards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck TEXT NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  interval_days INTEGER DEFAULT 1,
  ease_factor REAL DEFAULT 2.5,
  reps INTEGER DEFAULT 0,
  next_review TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS flashcard_reviews (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  grade TEXT NOT NULL,
  ease_factor REAL,
  interval_days INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS courses (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  blurb TEXT,
  author TEXT NOT NULL,
  verified INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  stars INTEGER DEFAULT 0,
  forks INTEGER DEFAULT 0,
  hours INTEGER DEFAULT 0,
  version TEXT DEFAULT 'v1.0',
  tags TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS enrollments (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_slug TEXT NOT NULL REFERENCES courses(slug),
  progress REAL DEFAULT 0,
  status TEXT DEFAULT 'enrolled',
  enrolled_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, course_slug)
);

CREATE TABLE IF NOT EXISTS starred_items (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, item_type, item_id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  mastery REAL DEFAULT 0,
  color TEXT DEFAULT '#7c3aed',
  id_short TEXT,
  issued_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  glyph TEXT NOT NULL,
  earned_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  sub TEXT,
  xp INTEGER DEFAULT 0,
  agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schedule_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL,
  agent TEXT,
  day_of_week INTEGER NOT NULL,
  start_hour REAL NOT NULL,
  duration_hours REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_status (
  agent_code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  short_desc TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  status_text TEXT,
  status_icon TEXT DEFAULT 'spark',
  is_active INTEGER DEFAULT 1,
  PRIMARY KEY (agent_code)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_user ON assignments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_flashcards_user ON flashcards(user_id, deck);
CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_card ON flashcard_reviews(card_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_roadmap_nodes ON roadmap_nodes(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_schedule_user ON schedule_events(user_id);
