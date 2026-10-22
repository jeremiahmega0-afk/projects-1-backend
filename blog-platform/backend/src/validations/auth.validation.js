const { z } = require("zod");

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must not exceed 50 characters"),

  email: z
    .string()
    .trim()
    .email("Please provide a valid email"),

    password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password is too long"),
}).strict();

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please provide a valid email"),

  password: z
    .string()
    .min(6, "Password must be at least 6 characters"),
}).strict();
const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please provide a valid email"),
}).strict();

const verifyAccountSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please provide a valid email"),

  otp: z
    .string()
    .regex(/^\d{6}$/, "OTP must be exactly 6 digits"),
}).strict();

const resetPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please provide a valid email"),

  otp: z
    .string()
    .length(6, "OTP must be 6 digits"),

  newPassword: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password is too long"),
}).strict();

const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, "Current password is required")
    .max(100, "Password is too long"),

  newPassword: z
    .string()
    .min(6, "New password must be at least 6 characters")
    .max(100, "New password is too long"),
}).strict();

module.exports = {
  registerSchema,
  loginSchema,
  emailSchema,
  verifyAccountSchema,
  resetPasswordSchema,
  changePasswordSchema,
};