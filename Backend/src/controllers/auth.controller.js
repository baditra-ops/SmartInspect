import * as authService from "../services/auth.service.js";
import { loginSchema, validateBody } from "../utils/validation.js";
import { ApiResponse } from "../utils/apiResponse.js";

/**
 * User Login
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const validatedData = validateBody(loginSchema, req.body);
    const result = await authService.loginUser(validatedData);

    return ApiResponse.success(res, "Login successful", result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Current Authenticated User Profile
 * GET /api/auth/me
 */
export const getMe = async (req, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.user.id);
    return ApiResponse.success(res, "User profile retrieved successfully", user, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * User Logout (Client-side token disposal notification)
 * POST /api/auth/logout
 */
export const logout = async (req, res, next) => {
  try {
    return ApiResponse.success(
      res,
      "Logged out successfully. Please clear authentication tokens from client storage.",
      null,
      200
    );
  } catch (error) {
    next(error);
  }
};
