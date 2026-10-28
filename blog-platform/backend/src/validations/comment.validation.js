
const { z } = require("zod");


const createCommentSchema = z
  .object({
    content: z
      .string()
      .trim()
      .max(2000, "Comment cannot exceed 2000 characters")
      .optional(),
    sticker: z.string().trim().max(100).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasContent = Boolean(data.content?.trim());
    const hasSticker = Boolean(data.sticker);

    if (!hasContent && !hasSticker) {
      ctx.addIssue({
        code: "custom",
        message: "Provide comment text or a sticker",
      });
    }
  });

const updateCommentSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1, "Comment cannot be empty")
      .max(2000, "Comment cannot exceed 2000 characters"),
  })
  .strict();

module.exports = {
  createCommentSchema,
  updateCommentSchema
};
