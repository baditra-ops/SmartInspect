import "dotenv/config";
import http from "http";
import app from "./app.js";
import { connectRedis, redisClient } from "./config/redis.js";
import { prisma } from "./config/db.js";
import { initSocketServer, closeSocketServer } from "./sockets/index.js";

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);

// Initialize WebSocket server attached to HTTP server
const io = initSocketServer(httpServer);

const startServer = async () => {
  // Initialize Redis gracefully
  await connectRedis();

  httpServer.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`  SmartInspect Backend Server Started   `);
    console.log(`  Port: ${PORT}                          `);
    console.log(`  Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`  Health Check: http://localhost:${PORT}/api/health`);
    console.log(`  WebSocket Endpoint: ws://localhost:${PORT}`);
    console.log(`========================================`);
  });

  // Graceful shutdown handler
  const shutdown = async (signal) => {
    console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);

    try {
      // 1. Close WebSocket server & disconnect clients
      await closeSocketServer();

      // 2. Stop accepting new HTTP requests
      await new Promise((resolve) => httpServer.close(resolve));
      console.log("[Server] HTTP server closed.");

      // 3. Disconnect Redis
      if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        console.log("[Server] Redis client disconnected.");
      }

      // 4. Disconnect Prisma DB connection
      if (prisma) {
        await prisma.$disconnect();
        console.log("[Server] PostgreSQL connection closed.");
      }

      console.log("[Server] Graceful shutdown completed cleanly.");
      process.exit(0);
    } catch (err) {
      console.error("[Server] Error during shutdown:", err);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (err) => {
    console.error("UNHANDLED REJECTION! Shutting down gracefully...", err);
    httpServer.close(() => {
      process.exit(1);
    });
  });

  // Handle uncaught exceptions
  process.on("uncaughtException", (err) => {
    console.error("UNCAUGHT EXCEPTION! Shutting down...", err);
    process.exit(1);
  });

  return httpServer;
};

// Start listening if executed directly
startServer();

export { httpServer, io };
export default httpServer;