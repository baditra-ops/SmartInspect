/**
 * Centralized WebSocket Event Constants
 * Formatted as: domain.action
 */
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

/**
 * Client-to-Server Inbound Event Names
 */
export const CLIENT_EVENTS = {
  SUBSCRIBE: "subscribe",
  UNSUBSCRIBE: "unsubscribe",
  PING: "ping",
  PONG: "pong",
};

export default WS_EVENTS;
