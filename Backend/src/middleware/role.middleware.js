import { ApiError } from "../utils/apiError.js";

/**
 * Role-Based Access Control (RBAC) Middleware
 * @param  {...string|string[]} roles Allowed roles
 */
export const requireRole = (...roles) => {
  // Flatten in case array was passed as argument: requireRole(["ADMIN", "INSPECTOR"])
  const allowedRoles = roles.flat();

  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required prior to permission check."));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `Access denied. Requires one of the following roles: [${allowedRoles.join(", ")}]. Current role: ${req.user.role}`
        )
      );
    }

    next();
  };
};

export default requireRole;
