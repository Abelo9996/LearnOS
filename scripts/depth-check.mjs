#!/usr/bin/env node
// Depth-floor report for every course in the DB (docs/MASTERY_SPEC_V2.md §5, V1+V2).
//   npm run depth:check          → full report, exits 1 if any course fails
//   npm run depth:check -- --summary   → one line per course
import { validateAllCourses, formatReport } from '../ai/quality/depthFloors.js';

const summaryOnly = process.argv.includes('--summary');
const results = validateAllCourses();
const report = formatReport(results);

console.log(summaryOnly
  ? report.split('\n').filter(l => /^(PASS|FAIL)|meet the depth/.test(l)).join('\n')
  : report);

process.exit(results.some(r => !r.ok) ? 1 : 0);
