import { z } from "zod";
import { ApiError } from "./apiError.js";

/**
 * Login Input Validation Schema
 */
export const loginSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .email("Invalid email format"),
  password: z
    .string({ required_error: "Password is required" })
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password exceeds maximum length"),
});

/**
 * Helper to validate request body against a Zod schema
 */
export const validateBody = (schema, data) => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues || result.error.errors || [];
    const errorMessages = issues.map((err) => `${err.path.join(".")}: ${err.message}`);
    const firstMessage = errorMessages[0] || "Invalid request payload";
    throw new ApiError(400, firstMessage, errorMessages);
  }
  return result.data;
};
