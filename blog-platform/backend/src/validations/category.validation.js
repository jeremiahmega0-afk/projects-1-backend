const { z } = require("zod");

const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .max(50, "Category name must not exceed 50 characters"),

  description: z
    .string()
    .trim()
    .max(200, "Description must not exceed 200 characters")
    .optional(),
}).strict();

const updateCategorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Category name must be at least 2 characters")
      .max(50, "Category name must not exceed 50 characters")
      .optional(),

    description: z
      .string()
      .trim()
      .max(200, "Description must not exceed 200 characters")
      .optional(),
  }).strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  }).strict();

module.exports = {
  createCategorySchema,
  updateCategorySchema,
};