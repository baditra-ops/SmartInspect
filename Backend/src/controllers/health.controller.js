import { prisma } from "../config/db.js";
import { getRedisStatus } from "../config/redis.js";

/**
 * Basic system health check endpoint
 * GET /api/health
 */
export const getHealth = async (req, res) => {
  let dbStatus = "unknown";
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "connected";
  } catch (err) {
    dbStatus = "disconnected";
  }

  const redisInfo = getRedisStatus();

  res.status(200).json({
    success: true,
    message: "SmartInspect backend is running",
    status: "ok",
    database: dbStatus,
    redis: redisInfo.status,
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

/**
 * Redis health check endpoint
 * GET /api/health/redis
 */
export const getRedisHealth = (req, res) => {
  const redisInfo = getRedisStatus();
  res.status(200).json({
    success: true,
    message: redisInfo.connected
      ? "Redis connected successfully"
      : "Redis is currently disconnected or in fallback mode",
    redis: redisInfo,
  });
};
