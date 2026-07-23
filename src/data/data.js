// data.js — LearnOS static config
//
// Only AGENTS (display metadata for the 7 agents) remains here — it is app
// config, not data. Everything else (roadmaps, sessions, courses, stats, the
// landing preview, etc.) is loaded from the API over real stored state.
// Do NOT add data/content exports here — fetch from /api/*.

export const AGENTS = {
  TU: { code: 'TU', name: 'Tutor',         color: 'var(--agent-tu)', short: 'Teaches concepts, answers questions, explains deeply.', icon: 'cap' },
  PR: { code: 'PR', name: 'Profiling',     color: 'var(--agent-pr)', short: 'Understands you — your goals, pace, background.', icon: 'user' },
  CR: { code: 'CR', name: 'Curriculum',    color: 'var(--agent-cr)', short: 'Creates personalized roadmaps and learning paths.', icon: 'graph' },
  AS: { code: 'AS', name: 'Assessment',    color: 'var(--agent-as)', short: 'Generates quizzes and evaluates mastery.', icon: 'check' },
  RE: { code: 'RE', name: 'Research',      color: 'var(--agent-re)', short: 'Finds, summarizes, and cites the best resources.', icon: 'search' },
  AN: { code: 'AN', name: 'Analytics',     color: 'var(--agent-an)', short: 'Tracks progress and surfaces insights.', icon: 'chart' },
  CE: { code: 'CE', name: 'Certification', color: 'var(--agent-ce)', short: 'Issues verifiable certificates and badges.', icon: 'ribbon' },
};
