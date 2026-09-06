import { prisma } from "../config/db.js";

/**
 * Helper to record immutable audit logs into PostgreSQL
 */
export const recordAuditLog = async ({
  actorUserId = null,
  action,
  entityType,
  entityId,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  userAgent = null,
}) => {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId,
        action,
        entityType,
        entityId,
        oldValues: oldValues ? JSON.parse(JSON.stringify(oldValues)) : null,
        newValues: newValues ? JSON.parse(JSON.stringify(newValues)) : null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });
  } catch (err) {
    console.error(`Audit log recording error (${action} on ${entityType}):`, err.message);
  }
};
