import "dotenv/config";
import app from "./app.js";
import { connectRedis } from "./config/redis.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Initialize Redis gracefully
  await connectRedis();

  const server = app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`  SmartInspect Backend Server Started   `);
    console.log(`  Port: ${PORT}                          `);
    console.log(`  Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`  Health Check: http://localhost:${PORT}/api/health`);
    console.log(`========================================`);
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (err) => {
    console.error("UNHANDLED REJECTION! Shutting down gracefully...", err);
    server.close(() => {
      process.exit(1);
    });
  });

  // Handle uncaught exceptions
  process.on("uncaughtException", (err) => {
    console.error("UNCAUGHT EXCEPTION! Shutting down...", err);
    process.exit(1);
  });

  return server;
};

const server = startServer();

export default server;