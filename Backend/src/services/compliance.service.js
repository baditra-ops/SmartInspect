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
 * Invalidate compliance action and related entity caches safely
 */
export const invalidateComplianceCaches = async (complianceId = null, institutionId = null, inspectionId = null) => {
  const promises = [
    cacheService.delByPattern("compliance:list:*"),
    cacheService.delByPattern("compliance:stats:*"),
  ];

  if (complianceId) {
    promises.push(cacheService.del(`compliance:detail:${complianceId}`));
  }
  if (institutionId) {
    promises.push(cacheService.del(`institutions:detail:${institutionId}`));
  }
  if (inspectionId) {
    promises.push(cacheService.del(`inspections:detail:${inspectionId}`));
  }

  await Promise.allSettled(promises);
};

/**
 * Enforce geographic and role-based access control for compliance action entities
 */
export const enforceComplianceAccess = (complianceAction, currentUser) => {
  if (!currentUser) {
    throw new ApiError(401, "Authentication required");
  }

  // National Admin has unrestricted nationwide access
  if (currentUser.role === "ADMIN") {
    return true;
  }

  // Inspectors can view compliance actions within their scope
  if (currentUser.role === "INSPECTOR") {
    return true;
  }

  // Institution staff can ONLY access compliance actions belonging to their designated facility
  if (currentUser.role === "INSTITUTION_USER") {
    if (!currentUser.institutionId || currentUser.institutionId !== complianceAction.institutionId) {
      throw new ApiError(403, "Access forbidden. You may only access compliance actions for your designated institution.");
    }
    return true;
  }

  const instState = complianceAction.institution?.state;
  const instDistrict = complianceAction.institution?.district;

  // State Officers are strictly scoped to their assigned state
  if (currentUser.role === "STATE_OFFICER") {
    if (!currentUser.state || !instState || currentUser.state.toLowerCase() !== instState.toLowerCase()) {
      throw new ApiError(
        403,
        `Access forbidden. Institution (${instState}) is outside your assigned state jurisdiction (${currentUser.state}).`
      );
    }
    return true;
  }

  // District Officers are strictly scoped to their assigned state and district
  if (currentUser.role === "DISTRICT_OFFICER") {
    const isStateMatch =
      currentUser.state && instState && currentUser.state.toLowerCase() === instState.toLowerCase();
    const isDistrictMatch =
      currentUser.district && instDistrict && currentUser.district.toLowerCase() === instDistrict.toLowerCase();

    if (!isStateMatch || !isDistrictMatch) {
      throw new ApiError(
        403,
        `Access forbidden. Institution (${instDistrict}, ${instState}) is outside your assigned district jurisdiction (${currentUser.district}, ${currentUser.state}).`
      );
    }
    return true;
  }

  throw new ApiError(403, "Access denied. Insufficient permissions.");
};

/**
 * Enforce geographic jurisdiction when mutating or assigning for an institution
 */
export const enforceInstitutionJurisdiction = (institution, currentUser) => {
  if (!currentUser) {
    throw new ApiError(401, "Authentication required");
  }

  if (currentUser.role === "ADMIN") return true;

  if (currentUser.role === "STATE_OFFICER") {
    if (!currentUser.state || !institution.state || currentUser.state.toLowerCase() !== institution.state.toLowerCase()) {
      throw new ApiError(
        403,
        `Access forbidden. Institution (${institution.state}) is outside your assigned state jurisdiction (${currentUser.state}).`
      );
    }
    return true;
  }

  if (currentUser.role === "DISTRICT_OFFICER") {
    const isStateMatch =
      currentUser.state && institution.state && currentUser.state.toLowerCase() === institution.state.toLowerCase();
    const isDistrictMatch =
      currentUser.district && institution.district && currentUser.district.toLowerCase() === institution.district.toLowerCase();

    if (!isStateMatch || !isDistrictMatch) {
      throw new ApiError(
        403,
        `Access forbidden. Institution (${institution.district}, ${institution.state}) is outside your assigned district jurisdiction (${currentUser.district}, ${currentUser.state}).`
      );
    }
    return true;
  }

  throw new ApiError(403, "Access denied. Insufficient permissions for this institution jurisdiction.");
};

/**
 * Compute derived deadline metrics and status for a compliance action
 */
export const enrichComplianceAction = (action) => {
  if (!action) return action;

  const now = new Date();
  const deadlineDate = new Date(action.deadline);
  const isClosed = action.status === "VERIFIED_CLOSED";

  // Check if deadline has passed
  const isOverdue = !isClosed && deadlineDate.getTime() < now.getTime();

  // Difference in calendar days
  const diffTime = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let deadlineStatus = "ON_TIME";
  if (isClosed) {
    deadlineStatus = "COMPLETED";
  } else if (isOverdue) {
    deadlineStatus = "OVERDUE";
  } else if (diffDays <= 3) {
    deadlineStatus = "DUE_SOON";
  }

  return {
    ...action,
    isOverdue,
    daysRemaining: isOverdue ? 0 : Math.max(0, diffDays),
    daysOverdue: isOverdue ? Math.abs(diffDays) : 0,
    deadlineStatus,
  };
};

/**
 * Get paginated list of compliance actions with role-based scoping and filters
 */
export const getComplianceActions = async (query, currentUser) => {
  const cacheKey = buildCacheKey("compliance", "list", currentUser, query);

  return await cacheService.getOrSet(cacheKey, async () => {
    const {
      page,
      limit,
      status,
      severity,
      institutionId,
      inspectionId,
      assignedToUserId,
      isOverdue,
      state,
      district,
      search,
      sortBy,
      sortOrder,
    } = query;

    const where = {};

    // 1. Role-based geographic constraints
    if (currentUser.role === "STATE_OFFICER") {
      where.institution = {
        state: { equals: currentUser.state, mode: "insensitive" },
      };
    } else if (currentUser.role === "DISTRICT_OFFICER") {
      where.institution = {
        state: { equals: currentUser.state, mode: "insensitive" },
        district: { equals: currentUser.district, mode: "insensitive" },
      };
    } else if (currentUser.role === "INSTITUTION_USER") {
      where.institutionId = currentUser.institutionId || "00000000-0000-0000-0000-000000000000";
    } else {
      // ADMIN or INSPECTOR can filter by geographic query params if provided
      if (state || district) {
        where.institution = {};
        if (state) where.institution.state = { equals: state, mode: "insensitive" };
        if (district) where.institution.district = { equals: district, mode: "insensitive" };
      }
    }

    // 2. Specific Entity Filters
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (institutionId) where.institutionId = institutionId;
    if (inspectionId) where.inspectionId = inspectionId;
    if (assignedToUserId) where.assignedToUserId = assignedToUserId;

    // 3. Overdue Filter
    if (isOverdue === true || isOverdue === "true") {
      where.status = { not: "VERIFIED_CLOSED" };
      where.deadline = { lt: new Date() };
    } else if (isOverdue === false || isOverdue === "false") {
      where.OR = [
        { status: "VERIFIED_CLOSED" },
        { deadline: { gte: new Date() } },
      ];
    }

    // 4. Search Filter
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { institution: { name: { contains: search, mode: "insensitive" } } },
        { inspection: { inspectionCode: { contains: search, mode: "insensitive" } } },
      ];
    }

    const skip = (page - 1) * limit;
    const take = limit;

    const [total, actions] = await Promise.all([
      prisma.complianceAction.count({ where }),
      prisma.complianceAction.findMany({
        where,
        skip,
        take,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          institution: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              state: true,
              district: true,
              status: true,
            },
          },
          inspection: {
            select: {
              id: true,
              inspectionCode: true,
              type: true,
              status: true,
              scheduledDate: true,
            },
          },
          checklistItem: {
            select: {
              id: true,
              category: true,
              questionText: true,
            },
          },
          assignedToUser: {
            select: safeUserSelect,
          },
          createdByUser: {
            select: safeUserSelect,
          },
          verifiedByUser: {
            select: safeUserSelect,
          },
        },
      }),
    ]);

    const enriched = actions.map(enrichComplianceAction);

    return {
      actions: enriched,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }, CACHE_TTL.STANDARD);
};

/**
 * Get aggregated statistical metrics for compliance actions
 */
export const getComplianceStats = async (query = {}, currentUser) => {
  const cacheKey = buildCacheKey("compliance", "stats", currentUser, query);

  return await cacheService.getOrSet(cacheKey, async () => {
    const where = {};

    if (currentUser.role === "STATE_OFFICER") {
      where.institution = {
        state: { equals: currentUser.state, mode: "insensitive" },
      };
    } else if (currentUser.role === "DISTRICT_OFFICER") {
      where.institution = {
        state: { equals: currentUser.state, mode: "insensitive" },
        district: { equals: currentUser.district, mode: "insensitive" },
      };
    } else if (currentUser.role === "INSTITUTION_USER") {
      where.institutionId = currentUser.institutionId || "00000000-0000-0000-0000-000000000000";
    }

    if (query.institutionId) where.institutionId = query.institutionId;

    const [total, pending, inProgress, submittedForReview, verifiedClosed, escalated, overdue] = await Promise.all([
      prisma.complianceAction.count({ where }),
      prisma.complianceAction.count({ where: { ...where, status: "PENDING" } }),
      prisma.complianceAction.count({ where: { ...where, status: "IN_PROGRESS" } }),
      prisma.complianceAction.count({ where: { ...where, status: "SUBMITTED_FOR_REVIEW" } }),
      prisma.complianceAction.count({ where: { ...where, status: "VERIFIED_CLOSED" } }),
      prisma.complianceAction.count({ where: { ...where, status: "ESCALATED" } }),
      prisma.complianceAction.count({
        where: {
          ...where,
          status: { not: "VERIFIED_CLOSED" },
          deadline: { lt: new Date() },
        },
      }),
    ]);

    return {
      total,
      pending,
      inProgress,
      submittedForReview,
      verifiedClosed,
      escalated,
      overdue,
    };
  }, CACHE_TTL.SHORT);
};

/**
 * Get single compliance action by ID with relations and derived status
 */
export const getComplianceActionById = async (id, currentUser) => {
  const cacheKey = `compliance:detail:${id}`;

  const action = await cacheService.getOrSet(cacheKey, async () => {
    const item = await prisma.complianceAction.findUnique({
      where: { id },
      include: {
        institution: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            address: true,
            state: true,
            district: true,
            pincode: true,
            contactPerson: true,
            contactPhone: true,
            contactEmail: true,
            status: true,
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
            overallScore: true,
            complianceStatus: true,
          },
        },
        checklistItem: {
          select: {
            id: true,
            category: true,
            questionText: true,
            guidelines: true,
            weightage: true,
          },
        },
        assignedToUser: {
          select: safeUserSelect,
        },
        createdByUser: {
          select: safeUserSelect,
        },
        verifiedByUser: {
          select: safeUserSelect,
        },
      },
    });

    if (!item) {
      throw new ApiError(404, `Compliance action with ID ${id} not found.`);
    }

    return item;
  }, CACHE_TTL.STANDARD);

  // Enforce access control dynamically on retrieved entity
  enforceComplianceAccess(action, currentUser);

  return enrichComplianceAction(action);
};

/**
 * Validate that an assignee user exists, is active, and is within permissible jurisdiction
 */
export const validateAssigneeUser = async (assignedToUserId, institution, currentUser) => {
  if (!assignedToUserId) return null;

  const user = await prisma.user.findUnique({
    where: { id: assignedToUserId },
    select: safeUserSelect,
  });

  if (!user) {
    throw new ApiError(404, `Assignee user with ID ${assignedToUserId} does not exist.`);
  }

  if (!user.isActive) {
    throw new ApiError(400, `Assignee user (${user.fullName}) is currently inactive.`);
  }

  // If assigned user is an Institution User, must match this exact institution
  if (user.role === "INSTITUTION_USER") {
    if (user.institutionId !== institution.id) {
      throw new ApiError(
        400,
        `Assignee user is an Institution User assigned to another institution. Cannot assign to ${institution.name}.`
      );
    }
  }

  // If assigner is State Officer, ensure assignee is within their state
  if (currentUser.role === "STATE_OFFICER") {
    if (user.state && user.state.toLowerCase() !== currentUser.state.toLowerCase()) {
      throw new ApiError(
        403,
        `Cannot assign compliance action to user (${user.state}) outside your state jurisdiction (${currentUser.state}).`
      );
    }
  }

  // If assigner is District Officer, ensure assignee is within their district
  if (currentUser.role === "DISTRICT_OFFICER") {
    const isStateMatch = !user.state || user.state.toLowerCase() === currentUser.state.toLowerCase();
    const isDistrictMatch = !user.district || user.district.toLowerCase() === currentUser.district.toLowerCase();
    if (!isStateMatch || !isDistrictMatch) {
      throw new ApiError(
        403,
        `Cannot assign compliance action to user (${user.district}, ${user.state}) outside your district jurisdiction (${currentUser.district}, ${currentUser.state}).`
      );
    }
  }

  return user;
};

/**
 * Create a new Compliance Action
 */
export const createComplianceAction = async (data, currentUser, reqMeta = {}) => {
  // Only authorized government officers can create compliance actions
  if (!["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"].includes(currentUser.role)) {
    throw new ApiError(403, `Access denied. Only government officers can create compliance actions. Current role: ${currentUser.role}`);
  }

  const {
    institutionId,
    inspectionId,
    checklistItemId,
    title,
    description,
    severity = "MEDIUM",
    deadline,
    assignedToUserId,
  } = data;

  // 1. Verify Institution exists and falls within assigner's jurisdiction
  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
  });
  if (!institution) {
    throw new ApiError(404, `Target institution with ID ${institutionId} not found.`);
  }
  enforceInstitutionJurisdiction(institution, currentUser);

  // 2. Verify Inspection exists and belongs to the specified institution
  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
  });
  if (!inspection) {
    throw new ApiError(404, `Inspection with ID ${inspectionId} not found.`);
  }
  if (inspection.institutionId !== institutionId) {
    throw new ApiError(400, "Inspection does not belong to the specified institution.");
  }

  // 3. Verify checklist item if provided
  if (checklistItemId) {
    const item = await prisma.checklistItem.findUnique({
      where: { id: checklistItemId },
    });
    if (!item) {
      throw new ApiError(404, `Checklist item with ID ${checklistItemId} not found.`);
    }
  }

  // 4. Validate assignee if provided
  if (assignedToUserId) {
    await validateAssigneeUser(assignedToUserId, institution, currentUser);
  }

  const deadlineDate = new Date(deadline);

  // 5. Create compliance action in PostgreSQL
  const action = await prisma.complianceAction.create({
    data: {
      institutionId,
      inspectionId,
      checklistItemId: checklistItemId || null,
      title,
      description,
      severity,
      deadline: deadlineDate,
      status: "PENDING",
      assignedToUserId: assignedToUserId || null,
      createdByUserId: currentUser.id,
    },
    include: {
      institution: {
        select: {
          id: true,
          code: true,
          name: true,
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
      assignedToUser: {
        select: safeUserSelect,
      },
      createdByUser: {
        select: safeUserSelect,
      },
    },
  });

  // 6. Record Audit Log
  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "COMPLIANCE_ACTION_CREATED",
    entityType: "ComplianceAction",
    entityId: action.id,
    newValues: {
      id: action.id,
      institutionId,
      inspectionId,
      title,
      severity,
      deadline: action.deadline,
      status: action.status,
      assignedToUserId: action.assignedToUserId,
    },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  // 7. Invalidate Caches
  await invalidateComplianceCaches(action.id, institutionId, inspectionId);

  // 8. Publish Real-Time WebSocket Event
  eventPublisher.publishComplianceEvent(WS_EVENTS.COMPLIANCE_CREATED, action).catch(() => {});

  return enrichComplianceAction(action);
};

/**
 * Create a Compliance Action directly from an existing Alert
 */
export const createComplianceFromAlert = async (data, currentUser, reqMeta = {}) => {
  if (!["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"].includes(currentUser.role)) {
    throw new ApiError(403, `Access denied. Only government officers can create compliance actions. Current role: ${currentUser.role}`);
  }

  const { alertId, inspectionId, checklistItemId, title, description, severity, deadline, assignedToUserId } = data;

  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    include: {
      institution: true,
    },
  });

  if (!alert) {
    throw new ApiError(404, `Alert with ID ${alertId} not found.`);
  }

  enforceInstitutionJurisdiction(alert.institution, currentUser);

  const resolvedInspectionId = inspectionId || alert.inspectionId;
  if (!resolvedInspectionId) {
    throw new ApiError(
      400,
      "This alert is not directly associated with an inspection. Please provide an inspectionId for compliance tracking."
    );
  }

  const action = await createComplianceAction(
    {
      institutionId: alert.institutionId,
      inspectionId: resolvedInspectionId,
      checklistItemId: checklistItemId || null,
      title: title || `Corrective Action: ${alert.title}`,
      description: description || alert.description,
      severity: severity || alert.severity,
      deadline,
      assignedToUserId,
    },
    currentUser,
    reqMeta
  );

  // Update alert status to IN_PROGRESS if open
  if (alert.status === "OPEN" || alert.status === "ACKNOWLEDGED") {
    await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: "IN_PROGRESS",
        acknowledgedById: alert.acknowledgedById || currentUser.id,
        acknowledgedAt: alert.acknowledgedAt || new Date(),
      },
    });
  }

  return action;
};

/**
 * Update Compliance Action Metadata (Title, Description, Severity, Deadline)
 */
export const updateComplianceAction = async (id, data, currentUser, reqMeta = {}) => {
  if (!["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"].includes(currentUser.role)) {
    throw new ApiError(403, `Access denied. Only government officers can update compliance action metadata. Current role: ${currentUser.role}`);
  }

  const existing = await prisma.complianceAction.findUnique({
    where: { id },
    include: { institution: true },
  });

  if (!existing) {
    throw new ApiError(404, `Compliance action with ID ${id} not found.`);
  }

  enforceInstitutionJurisdiction(existing.institution, currentUser);

  if (existing.status === "VERIFIED_CLOSED") {
    throw new ApiError(400, "Cannot modify a verified and closed compliance action. Reopen the action first if rework is required.");
  }

  const updatePayload = {};
  if (data.title !== undefined) updatePayload.title = data.title;
  if (data.description !== undefined) updatePayload.description = data.description;
  if (data.severity !== undefined) updatePayload.severity = data.severity;
  if (data.deadline !== undefined) updatePayload.deadline = new Date(data.deadline);
  if (data.checklistItemId !== undefined) updatePayload.checklistItemId = data.checklistItemId;

  const updated = await prisma.complianceAction.update({
    where: { id },
    data: updatePayload,
    include: {
      institution: {
        select: { id: true, code: true, name: true, state: true, district: true },
      },
      inspection: {
        select: { id: true, inspectionCode: true, type: true, status: true },
      },
      assignedToUser: { select: safeUserSelect },
      createdByUser: { select: safeUserSelect },
      verifiedByUser: { select: safeUserSelect },
    },
  });

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "COMPLIANCE_ACTION_UPDATED",
    entityType: "ComplianceAction",
    entityId: id,
    oldValues: existing,
    newValues: updated,
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  await invalidateComplianceCaches(id, existing.institutionId, existing.inspectionId);

  eventPublisher.publishComplianceEvent(WS_EVENTS.COMPLIANCE_UPDATED, updated).catch(() => {});

  return enrichComplianceAction(updated);
};

/**
 * Assign or Reassign Responsible User
 */
export const assignComplianceAction = async (id, assignedToUserId, currentUser, reqMeta = {}) => {
  if (!["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"].includes(currentUser.role)) {
    throw new ApiError(403, `Access denied. Only government officers can assign compliance actions. Current role: ${currentUser.role}`);
  }

  const existing = await prisma.complianceAction.findUnique({
    where: { id },
    include: { institution: true },
  });

  if (!existing) {
    throw new ApiError(404, `Compliance action with ID ${id} not found.`);
  }

  enforceInstitutionJurisdiction(existing.institution, currentUser);

  if (existing.status === "VERIFIED_CLOSED") {
    throw new ApiError(400, "Cannot reassign a closed compliance action.");
  }

  // Validate target user
  const assignee = await validateAssigneeUser(assignedToUserId, existing.institution, currentUser);

  const updated = await prisma.complianceAction.update({
    where: { id },
    data: {
      assignedToUserId,
    },
    include: {
      institution: {
        select: { id: true, code: true, name: true, state: true, district: true },
      },
      inspection: {
        select: { id: true, inspectionCode: true, type: true, status: true },
      },
      assignedToUser: { select: safeUserSelect },
      createdByUser: { select: safeUserSelect },
      verifiedByUser: { select: safeUserSelect },
    },
  });

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "COMPLIANCE_ACTION_ASSIGNED",
    entityType: "ComplianceAction",
    entityId: id,
    oldValues: { assignedToUserId: existing.assignedToUserId },
    newValues: { assignedToUserId, assignedUserName: assignee.fullName },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  await invalidateComplianceCaches(id, existing.institutionId, existing.inspectionId);

  eventPublisher.publishComplianceEvent(WS_EVENTS.COMPLIANCE_ASSIGNED, updated).catch(() => {});

  return enrichComplianceAction(updated);
};

/**
 * Start Work on Compliance Action: PENDING -> IN_PROGRESS
 */
export const startComplianceAction = async (id, currentUser, reqMeta = {}) => {
  const existing = await prisma.complianceAction.findUnique({
    where: { id },
    include: { institution: true },
  });

  if (!existing) {
    throw new ApiError(404, `Compliance action with ID ${id} not found.`);
  }

  enforceComplianceAccess(existing, currentUser);

  if (existing.status !== "PENDING") {
    throw new ApiError(
      400,
      `Cannot start compliance action. Action must be in PENDING status. Current status: ${existing.status}`
    );
  }

  const updated = await prisma.complianceAction.update({
    where: { id },
    data: {
      status: "IN_PROGRESS",
    },
    include: {
      institution: {
        select: { id: true, code: true, name: true, state: true, district: true },
      },
      inspection: {
        select: { id: true, inspectionCode: true, type: true, status: true },
      },
      assignedToUser: { select: safeUserSelect },
      createdByUser: { select: safeUserSelect },
      verifiedByUser: { select: safeUserSelect },
    },
  });

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "COMPLIANCE_ACTION_STARTED",
    entityType: "ComplianceAction",
    entityId: id,
    oldValues: { status: existing.status },
    newValues: { status: "IN_PROGRESS" },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  await invalidateComplianceCaches(id, existing.institutionId, existing.inspectionId);

  eventPublisher.publishComplianceEvent(WS_EVENTS.COMPLIANCE_STARTED, updated).catch(() => {});

  return enrichComplianceAction(updated);
};

/**
 * Submit Rectification by Institution or Assignee: (PENDING | IN_PROGRESS | ESCALATED) -> SUBMITTED_FOR_REVIEW
 */
export const submitRectification = async (id, data, currentUser, reqMeta = {}) => {
  const existing = await prisma.complianceAction.findUnique({
    where: { id },
    include: { institution: true },
  });

  if (!existing) {
    throw new ApiError(404, `Compliance action with ID ${id} not found.`);
  }

  enforceComplianceAccess(existing, currentUser);

  // Validate state transition
  if (!["PENDING", "IN_PROGRESS", "ESCALATED"].includes(existing.status)) {
    throw new ApiError(
      400,
      `Cannot submit rectification. Action status must be PENDING, IN_PROGRESS, or ESCALATED. Current status: ${existing.status}`
    );
  }

  const { institutionResponse, resolutionEvidenceUrl } = data;

  const updated = await prisma.complianceAction.update({
    where: { id },
    data: {
      status: "SUBMITTED_FOR_REVIEW",
      institutionResponse,
      resolutionEvidenceUrl: resolutionEvidenceUrl || null,
    },
    include: {
      institution: {
        select: { id: true, code: true, name: true, state: true, district: true },
      },
      inspection: {
        select: { id: true, inspectionCode: true, type: true, status: true },
      },
      assignedToUser: { select: safeUserSelect },
      createdByUser: { select: safeUserSelect },
      verifiedByUser: { select: safeUserSelect },
    },
  });

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "COMPLIANCE_ACTION_SUBMITTED",
    entityType: "ComplianceAction",
    entityId: id,
    oldValues: {
      status: existing.status,
      institutionResponse: existing.institutionResponse,
      resolutionEvidenceUrl: existing.resolutionEvidenceUrl,
    },
    newValues: {
      status: "SUBMITTED_FOR_REVIEW",
      institutionResponse,
      resolutionEvidenceUrl: resolutionEvidenceUrl || null,
    },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  await invalidateComplianceCaches(id, existing.institutionId, existing.inspectionId);

  eventPublisher.publishComplianceEvent(WS_EVENTS.COMPLIANCE_SUBMITTED, updated).catch(() => {});

  return enrichComplianceAction(updated);
};

/**
 * Officer Verification & Closure: SUBMITTED_FOR_REVIEW -> VERIFIED_CLOSED
 * IMPORTANT: Institution users must NEVER be able to verify their own actions!
 */
export const verifyComplianceAction = async (id, data = {}, currentUser, reqMeta = {}) => {
  // 1. Strict Role Check: Only ADMIN, STATE_OFFICER, or DISTRICT_OFFICER
  if (!["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"].includes(currentUser.role)) {
    throw new ApiError(
      403,
      `Access denied. Only authorized government officers can verify and approve compliance actions. Current role: ${currentUser.role}`
    );
  }

  const existing = await prisma.complianceAction.findUnique({
    where: { id },
    include: { institution: true },
  });

  if (!existing) {
    throw new ApiError(404, `Compliance action with ID ${id} not found.`);
  }

  // 2. Geographic Jurisdiction Check
  enforceInstitutionJurisdiction(existing.institution, currentUser);

  // 3. Strict State Transition Check
  if (existing.status !== "SUBMITTED_FOR_REVIEW") {
    throw new ApiError(
      400,
      `Cannot verify compliance action. Rectification has not been submitted for review. Current status: ${existing.status}`
    );
  }

  const verifiedAt = new Date();

  const updated = await prisma.complianceAction.update({
    where: { id },
    data: {
      status: "VERIFIED_CLOSED",
      verifiedAt,
      verifiedById: currentUser.id,
    },
    include: {
      institution: {
        select: { id: true, code: true, name: true, state: true, district: true },
      },
      inspection: {
        select: { id: true, inspectionCode: true, type: true, status: true },
      },
      assignedToUser: { select: safeUserSelect },
      createdByUser: { select: safeUserSelect },
      verifiedByUser: { select: safeUserSelect },
    },
  });

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "COMPLIANCE_ACTION_VERIFIED",
    entityType: "ComplianceAction",
    entityId: id,
    oldValues: { status: existing.status },
    newValues: {
      status: "VERIFIED_CLOSED",
      verifiedAt,
      verifiedById: currentUser.id,
      remarks: data.remarks || null,
    },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  await invalidateComplianceCaches(id, existing.institutionId, existing.inspectionId);

  eventPublisher.publishComplianceEvent(WS_EVENTS.COMPLIANCE_VERIFIED, updated).catch(() => {});

  return enrichComplianceAction(updated);
};

/**
 * Reject Rectification Submission: SUBMITTED_FOR_REVIEW -> IN_PROGRESS
 * Sends action back to IN_PROGRESS for rework (does NOT close).
 */
export const rejectRectification = async (id, data, currentUser, reqMeta = {}) => {
  if (!["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"].includes(currentUser.role)) {
    throw new ApiError(
      403,
      `Access denied. Only authorized government officers can reject rectification submissions. Current role: ${currentUser.role}`
    );
  }

  const existing = await prisma.complianceAction.findUnique({
    where: { id },
    include: { institution: true },
  });

  if (!existing) {
    throw new ApiError(404, `Compliance action with ID ${id} not found.`);
  }

  enforceInstitutionJurisdiction(existing.institution, currentUser);

  if (existing.status !== "SUBMITTED_FOR_REVIEW") {
    throw new ApiError(
      400,
      `Cannot reject rectification. Action must be in SUBMITTED_FOR_REVIEW status. Current status: ${existing.status}`
    );
  }

  const { rejectionReason } = data;

  const updated = await prisma.complianceAction.update({
    where: { id },
    data: {
      status: "IN_PROGRESS",
    },
    include: {
      institution: {
        select: { id: true, code: true, name: true, state: true, district: true },
      },
      inspection: {
        select: { id: true, inspectionCode: true, type: true, status: true },
      },
      assignedToUser: { select: safeUserSelect },
      createdByUser: { select: safeUserSelect },
      verifiedByUser: { select: safeUserSelect },
    },
  });

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "COMPLIANCE_ACTION_REJECTED",
    entityType: "ComplianceAction",
    entityId: id,
    oldValues: { status: existing.status },
    newValues: {
      status: "IN_PROGRESS",
      rejectionReason,
    },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  await invalidateComplianceCaches(id, existing.institutionId, existing.inspectionId);

  eventPublisher.publishComplianceEvent(WS_EVENTS.COMPLIANCE_REJECTED, updated).catch(() => {});

  return enrichComplianceAction(updated);
};

/**
 * Direct Officer Close: Transitions to VERIFIED_CLOSED
 */
export const closeComplianceAction = async (id, data = {}, currentUser, reqMeta = {}) => {
  if (!["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"].includes(currentUser.role)) {
    throw new ApiError(
      403,
      `Access denied. Only authorized government officers can close compliance actions. Current role: ${currentUser.role}`
    );
  }

  const existing = await prisma.complianceAction.findUnique({
    where: { id },
    include: { institution: true },
  });

  if (!existing) {
    throw new ApiError(404, `Compliance action with ID ${id} not found.`);
  }

  enforceInstitutionJurisdiction(existing.institution, currentUser);

  if (existing.status === "VERIFIED_CLOSED") {
    throw new ApiError(400, "Compliance action is already verified and closed.");
  }

  const verifiedAt = new Date();

  const updated = await prisma.complianceAction.update({
    where: { id },
    data: {
      status: "VERIFIED_CLOSED",
      verifiedAt,
      verifiedById: currentUser.id,
    },
    include: {
      institution: {
        select: { id: true, code: true, name: true, state: true, district: true },
      },
      inspection: {
        select: { id: true, inspectionCode: true, type: true, status: true },
      },
      assignedToUser: { select: safeUserSelect },
      createdByUser: { select: safeUserSelect },
      verifiedByUser: { select: safeUserSelect },
    },
  });

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "COMPLIANCE_ACTION_CLOSED",
    entityType: "ComplianceAction",
    entityId: id,
    oldValues: { status: existing.status },
    newValues: {
      status: "VERIFIED_CLOSED",
      verifiedAt,
      verifiedById: currentUser.id,
      remarks: data.remarks || null,
    },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  await invalidateComplianceCaches(id, existing.institutionId, existing.inspectionId);

  eventPublisher.publishComplianceEvent(WS_EVENTS.COMPLIANCE_CLOSED, updated).catch(() => {});

  return enrichComplianceAction(updated);
};

/**
 * Reopen Closed Compliance Action: VERIFIED_CLOSED -> IN_PROGRESS
 */
export const reopenComplianceAction = async (id, data, currentUser, reqMeta = {}) => {
  if (!["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"].includes(currentUser.role)) {
    throw new ApiError(
      403,
      `Access denied. Only authorized government officers can reopen closed compliance actions. Current role: ${currentUser.role}`
    );
  }

  const existing = await prisma.complianceAction.findUnique({
    where: { id },
    include: { institution: true },
  });

  if (!existing) {
    throw new ApiError(404, `Compliance action with ID ${id} not found.`);
  }

  enforceInstitutionJurisdiction(existing.institution, currentUser);

  if (existing.status !== "VERIFIED_CLOSED") {
    throw new ApiError(
      400,
      `Cannot reopen compliance action. Action must be in VERIFIED_CLOSED status. Current status: ${existing.status}`
    );
  }

  const { reopenReason } = data;

  const updated = await prisma.complianceAction.update({
    where: { id },
    data: {
      status: "IN_PROGRESS",
      verifiedAt: null,
      verifiedById: null,
    },
    include: {
      institution: {
        select: { id: true, code: true, name: true, state: true, district: true },
      },
      inspection: {
        select: { id: true, inspectionCode: true, type: true, status: true },
      },
      assignedToUser: { select: safeUserSelect },
      createdByUser: { select: safeUserSelect },
      verifiedByUser: { select: safeUserSelect },
    },
  });

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "COMPLIANCE_ACTION_REOPENED",
    entityType: "ComplianceAction",
    entityId: id,
    oldValues: {
      status: existing.status,
      verifiedAt: existing.verifiedAt,
      verifiedById: existing.verifiedById,
    },
    newValues: {
      status: "IN_PROGRESS",
      reopenReason,
    },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  await invalidateComplianceCaches(id, existing.institutionId, existing.inspectionId);

  eventPublisher.publishComplianceEvent(WS_EVENTS.COMPLIANCE_REOPENED, updated).catch(() => {});

  return enrichComplianceAction(updated);
};

/**
 * Escalate Overdue or High-Risk Compliance Action: -> ESCALATED
 */
export const escalateComplianceAction = async (id, data, currentUser, reqMeta = {}) => {
  if (!["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"].includes(currentUser.role)) {
    throw new ApiError(
      403,
      `Access denied. Only authorized government officers can escalate compliance actions. Current role: ${currentUser.role}`
    );
  }

  const existing = await prisma.complianceAction.findUnique({
    where: { id },
    include: { institution: true },
  });

  if (!existing) {
    throw new ApiError(404, `Compliance action with ID ${id} not found.`);
  }

  enforceInstitutionJurisdiction(existing.institution, currentUser);

  if (existing.status === "VERIFIED_CLOSED") {
    throw new ApiError(400, "Cannot escalate an already closed compliance action.");
  }

  const { escalationReason } = data;

  const updated = await prisma.complianceAction.update({
    where: { id },
    data: {
      status: "ESCALATED",
    },
    include: {
      institution: {
        select: { id: true, code: true, name: true, state: true, district: true },
      },
      inspection: {
        select: { id: true, inspectionCode: true, type: true, status: true },
      },
      assignedToUser: { select: safeUserSelect },
      createdByUser: { select: safeUserSelect },
      verifiedByUser: { select: safeUserSelect },
    },
  });

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "COMPLIANCE_ACTION_ESCALATED",
    entityType: "ComplianceAction",
    entityId: id,
    oldValues: { status: existing.status },
    newValues: {
      status: "ESCALATED",
      escalationReason,
    },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  await invalidateComplianceCaches(id, existing.institutionId, existing.inspectionId);

  eventPublisher.publishComplianceEvent(WS_EVENTS.COMPLIANCE_ESCALATED, updated).catch(() => {});

  return enrichComplianceAction(updated);
};
