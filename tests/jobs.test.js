import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.LEARNOS_DB = join(mkdtempSync(join(tmpdir(), 'learnos-jobs-')), 'jobs.db');
const { registerJobHandler, enqueueJob, getJob } = await import('../ai/jobs.js');

const until = async (cond, ms = 3000) => { const t = Date.now(); while (!cond()) { if (Date.now() - t > ms) throw new Error('timeout'); await new Promise(r => setTimeout(r, 10)); } };

describe('job runner', () => {
  it('runs a short job while a course build is still going', async () => {
    let release;
    registerJobHandler('build-course', () => new Promise(r => { release = r; }));
    registerJobHandler('grade-assignment', async () => ({ graded: true }));
    const build = enqueueJob('u', 'build-course', {});
    const grade = enqueueJob('u', 'grade-assignment', {});
    await until(() => getJob(grade, 'u')?.status === 'done');
    expect(getJob(build, 'u').status).toBe('running');
    release({ ok: true });
    await until(() => getJob(build, 'u')?.status === 'done');
  });

  it('runs course builds one at a time', async () => {
    const order = [];
    registerJobHandler('enrich-course', async ({ input }) => { order.push(`start ${input.n}`); await new Promise(r => setTimeout(r, 30)); order.push(`end ${input.n}`); });
    const a = enqueueJob('u', 'enrich-course', { n: 1 });
    const b = enqueueJob('u', 'enrich-course', { n: 2 });
    await until(() => getJob(b, 'u')?.status === 'done' && getJob(a, 'u')?.status === 'done');
    expect(order).toEqual(['start 1', 'end 1', 'start 2', 'end 2']);
  });
});
