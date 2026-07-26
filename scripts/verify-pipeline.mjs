#!/usr/bin/env node
/**
 * Verifies the M2 staged-build pipeline end-to-end WITHOUT an LLM key, by feeding
 * persistRichCourse() a blueprint shaped exactly like a real staged build and
 * asserting the persisted course clears the depth floors (spec checks V1 + V2).
 *
 * This is the proof that the content model, persistence and floors line up: if a
 * real generation produces this shape, it ships at Coursera-grade depth.
 *
 *   node scripts/verify-pipeline.mjs [--keep]
 */
import db from '../db/database.js';
import { persistRichCourse } from '../ai/agents/courseBuilder.js';
import { validateCourseDepth, formatReport } from '../ai/quality/depthFloors.js';

const KEEP = process.argv.includes('--keep');

// Real, long-stable URLs so reachability verification exercises the real path.
const URLS = [
  { title: '3Blue1Brown — But what is a neural network?', url: 'https://www.youtube.com/watch?v=aircAruvnKk', kind: 'video', source: 'YouTube' },
  { title: 'Attention Is All You Need', url: 'https://arxiv.org/abs/1706.03762', kind: 'paper', source: 'arXiv' },
  { title: 'Machine learning — overview', url: 'https://en.wikipedia.org/wiki/Machine_learning', kind: 'article', source: 'Wikipedia' },
  { title: 'Linear algebra — overview', url: 'https://en.wikipedia.org/wiki/Linear_algebra', kind: 'article', source: 'Wikipedia' },
  { title: 'Gradient descent', url: 'https://en.wikipedia.org/wiki/Gradient_descent', kind: 'article', source: 'Wikipedia' },
];

const reading = (topic, n) => ({
  title: `${topic} — part ${n}`,
  minutes: 12,
  // >= 1500 chars of structured instruction, matching the floor.
  body_md: [
    `# ${topic} — part ${n}`, '',
    `## Why this matters`, '',
    `Understanding ${topic.toLowerCase()} is what separates being able to recite a definition from being able to apply it under pressure. `.repeat(4), '',
    `## The core idea`, '',
    `We build the intuition first and the formalism second. Start from a concrete case, notice what stays invariant, then generalise. `.repeat(5), '',
    `## A worked example`, '',
    `Consider a small instance you can hold in your head. Trace each step and check the invariant still holds after every transformation. `.repeat(4), '',
    `## Common pitfalls`, '',
    `- Confusing the map with the territory when the notation is overloaded.`,
    `- Assuming the result generalises before checking the boundary conditions.`,
    `- Skipping the derivation and memorising the formula, which fails the moment the setup changes.`, '',
    `## What to take away`, '',
    `You should now be able to state the idea precisely, apply it to a new instance, and explain why it fails outside its assumptions. `.repeat(3),
  ].join('\n'),
});

const items = (topic) => Array.from({ length: 10 }, (_, k) => ({
  question: `Which statement about ${topic.toLowerCase()} is correct? (item ${k + 1})`,
  choices: ['The precise, correct characterisation', 'A plausible but subtly wrong variant', 'An unrelated claim', 'A reversed causal claim'],
  answer_idx: 0,
  explanation: `The first option is right because it preserves the defining property of ${topic.toLowerCase()}; the second swaps the direction of the implication, which is the classic trap.`,
  difficulty: ['easy', 'medium', 'hard'][k % 3],
  skill: topic,
}));

const MODULE_TITLES = ['Foundations', 'Core mechanics', 'Working with data', 'Optimization', 'Evaluation', 'Applied practice'];

const blueprint = {
  title: 'Pipeline Verification Course ' + Math.random().toString(36).slice(2, 6),
  blurb: 'A structurally complete course used to verify the staged build pipeline.',
  tags: ['verification'],
  outcomes: ['Explain the core ideas', 'Apply them to new problems', 'Evaluate tradeoffs', 'Build a working artifact'],
  prerequisites: ['Comfort with basic programming'],
  skills: MODULE_TITLES,
  modules: MODULE_TITLES.map((t, i) => ({
    title: t,
    summary: `What ${t.toLowerCase()} covers and why it comes at position ${i + 1}.`,
    objectives: [`Explain ${t.toLowerCase()}`, `Apply ${t.toLowerCase()} to a new case`, `Diagnose failures in ${t.toLowerCase()}`],
    readings: [reading(t, 1), reading(t, 2), reading(t, 3)],
    quiz_items: items(t),
    lab: { title: `Lab · ${t}`, description: `Hands-on practice with ${t.toLowerCase()}.`, minutes: 45,
      steps: ['Set up the environment', 'Implement the core routine', 'Run it on the provided case', 'Compare against the expected invariant', 'Write up what surprised you'] },
    graded: { title: `Graded assessment · ${t}`, kind: 'homework', minutes: 60,
      description: `Demonstrate that you can apply ${t.toLowerCase()} independently.`,
      tasks: ['Restate the problem', 'Choose an approach and justify it', 'Implement it', 'Validate the result', 'Report the tradeoffs'],
      rubric: [
        { criterion: 'Correctness', weight: 0.5, excellent: 'Fully correct and validated', adequate: 'Mostly correct', poor: 'Incorrect' },
        { criterion: 'Justification', weight: 0.3, excellent: 'Clear reasoning throughout', adequate: 'Some reasoning', poor: 'Unjustified' },
        { criterion: 'Communication', weight: 0.2, excellent: 'Precise and well organised', adequate: 'Understandable', poor: 'Unclear' },
      ] },
    resources: URLS.slice(0, 4).map(r => ({ ...r, summary: `Reference for ${t.toLowerCase()}.`, minutes: 15 })),
  })),
  capstone: { title: 'Capstone build', description: 'Synthesize every module into one artifact you can show off.',
    tasks: ['Scope the project', 'Design the approach', 'Implement it', 'Evaluate it', 'Write it up'] },
};

console.log('Persisting a staged-build-shaped course (verifying resource URLs for real)…');
const res = await persistRichCourse('user-1', blueprint, 'intermediate');
console.log(`\nPersisted: ${res.slug}`);
console.log(`  modules=${res.modules} lessons=${res.lessons} quizItems=${res.quizItems} resources=${res.resources} assignments=${res.assignments} hours=${res.hours}`);
console.log(`  companion roadmap: ${res.roadmap_id}`);

const depth = validateCourseDepth(res.slug);
console.log('\n' + formatReport([depth]));

if (!KEEP) {
  const mids = db.prepare('SELECT id FROM course_modules WHERE course_slug = ?').all(res.slug).map(r => r.id);
  for (const mid of mids) db.prepare('DELETE FROM module_lessons WHERE module_id = ?').run(mid);
  db.prepare('DELETE FROM quiz_items WHERE course_slug = ?').run(res.slug);
  db.prepare('DELETE FROM course_modules WHERE course_slug = ?').run(res.slug);
  db.prepare('DELETE FROM enrollments WHERE course_slug = ?').run(res.slug);
  db.prepare('DELETE FROM courses WHERE slug = ?').run(res.slug);
  if (res.roadmap_id) {
    db.prepare('DELETE FROM node_resources WHERE roadmap_id = ?').run(res.roadmap_id);
    db.prepare('DELETE FROM node_objectives WHERE roadmap_id = ?').run(res.roadmap_id);
    db.prepare('DELETE FROM roadmap_edges WHERE roadmap_id = ?').run(res.roadmap_id);
    db.prepare('DELETE FROM roadmap_nodes WHERE roadmap_id = ?').run(res.roadmap_id);
    db.prepare('DELETE FROM roadmaps WHERE id = ?').run(res.roadmap_id);
  }
  db.prepare("DELETE FROM assignments WHERE course = ?").run(blueprint.title);
  console.log('(test course removed — pass --keep to inspect it in the app)');
}

process.exit(depth.ok ? 0 : 1);
