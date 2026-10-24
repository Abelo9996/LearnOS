/**
 * Lesson writer: one lesson per call, then an independent review, then a
 * revision when the review or the mechanical checks find problems.
 *
 * Why this exists. The first course builder asked one call for all 3-4
 * readings of a module and gave it a checklist ("a diagram, a table, a chart
 * and two callouts in every reading"). The result read like a template being
 * filled in: decorative flowcharts, the same helper class rewritten in three
 * lessons, definitions that were simply wrong, and nothing that made the
 * learner do anything. Lessons are now:
 *
 *   planned   the blueprint gives every lesson its objectives and the concepts
 *             it introduces, so each lesson knows what came before it
 *   written   alone, with the course's notation, its running example and a
 *             summary of what the previous lesson actually taught
 *   checked   code examples are run; a reviewer reads it like an expert
 *             teaching the subject would, against a fixed rubric
 *   revised   once (twice if the code still fails), with the concrete issues
 *
 * Lessons are plain Markdown, not JSON. Long Markdown inside a JSON string is
 * where cheap models break: escaped newlines stored literally, LaTeX
 * backslashes doubled, code fences cutting the object in half.
 */
import { complete } from '../llm.js';
import { runLessonExamples } from '../quality/codeCheck.js';

export const LESSON_SYSTEM = `You are an expert university instructor writing ONE lesson of a course for LearnOS. You write the way the best teachers in your field explain things: concrete before abstract, precise, honest about subtleties, and always making the learner do something.

Structure the lesson like this (use these as a guide, with your own ### headings that name the actual ideas):
1. Open with a concrete question, problem or situation the lesson will answer (2-4 sentences). No "In this lesson we will...".
2. Build the intuition first, in plain language, then make it precise. Define every term and every symbol the first time you use it.
3. At least one fully WORKED EXAMPLE with real numbers or a real case, done step by step, ending in the actual answer. Put it in a "> [!EXAMPLE]" callout. Check your own arithmetic.
4. One "> [!WARNING]" callout for the most common mistake or misconception, and why it is wrong.
5. "### Try it": 2-3 practice problems of increasing difficulty. Write each problem as ordinary text (for example "**Problem 1.** ..."), then put ONLY its full worked solution in a "> [!SOLUTION]" callout right below it. The reader sees the problem and keeps the solution folded until they have tried, so the problem itself must never be inside the callout.
6. End with a "> [!KEY]" callout: the 3-5 things to remember.

Rules:
- Teach only what this lesson's objectives cover. Build on what earlier lessons taught (you are told what they covered); do not re-teach it, refer back to it. Do not preview later lessons beyond one sentence.
- Use the course's notation exactly as given, and keep using the course's running example when it fits.
- Mathematics in LaTeX: inline $...$, display $$...$$ on their own lines. Never ASCII math like x_1 or R^T outside LaTeX.
- Code only when the subject is computational. Every \`\`\`python or \`\`\`javascript block is executed, in order, in one session like a notebook: a block may use what an earlier block in this lesson defined, but must otherwise run exactly as written (imports included) and print the results the text talks about. Code is self-contained: never read or write files, never download anything, never assume a dataset exists. When an example needs data (including the course's running example), build a small version of it right in the code, with literal values or numpy with a fixed seed. Python may use the standard library, numpy, pandas, scipy, matplotlib and scikit-learn (they run in the learner's browser). Use \`\`\`text for anything that is not meant to run (pseudocode, output, shell commands).
- A \`\`\`mermaid diagram only when it shows structure that prose cannot (a process with branches, how parts connect, a sequence of messages). Never a flowchart of the lesson's own steps. Most lessons need zero or one diagram.
- A \`\`\`chart block ({"type":"line"|"bar"|"scatter"|"area","title":"...","x":"field","y":"field","data":[...]}) only when a quantitative relationship is the point. A table only for a real comparison.
- Never invent facts, citations, statistics, dates or quotes. If something is debated, say so.
- 900-1800 words. As long as the ideas need, no padding, no filler sentences, no "it's important to note".
- Output ONLY the lesson in Markdown, starting with its first section. Do not repeat the lesson title as a heading.`;

const REVIEW_SYSTEM = `You are a demanding subject-matter expert reviewing one lesson of a course before it is published. You are reviewing for a learner who will trust every word.

Find real problems only. For each, quote the exact text and say how to fix it. Check:
- accuracy: wrong definitions, wrong formulas, wrong numbers in worked examples or solutions, false claims, invented facts or sources
- consistency: notation that differs from the course notation, contradictions with what earlier lessons taught, re-teaching what was already covered
- teaching: a step skipped in a derivation, a term used before it is defined, a worked example or practice solution that does not actually work out, missing practice problems or missing solutions
- filler: decorative diagrams, padding, generic sentences that teach nothing
- form: math not written in LaTeX, broken Markdown

Severity: "critical" (wrong or misleading), "major" (a learner would get stuck or confused), "minor" (polish). Report at most 8 issues, the most important first. Do not report anything you conclude is correct, and keep each "problem" to one or two sentences. Return "pass": true only if there are no critical or major issues.`;

const reviewSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pass: { type: 'boolean' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
          quote: { type: 'string' },
          problem: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['severity', 'quote', 'problem', 'fix'],
      },
    },
  },
  required: ['pass', 'issues'],
};

const REVISE_SYSTEM = `You are the instructor who wrote this lesson, revising it after expert review and after its code examples were run. Fix every listed problem. Keep everything that was right. Keep the same structure and rules as before (worked example, warning, "### Try it" problems with "> [!SOLUTION]" callouts, closing "> [!KEY]"). Code blocks marked python or javascript are executed again after you revise, in order, in one session like a notebook, so each must run given the blocks before it and print what the text says it prints.

Fix things silently: the learner never saw the earlier version, so never write "wait", "correction", "typo", "as fixed above", or anything else that refers to a previous draft.

Output ONLY the full revised lesson in Markdown. No commentary about what you changed.`;

/** Mechanical problems a reviewer should not have to spot. */
export function lintLesson(md) {
  const issues = [];
  const text = String(md || '');
  if (text.length < 2500) issues.push('The lesson is far too short to teach its objectives; expand the explanation and the worked example.');
  if (!/\[!EXAMPLE\]/i.test(text)) issues.push('There is no worked example in a "> [!EXAMPLE]" callout.');
  if (!/\[!SOLUTION\]/i.test(text)) issues.push('The practice problems have no "> [!SOLUTION]" callouts.');
  if (!/\[!KEY\]/i.test(text)) issues.push('The lesson does not end with a "> [!KEY]" summary callout.');
  // The problem has to be visible; only its solution is folded away.
  if (/>\s*\[!SOLUTION\][^\n]*\n>\s*\**(Problem|Exercise|Question)\b/i.test(text)) {
    issues.push('A "> [!SOLUTION]" callout contains the problem statement, so the problem is hidden. Put each problem above its callout and keep only the solution inside.');
  }
  const mermaid = (text.match(/```mermaid/g) || []).length;
  if (mermaid > 2) issues.push(`There are ${mermaid} Mermaid diagrams; keep at most the one or two that show real structure.`);
  const outsideCode = text.replace(/```[\s\S]*?```/g, '');
  const dollars = (outsideCode.replace(/\$\$/g, '').match(/\$/g) || []).length;
  if (dollars % 2) issues.push('An inline math expression is missing its closing $.');
  const plainMath = outsideCode.replace(/\$\$[\s\S]*?\$\$/g, '').replace(/\$[^$\n]*\$/g, '').match(/\b[A-Za-z]_\{?\w\}?\b|\b[A-Za-z]\^[\w{]/g) || [];
  if (plainMath.length >= 3) issues.push(`Some math is written as plain text (${plainMath.slice(0, 3).join(', ')}); write it in LaTeX.`);
  return issues;
}

/** Clean up what a model returns around the lesson body. */
export function cleanLessonText(text, title) {
  let s = String(text || '').trim();
  // Some models wrap the whole answer in a ```markdown fence.
  const wrapped = s.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i);
  if (wrapped) s = wrapped[1].trim();
  // A body stored with literal "\n" escapes and no real newlines.
  if (!/\n/.test(s) && /\\n/.test(s)) s = s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
  // Drop a leading H1/H2 that repeats the lesson title.
  if (title) {
    const norm = (x) => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const m = s.match(/^#{1,2}\s+(.+)\n/);
    if (m && norm(m[1]) === norm(title)) s = s.slice(m[0].length).trim();
  }
  // Em dashes are the house style's one hard rule: a spaced or unspaced dash
  // becomes a comma, an en dash a hyphen.
  return s.replace(/\s*\u2014\s*/g, ', ').replace(/\u2013/g, '-');
}

/** The "> [!KEY]" summary, used as the hand-off to the next lesson. */
export function keySummary(md) {
  const m = String(md || '').match(/>\s*\[!KEY\][^\n]*\n((?:>.*\n?)+)/i);
  if (!m) return '';
  return m[1].split('\n').map(l => l.replace(/^>\s?/, '').trim()).filter(Boolean).join(' ').slice(0, 900);
}

function lessonBrief(ctx, plan, prev) {
  return [
    `Course: ${ctx.courseTitle} (${ctx.level})`,
    ctx.pathwayContext ? `Pathway context: ${ctx.pathwayContext}` : null,
    ctx.audience ? `Learner: ${ctx.audience}` : null,
    ctx.codeLanguage && ctx.codeLanguage !== 'none' ? `Language for all code: ${ctx.codeLanguage}` : 'This course has no programming; do not include code unless the lesson truly needs a small calculation.',
    ctx.notation ? `Course notation (use exactly): ${ctx.notation}` : null,
    ctx.throughline ? `Running example used across the course: ${ctx.throughline}` : null,
    '',
    `Course outline:\n${ctx.outline}`,
    '',
    `Module ${ctx.moduleIndex + 1}: ${ctx.moduleTitle}`,
    `This lesson (${plan.index + 1} of ${ctx.lessonsInModule} in the module): ${plan.title}`,
    `Objectives (the learner can do these afterwards): ${(plan.objectives || []).join('; ')}`,
    plan.concepts?.length ? `Concepts this lesson introduces: ${plan.concepts.join(', ')}` : null,
    ctx.taughtBefore?.length ? `Already taught in earlier lessons (build on these, do not re-teach): ${ctx.taughtBefore.join(', ')}` : 'This is the first lesson of the course.',
    prev ? `The previous lesson ("${prev.title}") ended with: ${prev.summary}` : null,
    ctx.styleDirective ? `\n${ctx.styleDirective}` : null,
  ].filter(x => x != null).join('\n');
}

/**
 * First draft of one lesson. Drafts of a module are written in order (each is
 * handed the previous one's summary); review and revision then run for all of
 * them at once, which is where most of the time goes.
 */
export async function draftLesson({ userId, ctx, plan, prev }) {
  const brief = lessonBrief(ctx, plan, prev);
  const draft = await complete({
    userId, agentCode: 'CR',
    maxTokens: 9000, reasoning: 'off',
    system: LESSON_SYSTEM,
    messages: `${brief}\n\nWrite this lesson.`,
  });
  const body = cleanLessonText(draft.text, plan.title);
  if (body.length < 400) throw new Error(`lesson "${plan.title}" came back empty`);
  return { brief, body, summary: keySummary(body) || (plan.objectives || []).join('; ') };
}

/**
 * Write, check and revise one lesson.
 * @returns {Promise<{title, body_md, minutes, summary, quality}>}
 */
export async function writeLesson({ userId, ctx, plan, prev, review = true }) {
  return polishLesson({ userId, plan, draft: await draftLesson({ userId, ctx, plan, prev }), review });
}

/** Review a draft, run its code, and revise it until it holds up. */
export async function polishLesson({ userId, plan, draft, review = true }) {
  const { brief } = draft;
  let body = draft.body;

  const quality = { revisions: 0, reviewIssues: [], codeFailures: [], codeRan: 0, lint: [] };

  for (let round = 0; round < 2; round++) {
    const code = await runLessonExamples(body);
    const lint = lintLesson(body);
    let issues = [];
    if (review && round === 0) {
      try {
        const r = (await complete({
          userId, agentCode: 'RV',
          schema: reviewSchema,
          // Reviewing is where thinking pays off, so reasoning stays on; the
          // budget is large enough that it finishes thinking and still answers.
          maxTokens: 16000,
          system: REVIEW_SYSTEM,
          messages: `${brief}\n\n--- LESSON TO REVIEW ---\n${body}`,
        })).json;
        issues = (r?.issues || []).filter(i => i && i.severity !== 'minor');
        quality.reviewIssues = (r?.issues || []).map(i => ({ severity: i.severity, problem: i.problem }));
      } catch (e) {
        quality.reviewError = e?.message || String(e);
      }
    }
    quality.codeRan = code.ran;
    quality.codeFailures = code.failed;
    quality.lint = lint;
    // A stray "$" (a price, a shell prompt) is not worth rewriting a lesson for;
    // it is reported, and fixed if a revision happens for a real reason.
    const lintThatMatters = lint.filter(l => !/missing its closing \$/.test(l));
    if (!issues.length && !code.failed.length && !code.mismatched.length && !lintThatMatters.length) break;
    // Code failures are worth a second revision; review notes get one.
    if (round === 1 && !code.failed.length) break;

    const problems = [
      ...issues.map(i => `- [${i.severity}] "${i.quote}": ${i.problem} Fix: ${i.fix}`),
      ...code.failed.map(f => `- The ${f.lang} block starting at line ${f.line} fails when run:\n${f.error}`),
      ...code.mismatched.map(m => `- The output shown after the ${m.lang} block at line ${m.line} is not what that code prints. Replace the shown output with exactly what it prints, and fix any sentence that relies on the wrong numbers:\n${m.printed}`),
      ...lint.map(l => `- ${l}`),
    ].join('\n');
    const revised = await complete({
      userId, agentCode: 'CR',
      maxTokens: 9000, reasoning: 'off',
      system: REVISE_SYSTEM,
      messages: `${brief}\n\n--- CURRENT LESSON ---\n${body}\n\n--- PROBLEMS TO FIX ---\n${problems}`,
    });
    const next = cleanLessonText(revised.text, plan.title);
    // A revision that lost most of the lesson is worse than the problems it fixed.
    if (next.length < body.length * 0.6) break;
    body = next;
    quality.revisions++;
  }

  if (quality.revisions) {
    const final = await runLessonExamples(body);
    quality.codeRan = final.ran;
    quality.codeFailures = final.failed;
    quality.lint = lintLesson(body);
  }

  const words = body.split(/\s+/).length;
  return {
    title: plan.title,
    body_md: body,
    minutes: Math.max(8, Math.round(words / 130) + 3 * (plan.objectives?.length || 1)),
    summary: keySummary(body) || (plan.objectives || []).join('; '),
    quality,
  };
}

export default { writeLesson, draftLesson, polishLesson, lintLesson, cleanLessonText, keySummary, LESSON_SYSTEM };
