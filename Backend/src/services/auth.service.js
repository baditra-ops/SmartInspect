import { prisma } from "../config/db.js";
import { comparePassword, generateToken, getSafeUser } from "../utils/auth.js";
import { ApiError } from "../utils/apiError.js";

/**
 * Authenticate user with email and password
 */
export const loginUser = async ({ email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();

  // Find user by unique email
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      inspectorProfile: true,
      institution: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          district: true,
          state: true,
        },
      },
    },
  });

  // Generic rejection message to avoid account enumeration
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  // Check if account has been soft-deleted
  if (user.deletedAt !== null) {
    throw new ApiError(401, "Account has been deactivated. Please contact administrator.");
  }

  // Check if account is active
  if (!user.isActive) {
    throw new ApiError(401, "Account is currently disabled. Please contact administrator.");
  }

  // Verify password hash
  const isPasswordValid = await comparePassword(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid email or password");
  }

  // Update last login timestamp asynchronously
  prisma.user
    .update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })
    .catch((err) => console.error("Failed to update lastLoginAt:", err.message));

  // Generate signed JWT
  const token = generateToken({
    userId: user.id,
    role: user.role,
  });

  return {
    token,
    user: getSafeUser(user),
  };
};

/**
 * Fetch authenticated user details from database
 */
export const getCurrentUser = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      inspectorProfile: true,
      institution: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          district: true,
          state: true,
        },
      },
    },
  });

  if (!user) {
    throw new ApiError(404, "User account not found");
  }

  if (user.deletedAt !== null) {
    throw new ApiError(401, "Account has been deactivated");
  }

  if (!user.isActive) {
    throw new ApiError(401, "Account is currently disabled");
  }

  return getSafeUser(user);
};
