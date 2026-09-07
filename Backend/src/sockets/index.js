import { Server } from "socket.io";
import { socketAuthMiddleware } from "./auth.js";
import { socketManager } from "./manager.js";

let io = null;

/**
 * Initialize Socket.IO server attached to Node HTTP server
 * @param {import("http").Server} httpServer
 * @param {object} options
 */
export const initSocketServer = (httpServer, options = {}) => {
  const allowedOrigins = [
    process.env.CLIENT_URL || "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
  ];

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by WebSocket CORS"));
        }
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 1e6, // 1MB payload ceiling
    transports: ["websocket", "polling"],
    ...options,
  });

  // Attach connection manager
  socketManager.setIO(io);

  // Apply authentication middleware on connection handshake
  io.use(socketAuthMiddleware);

  // Handle incoming authenticated connections
  io.on("connection", (socket) => {
    socketManager.registerConnection(socket);
  });

  if (process.env.NODE_ENV === "development") {
    console.log("WebSocket Server initialized & attached to HTTP server");
  }

  return io;
};

/**
 * Get active Socket.IO server instance
 */
export const getIO = () => {
  return io;
};

/**
 * Gracefully close Socket.IO server and disconnect all clients
 */
export const closeSocketServer = async () => {
  if (io) {
    return new Promise((resolve) => {
      io.close(() => {
        io = null;
        socketManager.setIO(null);
        if (process.env.NODE_ENV === "development") {
          console.log("WebSocket Server closed successfully");
        }
        resolve();
      });
    });
  }
};

export default {
  initSocketServer,
  getIO,
  closeSocketServer,
};
