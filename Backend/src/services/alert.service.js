import { prisma } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";
import { recordAuditLog } from "../utils/audit.js";
import { cacheService, buildCacheKey, CACHE_TTL } from "./cache.service.js";
import { eventPublisher } from "../sockets/publisher.js";
import { WS_EVENTS } from "../sockets/events.js";

/**
 * Standard User projection excluding sensitive authentication fields
 */
const safeUserSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  state: true,
  district: true,
  isActive: true,
  institutionId: true,
};

/**
 * Invalidate alert caches safely
 */
export const invalidateAlertCaches = async (alertId = null, institutionId = null) => {
  const promises = [
    cacheService.delByPattern("alerts:list:*"),
    cacheService.delByPattern("alerts:stats:*"),
  ];

  if (alertId) {
    promises.push(cacheService.del(`alerts:detail:${alertId}`));
  }
  if (institutionId) {
    promises.push(cacheService.del(`institutions:detail:${institutionId}`));
  }

  await Promise.allSettled(promises);
};

/**
 * Build jurisdiction where-clause for alerts query based on currentUser role
 */
export const buildAlertJurisdictionWhere = (currentUser) => {
  if (!currentUser) return {};

  switch (currentUser.role) {
    case "ADMIN":
      return {}; // Unrestricted nationwide access

    case "STATE_OFFICER":
      if (!currentUser.state) {
        throw new ApiError(403, "State officer account is not mapped to any state jurisdiction");
      }
      return {
        institution: {
          state: { equals: currentUser.state, mode: "insensitive" },
        },
      };

    case "DISTRICT_OFFICER":
      if (!currentUser.state || !currentUser.district) {
        throw new ApiError(403, "District officer account is not mapped to state/district jurisdiction");
      }
      return {
        institution: {
          state: { equals: currentUser.state, mode: "insensitive" },
          district: { equals: currentUser.district, mode: "insensitive" },
        },
      };

    case "INSPECTOR":
      // Inspectors see alerts for institutions in their district or for their assigned inspections
      if (currentUser.district) {
        return {
          OR: [
            {
              institution: {
                district: { equals: currentUser.district, mode: "insensitive" },
              },
            },
            {
              inspection: {
                currentInspectorId: currentUser.id,
              },
            },
          ],
        };
      }
      return {
        inspection: {
          currentInspectorId: currentUser.id,
        },
      };

    case "INSTITUTION_USER":
      if (!currentUser.institutionId) {
        throw new ApiError(403, "Institution user account is not linked to any institution");
      }
      return {
        institutionId: currentUser.institutionId,
      };

    default:
      throw new ApiError(403, "Access forbidden for this user role");
  }
};

/**
 * Enforce jurisdiction access for a single Alert
 */
export const enforceAlertAccess = (alert, currentUser) => {
  if (!currentUser) throw new ApiError(401, "Authentication required");
  if (currentUser.role === "ADMIN") return true;

  if (currentUser.role === "INSTITUTION_USER") {
    if (alert.institutionId !== currentUser.institutionId) {
      throw new ApiError(403, "Access forbidden: You can only access alerts for your registered institution");
    }
    return true;
  }

  if (currentUser.role === "STATE_OFFICER") {
    if (alert.institution?.state?.toLowerCase() !== currentUser.state?.toLowerCase()) {
      throw new ApiError(403, `Access forbidden: Alert is outside your state jurisdiction (${currentUser.state})`);
    }
    return true;
  }

  if (currentUser.role === "DISTRICT_OFFICER") {
    if (
      alert.institution?.state?.toLowerCase() !== currentUser.state?.toLowerCase() ||
      alert.institution?.district?.toLowerCase() !== currentUser.district?.toLowerCase()
    ) {
      throw new ApiError(
        403,
        `Access forbidden: Alert is outside your district jurisdiction (${currentUser.district}, ${currentUser.state})`
      );
    }
    return true;
  }

  return true;
};

// =========================================================================
// ALERTS CORE SERVICES
// =========================================================================

/**
 * List Alerts with filters, pagination, and jurisdiction enforcement
 */
export const getAlerts = async (filters = {}, pagination = {}, currentUser) => {
  const { status, severity, alertType, institutionId, inspectionId, search } = filters;
  const page = Math.max(1, parseInt(pagination.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(pagination.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const jurisdictionWhere = buildAlertJurisdictionWhere(currentUser);

  const where = {
    ...jurisdictionWhere,
  };

  if (status) {
    if (Array.isArray(status)) {
      where.status = { in: status };
    } else {
      where.status = status;
    }
  }

  if (severity) {
    if (Array.isArray(severity)) {
      where.severity = { in: severity };
    } else {
      where.severity = severity;
    }
  }

  if (alertType) {
    where.alertType = { equals: alertType, mode: "insensitive" };
  }

  if (institutionId) {
    where.institutionId = institutionId;
  }

  if (inspectionId) {
    where.inspectionId = inspectionId;
  }

  if (search && search.trim()) {
    const s = search.trim();
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { title: { contains: s, mode: "insensitive" } },
          { description: { contains: s, mode: "insensitive" } },
          { alertType: { contains: s, mode: "insensitive" } },
          { institution: { name: { contains: s, mode: "insensitive" } } },
        ],
      },
    ];
  }

  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where,
      include: {
        institution: {
          select: {
            id: true,
            name: true,
            code: true,
            state: true,
            district: true,
            type: true,
            status: true,
            latestRiskScore: true,
            latestRiskLevel: true,
          },
        },
        inspection: {
          select: {
            id: true,
            inspectionCode: true,
            type: true,
            status: true,
            scheduledDate: true,
            currentInspector: {
              select: safeUserSelect,
            },
          },
        },
        acknowledgedBy: {
          select: safeUserSelect,
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.alert.count({ where }),
  ]);

  return {
    alerts,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get Alert Statistics scoped by user's jurisdiction
 */
export const getAlertStats = async (currentUser) => {
  const jurisdictionWhere = buildAlertJurisdictionWhere(currentUser);

  const [
    total,
    open,
    acknowledged,
    inProgress,
    resolved,
    dismissed,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
  ] = await Promise.all([
    prisma.alert.count({ where: jurisdictionWhere }),
    prisma.alert.count({ where: { ...jurisdictionWhere, status: "OPEN" } }),
    prisma.alert.count({ where: { ...jurisdictionWhere, status: "ACKNOWLEDGED" } }),
    prisma.alert.count({ where: { ...jurisdictionWhere, status: "IN_PROGRESS" } }),
    prisma.alert.count({ where: { ...jurisdictionWhere, status: "RESOLVED" } }),
    prisma.alert.count({ where: { ...jurisdictionWhere, status: "DISMISSED" } }),
    prisma.alert.count({ where: { ...jurisdictionWhere, severity: "CRITICAL" } }),
    prisma.alert.count({ where: { ...jurisdictionWhere, severity: "HIGH" } }),
    prisma.alert.count({ where: { ...jurisdictionWhere, severity: "MEDIUM" } }),
    prisma.alert.count({ where: { ...jurisdictionWhere, severity: "LOW" } }),
  ]);

  return {
    total,
    open,
    acknowledged,
    inProgress,
    resolved,
    dismissed,
    bySeverity: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
    },
  };
};

/**
 * Get detailed Alert dossier by ID
 */
export const getAlertById = async (alertId, currentUser) => {
  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    include: {
      institution: {
        select: {
          id: true,
          name: true,
          code: true,
          state: true,
          district: true,
          type: true,
          status: true,
          address: true,
          contactPerson: true,
          contactPhone: true,
          latestRiskScore: true,
          latestRiskLevel: true,
        },
      },
      inspection: {
        select: {
          id: true,
          inspectionCode: true,
          type: true,
          status: true,
          scheduledDate: true,
          startedAt: true,
          completedAt: true,
          currentInspector: {
            select: safeUserSelect,
          },
        },
      },
      acknowledgedBy: {
        select: safeUserSelect,
      },
    },
  });

  if (!alert) {
    throw new ApiError(404, `Alert with ID ${alertId} not found`);
  }

  enforceAlertAccess(alert, currentUser);

  return alert;
};

/**
 * Create a new Alert
 */
export const createAlert = async (data, currentUser, reqMeta = {}) => {
  const { institutionId, inspectionId, alertType, severity, title, description } = data;

  // Validate institution exists
  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    select: { id: true, name: true, state: true, district: true },
  });

  if (!institution) {
    throw new ApiError(404, `Institution with ID ${institutionId} not found`);
  }

  // Validate inspection if provided
  if (inspectionId) {
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: { id: true, institutionId: true },
    });
    if (!inspection) {
      throw new ApiError(404, `Inspection with ID ${inspectionId} not found`);
    }
  }

  const alert = await prisma.alert.create({
    data: {
      institutionId,
      inspectionId: inspectionId || null,
      alertType: alertType.toUpperCase(),
      severity: severity || "MEDIUM",
      title,
      description,
      status: "OPEN",
    },
    include: {
      institution: {
        select: {
          id: true,
          name: true,
          code: true,
          state: true,
          district: true,
        },
      },
      inspection: {
        select: {
          id: true,
          inspectionCode: true,
          type: true,
          status: true,
        },
      },
    },
  });

  // Create notifications for institution superintendent and state/district officers
  try {
    const recipientUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { institutionId: institution.id },
          { role: "ADMIN" },
          {
            role: "STATE_OFFICER",
            state: { equals: institution.state, mode: "insensitive" },
          },
          {
            role: "DISTRICT_OFFICER",
            state: { equals: institution.state, mode: "insensitive" },
            district: { equals: institution.district, mode: "insensitive" },
          },
        ],
      },
      select: { id: true },
    });

    if (recipientUsers.length > 0) {
      await prisma.notification.createMany({
        data: recipientUsers.map((u) => ({
          userId: u.id,
          title: `[${severity || "MEDIUM"}] ${title}`,
          message: description.length > 200 ? `${description.slice(0, 197)}...` : description,
          type: alertType,
          linkUrl: `/admin/alert`,
          isRead: false,
        })),
      });
    }
  } catch (err) {
    console.warn("Failed to create automated notifications for alert:", err.message);
  }

  // Record audit log
  await recordAuditLog({
    actorUserId: currentUser?.id || null,
    action: "CREATE_ALERT",
    entityType: "ALERT",
    entityId: alert.id,
    newValues: {
      title: alert.title,
      alertType: alert.alertType,
      severity: alert.severity,
      institutionId: alert.institutionId,
    },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  // Publish event
  await eventPublisher.publishAlertEvent(WS_EVENTS.ALERT_CREATED, alert);
  await invalidateAlertCaches(alert.id, alert.institutionId);

  return alert;
};

/**
 * Acknowledge an Alert
 */
export const acknowledgeAlert = async (alertId, notes = null, currentUser, reqMeta = {}) => {
  const existing = await getAlertById(alertId, currentUser);

  if (existing.status === "RESOLVED" || existing.status === "DISMISSED") {
    throw new ApiError(400, `Cannot acknowledge an alert that is already ${existing.status.toLowerCase()}`);
  }

  const updatedAlert = await prisma.alert.update({
    where: { id: alertId },
    data: {
      status: "ACKNOWLEDGED",
      acknowledgedById: currentUser.id,
      acknowledgedAt: new Date(),
      resolutionNotes: notes ? notes : existing.resolutionNotes,
    },
    include: {
      institution: {
        select: { id: true, name: true, code: true, state: true, district: true },
      },
      inspection: {
        select: { id: true, inspectionCode: true, type: true, status: true },
      },
      acknowledgedBy: {
        select: safeUserSelect,
      },
    },
  });

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "ACKNOWLEDGE_ALERT",
    entityType: "ALERT",
    entityId: alertId,
    oldValues: { status: existing.status },
    newValues: { status: "ACKNOWLEDGED", acknowledgedById: currentUser.id, notes },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  await eventPublisher.publishAlertEvent(WS_EVENTS.ALERT_ACKNOWLEDGED, updatedAlert);
  await invalidateAlertCaches(alertId, updatedAlert.institutionId);

  return updatedAlert;
};

/**
 * Resolve an Alert
 */
export const resolveAlert = async (alertId, resolutionNotes, currentUser, reqMeta = {}) => {
  const existing = await getAlertById(alertId, currentUser);

  if (existing.status === "RESOLVED") {
    throw new ApiError(400, "Alert is already resolved");
  }

  const updatedAlert = await prisma.alert.update({
    where: { id: alertId },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolutionNotes: resolutionNotes || "Resolved by authorized user",
      acknowledgedById: existing.acknowledgedById || currentUser.id,
      acknowledgedAt: existing.acknowledgedAt || new Date(),
    },
    include: {
      institution: {
        select: { id: true, name: true, code: true, state: true, district: true },
      },
      inspection: {
        select: { id: true, inspectionCode: true, type: true, status: true },
      },
      acknowledgedBy: {
        select: safeUserSelect,
      },
    },
  });

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "RESOLVE_ALERT",
    entityType: "ALERT",
    entityId: alertId,
    oldValues: { status: existing.status },
    newValues: { status: "RESOLVED", resolutionNotes },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  await eventPublisher.publishAlertEvent(WS_EVENTS.ALERT_RESOLVED, updatedAlert);
  await invalidateAlertCaches(alertId, updatedAlert.institutionId);

  return updatedAlert;
};

/**
 * Dismiss an Alert
 */
export const dismissAlert = async (alertId, resolutionNotes = null, currentUser, reqMeta = {}) => {
  const existing = await getAlertById(alertId, currentUser);

  if (existing.status === "RESOLVED") {
    throw new ApiError(400, "Cannot dismiss an already resolved alert");
  }

  const updatedAlert = await prisma.alert.update({
    where: { id: alertId },
    data: {
      status: "DISMISSED",
      resolutionNotes: resolutionNotes || "Dismissed by authorized administrator",
      acknowledgedById: existing.acknowledgedById || currentUser.id,
      acknowledgedAt: existing.acknowledgedAt || new Date(),
    },
    include: {
      institution: {
        select: { id: true, name: true, code: true, state: true, district: true },
      },
      inspection: {
        select: { id: true, inspectionCode: true, type: true, status: true },
      },
      acknowledgedBy: {
        select: safeUserSelect,
      },
    },
  });

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "DISMISS_ALERT",
    entityType: "ALERT",
    entityId: alertId,
    oldValues: { status: existing.status },
    newValues: { status: "DISMISSED", resolutionNotes },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  await eventPublisher.publishAlertEvent(WS_EVENTS.ALERT_UPDATED, updatedAlert);
  await invalidateAlertCaches(alertId, updatedAlert.institutionId);

  return updatedAlert;
};

// =========================================================================
// USER NOTIFICATIONS CORE SERVICES
// =========================================================================

/**
 * Get Notifications for authenticated user
 */
export const getUserNotifications = async (currentUser, options = {}) => {
  if (!currentUser) throw new ApiError(401, "Authentication required");

  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(options.limit, 10) || 15));
  const skip = (page - 1) * limit;

  const where = {
    userId: currentUser.id,
  };

  if (options.isRead !== undefined && options.isRead !== null && options.isRead !== "") {
    where.isRead = options.isRead === "true" || options.isRead === true;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { userId: currentUser.id, isRead: false },
    }),
  ]);

  return {
    notifications,
    unreadCount,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get unread notification count for authenticated user
 */
export const getUnreadNotificationCount = async (currentUser) => {
  if (!currentUser) throw new ApiError(401, "Authentication required");

  const unreadCount = await prisma.notification.count({
    where: {
      userId: currentUser.id,
      isRead: false,
    },
  });

  return { unreadCount };
};

/**
 * Mark a single Notification as read
 */
export const markNotificationRead = async (notificationId, currentUser) => {
  if (!currentUser) throw new ApiError(401, "Authentication required");

  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId: currentUser.id,
    },
  });

  if (!notification) {
    throw new ApiError(404, "Notification not found or access denied");
  }

  if (notification.isRead) {
    return notification;
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return updated;
};

/**
 * Mark all notifications as read for authenticated user
 */
export const markAllNotificationsRead = async (currentUser) => {
  if (!currentUser) throw new ApiError(401, "Authentication required");

  const result = await prisma.notification.updateMany({
    where: {
      userId: currentUser.id,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return {
    updatedCount: result.count,
    message: `Marked ${result.count} notifications as read`,
  };
};
