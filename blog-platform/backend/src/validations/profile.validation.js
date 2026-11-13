
const { z } = require("zod");

const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name cannot exceed 50 characters")
      .optional(),

    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, "Username must be at least 3 characters")
      .max(20, "Username cannot exceed 20 characters")
      .regex(
        /^[a-z0-9_]+$/,
        "Username can only contain letters, numbers and underscores"
      )
      .optional(),

    bio: z
      .string()
      .trim()
      .max(500, "Bio cannot exceed 500 characters")
      .optional(),

    avatar: z
      .string()
      .trim()
      .max(2048, "Avatar URL is too long")
      .refine(
        (value) =>
          value === "" ||
          (z.string().url().safeParse(value).success &&
            ["http:", "https:"].includes(new URL(value).protocol)),
        "Avatar must be a valid HTTP or HTTPS URL"
      )
      .optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "Provide at least one profile field to update"
  );

module.exports = {
  updateProfileSchema,
};
