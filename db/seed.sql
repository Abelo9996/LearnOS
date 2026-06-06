-- LearnOS Seed Data
-- A fully populated example user "Alex Learner" with realistic learning data.

-- User
INSERT INTO users (id, name, email, password_hash, role, level, xp, xp_to_next, streak, best_streak, plan)
VALUES ('user-1', 'Alex Learner', 'alex@learnos.dev',
  '$2b$10$Jg3eobdQ0Ns4u17rds.pyeW9elY7GdnTmdOhpTjGgWm79S/Keseqq',
  'user', 4, 2350, 3000, 12, 18, 'Pro');

-- Settings
INSERT INTO user_settings (user_id, theme, density, font_size, local_only)
VALUES ('user-1', 'dark', 'regular', 14, 0);

-- API Keys (masked placeholders — real keys would be encrypted)
INSERT INTO api_keys (id, user_id, provider, encrypted_key, model, is_active)
 VALUES ('ak-1', 'user-1', 'anthropic', 'sk-ant-…7Z2', 'claude-haiku-4-5', 1);
INSERT INTO api_keys (id, user_id, provider, encrypted_key, model, is_active)
 VALUES ('ak-2', 'user-1', 'openai', 'sk-…q1Pa', 'gpt-4o', 1);

-- Agent routing defaults
INSERT INTO agent_routing (user_id, agent_code, model) VALUES
  ('user-1', 'TU', 'claude-sonnet-4-5'),
  ('user-1', 'PR', 'claude-haiku-4-5'),
  ('user-1', 'CR', 'claude-haiku-4-5'),
  ('user-1', 'AS', 'claude-haiku-4-5'),
  ('user-1', 'RE', 'claude-haiku-4-5'),
  ('user-1', 'AN', 'claude-haiku-4-5'),
  ('user-1', 'CE', 'claude-haiku-4-5');

-- Agent status
INSERT INTO agent_status (agent_code, display_name, short_desc, color, icon, status_text, is_active) VALUES
  ('TU','Tutor',        'Teaches concepts, answers questions, explains deeply.',              '--agent-tu','cap',    'Speaking · explaining bias–variance', 1),
  ('PR','Profiling',    'Understands you — your goals, pace, background.',                  '--agent-pr','user',   'Noticed: switching to active recall',  0),
  ('CR','Curriculum',   'Creates personalized roadmaps and learning paths.',                '--agent-cr','graph',  'Re-sequenced Cross-validation',      0),
  ('AS','Assessment',   'Generates quizzes and evaluates mastery.',                         '--agent-as','check',  'Drafting 3 follow-up checks',         1),
  ('RE','Research',     'Finds, summarizes, and cites the best resources.',                 '--agent-re','search', 'Pulled: Geman et al. 1992',          1),
  ('AN','Analytics',    'Tracks progress and surfaces insights.',                          '--agent-an','chart',  'Retention holding at 92%',           1),
  ('CE','Certification','Issues verifiable certificates and badges.',                      '--agent-ce','ribbon', 'Issued: Python for Data Science',    0);

-- Roadmaps
INSERT INTO roadmaps (id, user_id, title, subtitle, authored_by, mastery, total_modules, completed_modules, status, color, icon, next_module, modules_left)
VALUES
  ('rm-ml-engineer','user-1','Machine Learning Engineer','Foundations through deployment, in 24 modules','community · forked from karpathy/zero-to-hero',0.68,24,14,'active','#7c3aed','box','Bias–Variance Tradeoff',2),
  ('rm-data-sci',   'user-1','Data Science Fundamentals','Statistics, analysis, and ML basics','community',0.45,18,8,'active','#22d3ee','chart','Hypothesis Testing',3),
  ('rm-genai',      'user-1','Generative AI Mastery','From prompts to agents and RAG','community',0.32,15,5,'active','#e0476a','spark','Prompt Engineering',1);

-- Roadmap nodes (ML Engineer)
INSERT INTO roadmap_nodes (id, roadmap_id, title, col, row_idx, mastery, status) VALUES
  ('n1','rm-ml-engineer','Vectors & spaces',0,0,1.0,'done'),
  ('n2','rm-ml-engineer','Linear regression',1,0,1.0,'done'),
  ('n3','rm-ml-engineer','Gradient descent',2,0,0.95,'done'),
  ('n4','rm-ml-engineer','Logistic regression',1,1,0.88,'done'),
  ('n5','rm-ml-engineer','Regularization',2,1,0.74,'done'),
  ('n6','rm-ml-engineer','Bias–Variance Tradeoff',3,0,0.72,'active'),
  ('n7','rm-ml-engineer','Cross-validation',3,1,0.30,'next'),
  ('n8','rm-ml-engineer','Backpropagation',4,0,0.10,'locked'),
  ('n9','rm-ml-engineer','Optimizers',4,1,0.0,'locked'),
  ('n10','rm-ml-engineer','Convolutions',5,0,0.0,'locked'),
  ('n11','rm-ml-engineer','Transformers',5,1,0.0,'locked');

-- Roadmap edges
INSERT INTO roadmap_edges (roadmap_id, from_node, to_node) VALUES
  ('rm-ml-engineer','n1','n2'),('rm-ml-engineer','n2','n3'),('rm-ml-engineer','n2','n4'),
  ('rm-ml-engineer','n3','n4'),('rm-ml-engineer','n3','n5'),('rm-ml-engineer','n4','n5'),
  ('rm-ml-engineer','n5','n6'),('rm-ml-engineer','n5','n7'),('rm-ml-engineer','n6','n7'),
  ('rm-ml-engineer','n6','n8'),('rm-ml-engineer','n7','n8'),('rm-ml-engineer','n7','n9'),
  ('rm-ml-engineer','n8','n9'),('rm-ml-engineer','n8','n10'),('rm-ml-engineer','n9','n11'),
  ('rm-ml-engineer','n10','n11');

-- Sessions
INSERT INTO sessions (id, user_id, roadmap_id, roadmap_node_id, title, subtitle, agent, course, level, session_index, total_sessions, duration_seconds, status, mastery_score) VALUES
  ('sess-1','user-1','rm-ml-engineer','n6','Bias–Variance Tradeoff','Understanding the balance between bias and variance','TU','Machine Learning','Intermediate',6,12,1440,'active',0.72),
  ('sess-2','user-1','rm-ml-engineer','n6','Visualizing the Tradeoff','A visual deep-dive into the tradeoff','TU','Machine Learning','Intermediate',5,12,1440,'completed',0.88),
  ('sess-3','user-1','rm-ml-engineer','n6','Underfit vs Overfit','Recognizing the patterns','TU','Machine Learning','Intermediate',4,12,1080,'completed',0.95),
  ('sess-4','user-1','rm-ml-engineer','n5','Regularization Deep Dive','L1, L2, and beyond','TU','Machine Learning','Intermediate',3,12,1320,'completed',0.76);

-- Session messages for sess-1 (active)
INSERT INTO session_messages (id, session_id, role, agent_code, body, kind) VALUES
  ('msg-1','sess-1','agent','TU','Great question! The bias-variance tradeoff is one of the foundational concepts in machine learning. Let me break it down visually.','text'),
  ('msg-2','sess-1','agent','TU','Imagine we are trying to predict house prices.' || char(10) || 'A model with high bias makes strong assumptions and tends to underfit.' || char(10) || 'A model with high variance is too flexible and tends to overfit the training data.','text'),
  ('msg-3','sess-1','user',NULL,'Can you show me an example with real data?','text'),
  ('msg-4','sess-1','agent','TU','Here is a real one: a degree-1 polynomial on housing data has high bias (misses the curve). A degree-15 polynomial has high variance (oscillates wildly). A degree-3 or 4 polynomial usually sits in the sweet spot.','text'),
  ('msg-5','sess-1','agent','AS','Quick check — A model with very high variance is most likely to:','quiz');

-- Assignments
INSERT INTO assignments (id, user_id, title, course, status, progress, grade, priority, estimated_minutes, due_date) VALUES
  ('a1','user-1','Implement a Decision Tree from scratch','Machine Learning','in-progress',0.6,NULL,'high',90,'2026-05-28'),
  ('a2','user-1','Hypothesis testing — p-values exercise','Data Science','todo',0.0,NULL,'med',45,'2026-05-29'),
  ('a3','user-1','Prompt patterns — write 5 variants','Generative AI','todo',0.0,NULL,'low',30,'2026-06-02'),
  ('a4','user-1','Linear regression on Boston dataset','Machine Learning','graded',1.0,92,'high',60,'2026-05-25'),
  ('a5','user-1','Vector spaces — proof exercises','Linear Algebra','graded',1.0,88,'med',45,'2026-05-22');

-- Flashcards
INSERT INTO flashcards (id, user_id, deck, front, back, interval_days, ease_factor, reps, next_review) VALUES
  ('c1','user-1','ML · Bias–Variance','What does high variance imply?','The model fits training data closely (including noise) and generalizes poorly. Low train error, high test error.',4,2.5,3,'2026-05-29'),
  ('c2','user-1','ML · Bias–Variance','Define overfitting in one sentence.','When a model captures training-set noise as if it were signal, so it performs worse on new data than on training.',2,2.5,2,'2026-05-29'),
  ('c3','user-1','Calculus','What is the chain rule?','∂(f∘g)/∂x = (∂f/∂g) · (∂g/∂x). It lets us compose derivatives across a chain of functions.',7,2.7,4,'2026-05-29'),
  ('c4','user-1','ML · Regularization','L1 vs L2 regularization — one diff?','L1 (lasso) drives weights toward exactly zero (sparse). L2 (ridge) shrinks weights toward zero but rarely to zero.',1,2.3,1,'2026-05-29');

-- Courses
INSERT INTO courses (slug, title, blurb, author, verified, rating, stars, forks, hours, version, tags) VALUES
  ('ml-foundations','Machine Learning Foundations','A complete introduction to ML concepts, algorithms, and hands-on implementation with Python.',    'Maya Chen',   1,4.9,1200,1100,16,'v2.1','["Machine Learning","Python","Beginner"]'),
  ('systems-design','Systems Design',          'Design scalable systems and prepare for technical interviews with real-world examples.',                'Arjun Patel', 1,4.8,943,876,12,'v1.8','["System Design","Architecture","Intermediate"]'),
  ('linear-algebra','Linear Algebra for AI',  'Master vectors, matrices, eigenvalues, and linear transformations for AI and ML.',                   'Sara Kim',    1,4.9,1100,987,10,'v2.0','["Math","Linear Algebra","Beginner"]'),
  ('prompt-eng','Prompt Engineering',          'Learn to craft powerful prompts and build reliable LLM-powered applications.',                         'Tyler Durden',1,4.8,822,756,8,'v1.6','["LLM","Prompting","Beginner"]'),
  ('deep-learning','Deep Learning',            'From neural networks to transformers — build and train state-of-the-art deep learning models.',        'Maya Chen',   1,4.9,1600,1400,20,'v2.3','["Deep Learning","PyTorch","Advanced"]'),
  ('pgm','Probabilistic Graphical Models',      'Understand probabilistic models and their applications in AI, NLP, and beyond.',                      'Wei Zhou',    1,4.7,612,543,9,'v1.4','["Probabilistic AI","Graphical Models","Intermediate"]');

-- Enrollments
INSERT INTO enrollments (user_id, course_slug, progress, status) VALUES
  ('user-1','ml-foundations',0.68,'enrolled'),
  ('user-1','linear-algebra',0.45,'enrolled');

-- Starred items
INSERT INTO starred_items (user_id, item_type, item_id) VALUES
  ('user-1','course','ml-foundations'),
  ('user-1','course','systems-design'),
  ('user-1','course','linear-algebra'),
  ('user-1','course','deep-learning');

-- Certificates
INSERT INTO certificates (id, user_id, title, mastery, color, id_short, issued_at) VALUES
  ('ce1','user-1','Python for Data Science',0.94,'#7c3aed','LOS-PYDS-2026-0481','2026-05-20'),
  ('ce2','user-1','Linear Algebra for AI',   0.91,'#22d3ee','LOS-LINAL-2026-0233','2026-04-04'),
  ('ce3','user-1','Probability & Statistics',0.89,'#e0476a','LOS-PROBS-2026-0119','2026-02-18');

-- Badges
INSERT INTO badges (id, user_id, label, glyph) VALUES
  ('b1','user-1','12-day streak',          'flame'),
  ('b2','user-1','First quiz 100%',       'check'),
  ('b3','user-1','First fork',            'fork'),
  ('b4','user-1','Module mastered',       'star'),
  ('b5','user-1','5 sessions in a week',  'bolt'),
  ('b6','user-1','Contributor',           'spark');

-- Activity log
INSERT INTO activity_log (id, user_id, kind, text, sub, xp, agent) VALUES
  ('al-1','user-1','quiz',      'Completed "Cross-Validation" quiz',        'Machine Learning Engineer',120,'AS'),
  ('al-2','user-1','assignment','Submitted assignment "Model Tuning"',        'Data Science Fundamentals',250,'AS'),
  ('al-3','user-1','cert',      'Earned Certificate',                       'Python for Data Science',  0,'CE'),
  ('al-4','user-1','session',   'Joined session "Intro to LLMs"',           'with Research Agent',      0,'RE'),
  ('al-5','user-1','quiz',      'Completed "Regularization" quiz',           'Machine Learning Engineer',180,'AS'),
  ('al-6','user-1','session',   'Completed "Bias Intuition" session',        'Machine Learning Engineer',200,'TU'),
  ('al-7','user-1','assignment','Submitted "Gradient Descent" assignment',   'Machine Learning Engineer',300,'AS');

-- Schedule events (Mon=0 through Sun=6)
INSERT INTO schedule_events (id, user_id, title, event_type, agent, day_of_week, start_hour, duration_hours) VALUES
  ('ev-1', 'user-1','Bias–Variance Tradeoff',   'session',  'TU', 0, 9,   1),
  ('ev-2', 'user-1','Spaced review · 12 cards', 'review',   'AN', 0, 14,  0.75),
  ('ev-3', 'user-1','Model Evaluation Metrics', 'session',  'TU', 1, 11,  0.75),
  ('ev-4', 'user-1','Assignment · Model Tuning','assign',   'AS', 1, 15,  1),
  ('ev-5', 'user-1','Reading: Olah on Comp Graphs','read',  'RE', 2, 10,  1.25),
  ('ev-6', 'user-1','Prompt Engineering Deep Dive','session','RE',2, 14,  1),
  ('ev-7', 'user-1','Spaced review · 8 cards',  'review',   'AN', 3, 9,   0.5),
  ('ev-8', 'user-1','Cross-validation',          'session',  'TU', 3, 13,  1.25),
  ('ev-9', 'user-1','Office hours · Maya Chen',  'live',     'TU', 4, 10,  1),
  ('ev-10','user-1','Project · Build a classifier','project','CR',5, 11,  1.5);
