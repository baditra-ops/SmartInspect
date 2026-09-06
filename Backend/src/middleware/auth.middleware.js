import { verifyToken, getSafeUser } from "../utils/auth.js";
import { prisma } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";

/**
 * Authentication Middleware
 * Extracts and verifies JWT from the Authorization header
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError(401, "Authentication token required. Please log in.");
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      throw new ApiError(401, "Malformed authorization header.");
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      throw new ApiError(401, "Invalid authentication token.");
    }

    // Verify user in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        inspectorProfile: true,
      },
    });

    if (!user) {
      throw new ApiError(401, "User session invalid. User not found.");
    }

    if (user.deletedAt !== null) {
      throw new ApiError(401, "Account has been deactivated.");
    }

    if (!user.isActive) {
      throw new ApiError(401, "Account is disabled. Please contact administrator.");
    }

    // Attach safe user object to request
    req.user = getSafeUser(user);
    next();
  } catch (error) {
    next(error);
  }
};

export default authenticate;
