import { prisma } from "../config/db.js";

/**
 * Basic health check endpoint
 * GET /api/health
 */
export const getHealth = (req, res) => {
  res.status(200).json({
    success: true,
    message: "SmartInspect backend is running",
    timestamp: new Date().toISOString(),
  });
};

/**
 * Database health check endpoint
 * GET /api/health/db
 */
export const getDbHealth = async (req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      message: "Database connected successfully",
      status: "healthy",
    });
  } catch (error) {
    next(error);
  }
};
