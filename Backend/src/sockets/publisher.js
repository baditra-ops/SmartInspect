import { socketManager } from "./manager.js";
import { ROOMS } from "./rooms.js";
import { WS_EVENTS } from "./events.js";

/**
 * Remove sensitive credentials, secrets, and database internals from event payload
 */
export const sanitizePayload = (data) => {
  if (!data || typeof data !== "object") return data;

  const forbiddenKeys = new Set([
    "password",
    "passwordHash",
    "secret",
    "jwtSecret",
    "token",
    "refreshToken",
    "verificationCode",
    "pin",
  ]);

  const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== "object") return obj;

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    // Handle Decimal or Date
    if (obj instanceof Date) return obj.toISOString();
    if (obj && typeof obj.toFixed === "function") return Number(obj.toString());

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (!forbiddenKeys.has(key)) {
        if (value && typeof value === "object" && !(value instanceof Date)) {
          sanitized[key] = sanitizeObject(value);
        } else {
          sanitized[key] = value;
        }
      }
    }
    return sanitized;
  };

  return sanitizeObject(data);
};

/**
 * Construct standard event envelope
 */
export const buildEventEnvelope = (event, data = {}) => {
  return {
    event,
    timestamp: new Date().toISOString(),
    data: sanitizePayload(data),
  };
};

/**
 * Centralized WebSocket Event Publisher
 */
export class EventPublisher {
  /**
   * Publish Compliance & Corrective Action Event
   * @param {string} eventType One of WS_EVENTS.COMPLIANCE_*
   * @param {object} action Compliance Action entity with relations
   */
  async publishComplianceEvent(eventType, action) {
    if (!action) return;

    const payload = buildEventEnvelope(eventType, {
      id: action.id,
      inspectionId: action.inspectionId,
      institutionId: action.institutionId,
      institutionName: action.institution?.name,
      state: action.institution?.state,
      district: action.institution?.district,
      title: action.title,
      severity: action.severity,
      status: action.status,
      deadline: action.deadline,
      assignedToUserId: action.assignedToUserId,
      createdByUserId: action.createdByUserId,
      verifiedAt: action.verifiedAt,
      verifiedById: action.verifiedById,
      updatedAt: action.updatedAt,
    });

    const targetRooms = new Set([
      ROOMS.role("ADMIN"),
      ROOMS.institution(action.institutionId),
    ]);

    if (action.institution?.state) {
      targetRooms.add(ROOMS.state(action.institution.state));
      if (action.institution?.district) {
        targetRooms.add(ROOMS.district(action.institution.state, action.institution.district));
      }
    }

    if (action.assignedToUserId) {
      targetRooms.add(ROOMS.user(action.assignedToUserId));
    }

    for (const room of targetRooms) {
      socketManager.emitToRoom(room, eventType, payload);
    }
  }

  /**
   * Publish Inspection Lifecycle Event
   * @param {string} eventType One of WS_EVENTS.INSPECTION_*
   * @param {object} inspection Inspection entity with relations
   */
  async publishInspectionEvent(eventType, inspection) {
    if (!inspection) return;

    const payload = buildEventEnvelope(eventType, {
      id: inspection.id,
      inspectionCode: inspection.inspectionCode,
      institutionId: inspection.institutionId,
      institutionName: inspection.institution?.name,
      state: inspection.institution?.state,
      district: inspection.institution?.district,
      type: inspection.type,
      status: inspection.status,
      scheduledDate: inspection.scheduledDate,
      currentInspectorId: inspection.currentInspectorId,
      assignedById: inspection.assignedById,
      overallScore: inspection.overallScore,
      complianceStatus: inspection.complianceStatus,
      updatedAt: inspection.updatedAt,
    });

    const targetRooms = new Set([
      ROOMS.role("ADMIN"),
      ROOMS.institution(inspection.institutionId),
      ROOMS.inspection(inspection.id),
    ]);

    if (inspection.institution?.state) {
      targetRooms.add(ROOMS.state(inspection.institution.state));
      if (inspection.institution?.district) {
        targetRooms.add(ROOMS.district(inspection.institution.state, inspection.institution.district));
      }
    }

    if (inspection.currentInspectorId) {
      targetRooms.add(ROOMS.user(inspection.currentInspectorId));
    }

    for (const room of targetRooms) {
      socketManager.emitToRoom(room, eventType, payload);
    }
  }

  /**
   * Publish GPS Location Verification Event
   * @param {string} eventType WS_EVENTS.GPS_VERIFIED
   * @param {object} gpsData GPS Verification entity
   */
  async publishGpsEvent(eventType, gpsData) {
    if (!gpsData) return;

    const payload = buildEventEnvelope(eventType, {
      id: gpsData.id,
      inspectionId: gpsData.inspectionId,
      inspectorId: gpsData.inspectorId,
      verificationType: gpsData.verificationType,
      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      distanceFromInstitutionMeters: gpsData.distanceFromInstitutionMeters,
      isWithinGeofence: gpsData.isWithinGeofence,
      tamperFlag: gpsData.tamperFlag,
      capturedAt: gpsData.capturedAt,
    });

    const targetRooms = [
      ROOMS.role("ADMIN"),
      ROOMS.inspection(gpsData.inspectionId),
    ];

    for (const room of targetRooms) {
      socketManager.emitToRoom(room, eventType, payload);
    }
  }

  /**
   * Publish Alert Event
   * @param {string} eventType One of WS_EVENTS.ALERT_*
   * @param {object} alert Alert entity
   */
  async publishAlertEvent(eventType, alert) {
    if (!alert) return;

    const payload = buildEventEnvelope(eventType, {
      id: alert.id,
      institutionId: alert.institutionId,
      institutionName: alert.institution?.name,
      inspectionId: alert.inspectionId,
      alertType: alert.alertType,
      severity: alert.severity,
      title: alert.title,
      status: alert.status,
      createdAt: alert.createdAt,
    });

    const targetRooms = new Set([
      ROOMS.role("ADMIN"),
      ROOMS.institution(alert.institutionId),
    ]);

    if (alert.institution?.state) {
      targetRooms.add(ROOMS.state(alert.institution.state));
      if (alert.institution?.district) {
        targetRooms.add(ROOMS.district(alert.institution.state, alert.institution.district));
      }
    }

    for (const room of targetRooms) {
      socketManager.emitToRoom(room, eventType, payload);
    }
  }

  /**
   * Publish CCTV Device & Stream Status Event
   * @param {string} eventType One of WS_EVENTS.CCTV_*
   * @param {object} cctvDevice CCTV Device entity
   */
  async publishCctvEvent(eventType, cctvDevice) {
    if (!cctvDevice) return;

    const payload = buildEventEnvelope(eventType, {
      id: cctvDevice.id,
      institutionId: cctvDevice.institutionId,
      institutionName: cctvDevice.institution?.name,
      state: cctvDevice.institution?.state,
      district: cctvDevice.institution?.district,
      deviceName: cctvDevice.deviceName,
      cameraLocation: cctvDevice.cameraLocation,
      status: cctvDevice.status,
      lastPingAt: cctvDevice.lastPingAt,
      isAiMonitoringEnabled: cctvDevice.isAiMonitoringEnabled,
      updatedAt: cctvDevice.updatedAt || new Date(),
    });

    const targetRooms = new Set([
      ROOMS.role("ADMIN"),
      ROOMS.institution(cctvDevice.institutionId),
    ]);

    if (cctvDevice.institution?.state) {
      targetRooms.add(ROOMS.state(cctvDevice.institution.state));
      if (cctvDevice.institution?.district) {
        targetRooms.add(ROOMS.district(cctvDevice.institution.state, cctvDevice.institution.district));
      }
    }

    for (const room of targetRooms) {
      socketManager.emitToRoom(room, eventType, payload);
    }
  }

  /**
   * Publish Generic Direct Notification
   * @param {string} userId Target user UUID
   * @param {object} notification Payload data
   */
  async notifyUser(userId, notification) {
    const payload = buildEventEnvelope(WS_EVENTS.SYSTEM_NOTIFICATION, notification);
    socketManager.emitToUser(userId, WS_EVENTS.SYSTEM_NOTIFICATION, payload);
  }
}

export const eventPublisher = new EventPublisher();
export default eventPublisher;
