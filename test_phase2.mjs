import db from './db/database.js';
import { runIntake, getProfile } from './ai/agents/profiling.js';
import { generateRoadmap, persistRoadmap } from './ai/agents/curriculum.js';
import { enqueueJob, getJob } from './ai/jobs.js';

const U = 'user-1';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✓', m)) : (fail++, console.log('  ✗', m)); };

// Migrations
const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x => x.name);
ok(t.includes('user_profiles'), 'user_profiles table');
ok(t.includes('node_objectives'), 'node_objectives table');
ok(db.prepare('PRAGMA table_info(roadmaps)').all().some(c => c.name === 'course_slug'), 'roadmaps.course_slug column');

// PR — heuristic profile (no key)
const prof = await runIntake({ userId: U, goal: 'Learn Rust', answers: { level: 'intermediate', time_per_week: 6, learning_style: 'projects', motivation: 'career' } });
ok(prof.level === 'intermediate' && prof.time_per_week === 6, 'runIntake builds profile from answers');
const stored = getProfile(U);
ok(stored && stored.goal === 'Learn Rust' && stored.level === 'intermediate', 'profile persisted (upsert)');

// CR — generate via template fallback, end to end
const res = await generateRoadmap({ userId: U, goal: 'Master Rust ownership', profile: stored });
ok(res.roadmapId && res.source === 'template' && res.nodeCount >= 8, 'generateRoadmap → template roadmap (>=8 nodes)');
const rm = db.prepare('SELECT * FROM roadmaps WHERE id=?').get(res.roadmapId);
ok(rm && rm.status === 'active' && rm.total_modules === res.nodeCount, 'roadmap row written');
ok(/offline template/.test(rm.authored_by), 'template roadmap clearly labeled');
const nodes = db.prepare('SELECT * FROM roadmap_nodes WHERE roadmap_id=?').all(res.roadmapId);
ok(nodes.length === res.nodeCount, 'nodes written');
ok(nodes.filter(n => n.status === 'active').length === 1, 'exactly one active node');
ok(nodes.filter(n => n.col === 0).every(n => ['active', 'next'].includes(n.status)), 'col-0 nodes are active/next');
const edges = db.prepare('SELECT * FROM roadmap_edges WHERE roadmap_id=?').all(res.roadmapId);
const nodeIds = new Set(nodes.map(n => n.id));
ok(edges.length > 0 && edges.every(e => nodeIds.has(e.from_node) && nodeIds.has(e.to_node)), 'edges form a valid DAG (reference real nodes)');
const objs = db.prepare('SELECT * FROM node_objectives WHERE roadmap_id=?').all(res.roadmapId);
ok(objs.length > 0, 'node objectives written');

// CR — AI-path persistence with a simulated LLM spec
const sampleSpec = { title: 'Sample', subtitle: 's', nodes: [
  { id: 'n1', title: 'A', col: 0, row: 0, objectives: ['o1'], prereqs: [] },
  { id: 'n2', title: 'B', col: 1, row: 0, objectives: ['o2', 'o3'], prereqs: ['n1'] },
  { id: 'n3', title: 'C', col: 2, row: 0, objectives: ['o4'], prereqs: ['n2'] },
]};
const rid2 = persistRoadmap(U, sampleSpec, 'ai', 'sample goal');
ok(/AI Curriculum/.test(db.prepare('SELECT authored_by FROM roadmaps WHERE id=?').get(rid2).authored_by), 'AI-source roadmap labeled "AI Curriculum agent"');
ok(db.prepare('SELECT COUNT(*) c FROM roadmap_edges WHERE roadmap_id=?').get(rid2).c === 2, 'AI spec prereqs → 2 edges');

// Job handler registered + runs
const jid = enqueueJob(U, 'generate-roadmap', { goal: 'Learn SQL' });
await new Promise(r => setTimeout(r, 350));
const job = getJob(jid, U);
ok(job && job.status === 'done' && job.result?.roadmapId, "'generate-roadmap' job runs to done");

// cleanup
const tx = db.transaction(() => {
  for (const r of db.prepare("SELECT id FROM roadmaps WHERE id LIKE 'rm-gen-%'").all()) {
    db.prepare('DELETE FROM node_objectives WHERE roadmap_id=?').run(r.id);
    db.prepare('DELETE FROM roadmaps WHERE id=?').run(r.id); // cascades nodes + edges
  }
  db.prepare("DELETE FROM agent_jobs WHERE kind='generate-roadmap'").run();
  db.prepare('DELETE FROM user_profiles WHERE user_id=?').run(U);
});
tx();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
