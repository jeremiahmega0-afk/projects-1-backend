
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

const tagsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, "A tag cannot be empty")
      .max(30, "A tag cannot exceed 30 characters")
  )
  .max(10, "An article cannot have more than 10 tags")
  .refine(
    (tags) =>
      new Set(tags.map((tag) => tag.toLowerCase())).size === tags.length,
    "Duplicate tags are not allowed"
  );

const metaTitleSchema = z
  .string()
  .trim()
  .min(1, "Meta title cannot be empty")
  .max(60, "Meta title cannot exceed 60 characters");

const metaDescriptionSchema = z
  .string()
  .trim()
  .min(1, "Meta description cannot be empty")
  .max(160, "Meta description cannot exceed 160 characters");

const canonicalUrlSchema = z
  .string()
  .trim()
  .max(2048, "Canonical URL is too long")
  .refine(
    (value) => value === "" || /^https?:\/\//i.test(value),
    "Canonical URL must use HTTP or HTTPS"
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
    "Canonical URL must be a valid URL"
  );

const ogTitleSchema = z
  .string()
  .trim()
  .min(1, "Open Graph title cannot be empty")
  .max(95, "Open Graph title cannot exceed 95 characters");

const ogDescriptionSchema = z
  .string()
  .trim()
  .min(1, "Open Graph description cannot be empty")
  .max(200, "Open Graph description cannot exceed 200 characters");

const ogImageSchema = z
  .string()
  .trim()
  .max(2048, "Open Graph image URL is too long")
  .refine(
    (value) => value === "" || /^https?:\/\//i.test(value),
    "Open Graph image must use HTTP or HTTPS"
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
    "Open Graph image must be a valid URL"
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
    tags: tagsSchema.optional(),
    metaTitle: metaTitleSchema.optional(),
    metaDescription: metaDescriptionSchema.optional(),
    canonicalUrl: canonicalUrlSchema.optional(),
    ogTitle: ogTitleSchema.optional(),
    ogDescription: ogDescriptionSchema.optional(),
    ogImage: ogImageSchema.optional(),
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

    tags: tagsSchema.optional(),
    metaTitle: metaTitleSchema.optional(),
    metaDescription: metaDescriptionSchema.optional(),
    canonicalUrl: canonicalUrlSchema.optional(),
    ogTitle: ogTitleSchema.optional(),
    ogDescription: ogDescriptionSchema.optional(),
    ogImage: ogImageSchema.optional(),
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
  tagsSchema,
  metaTitleSchema,
  metaDescriptionSchema,
};
