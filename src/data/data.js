// data.js — content for LearnOS

export const USER = {
  name: 'Alex Learner',
  email: 'alex@learnos.dev',
  level: 4,
  xp: 2350,
  xpToNext: 3000,
  streak: 12,
  bestStreak: 18,
  plan: 'Pro',
  avatarInitials: 'AL',
};

export const AGENTS = {
  TU: { code: 'TU', name: 'Tutor',         color: 'var(--agent-tu)', short: 'Teaches concepts, answers questions, explains deeply.', icon: 'cap' },
  PR: { code: 'PR', name: 'Profiling',     color: 'var(--agent-pr)', short: 'Understands you — your goals, pace, background.', icon: 'user' },
  CR: { code: 'CR', name: 'Curriculum',    color: 'var(--agent-cr)', short: 'Creates personalized roadmaps and learning paths.', icon: 'graph' },
  AS: { code: 'AS', name: 'Assessment',    color: 'var(--agent-as)', short: 'Generates quizzes and evaluates mastery.', icon: 'check' },
  RE: { code: 'RE', name: 'Research',      color: 'var(--agent-re)', short: 'Finds, summarizes, and cites the best resources.', icon: 'search' },
  AN: { code: 'AN', name: 'Analytics',     color: 'var(--agent-an)', short: 'Tracks progress and surfaces insights.', icon: 'chart' },
  CE: { code: 'CE', name: 'Certification', color: 'var(--agent-ce)', short: 'Issues verifiable certificates and badges.', icon: 'ribbon' },
};

export const ROADMAPS = [
  {
    id: 'rm-ml-engineer',
    title: 'Machine Learning Engineer',
    level: 4, status: 'In Progress',
    mastery: 0.68,
    nextModule: 'Bias–Variance Tradeoff',
    modulesLeft: 2,
    color: 'var(--brand)',
    icon: 'box',
  },
  {
    id: 'rm-data-sci',
    title: 'Data Science Fundamentals',
    level: 3, status: 'In Progress',
    mastery: 0.45,
    nextModule: 'Hypothesis Testing',
    modulesLeft: 3,
    color: 'var(--brand-3)',
    icon: 'chart',
  },
  {
    id: 'rm-genai',
    title: 'Generative AI Mastery',
    level: 2, status: 'In Progress',
    mastery: 0.32,
    nextModule: 'Prompt Engineering',
    modulesLeft: 1,
    color: 'oklch(0.74 0.18 25)',
    icon: 'spark',
  },
];

export const ACTIVE_ROADMAP = {
  id: 'rm-ml-engineer',
  title: 'Machine Learning Engineer',
  subtitle: 'Foundations through deployment, in 24 modules',
  authoredBy: 'community · forked from karpathy/zero-to-hero',
  mastery: 0.68,
  weekStreak: 4,
  totalModules: 24,
  completedModules: 14,
  nodes: [
    { id: 'n1',  title: 'Vectors & spaces',          row: 0, col: 0, mastery: 1.0,  status: 'done' },
    { id: 'n2',  title: 'Linear regression',         row: 0, col: 1, mastery: 1.0,  status: 'done' },
    { id: 'n3',  title: 'Gradient descent',          row: 0, col: 2, mastery: 0.95, status: 'done' },
    { id: 'n4',  title: 'Logistic regression',       row: 1, col: 1, mastery: 0.88, status: 'done' },
    { id: 'n5',  title: 'Regularization',            row: 1, col: 2, mastery: 0.74, status: 'done' },
    { id: 'n6',  title: 'Bias–Variance Tradeoff',    row: 0, col: 3, mastery: 0.72, status: 'active' },
    { id: 'n7',  title: 'Cross-validation',          row: 1, col: 3, mastery: 0.30, status: 'next' },
    { id: 'n8',  title: 'Backpropagation',           row: 0, col: 4, mastery: 0.10, status: 'locked' },
    { id: 'n9',  title: 'Optimizers',                row: 1, col: 4, mastery: 0.00, status: 'locked' },
    { id: 'n10', title: 'Convolutions',              row: 0, col: 5, mastery: 0.00, status: 'locked' },
    { id: 'n11', title: 'Transformers',              row: 1, col: 5, mastery: 0.00, status: 'locked' },
  ],
  edges: [
    ['n1','n2'],['n2','n3'],['n2','n4'],['n3','n4'],['n3','n5'],['n4','n5'],
    ['n5','n6'],['n5','n7'],['n6','n7'],['n6','n8'],['n7','n8'],['n7','n9'],
    ['n8','n9'],['n8','n10'],['n9','n11'],['n10','n11'],
  ],
};

export const UPCOMING_SESSIONS = [
  { id: 's1', title: 'Bias–Variance Tradeoff',     agent: 'TU', when: 'Today',     time: '4:00 PM',  length: 60 },
  { id: 's2', title: 'Model Evaluation Metrics',   agent: 'TU', when: 'Tomorrow',  time: '11:00 AM', length: 45 },
  { id: 's3', title: 'Prompt Engineering Deep Dive', agent: 'RE', when: 'May 28', time: '2:00 PM',  length: 60 },
];

export const RECENT_ACTIVITY = [
  { kind: 'quiz',       text: 'Completed "Cross-Validation" quiz',   sub: 'Machine Learning Engineer', when: '2h ago', xp: 120, agent: 'AS' },
  { kind: 'assignment', text: 'Submitted assignment "Model Tuning"', sub: 'Data Science Fundamentals', when: '5h ago', xp: 250, agent: 'AS' },
  { kind: 'cert',       text: 'Earned Certificate',                   sub: 'Python for Data Science',   when: 'Yesterday', agent: 'CE' },
  { kind: 'session',    text: 'Joined session "Intro to LLMs"',       sub: 'with Research Agent',       when: 'Yesterday', agent: 'RE' },
];

export const LEARNING_PROGRESS = [
  { d: 'Mon', v: 1.4 }, { d: 'Tue', v: 2.0 }, { d: 'Wed', v: 1.6 },
  { d: 'Thu', v: 2.4 }, { d: 'Fri', v: 1.2 }, { d: 'Sat', v: 2.6 }, { d: 'Sun', v: 1.9 },
];

export const STREAK_BARS = [3, 5, 4, 6, 5, 7, 8, 6, 7, 9, 8, 12];

export const SESSION = {
  title: 'Bias–Variance Tradeoff',
  subtitle: 'Understanding the balance between bias and variance to build better models.',
  course: 'Machine Learning',
  level: 'Intermediate',
  index: 6, total: 12,
  outline: [
    { label: 'What is Bias?',           state: 'done' },
    { label: 'What is Variance?',       state: 'done' },
    { label: 'The Tradeoff Intuition',  state: 'done' },
    { label: 'Underfitting vs Overfitting', state: 'done' },
    { label: 'Visualizing the Tradeoff', state: 'done' },
    { label: 'Finding the Right Balance', state: 'active' },
    { label: 'Practical Guidelines',    state: 'queued' },
  ],
  concepts: ['Bias','Variance','Underfitting','Overfitting','Model Complexity','Generalization','Cross Validation'],
  signals: [
    { label: 'Mastery — Machine Learning', value: 0.68, sub: 'overall' },
    { label: 'Bias–Variance Tradeoff',      value: 0.72, sub: 'this session' },
  ],
};

export const QUIZ = {
  prompt: "A model with very high variance is most likely to:",
  options: [
    { id: 'a', text: 'Underfit the training data',                       verdict: 'wrong', feedback: "High variance is the opposite — it fits training too well, including noise." },
    { id: 'b', text: 'Have high error on both train and test',           verdict: 'wrong', feedback: "That's high bias. High variance has LOW train error but HIGH test error." },
    { id: 'c', text: 'Overfit — low train error, high test error',       verdict: 'right', feedback: "Exactly. High variance memorizes training noise, so it generalizes poorly to unseen data." },
    { id: 'd', text: 'Generalize perfectly to new data',                 verdict: 'wrong', feedback: "Generalization is what we want — but it's the opposite of high variance." },
  ],
};

export const SEED_MESSAGES = [
  { role: 'agent', agent: 'TU', kind: 'text', t: '10:32 AM',
    body: "Great question! The bias-variance tradeoff is one of the foundational concepts in machine learning. Let\'s break it down visually." },
  { role: 'agent', agent: 'TU', kind: 'text',
    body: "Imagine we\'re trying to predict house prices.\nA model with high bias makes strong assumptions and tends to underfit.\nA model with high variance is too flexible and tends to overfit the training data." },
  { role: 'agent', agent: 'TU', kind: 'viz', vizKind: 'tradeoff-trio',
    body: "Here\'s a visualization:" },
  { role: 'agent', agent: 'TU', kind: 'text',
    body: "The goal is to find that sweet spot in the middle." },
  { role: 'user', kind: 'text', t: '10:34 AM',
    body: "Can you show me an example with real data?" },
  { role: 'agent', agent: 'AS', kind: 'quiz', quiz: QUIZ },
];

export const COURSES = [
  { slug: 'ml-foundations',     title: 'Machine Learning Foundations', author: 'Maya Chen',  verified: true,
    blurb: 'A complete introduction to ML concepts, algorithms, and hands-on implementation with Python.',
    stars: 1200, forks: 1100, hours: 16, version: 'v2.1', tags: ['Machine Learning','Python','Beginner'], rating: 4.9 },
  { slug: 'systems-design',     title: 'Systems Design',               author: 'Arjun Patel', verified: true,
    blurb: 'Design scalable systems and prepare for technical interviews with real-world examples.',
    stars: 943, forks: 876, hours: 12, version: 'v1.8', tags: ['System Design','Architecture','Intermediate'], rating: 4.8 },
  { slug: 'linear-algebra',     title: 'Linear Algebra for AI',        author: 'Sara Kim',    verified: true,
    blurb: 'Master vectors, matrices, eigenvalues, and linear transformations for AI and ML.',
    stars: 1100, forks: 987, hours: 10, version: 'v2.0', tags: ['Math','Linear Algebra','Beginner'], rating: 4.9 },
  { slug: 'prompt-eng',         title: 'Prompt Engineering',           author: 'Tyler Durden',verified: true,
    blurb: 'Learn to craft powerful prompts and build reliable LLM-powered applications.',
    stars: 822, forks: 756, hours: 8, version: 'v1.6', tags: ['LLM','Prompting','Beginner'], rating: 4.8 },
  { slug: 'deep-learning',      title: 'Deep Learning',                author: 'Maya Chen',  verified: true,
    blurb: 'From neural networks to transformers — build and train state-of-the-art deep learning models.',
    stars: 1600, forks: 1400, hours: 20, version: 'v2.3', tags: ['Deep Learning','PyTorch','Advanced'], rating: 4.9 },
  { slug: 'pgm',                title: 'Probabilistic Graphical Models', author: 'Wei Zhou', verified: true,
    blurb: 'Understand probabilistic models and their applications in AI, NLP, and beyond.',
    stars: 612, forks: 543, hours: 9, version: 'v1.4', tags: ['Probabilistic AI','Graphical Models','Intermediate'], rating: 4.7 },
];

export const COURSE_FEATURED = [
  { slug: 'llm-app',     title: 'LLM Application Engineering', author: 'Maya Chen',  rating: 4.9, learners: 1200 },
  { slug: 'rag',         title: 'Advanced RAG Systems',        author: 'Tyler Durden', rating: 4.8, learners: 948 },
  { slug: 'langgraph',   title: 'Agents with LangGraph',       author: 'Pranav Vijay', rating: 4.9, learners: 821 },
];

export const COURSE_VERSIONS = [
  { v: 'v2.1', label: 'Latest', when: '2 days ago', notes: ['Added new section on Model Evaluation', 'Updated exercises & solutions', 'Improved explanations and visuals'] },
  { v: 'v2.0', when: '3 weeks ago', notes: ['Restructured into 12 chapters', 'New project: build a classifier'] },
  { v: 'v1.9', when: 'last month',  notes: ['Fixed errata in chapter 4'] },
];

export const TOP_CONTRIBUTORS = [
  { name: 'Maya Chen',   n: 42 },
  { name: 'Arjun Patel', n: 33 },
  { name: 'Sara Kim',    n: 28 },
  { name: 'Wei Zhou',    n: 21 },
];

export const SCHEDULE_DAYS = (() => {
  const days = ['Mon 26','Tue 27','Wed 28','Thu 29','Fri 30','Sat 31','Sun 01'];
  const items = [
    { day: 0, start: 9,  len: 1,    title: 'Bias–Variance Tradeoff',   agent: 'TU', kind: 'session' },
    { day: 0, start: 14, len: 0.75, title: 'Spaced review · 12 cards', agent: 'AN', kind: 'review' },
    { day: 1, start: 11, len: 0.75, title: 'Model Evaluation Metrics', agent: 'TU', kind: 'session' },
    { day: 1, start: 15, len: 1,    title: 'Assignment · Model Tuning',agent: 'AS', kind: 'assign' },
    { day: 2, start: 10, len: 1.25, title: 'Reading: Olah on Comp Graphs', agent: 'RE', kind: 'read' },
    { day: 2, start: 14, len: 1,    title: 'Prompt Engineering Deep Dive', agent: 'RE', kind: 'session' },
    { day: 3, start: 9,  len: 0.5,  title: 'Spaced review · 8 cards',   agent: 'AN', kind: 'review' },
    { day: 3, start: 13, len: 1.25, title: 'Cross-validation',          agent: 'TU', kind: 'session' },
    { day: 4, start: 10, len: 1,    title: 'Office hours · Maya Chen',  agent: 'TU', kind: 'live' },
    { day: 5, start: 11, len: 1.5,  title: 'Project · Build a classifier', agent: 'CR', kind: 'project' },
  ];
  return { days, items };
})();

export const ASSIGNMENTS = [
  { id: 'a1', title: 'Implement a Decision Tree from scratch', course: 'Machine Learning', due: 'Thu, May 28', status: 'in-progress', pct: 0.6, est: '90 min', priority: 'high' },
  { id: 'a2', title: 'Hypothesis testing — p-values exercise', course: 'Data Science',     due: 'Fri, May 29', status: 'todo', pct: 0, est: '45 min', priority: 'med' },
  { id: 'a3', title: 'Prompt patterns — write 5 variants',     course: 'Generative AI',    due: 'Tue, Jun 02', status: 'todo', pct: 0, est: '30 min', priority: 'low' },
  { id: 'a4', title: 'Linear regression on Boston dataset',    course: 'Machine Learning', due: 'Yesterday',  status: 'graded', pct: 1, grade: 92, est: '60 min', priority: 'high' },
  { id: 'a5', title: 'Vector spaces — proof exercises',        course: 'Linear Algebra',   due: 'May 22',     status: 'graded', pct: 1, grade: 88, est: '45 min', priority: 'med' },
];

export const FLASHCARDS = [
  { id: 'c1', q: 'What does high variance imply?',       a: 'The model fits training data closely (including noise) and generalizes poorly. Low train error, high test error.', deck: 'ML · Bias–Variance', interval: '4d', due: 'today' },
  { id: 'c2', q: 'Define overfitting in one sentence.', a: 'When a model captures training-set noise as if it were signal, so it performs worse on new data than on training.', deck: 'ML · Bias–Variance', interval: '2d', due: 'today' },
  { id: 'c3', q: 'What is the chain rule?',              a: '∂(f∘g)/∂x = (∂f/∂g) · (∂g/∂x). It lets us compose derivatives across a chain of functions.',                            deck: 'Calculus',           interval: '7d', due: 'today' },
  { id: 'c4', q: 'L1 vs L2 regularization — one diff?',  a: 'L1 (lasso) drives weights toward exactly zero (sparse). L2 (ridge) shrinks weights toward zero but rarely to zero.',     deck: 'ML · Regularization',interval: '1d', due: 'today' },
];

export const CERTIFICATES = [
  { id: 'ce1', title: 'Python for Data Science', issued: 'May 20, 2026', mastery: 0.94, color: 'var(--brand)', id_short: 'LOS-PYDS-2026-0481', earned: true },
  { id: 'ce2', title: 'Linear Algebra for AI',    issued: 'Apr 04, 2026', mastery: 0.91, color: 'var(--brand-3)', id_short: 'LOS-LINAL-2026-0233', earned: true },
  { id: 'ce3', title: 'Probability & Statistics', issued: 'Feb 18, 2026', mastery: 0.89, color: 'oklch(0.74 0.18 25)', id_short: 'LOS-PROBS-2026-0119', earned: true },
];

export const BADGES = [
  { id: 'b1', label: '12-day streak',  glyph: 'flame' },
  { id: 'b2', label: 'First quiz 100%', glyph: 'check' },
  { id: 'b3', label: 'First fork',      glyph: 'fork' },
  { id: 'b4', label: 'Module mastered', glyph: 'star' },
  { id: 'b5', label: '5 sessions in a week', glyph: 'bolt' },
  { id: 'b6', label: 'Contributor',     glyph: 'spark' },
];

export const DISCUSSIONS = [
  { id: 'd1', title: 'Best way to build intuition for backprop?',  author: 'Sara Kim',     replies: 23, votes: 86, course: 'ml-foundations', tag: 'question', when: '1h ago' },
  { id: 'd2', title: 'Errata: chapter 4 has a typo on page 12',    author: 'Wei Zhou',     replies: 4,  votes: 14, course: 'systems-design', tag: 'errata',   when: '4h ago' },
  { id: 'd3', title: 'Just forked the LLM course — adding examples', author: 'Pranav Vijay', replies: 11, votes: 41, course: 'prompt-eng',     tag: 'show',     when: '7h ago' },
  { id: 'd4', title: 'Study group — Foundations of ML, Tuesdays 7pm UTC', author: 'Maya Chen', replies: 38, votes: 142, course: 'ml-foundations', tag: 'group', when: 'yesterday' },
  { id: 'd5', title: 'Anyone else struggling with measure theory?', author: 'Tobi Eli',     replies: 19, votes: 33, course: 'probability',   tag: 'question', when: '2d ago' },
];

export const LEADERBOARD = [
  { rank: 1, name: 'Maya Chen',   xp: 18420, change: '+2' },
  { rank: 2, name: 'Arjun Patel', xp: 16980, change: '0'  },
  { rank: 3, name: 'Sara Kim',    xp: 15110, change: '+1' },
  { rank: 4, name: 'Wei Zhou',    xp: 14220, change: '-1' },
  { rank: 5, name: 'Pranav Vijay', xp: 13550, change: '+3' },
  { rank: 6, name: 'Tyler Durden', xp: 12740, change: '0'  },
  { rank: 11, name: 'Alex Learner (you)', xp: 9280, change: '+4', me: true },
];

export const FEED = [
  { id: 'f1', kind: 'release', author: 'Maya Chen',  text: 'Published v2.1 of Machine Learning Foundations — added Model Evaluation chapter.', when: '2h ago', course: 'ml-foundations' },
  { id: 'f2', kind: 'fork',    author: 'Pranav Vijay', text: 'Forked Prompt Engineering and added 12 new worked examples.', when: '6h ago', course: 'prompt-eng' },
  { id: 'f3', kind: 'milestone', author: 'You', text: 'You hit a 12-day learning streak — your longest yet.', when: 'today' },
  { id: 'f4', kind: 'discuss', author: 'Kim', text: 'Started a discussion: "Best way to build intuition for backprop?"', when: 'yesterday' },
  { id: 'f5', kind: 'release', author: 'Wei Zhou', text: 'Published v1.4 of Probabilistic Graphical Models — new visualizations.', when: 'yesterday' },
  { id: 'f6', kind: 'cert', author: 'You', text: 'Earned the Python for Data Science certificate.', when: '6 days ago' },
];
