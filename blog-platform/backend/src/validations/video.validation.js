
const { z } = require("zod");

const videoUrlSchema = z
    .string()
    .trim()
    .min(1, "Video URL is required")
    .max(2048, "Video URL is too long")
    .refine(
        (value) =>
            /^https?:\/\//i.test(value) ||
            value.startsWith("/uploads/"),
        "Video URL must be HTTP, HTTPS, or a valid upload path"
    );

const thumbnailSchema = z
    .string()
    .trim()
    .max(2048, "Thumbnail URL is too long")
    .refine(
        (value) =>
            value === "" ||
            /^https?:\/\//i.test(value),
        "Thumbnail must use HTTP or HTTPS"
    );

const createVideoSchema = z
    .object({
        title: z
            .string()
            .trim()
            .min(5, "Video title must be at least 5 characters")
            .max(200, "Video title must not exceed 200 characters"),

        description: z
            .string()
            .trim()
            .max(2000, "Description must not exceed 2000 characters")
            .optional(),

        videoUrl: videoUrlSchema,

        videoType: z
            .enum(["youtube", "upload"]),

        thumbnail: thumbnailSchema.optional(),

        category: z
            .string()
            .optional(),

        tags: z
            .array(
                z.string().trim().min(1).max(30)
            )
            .max(10, "You cannot add more than 10 tags")
            .optional(),
    })
    .strict();

const updateVideoSchema = z
    .object({
        title: z
            .string()
            .trim()
            .min(5, "Video title must be at least 5 characters")
            .max(200, "Video title must not exceed 200 characters")
            .optional(),

        description: z
            .string()
            .trim()
            .max(2000, "Description must not exceed 2000 characters")
            .optional(),

        videoUrl: videoUrlSchema.optional(),

        videoType: z
            .enum(["youtube", "upload"])
            .optional(),

        thumbnail: thumbnailSchema.optional(),

        category: z
            .string()
            .optional(),

        tags: z
            .array(
                z.string().trim().min(1).max(30)
            )
            .max(10, "You cannot add more than 10 tags")
            .optional(),

        status: z
            .enum(["draft", "published"])
            .optional(),
    })
    .strict()
    .refine(
        (data) => Object.keys(data).length > 0,
        {
            message: "At least one field must be provided",
        }
    );
const uploadVideoSchema = z
    .object({
        title: z
            .string()
            .trim()
            .min(5, "Video title must be at least 5 characters")
            .max(200, "Video title must not exceed 200 characters"),

        description: z
            .string()
            .trim()
            .max(2000, "Description must not exceed 2000 characters")
            .optional(),

        category: z
            .string()
            .optional(),

        tags: z
            .string()
            .optional(),
    })
    .strict();

module.exports = {
    createVideoSchema,
    updateVideoSchema,
    uploadVideoSchema,
};

