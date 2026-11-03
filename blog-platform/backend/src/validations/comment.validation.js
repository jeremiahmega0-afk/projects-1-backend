
const { z } = require("zod");

const createCommentSchema = z.discriminatedUnion("type", [
  // Text comment
  z.object({
  type: z.literal("text"),
  content: z.string().trim().min(2).max(1000),
  parentComment: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
}).strict(),

  // Sticker comment
  z.object({
    type: z.literal("sticker"),
    stickerUrl: z.string().url().max(2048),
  }).strict(),

  // Audio comment
  z.object({
    type: z.literal("audio"),
    audioUrl: z.string().url().max(2048),
    audioDuration: z.number().int().min(1).max(300),
  }).strict(),
]);

const updateCommentSchema = z.object({
  content: z.string().trim().min(2).max(1000),
}).strict();

module.exports = {
  createCommentSchema,
  updateCommentSchema,
};
