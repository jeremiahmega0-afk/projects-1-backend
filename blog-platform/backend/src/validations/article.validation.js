
const { z } = require("zod");

const coverImageSchema = z
  .string()
  .trim()
  .max(2048, "Cover image URL is too long")
  .refine(
    (value) =>
      value === "" || /^https?:\/\//i.test(value),
    "Cover image URL must use HTTP or HTTPS"
  )
  .refine(
    (value) => {
      if (value === "") return true;

      try {
        const url = new URL(value);
        return Boolean(url.hostname);
      } catch {
        return false;
      }
    },
    "Cover image must be a valid URL"
  );

const createArticleSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(5, "Title must be at least 5 characters")
      .max(200, "Title must not exceed 200 characters"),

    content: z
      .string()
      .trim()
      .min(20, "Content must be at least 20 characters")
      .refine(
        (value) => value.trim().length > 0,
        "Article content cannot contain only whitespace"
      ),

    coverImage: coverImageSchema.optional(),

    category: z
      .string()
      .optional(),
  })
  .strict();

const updateArticleSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(5, "Title must be at least 5 characters")
      .max(200, "Title must not exceed 200 characters")
      .optional(),

    content: z
      .string()
      .trim()
      .min(20, "Content must be at least 20 characters")
      .refine(
        (value) => value.trim().length > 0,
        "Article content cannot contain only whitespace"
      )
      .optional(),

    coverImage: coverImageSchema.optional(),

    category: z
      .string()
      .optional(),

    status: z
      .enum(["draft", "pending"])
      .optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field must be provided",
    }
  );

module.exports = {
  createArticleSchema,
  updateArticleSchema,
};
