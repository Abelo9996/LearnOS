import API from '../api.js';

/**
 * The single way a pathway gets created.
 *
 * Onboarding and the Roadmaps page used to generate roadmaps differently:
 * onboarding called genRoadmap directly, while the Roadmaps page planned a full
 * specialization first. The results behaved differently — different node kinds,
 * no course topics to build from, no placement diagnostic — so the roadmap you
 * got on day one was not the roadmap the rest of the product expects. Both now
 * come through here, so they cannot drift apart again.
 *
 * Order matters: a specialization is the richer artifact (each stage carries a
 * topic the course builder can expand on demand, plus a placement diagnostic),
 * so it is always tried first. The Curriculum agent's pathway is the fallback,
 * and ONLY for key/credit problems — a genuine planning failure must surface
 * rather than be quietly downgraded to a template.
 */

const KEY_PROBLEM = /key|NO_KEY|401|402|403|credit|limit exceeded|insufficient/i;

async function pollJob(jobId, { tries, everyMs, onProgress }) {
  for (let i = 0; i < tries; i++) {
    await new Promise(r => setTimeout(r, everyMs));
    const job = await API.getJob(jobId).catch(() => null);
    if (job && onProgress) onProgress(job.progress ?? null, job.progress_msg || null);
    if (job?.status === 'done') return job.result;
    if (job?.status === 'failed') throw new Error(job.error || 'Generation failed');
  }
  throw new Error('Generation timed out — try again');
}

/**
 * @returns {Promise<{roadmapId, source, stages, title, diagnosticQuestions}>}
 *   source: 'specialization' | 'ai' | 'template'
 */
export async function generatePathway({ goal, level, profile, onProgress }) {
  try {
    const { jobId } = await API.planSpecialization({ goal, level });
    const r = await pollJob(jobId, { tries: 150, everyMs: 1000, onProgress });
    if (!r?.roadmap_id) throw new Error('Pathway planning returned nothing');
    return {
      roadmapId: r.roadmap_id,
      source: 'specialization',
      stages: r.courses,
      title: r.title,
      diagnosticQuestions: r.diagnosticQuestions || 0,
    };
  } catch (e) {
    if (!KEY_PROBLEM.test(e?.message || '')) throw e;
  }

  const { jobId } = await API.genRoadmap(goal, profile);
  const r = await pollJob(jobId, { tries: 60, everyMs: 800, onProgress });
  if (!r?.roadmapId) throw new Error('Generation returned nothing');
  return {
    roadmapId: r.roadmapId,
    source: r.source,               // 'ai' | 'template'
    stages: r.nodeCount,
    title: r.title,
    diagnosticQuestions: 0,
  };
}

/** One wording for the outcome, so both entry points describe it identically. */
export function describePathway(result, goal) {
  if (result.source === 'specialization') {
    return {
      tone: 'success',
      message: `Pathway planned · ${result.stages} courses toward "${goal}"` +
        (result.diagnosticQuestions ? ' — take the placement diagnostic to skip what you already know' : ''),
    };
  }
  if (result.source === 'ai') {
    return { tone: 'success', message: `Pathway generated · ${result.stages} courses` };
  }
  return {
    tone: 'info',
    message: `Pathway created from an offline template · ${result.stages} courses — add an API key in Settings for one built around your goal`,
  };
}

export default { generatePathway, describePathway };
