import { ROOMS, authorizeRoomSubscription } from "./rooms.js";
import { CLIENT_EVENTS, WS_EVENTS } from "./events.js";

export class SocketConnectionManager {
  constructor() {
    // Map of userId -> Set of active socketIds
    this.userSockets = new Map();
    // Map of socketId -> userId
    this.socketUsers = new Map();
    // Reference to Socket.IO server instance
    this.io = null;
  }

  /**
   * Set Socket.IO server instance
   */
  setIO(io) {
    this.io = io;
  }

  /**
   * Register newly authenticated socket connection
   */
  registerConnection(socket) {
    const user = socket.user;
    if (!user || !user.id) return;

    const userId = user.id;

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socket.id);
    this.socketUsers.set(socket.id, userId);

    // Automatically join default authorized rooms
    this.joinDefaultRooms(socket, user);

    // Register inbound message handlers
    this.registerSocketHandlers(socket);

    if (process.env.NODE_ENV === "development") {
      console.log(`[WebSocket] User ${user.fullName} (${user.role}) connected [Socket: ${socket.id}]`);
    }
  }

  /**
   * Auto-join baseline rooms according to user identity and geographic scope
   */
  joinDefaultRooms(socket, user) {
    // 1. User private room
    socket.join(ROOMS.user(user.id));

    // 2. Role broadcast room
    socket.join(ROOMS.role(user.role));

    // 3. Institution room (if institution user)
    if (user.institutionId) {
      socket.join(ROOMS.institution(user.institutionId));
    }

    // 4. Geographic state room
    if (user.state) {
      socket.join(ROOMS.state(user.state));
    }

    // 5. Geographic district room
    if (user.state && user.district) {
      socket.join(ROOMS.district(user.state, user.district));
    }
  }

  /**
   * Register socket event handlers for subscription and health check
   */
  registerSocketHandlers(socket) {
    const user = socket.user;

    // Handle controlled room subscription
    socket.on(CLIENT_EVENTS.SUBSCRIBE, async (data, callback) => {
      try {
        const room = typeof data === "string" ? data : data?.room;
        if (!room || typeof room !== "string") {
          const res = { success: false, message: "Invalid room identifier" };
          if (typeof callback === "function") callback(res);
          return socket.emit(WS_EVENTS.ERROR, res);
        }

        await authorizeRoomSubscription(user, room);
        socket.join(room);

        const res = { success: true, room, message: `Subscribed to ${room}` };
        if (typeof callback === "function") callback(res);
        socket.emit("subscribed", res);
      } catch (err) {
        const res = { success: false, message: err.message || "Subscription denied" };
        if (typeof callback === "function") callback(res);
        socket.emit(WS_EVENTS.ERROR, res);
      }
    });

    // Handle room unsubscription
    socket.on(CLIENT_EVENTS.UNSUBSCRIBE, (data, callback) => {
      try {
        const room = typeof data === "string" ? data : data?.room;
        if (!room || typeof room !== "string") {
          const res = { success: false, message: "Invalid room identifier" };
          if (typeof callback === "function") callback(res);
          return;
        }

        socket.leave(room);
        const res = { success: true, room, message: `Unsubscribed from ${room}` };
        if (typeof callback === "function") callback(res);
        socket.emit("unsubscribed", res);
      } catch (err) {
        const res = { success: false, message: err.message };
        if (typeof callback === "function") callback(res);
      }
    });

    // Handle client ping
    socket.on(CLIENT_EVENTS.PING, (data, callback) => {
      const res = { timestamp: new Date().toISOString() };
      if (typeof callback === "function") callback(res);
      socket.emit(CLIENT_EVENTS.PONG, res);
    });

    // Handle disconnect
    socket.on("disconnect", (reason) => {
      this.handleDisconnect(socket, reason);
    });

    // Handle unexpected socket errors gracefully without crashing process
    socket.on("error", (err) => {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[WebSocket] Socket ${socket.id} error:`, err.message);
      }
    });
  }

  /**
   * Clean up user connection tracking on disconnect
   */
  handleDisconnect(socket, reason) {
    const socketId = socket.id;
    const userId = this.socketUsers.get(socketId);

    if (userId) {
      const userSockets = this.userSockets.get(userId);
      if (userSockets) {
        userSockets.delete(socketId);
        if (userSockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
      this.socketUsers.delete(socketId);
    }

    if (process.env.NODE_ENV === "development") {
      console.log(`[WebSocket] Socket ${socketId} disconnected (Reason: ${reason})`);
    }
  }

  /**
   * Total active connection count
   */
  getTotalConnections() {
    return this.socketUsers.size;
  }

  /**
   * Active connection count for a specific user
   */
  getUserConnectionCount(userId) {
    return this.userSockets.get(userId)?.size || 0;
  }

  /**
   * Check if user is currently online
   */
  isUserOnline(userId) {
    return this.userSockets.has(userId) && this.userSockets.get(userId).size > 0;
  }

  /**
   * Emit event to a specific room
   */
  emitToRoom(room, event, payload) {
    if (!this.io) return;
    this.io.to(room).emit(event, payload);
  }

  /**
   * Emit event to multiple rooms
   */
  emitToRooms(rooms = [], event, payload) {
    if (!this.io || !rooms || rooms.length === 0) return;
    let target = this.io;
    for (const room of rooms) {
      if (room) target = target.to(room);
    }
    target.emit(event, payload);
  }

  /**
   * Emit event to a specific user across all their active devices
   */
  emitToUser(userId, event, payload) {
    this.emitToRoom(ROOMS.user(userId), event, payload);
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcast(event, payload) {
    if (!this.io) return;
    this.io.emit(event, payload);
  }
}

export const socketManager = new SocketConnectionManager();
export default socketManager;
