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

export const roadmapSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    subtitle: { type: 'string' },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },                 // short local slug: "n1", "n2"...
          title: { type: 'string' },
          col: { type: 'integer' },                // 0-based prerequisite depth
          row: { type: 'integer' },                // 0-based lane within a column
          objectives: { type: 'array', items: { type: 'string' } },
          prereqs: { type: 'array', items: { type: 'string' } }, // earlier node ids
        },
        required: ['id', 'title', 'col', 'row', 'objectives', 'prereqs'],
      },
    },
  },
  required: ['title', 'subtitle', 'nodes'],
};
