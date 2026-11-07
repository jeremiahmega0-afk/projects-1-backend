
const { z } = require("zod");

const articleReactionSchema = z
  .object({
    type: z.enum(["love", "laugh", "wow", "sad"]),
  })
  .strict();

module.exports = {
  articleReactionSchema,
};
