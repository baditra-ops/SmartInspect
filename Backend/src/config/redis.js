import "dotenv/config";
import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

let isRedisConnected = false;
let redisError = null;

export const redisClient = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 3) {
        // Stop reconnecting after 3 attempts to prevent flooding console in offline development
        return false;
      }
      return Math.min(retries * 500, 2000);
    },
  },
});

redisClient.on("connect", () => {
  console.log("Redis Client Connecting...");
});

redisClient.on("ready", () => {
  isRedisConnected = true;
  redisError = null;
  console.log("Redis Client Connected & Ready");
});

redisClient.on("error", (err) => {
  isRedisConnected = false;
  redisError = err.message || "Connection error";
  // Log a concise warning to avoid unhandled errors
  if (process.env.NODE_ENV === "development") {
    console.warn(`Redis Notice: ${err.message || "Connection failed"}`);
  }
});

redisClient.on("end", () => {
  isRedisConnected = false;
  console.log("Redis Client Disconnected");
});

/**
 * Connect to Redis gracefully without terminating server startup on failure
 */
export const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    return true;
  } catch (error) {
    isRedisConnected = false;
    redisError = error.message;
    console.warn(`Redis initial connection notice: Redis is unavailable (${error.message}). Server running with Redis offline fallback.`);
    return false;
  }
};

/**
 * Get current Redis connection health status
 */
export const getRedisStatus = () => {
  return {
    connected: isRedisConnected,
    isOpen: redisClient.isOpen,
    status: isRedisConnected ? "connected" : "disconnected",
    error: redisError,
  };
};

export default redisClient;
