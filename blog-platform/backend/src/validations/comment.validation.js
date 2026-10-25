
const { z } = require("zod");

const updateCommentSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1, "Comment cannot be empty")
      .max(2000, "Comment cannot exceed 2000 characters"),
  })
  .strict();

const createCommentSchema = z
  .object({
    content: z
      .string()
      .trim()
      .max(2000, "Comment cannot exceed 2000 characters")
      .optional(),
    type: z.enum(["text", "image", "audio", "sticker", "mixed"]).optional(),
    imageUrl: z.string().url().max(2048).optional(),
    audioUrl: z.string().url().max(2048).optional(),
    sticker: z.string().trim().max(100).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasContent = Boolean(data.content?.trim());
    const hasImage = Boolean(data.imageUrl);
    const hasAudio = Boolean(data.audioUrl);
    const hasSticker = Boolean(data.sticker);

    if (!hasContent && !hasImage && !hasAudio && !hasSticker) {
      ctx.addIssue({
        code: "custom",
        message: "Provide text, an image, audio, or a sticker",
      });
    }

    const attachmentCount = [hasImage, hasAudio, hasSticker].filter(Boolean).length;

    if (attachmentCount > 1) {
      ctx.addIssue({
        code: "custom",
        message: "Only one attachment type is allowed per comment",
      });
    }

    if (data.type === "text" && (hasImage || hasAudio || hasSticker)) {
      ctx.addIssue({
        code: "custom",
        message: "Text comments cannot contain attachments",
      });
    }
  });

module.exports = {
  createCommentSchema,
  updateCommentSchema,
};
