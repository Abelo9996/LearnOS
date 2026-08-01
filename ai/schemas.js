/**
 * Agent I/O JSON schemas (AI-7). Constrained to what structured outputs support
 * (object/array/string/integer/boolean/enum + additionalProperties:false; no
 * min/max/length constraints).
 */

export const profileSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    background: { type: 'string' },
    level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
    time_per_week: { type: 'integer' },
    learning_style: { type: 'string' },
    motivations: { type: 'array', items: { type: 'string' } },
  },
  required: ['background', 'level', 'time_per_week', 'learning_style', 'motivations'],
};

/**
 * A roadmap is a COURSE PATHWAY: an ordered sequence of courses carrying the
 * learner from where they are to their goal.
 *
 * It is deliberately NOT a concept graph. There are no parallel lanes, no DAG
 * and no "explore in any order" — each stage depends on the one before it, so
 * there is always exactly one next thing to do.
 */
export const roadmapSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    subtitle: { type: 'string' },
    courses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },                                // the course taken at this stage
          topic: { type: 'string' },                                // self-contained topic for the course builder
          why: { type: 'string' },                                  // why it sits at this point in the path
          objectives: { type: 'array', items: { type: 'string' } }, // what it makes the learner able to do
        },
        required: ['title', 'topic', 'why', 'objectives'],
      },
    },
  },
  required: ['title', 'subtitle', 'courses'],
};
