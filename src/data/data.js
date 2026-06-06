// data.js — LearnOS static data
//
// Only AGENTS (display metadata for the 7 agents) and LEARNING_PROGRESS
// (decorative landing-page chart, renamed MARKETING_CHART_DATA at import site)
// remain here. All other content (roadmaps, sessions, courses, assignments,
// etc.) is loaded from the API. Do NOT add new exports here — fetch from /api/*.

export const AGENTS = {
  TU: { code: 'TU', name: 'Tutor',         color: 'var(--agent-tu)', short: 'Teaches concepts, answers questions, explains deeply.', icon: 'cap' },
  PR: { code: 'PR', name: 'Profiling',     color: 'var(--agent-pr)', short: 'Understands you — your goals, pace, background.', icon: 'user' },
  CR: { code: 'CR', name: 'Curriculum',    color: 'var(--agent-cr)', short: 'Creates personalized roadmaps and learning paths.', icon: 'graph' },
  AS: { code: 'AS', name: 'Assessment',    color: 'var(--agent-as)', short: 'Generates quizzes and evaluates mastery.', icon: 'check' },
  RE: { code: 'RE', name: 'Research',      color: 'var(--agent-re)', short: 'Finds, summarizes, and cites the best resources.', icon: 'search' },
  AN: { code: 'AN', name: 'Analytics',     color: 'var(--agent-an)', short: 'Tracks progress and surfaces insights.', icon: 'chart' },
  CE: { code: 'CE', name: 'Certification', color: 'var(--agent-ce)', short: 'Issues verifiable certificates and badges.', icon: 'ribbon' },
};

// Decorative mini-bar chart data for the landing page hero.
// Renamed MARKETING_CHART_DATA at import site to signal "do not use for real data".
export const LEARNING_PROGRESS = [
  { d: 'Mon', v: 1.4 }, { d: 'Tue', v: 2.0 }, { d: 'Wed', v: 1.6 },
  { d: 'Thu', v: 2.4 }, { d: 'Fri', v: 1.2 }, { d: 'Sat', v: 2.6 }, { d: 'Sun', v: 1.9 },
];
