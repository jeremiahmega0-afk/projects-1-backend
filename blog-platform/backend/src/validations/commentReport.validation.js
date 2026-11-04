
const { z } = require("zod");

const createCommentReportSchema = z.object({
  reason: z.enum([
    "spam",
    "harassment",
    "hate_speech",
    "inappropriate_content",
    "misinformation",
    "other",
  ]),

  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .default(""),
}).strict();

module.exports = {
  createCommentReportSchema,
};
