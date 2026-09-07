import { verifyToken, getSafeUser } from "../utils/auth.js";
import { prisma } from "../config/db.js";

/**
 * Socket.IO Authentication Middleware
 * Authenticates incoming connections using JWT and resolves active user profile
 */
export const socketAuthMiddleware = async (socket, next) => {
  try {
    const authHeader =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization ||
      socket.handshake.query?.token;

    if (!authHeader) {
      const err = new Error("Authentication token required for WebSocket connection");
      err.data = { code: "AUTH_TOKEN_REQUIRED", statusCode: 401 };
      return next(err);
    }

    // Extract Bearer token if prefixed
    let token = authHeader;
    if (typeof token === "string" && token.startsWith("Bearer ")) {
      token = token.slice(7).trim();
    }

    if (!token) {
      const err = new Error("Malformed WebSocket authorization token");
      err.data = { code: "MALFORMED_TOKEN", statusCode: 401 };
      return next(err);
    }

    // Verify JWT
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (tokenErr) {
      const err = new Error(tokenErr.message || "Invalid WebSocket authentication token");
      err.data = { code: "INVALID_TOKEN", statusCode: 401 };
      return next(err);
    }

    if (!decoded || !decoded.userId) {
      const err = new Error("Invalid token payload structure");
      err.data = { code: "INVALID_TOKEN_PAYLOAD", statusCode: 401 };
      return next(err);
    }

    // Query user from database to verify status and geographic scope
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        inspectorProfile: true,
      },
    });

    if (!user) {
      const err = new Error("User session invalid. User not found.");
      err.data = { code: "USER_NOT_FOUND", statusCode: 401 };
      return next(err);
    }

    if (user.deletedAt !== null) {
      const err = new Error("User account has been deactivated.");
      err.data = { code: "ACCOUNT_DEACTIVATED", statusCode: 401 };
      return next(err);
    }

    if (!user.isActive) {
      const err = new Error("User account is disabled. Please contact administrator.");
      err.data = { code: "ACCOUNT_DISABLED", statusCode: 401 };
      return next(err);
    }

    // Attach sanitized user profile to socket instance
    socket.user = getSafeUser(user);
    next();
  } catch (error) {
    const err = new Error("WebSocket authentication failed");
    err.data = { code: "AUTH_ERROR", message: error.message, statusCode: 500 };
    next(err);
  }
};

export default socketAuthMiddleware;
