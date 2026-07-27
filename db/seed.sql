-- LearnOS Seed Data
-- A fully populated example user "Alex Learner" with realistic learning data.

-- The single local user (no login — this is "you" on your own machine).
INSERT INTO users (id, name, email, role, level, xp, xp_to_next, streak, best_streak)
VALUES ('user-1', 'Alex Learner', 'you@localhost',
  'user', 4, 2350, 3000, 12, 18);

-- Settings
INSERT INTO user_settings (user_id, theme, density, font_size, local_only)
VALUES ('user-1', 'dark', 'regular', 14, 0);

-- NOTE: this file used to seed four invented "community members" who authored
-- fake threads so the app would look socially active. LearnOS is single-user and
-- self-hosted — there is no one else — so that was simply fabricated data
-- dressed up as a community. It has been removed. Sharing now happens the way it
-- actually can for a local open-source tool: courses are exported and imported
-- as files (see routes/share.js).

-- API keys are added in Settings → API Keys (OpenRouter), or via the
-- OPENROUTER_API_KEY env var. No key is seeded — add your own to go live.

-- Agent routing defaults (OpenRouter model slugs — change any of these in Settings)
INSERT INTO agent_routing (user_id, agent_code, model) VALUES
  ('user-1', 'TU', 'anthropic/claude-sonnet-4.6'),
  ('user-1', 'PR', 'anthropic/claude-haiku-4.5'),
  ('user-1', 'CR', 'anthropic/claude-haiku-4.5'),
  ('user-1', 'AS', 'anthropic/claude-haiku-4.5'),
  ('user-1', 'RE', 'anthropic/claude-haiku-4.5'),
  ('user-1', 'AN', 'anthropic/claude-haiku-4.5'),
  ('user-1', 'CE', 'anthropic/claude-haiku-4.5');

-- Agent status is app config, not example content — it is bootstrapped
-- unconditionally in db/database.js (ensureAgentStatus) so the 7 agents exist
-- even in zero-seed mode, with honest neutral status (no fabricated telemetry).

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
  ('msg-5','sess-1','agent','AS','Quick check: a model with very high variance is most likely to **overfit** — it fits the training noise and generalizes poorly to new data. Want to test yourself properly? Hit **Generate quiz** above for a scored quiz on this module.','text');

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

-- ── Course syllabi: modules + readable lessons ───────────────────────────────
-- Without these every catalog course opened to "This course has no modules yet"
-- and there was nothing to read. Each module ships one substantive lesson so the
-- course → syllabus → lesson → mark-complete workflow works out of the box.
INSERT INTO course_modules (id, course_slug, title, summary, order_idx, estimated_minutes) VALUES
  ('cm-mlf-1','ml-foundations','What machine learning actually is','Supervised vs unsupervised · the learning loop',0,40),
  ('cm-mlf-2','ml-foundations','Linear regression from scratch','Least squares · gradient descent',1,55),
  ('cm-mlf-3','ml-foundations','Overfitting and regularization','Bias-variance · L1/L2 · cross-validation',2,50),
  ('cm-sd-1','systems-design','Scaling fundamentals','Vertical vs horizontal · statelessness',0,45),
  ('cm-sd-2','systems-design','Caching and CDNs','Cache layers · invalidation · edge delivery',1,45),
  ('cm-sd-3','systems-design','Design a URL shortener','Applying the patterns end to end',2,60),
  ('cm-la-1','linear-algebra','Vectors and vector spaces','Span · basis · dimension',0,45),
  ('cm-la-2','linear-algebra','Matrices as linear maps','Transformations · composition',1,50),
  ('cm-la-3','linear-algebra','Eigenvalues and eigenvectors','Invariant directions · diagonalization',2,55),
  ('cm-pe-1','prompt-eng','How an LLM reads your prompt','Tokens · context · attention to instructions',0,35),
  ('cm-pe-2','prompt-eng','Few-shot and chain-of-thought','Examples · reasoning scaffolds',1,40),
  ('cm-pe-3','prompt-eng','Structured output and tools','JSON schemas · function calling',2,45),
  ('cm-dl-1','deep-learning','Neurons, layers and the forward pass','From linear models to networks',0,45),
  ('cm-dl-2','deep-learning','Backpropagation','The chain rule at scale',1,60),
  ('cm-dl-3','deep-learning','Transformers and attention','Self-attention · positional encoding',2,65),
  ('cm-pgm-1','pgm','Probability refresher','Joint · conditional · marginal',0,40),
  ('cm-pgm-2','pgm','Bayesian networks','DAGs · conditional independence',1,50),
  ('cm-pgm-3','pgm','Inference in graphical models','Exact vs approximate',2,55);

INSERT INTO module_lessons (id, module_id, title, body_md, kind, order_idx) VALUES
  ('ml-mlf-1','cm-mlf-1','What machine learning actually is','# What machine learning actually is' || char(10) || char(10) || 'Machine learning is the practice of fitting a function to data instead of writing that function by hand.' || char(10) || char(10) || '## The three families' || char(10) || char(10) || '- **Supervised** — you have inputs and correct answers. The model learns the mapping.' || char(10) || '- **Unsupervised** — you only have inputs. The model finds structure (clusters, factors).' || char(10) || '- **Reinforcement** — an agent acts, receives reward, and improves a policy.' || char(10) || char(10) || '## The learning loop' || char(10) || char(10) || 'Every supervised model repeats four steps: predict, measure error with a loss function, compute how each parameter contributed, nudge the parameters. Training is that loop run until the loss stops improving.' || char(10) || char(10) || 'The essential discipline is holding out data. A model that has seen the test set tells you nothing about how it will behave on new inputs.','reading',0),
  ('ml-mlf-2','cm-mlf-2','Linear regression from scratch','# Linear regression from scratch' || char(10) || char(10) || 'Linear regression predicts y = wx + b. Simple, and the foundation for almost everything else.' || char(10) || char(10) || '## Least squares' || char(10) || char(10) || 'We measure error as mean squared error: the average of (prediction - truth) squared. Squaring punishes large mistakes and keeps the function smooth, which matters because we differentiate it.' || char(10) || char(10) || '## Gradient descent' || char(10) || char(10) || 'The gradient points uphill, so we step the opposite way. Repeat: compute predictions, compute the gradient of the loss with respect to w and b, subtract a small multiple of it.' || char(10) || char(10) || 'Learning rate is the whole game. Too large and the loss oscillates or diverges; too small and training crawls.','reading',0),
  ('ml-mlf-3','cm-mlf-3','Overfitting and regularization','# Overfitting and regularization' || char(10) || char(10) || 'A model that memorizes the training set has low training error and high test error. That gap is overfitting.' || char(10) || char(10) || '## Bias and variance' || char(10) || char(10) || '- **High bias** — the model is too simple. It underfits and misses real structure.' || char(10) || '- **High variance** — the model is too flexible. It fits noise as if it were signal.' || char(10) || char(10) || '## Regularization' || char(10) || char(10) || 'Add a penalty on weight size to the loss. **L2 (ridge)** shrinks weights smoothly toward zero. **L1 (lasso)** drives some weights to exactly zero, which doubles as feature selection.' || char(10) || char(10) || 'Use k-fold cross-validation to choose the penalty strength rather than trusting a single split.','reading',0),
  ('ml-sd-1','cm-sd-1','Scaling fundamentals','# Scaling fundamentals' || char(10) || char(10) || 'Vertical scaling buys a bigger machine. It is simple and has a hard ceiling. Horizontal scaling adds machines and has no ceiling, but forces you to confront state.' || char(10) || char(10) || '## Statelessness' || char(10) || char(10) || 'A stateless service stores no per-user data in memory, so any instance can serve any request and you can add or remove instances freely. Push state into a database, cache, or object store.' || char(10) || char(10) || '## Where systems actually break' || char(10) || char(10) || 'Rarely CPU. Usually the database, a shared lock, or an unbounded queue. Measure before you scale.','reading',0),
  ('ml-sd-2','cm-sd-2','Caching and CDNs','# Caching and CDNs' || char(10) || char(10) || 'A cache trades freshness for latency. The engineering is entirely in deciding how stale is acceptable.' || char(10) || char(10) || '## Layers' || char(10) || char(10) || 'Browser cache, CDN edge, application cache (Redis), and the database buffer pool. A request that never reaches your origin is the cheapest request you will ever serve.' || char(10) || char(10) || '## Invalidation' || char(10) || char(10) || 'Two workable strategies: expire on a TTL, or write-through and update the cache when the record changes. Avoid the thundering herd by adding jitter to expiry times.','reading',0),
  ('ml-sd-3','cm-sd-3','Design a URL shortener','# Design a URL shortener' || char(10) || char(10) || 'A compact exercise that touches hashing, storage, caching, and scale.' || char(10) || char(10) || '## Requirements' || char(10) || char(10) || 'Shorten a long URL, redirect quickly, handle far more reads than writes.' || char(10) || char(10) || '## Key decisions' || char(10) || char(10) || '- Generate the key from a counter encoded in base62 rather than hashing, to avoid collisions.' || char(10) || '- Redirects are read-heavy and immutable — cache aggressively at the edge.' || char(10) || '- Store the mapping in a key-value store; this workload does not need joins.','reading',0),
  ('ml-la-1','cm-la-1','Vectors and vector spaces','# Vectors and vector spaces' || char(10) || char(10) || 'A vector is an element you can add to another and scale by a number. That is the entire definition.' || char(10) || char(10) || '## Span and basis' || char(10) || char(10) || 'The **span** of a set of vectors is every point you can reach by scaling and adding them. A **basis** is a spanning set with no redundancy, and its size is the **dimension**.' || char(10) || char(10) || 'Coordinates are always relative to a basis. Changing basis does not move the vector, only its description.','reading',0),
  ('ml-la-2','cm-la-2','Matrices as linear maps','# Matrices as linear maps' || char(10) || char(10) || 'Stop reading a matrix as a grid of numbers. Read it as a function that sends vectors to vectors.' || char(10) || char(10) || '## The columns tell you everything' || char(10) || char(10) || 'Column j of the matrix is where the j-th basis vector lands. Because the map is linear, that fully determines the transformation.' || char(10) || char(10) || '## Composition' || char(10) || char(10) || 'Matrix multiplication is function composition, which is exactly why it is associative but not commutative — doing A then B is not doing B then A.','reading',0),
  ('ml-la-3','cm-la-3','Eigenvalues and eigenvectors','# Eigenvalues and eigenvectors' || char(10) || char(10) || 'An eigenvector is a direction the transformation does not rotate — it only stretches it. The stretch factor is the eigenvalue.' || char(10) || char(10) || '## Why they matter' || char(10) || char(10) || 'In an eigenbasis the transformation is just independent scaling along each axis. That turns hard repeated operations into simple exponentiation, which is why eigen-decomposition underpins PCA, PageRank, and stability analysis.','reading',0),
  ('ml-pe-1','cm-pe-1','How an LLM reads your prompt','# How an LLM reads your prompt' || char(10) || char(10) || 'The model sees a sequence of tokens and predicts the next one. Everything else is a consequence of that.' || char(10) || char(10) || '## Practical implications' || char(10) || char(10) || '- Instructions compete for attention. Bury a constraint in paragraph five and it may be ignored.' || char(10) || '- Position matters — the start and end of the context are attended to most reliably.' || char(10) || '- The model has no memory between calls. Anything it must know has to be in the context.' || char(10) || char(10) || 'Be specific about format, audience, and constraints. Vague prompts produce average answers.','reading',0),
  ('ml-pe-2','cm-pe-2','Few-shot and chain-of-thought','# Few-shot and chain-of-thought' || char(10) || char(10) || '## Few-shot' || char(10) || char(10) || 'Show two or three worked examples in exactly the format you want back. Examples communicate format far more reliably than a description of the format.' || char(10) || char(10) || '## Chain-of-thought' || char(10) || char(10) || 'Asking the model to work step by step gives it room to compute intermediate results before committing to an answer, which measurably improves multi-step reasoning.' || char(10) || char(10) || 'If you need only the final answer, ask it to reason first and then output the result on a clearly marked final line.','reading',0),
  ('ml-pe-3','cm-pe-3','Structured output and tools','# Structured output and tools' || char(10) || char(10) || 'Prose is for humans. When another program consumes the output, constrain it.' || char(10) || char(10) || '## JSON schemas' || char(10) || char(10) || 'Supplying a schema makes the response parseable by construction. Always validate anyway, and always handle the parse failure — a model can still return prose around the JSON.' || char(10) || char(10) || '## Tools' || char(10) || char(10) || 'Tool calling lets the model request an action instead of hallucinating its result. Give each tool a narrow purpose and a precise description; the description is the prompt the model uses to decide.','reading',0),
  ('ml-dl-1','cm-dl-1','Neurons, layers and the forward pass','# Neurons, layers and the forward pass' || char(10) || char(10) || 'A neuron computes a weighted sum then applies a nonlinearity. Without the nonlinearity, stacking layers collapses to a single linear map and buys you nothing.' || char(10) || char(10) || '## The forward pass' || char(10) || char(10) || 'Multiply by a weight matrix, add a bias, apply an activation, repeat. Depth lets early layers build simple features that later layers compose into complex ones.' || char(10) || char(10) || 'ReLU is the default activation because it is cheap and does not saturate for positive inputs.','reading',0),
  ('ml-dl-2','cm-dl-2','Backpropagation','# Backpropagation' || char(10) || char(10) || 'Backprop is the chain rule applied to a computation graph, reusing shared work.' || char(10) || char(10) || '## The idea' || char(10) || char(10) || 'The forward pass records what each operation did. The backward pass walks the graph in reverse, multiplying local derivatives to get the gradient of the loss with respect to every parameter.' || char(10) || char(10) || 'Its efficiency is the point: one backward pass costs about the same as one forward pass, no matter how many millions of parameters there are.' || char(10) || char(10) || 'Vanishing gradients in deep stacks are why residual connections and normalization exist.','reading',0),
  ('ml-dl-3','cm-dl-3','Transformers and attention','# Transformers and attention' || char(10) || char(10) || 'Attention lets every position look directly at every other position, removing the sequential bottleneck of recurrence.' || char(10) || char(10) || '## Query, key, value' || char(10) || char(10) || 'Each token emits a query (what am I looking for), a key (what do I offer), and a value (what I pass on). Similarity between queries and keys becomes the weights used to average the values.' || char(10) || char(10) || '## Why it won' || char(10) || char(10) || 'Every position is computed in parallel, and the path length between any two tokens is one step — so long-range dependencies survive. Position must be injected explicitly, since attention itself is order-agnostic.','reading',0),
  ('ml-pgm-1','cm-pgm-1','Probability refresher','# Probability refresher' || char(10) || char(10) || 'Three quantities do most of the work: the joint P(A,B), the conditional P(A|B), and the marginal P(A).' || char(10) || char(10) || '## The rules that matter' || char(10) || char(10) || '- Product rule: P(A,B) = P(A|B)P(B)' || char(10) || '- Marginalization: sum the joint over the variables you do not care about.' || char(10) || '- Bayes: P(A|B) = P(B|A)P(A) / P(B) — how evidence updates belief.' || char(10) || char(10) || 'Independence is what makes large models tractable, because it lets a huge joint factor into small pieces.','reading',0),
  ('ml-pgm-2','cm-pgm-2','Bayesian networks','# Bayesian networks' || char(10) || char(10) || 'A Bayesian network is a directed acyclic graph where each node carries the distribution of a variable given its parents.' || char(10) || char(10) || '## Why the graph helps' || char(10) || char(10) || 'The full joint is the product of those local distributions. A joint over 30 binary variables needs a billion numbers; a sparse network may need only a few hundred.' || char(10) || char(10) || 'Edges encode conditional independence. Reading independence off the structure is the core skill.','reading',0),
  ('ml-pgm-3','cm-pgm-3','Inference in graphical models','# Inference in graphical models' || char(10) || char(10) || 'Inference means computing the distribution of some variables given observed values of others.' || char(10) || char(10) || '## Exact' || char(10) || char(10) || 'Variable elimination sums out variables one at a time, reusing intermediate factors. Exact and efficient on sparse graphs; intractable as connectivity grows.' || char(10) || char(10) || '## Approximate' || char(10) || char(10) || 'When exact inference is out of reach, sample (MCMC) or optimize a simpler surrogate distribution (variational inference). You trade a guaranteed answer for one that is close enough.','reading',0);

-- Embedded media + verified public resources woven into modules (Coursera-style).
-- Videos embed inline in the lesson viewer; others render as rich resource cards.
INSERT INTO module_lessons (id, module_id, title, body_md, kind, order_idx, url) VALUES
  ('mlv-mlf-1','cm-mlf-1','Watch · But what is a neural network? (3Blue1Brown)','A visual, intuition-first tour of what a network computes.','video',1,'https://www.youtube.com/watch?v=aircAruvnKk'),
  ('mla-mlf-1','cm-mlf-1','Read · Machine learning (Wikipedia)','A broad map of the field, its tasks, and its methods.','article',2,'https://en.wikipedia.org/wiki/Machine_learning'),
  ('mlv-mlf-2','cm-mlf-2','Watch · Gradient descent, how neural networks learn','How the loss is minimized step by step.','video',1,'https://www.youtube.com/watch?v=IHZwWFHWa-w'),
  ('mlv-dl-2','cm-dl-2','Watch · Backpropagation calculus (3Blue1Brown)','The chain rule that trains deep networks.','video',1,'https://www.youtube.com/watch?v=tIeHLnjs5U8'),
  ('mlv-dl-3','cm-dl-3','Watch · Attention in transformers, visually explained','See self-attention computed, one step at a time.','video',1,'https://www.youtube.com/watch?v=eMlx5fFNoYc'),
  ('mlp-dl-3','cm-dl-3','Paper · Attention Is All You Need','The original transformer paper (Vaswani et al., 2017).','paper',2,'https://arxiv.org/abs/1706.03762'),
  ('mlv-la-1','cm-la-1','Watch · Vectors, what even are they? (3Blue1Brown)','The geometric foundation of linear algebra.','video',1,'https://www.youtube.com/watch?v=fNk_zzaMoSs'),
  ('mlv-la-3','cm-la-3','Watch · Eigenvectors and eigenvalues (3Blue1Brown)','Geometric intuition for eigen-decomposition.','video',1,'https://www.youtube.com/watch?v=PFDu9oVAE-g'),
  ('mla-pe-1','cm-pe-1','Read · Prompt engineering (Wikipedia)','An overview of prompting techniques for LLMs.','article',1,'https://en.wikipedia.org/wiki/Prompt_engineering'),
  ('mlv-sd-1','cm-sd-1','Read · Scalability (Wikipedia)','Vertical vs horizontal scaling and their trade-offs.','article',1,'https://en.wikipedia.org/wiki/Scalability');
