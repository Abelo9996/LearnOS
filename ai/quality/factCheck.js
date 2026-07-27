/**
 * Independent answer verification — M7 of docs/MASTERY_SPEC_V2.md.
 *
 * The generator that wrote a question also wrote its answer key. Asking it "is
 * this right?" mostly gets agreement, so that is worth very little. Instead we
 * pose the question COLD — no answer key, no explanation, no hint that anything
 * is being checked — and see which option an independent pass picks. If it
 * disagrees, or reports that the question is ambiguous or has several defensible
 * answers, the item is DISPUTED and is kept out of graded assessment until a
 * human resolves it.
 *
 * This is deliberately conservative: a disputed item is not necessarily wrong,
 * but it is not trustworthy enough to grade someone on.
 */
import db from '../../db/database.js';
import { complete } from '../llm.js';

export const STATUS = { UNVERIFIED: 'unverified', CONFIRMED: 'confirmed', DISPUTED: 'disputed', FLAGGED: 'flagged' };

const answerSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answer_idx: { type: 'integer' },
    confident: { type: 'boolean' },
    single_correct_answer: { type: 'boolean' },
    concern: { type: 'string' },
  },
  required: ['answer_idx', 'confident', 'single_correct_answer', 'concern'],
};

const SYSTEM = `You are an independent subject-matter examiner. You are shown a multiple-choice question with its options — NOT the answer key.

Do three things:
1. "answer_idx": pick the single best option (0-based). Answer it yourself, on the merits.
2. "single_correct_answer": false if more than one option is defensibly correct, if none is, or if the question is ambiguous or depends on unstated assumptions.
3. "concern": if anything is wrong with the question — ambiguity, a factual error in an option, two right answers, a trick of wording — say so in one sentence. Empty string if it is a clean question.

Be exacting. You are the check that stops a plausible-sounding but wrong question from being used to grade a learner.`;

/** Verify a single item. Returns the verdict without writing to the DB. */
export async function verifyItem({ userId = 'user-1', item }) {
  const choices = Array.isArray(item.choices) ? item.choices : JSON.parse(item.choices_json || '[]');
  const out = (await complete({
    userId, agentCode: 'AS',
    schema: answerSchema,
    maxTokens: 700,
    system: SYSTEM,
    messages: `Question: ${item.question}\n\nOptions:\n${choices.map((c, i) => `${i}. ${c}`).join('\n')}\n\nAnswer it.`,
  })).json;

  if (!out || !Number.isInteger(out.answer_idx)) {
    return { status: STATUS.UNVERIFIED, note: 'Verifier returned no usable answer', agrees: null };
  }

  const agrees = out.answer_idx === item.answer_idx;
  const clean = out.single_correct_answer !== false;

  if (agrees && clean && out.confident !== false) {
    return { status: STATUS.CONFIRMED, note: null, agrees: true };
  }

  const why = !agrees
    ? `Independent check chose option ${out.answer_idx} ("${choices[out.answer_idx] ?? '?'}"), not the stored answer ${item.answer_idx}.`
    : !clean
      ? 'Independent check reports more than one defensible answer.'
      : 'Independent check was not confident in any option.';

  return { status: STATUS.DISPUTED, note: `${why}${out.concern ? ` ${out.concern}` : ''}`.trim(), agrees };
}

/** Persist a verdict. */
export function applyVerdict(itemId, verdict) {
  db.prepare("UPDATE quiz_items SET verification_status = ?, verification_note = ?, verified_at = datetime('now') WHERE id = ?")
    .run(verdict.status, verdict.note || null, itemId);
}

/**
 * Verify every unverified item in a course (or all courses).
 * @param {function(number,string)} onProgress
 */
export async function verifyCourseItems({ userId = 'user-1', slug = null, limit = null, concurrency = 4, onProgress = () => {} }) {
  const where = slug ? 'WHERE course_slug = ? AND verification_status = ?' : 'WHERE verification_status = ?';
  const params = slug ? [slug, STATUS.UNVERIFIED] : [STATUS.UNVERIFIED];
  let items = db.prepare(`SELECT id, question, choices_json, answer_idx, course_slug FROM quiz_items ${where}`).all(...params);
  if (limit) items = items.slice(0, limit);

  const tally = { confirmed: 0, disputed: 0, unverified: 0, total: items.length };
  if (!items.length) return tally;

  let done = 0;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      const it = items[i];
      try {
        const verdict = await verifyItem({ userId, item: it });
        applyVerdict(it.id, verdict);
        tally[verdict.status] = (tally[verdict.status] || 0) + 1;
      } catch (e) {
        // A verification that cannot run leaves the item UNVERIFIED — never
        // silently "confirmed". Unverified items stay out of graded assessment.
        tally.unverified++;
        if (/402|credit/i.test(e?.message || '')) throw e; // no point continuing
      }
      done++;
      onProgress(done / items.length, `Verified ${done}/${items.length} items`);
    }
  });
  await Promise.all(workers);
  return tally;
}

/** Count items by verification state, for reporting. */
export function verificationSummary(slug = null) {
  const rows = slug
    ? db.prepare('SELECT verification_status s, COUNT(*) c FROM quiz_items WHERE course_slug = ? GROUP BY s').all(slug)
    : db.prepare('SELECT verification_status s, COUNT(*) c FROM quiz_items GROUP BY s').all();
  const out = { unverified: 0, confirmed: 0, disputed: 0, flagged: 0 };
  for (const r of rows) out[r.s || 'unverified'] = r.c;
  out.total = Object.values(out).reduce((a, b) => a + b, 0);
  out.gradeable = out.confirmed + out.unverified; // disputed/flagged are excluded
  return out;
}

export default { verifyItem, verifyCourseItems, applyVerdict, verificationSummary, STATUS };
