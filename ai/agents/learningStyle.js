/**
 * Turns the learner's stated learning style into concrete directives for the
 * content and research agents.
 *
 * The style is collected at onboarding (the chips "Visual examples",
 * "Hands-on projects", "Theory first", "Quick sprints", or free text) and
 * persisted as a comma-joined string. Historically it only reached the roadmap
 * prompt, and even there a type check meant it never actually fired. This module
 * is the single place that maps that signal into what the agents should DO, so a
 * visual learner gets more video and diagrams instead of another wall of prose.
 */

export function styleText(ls) {
  if (Array.isArray(ls)) return ls.filter(Boolean).join(', ');
  if (typeof ls === 'string') return ls.trim();
  return '';
}

export function styleProfile(ls) {
  const t = styleText(ls).toLowerCase();
  const visual  = /visual|diagram|watch|video|picture|illustrat|graphic/.test(t);
  const handsOn = /hands|project|build|practice|doing|kinesth|\blab\b|code/.test(t);
  const theory  = /theory|concept|principle|rigor|proof|formal|deep/.test(t);
  const quick   = /quick|sprint|fast|concise|short|bite/.test(t);
  const stated  = visual || handsOn || theory || quick;
  return { visual, handsOn, theory, quick, stated, text: styleText(ls) };
}

/** Verified lecture videos a module should carry, given the style. */
export function videosPerModule(ls) {
  return styleProfile(ls).visual ? 3 : 2;
}

/** Directive injected into the lesson-writing prompt so content leans toward
 *  the learner's modality instead of defaulting to prose. */
export function contentDirective(ls) {
  const p = styleProfile(ls);
  if (!p.stated) {
    return 'Learner modality: balanced. Keep every lesson media-rich: diagrams, a worked example, and a strong lecture video alongside the reading, not a wall of text.';
  }
  const parts = [`Learner's stated learning style: ${p.text}.`];
  if (p.visual) parts.push('This learner is VISUAL. Lead with diagrams and visuals: put TWO or more Mermaid diagrams in every reading, prefer lecture videos over text sources, and teach with annotated examples and visual analogies. Never leave a concept text-only when a diagram would show it.');
  if (p.handsOn) parts.push('This learner is HANDS-ON. Anchor each concept in something they build or run: favour runnable code, step-by-step walkthroughs, and "try it yourself" prompts over exposition.');
  if (p.theory) parts.push('This learner likes THEORY FIRST. State the underlying principle and the why before the how, with precise definitions, but still show it with a diagram and a concrete example.');
  if (p.quick) parts.push('This learner prefers QUICK SPRINTS. Be concise and high-density: short sections, tight takeaways, no padding.');
  return parts.join(' ');
}

/** Directive for the resource/research prompts to bias the SOURCE MIX away from
 *  passive encyclopedia text and toward active, engaging material. */
export function resourceDirective(ls) {
  const p = styleProfile(ls);
  const base = 'Prefer sources that teach actively: canonical lecture videos, interactive or visual explainers, official docs, and well-regarded courses. Do NOT pad with encyclopedia dumps; avoid Wikipedia unless a concept genuinely has no better source.';
  if (p.visual) return base + ' This learner is VISUAL: weight the mix toward videos and visual explainers, so at least half the resources are video or richly illustrated.';
  if (p.handsOn) return base + ' This learner is HANDS-ON: weight toward interactive tutorials, labs, and official getting-started guides they can follow by doing.';
  return base;
}

export default { styleText, styleProfile, videosPerModule, contentDirective, resourceDirective };
