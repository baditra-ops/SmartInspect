import { io } from "socket.io-client";

export const WS_EVENTS = {
  // Compliance & Corrective Action Events
  COMPLIANCE_CREATED: "compliance.created",
  COMPLIANCE_UPDATED: "compliance.updated",
  COMPLIANCE_ASSIGNED: "compliance.assigned",
  COMPLIANCE_STARTED: "compliance.started",
  COMPLIANCE_SUBMITTED: "compliance.submitted",
  COMPLIANCE_VERIFIED: "compliance.verified",
  COMPLIANCE_REJECTED: "compliance.rejected",
  COMPLIANCE_CLOSED: "compliance.closed",
  COMPLIANCE_REOPENED: "compliance.reopened",
  COMPLIANCE_ESCALATED: "compliance.escalated",

  // Inspection & Assignment Events
  INSPECTION_CREATED: "inspection.created",
  INSPECTION_UPDATED: "inspection.updated",
  INSPECTION_ASSIGNED: "inspection.assigned",
  INSPECTION_ACCEPTED: "inspection.accepted",
  INSPECTION_REJECTED: "inspection.rejected",
  INSPECTION_STARTED: "inspection.started",
  INSPECTION_COMPLETED: "inspection.completed",
  INSPECTION_CANCELLED: "inspection.cancelled",

  // GPS Verification Events
  GPS_VERIFIED: "gps.verified",

  // Alert Management Events
  ALERT_CREATED: "alert.created",
  ALERT_UPDATED: "alert.updated",
  ALERT_ACKNOWLEDGED: "alert.acknowledged",
  ALERT_RESOLVED: "alert.resolved",

  // CCTV Device Events
  CCTV_CREATED: "cctv.created",
  CCTV_UPDATED: "cctv.updated",
  CCTV_STATUS_CHANGED: "cctv.status_changed",
  CCTV_DELETED: "cctv.deleted",

  // AI & Analytics Events
  AI_RISK_ASSESSED: "ai.risk_assessed",
  AI_ATTENDANCE_ANALYZED: "ai.attendance_analyzed",
  AI_ANOMALY_DETECTED: "ai.anomaly_detected",

  // System & Notification Events
  SYSTEM_NOTIFICATION: "system.notification",
  ERROR: "error",
};

export const CLIENT_EVENTS = {
  SUBSCRIBE: "subscribe",
  UNSUBSCRIBE: "unsubscribe",
  PING: "ping",
  PONG: "pong",
};

/**
 * Get configured WebSocket server URL
 */
export function getSocketUrl() {
  const envUrl = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl.replace(/\/api\/?$/, "");
  }
  return "http://localhost:5000";
}

/**
 * Create a new Socket.IO client instance configured with authentication
 * @param {string} token JWT bearer token
 * @returns {import("socket.io-client").Socket}
 */
export function createSocketClient(token) {
  const socketUrl = getSocketUrl();

  const socket = io(socketUrl, {
    auth: {
      token: token ? `Bearer ${token}` : "",
    },
    transports: ["websocket", "polling"],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  return socket;
}
