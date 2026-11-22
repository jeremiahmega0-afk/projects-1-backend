
const { z } = require("zod");

const scheduleArticleSchema = z.object({
  scheduledAt: z
    .string()
    .datetime({
      message: "Scheduled date must be a valid ISO date",
    })
    .refine(
      (value) => new Date(value).getTime() > Date.now(),
      {
        message: "Scheduled date must be in the future",
      }
    ),
}).strict();

module.exports = {
  scheduleArticleSchema,
};
