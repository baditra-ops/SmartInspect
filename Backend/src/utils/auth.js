import "dotenv/config";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { ApiError } from "./apiError.js";

const BCRYPT_SALT_ROUNDS = 12;

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: JWT_SECRET environment variable is missing in production!");
    }
    return "smartinspect_jwt_dev_secret_key_2026";
  }
  return secret;
};

/**
 * Hash plaintext password using bcrypt
 */
export const hashPassword = async (password) => {
  return await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
};

/**
 * Compare plaintext password with stored bcrypt hash
 */
export const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

/**
 * Generate signed JWT token
 */
export const generateToken = (payload) => {
  const secret = getJwtSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

  return jwt.sign(payload, secret, { expiresIn });
};

/**
 * Verify and decode JWT token
 */
export const verifyToken = (token) => {
  try {
    const secret = getJwtSecret();
    return jwt.verify(token, secret);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new ApiError(401, "Authentication token has expired. Please log in again.");
    }
    throw new ApiError(401, "Invalid authentication token.");
  }
};

/**
 * Strip sensitive fields (like passwordHash) and return a safe user profile object
 */
export const getSafeUser = (user) => {
  if (!user) return null;

  const { passwordHash, deletedAt, ...safeUser } = user;
  return safeUser;
};
