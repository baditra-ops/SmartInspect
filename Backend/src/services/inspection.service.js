import { prisma } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";
import { recordAuditLog } from "../utils/audit.js";
import { cacheService, buildCacheKey, CACHE_TTL } from "./cache.service.js";
import { eventPublisher } from "../sockets/publisher.js";
import { WS_EVENTS } from "../sockets/events.js";

/**
 * Invalidate inspection and related caches safely
 */
export const invalidateInspectionCaches = async (inspectionId = null, institutionId = null) => {
  const promises = [
    cacheService.delByPattern("inspections:list:*"),
    cacheService.delByPattern("inspections:my:*"),
    cacheService.delByPattern("inspectors:eligible:*"),
  ];
  if (inspectionId) {
    promises.push(cacheService.del(`inspections:detail:${inspectionId}`));
    promises.push(cacheService.del(`inspections:assignments:${inspectionId}`));
  }
  if (institutionId) {
    promises.push(cacheService.del(`institutions:detail:${institutionId}`));
  }
  await Promise.allSettled(promises);
};

/**
 * Standard User projection excluding sensitive fields
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
  inspectorProfile: {
    select: {
      badgeNumber: true,
      designation: true,
      assignedDistrict: true,
      status: true,
      totalInspectionsConducted: true,
    },
  },
};

/**
 * Generate human-readable unique inspection code (e.g. INSP-2026-X8Y2K)
 */
const generateInspectionCode = () => {
  const year = new Date().getFullYear();
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  const timePart = Date.now().toString(36).substring(4).toUpperCase();
  return `INSP-${year}-${timePart}${randomPart}`;
};

/**
 * Enforce geographic and role-based access control for an inspection
 */
export const enforceInspectionAccess = (inspection, currentUser) => {
  if (!currentUser) {
    throw new ApiError(401, "Authentication required");
  }

  // National Admin has unrestricted access
  if (currentUser.role === "ADMIN") {
    return true;
  }

  // Inspector has access to inspections assigned to them or general view
  if (currentUser.role === "INSPECTOR") {
    return true;
  }

  // Institution staff can only access inspections of their designated facility
  if (currentUser.role === "INSTITUTION_USER") {
    if (!currentUser.institutionId || currentUser.institutionId !== inspection.institutionId) {
      throw new ApiError(403, "Access forbidden. You may only view inspections for your assigned institution.");
    }
    return true;
  }

  const instState = inspection.institution?.state;
  const instDistrict = inspection.institution?.district;

  // State Officers are strictly scoped to their assigned state
  if (currentUser.role === "STATE_OFFICER") {
    if (!currentUser.state || !instState || currentUser.state.toLowerCase() !== instState.toLowerCase()) {
      throw new ApiError(
        403,
        `Access forbidden. Inspection institution (${instState}) is outside your assigned state (${currentUser.state}).`
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
        `Access forbidden. Inspection institution (${instDistrict}, ${instState}) is outside your assigned district jurisdiction (${currentUser.district}, ${currentUser.state}).`
      );
    }
    return true;
  }

  throw new ApiError(403, "Access denied. Insufficient permissions.");
};

/**
 * Enforce geographic and role-based access control on target institution
 */
const enforceInstitutionJurisdiction = (institution, currentUser) => {
  if (currentUser.role === "ADMIN") return true;

  if (currentUser.role === "STATE_OFFICER") {
    if (!currentUser.state || currentUser.state.toLowerCase() !== institution.state.toLowerCase()) {
      throw new ApiError(
        403,
        `Access forbidden. Institution (${institution.state}) is outside your assigned state (${currentUser.state}).`
      );
    }
    return true;
  }

  if (currentUser.role === "DISTRICT_OFFICER") {
    const isStateMatch =
      currentUser.state && currentUser.state.toLowerCase() === institution.state.toLowerCase();
    const isDistrictMatch =
      currentUser.district && currentUser.district.toLowerCase() === institution.district.toLowerCase();

    if (!isStateMatch || !isDistrictMatch) {
      throw new ApiError(
        403,
        `Access forbidden. Institution (${institution.district}, ${institution.state}) is outside your district jurisdiction (${currentUser.district}, ${currentUser.state}).`
      );
    }
    return true;
  }

  throw new ApiError(403, "Access denied. Insufficient permissions.");
};

/**
 * Query eligible inspectors based on geographic constraints and active status
 */
export const getEligibleInspectors = async (query = {}, currentUser) => {
  const cacheKey = buildCacheKey("inspectors", "eligible", currentUser, query);

  return await cacheService.getOrSet(cacheKey, async () => {
    const { institutionId, district, state } = query;

    let targetState = state;
    let targetDistrict = district;

    if (institutionId) {
      const institution = await prisma.institution.findUnique({
        where: { id: institutionId },
        select: { state: true, district: true, deletedAt: true },
      });
      if (institution && !institution.deletedAt) {
        targetState = institution.state;
        targetDistrict = institution.district;
      }
    }

    // Scoping based on current user role
    if (currentUser.role === "STATE_OFFICER") {
      targetState = currentUser.state;
    } else if (currentUser.role === "DISTRICT_OFFICER") {
      targetState = currentUser.state;
      targetDistrict = currentUser.district;
    }

    const profileWhere = {
      status: { in: ["AVAILABLE", "ON_DUTY"] },
    };

    if (targetDistrict) {
      profileWhere.assignedDistrict = { equals: targetDistrict, mode: "insensitive" };
    }

    const where = {
      role: "INSPECTOR",
      isActive: true,
      deletedAt: null,
      inspectorProfile: {
        is: profileWhere,
      },
    };

    if (targetState) {
      where.state = { equals: targetState, mode: "insensitive" };
    }

    let inspectors = await prisma.user.findMany({
      where,
      select: {
        ...safeUserSelect,
        assignedInspections: {
          where: {
            status: { in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"] },
          },
          select: { id: true, status: true, scheduledDate: true },
        },
      },
      orderBy: { fullName: "asc" },
    });

    // If no inspectors found in this specific district and current user is ADMIN, fallback to all available inspectors
    if (inspectors.length === 0 && currentUser.role === "ADMIN") {
      inspectors = await prisma.user.findMany({
        where: {
          role: "INSPECTOR",
          isActive: true,
          deletedAt: null,
          inspectorProfile: {
            is: { status: { in: ["AVAILABLE", "ON_DUTY"] } },
          },
        },
        select: {
          ...safeUserSelect,
          assignedInspections: {
            where: {
              status: { in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"] },
            },
            select: { id: true, status: true, scheduledDate: true },
          },
        },
        orderBy: { fullName: "asc" },
      });
    }

    return inspectors.map((insp) => ({
      id: insp.id,
      fullName: insp.fullName,
      email: insp.email,
      phone: insp.phone,
      state: insp.state,
      district: insp.district,
      profile: insp.inspectorProfile,
      activeInspectionsCount: insp.assignedInspections.length,
      activeInspections: insp.assignedInspections,
    }));
  }, CACHE_TTL.SHORT);
};

/**
 * Create a new Inspection
 */
export const createInspection = async (data, currentUser, reqMeta = {}) => {
  const { institutionId, type, scheduledDate, remarks } = data;

  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
  });

  if (!institution || institution.deletedAt) {
    throw new ApiError(404, "Target institution not found or has been deactivated");
  }

  if (institution.status === "CLOSED") {
    throw new ApiError(400, "Cannot create inspection for a CLOSED institution");
  }

  enforceInstitutionJurisdiction(institution, currentUser);

  const inspectionCode = generateInspectionCode();

  const inspection = await prisma.inspection.create({
    data: {
      inspectionCode,
      institutionId,
      assignedById: currentUser.id,
      type: type || "SCHEDULED",
      status: "PLANNED",
      scheduledDate: new Date(scheduledDate),
      remarks: remarks || null,
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
          address: true,
        },
      },
      assignedBy: { select: safeUserSelect },
    },
  });

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "INSPECTION_CREATED",
    entityType: "Inspection",
    entityId: inspection.id,
    newValues: {
      inspectionCode: inspection.inspectionCode,
      institutionId: inspection.institutionId,
      type: inspection.type,
      status: inspection.status,
      scheduledDate: inspection.scheduledDate,
    },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  // Invalidate list caches and institution detail
  await invalidateInspectionCaches(inspection.id, inspection.institutionId);

  // Publish Real-Time Inspection Event
  eventPublisher.publishInspectionEvent(WS_EVENTS.INSPECTION_CREATED, inspection).catch(() => {});

  return inspection;
};

/**
 * Get paginated list of inspections with role scoping and filters
 */
export const getInspections = async (query, currentUser) => {
  const cacheKey = buildCacheKey("inspections", "list", currentUser, query);

  return await cacheService.getOrSet(cacheKey, async () => {
    const {
      page,
      limit,
      status,
      type,
      institutionId,
      inspectorId,
      state,
      district,
      scheduledDate,
      startDate,
      endDate,
      search,
      sortBy,
      sortOrder,
    } = query;

    const where = {};

    // 1. Role-based geographic scoping on linked institution
    if (currentUser.role === "STATE_OFFICER") {
      where.institution = { state: { equals: currentUser.state, mode: "insensitive" } };
    } else if (currentUser.role === "DISTRICT_OFFICER") {
      where.institution = {
        state: { equals: currentUser.state, mode: "insensitive" },
        district: { equals: currentUser.district, mode: "insensitive" },
      };
    } else if (currentUser.role === "INSTITUTION_USER") {
      where.institutionId = currentUser.institutionId || "00000000-0000-0000-0000-000000000000";
    } else {
      if (state || district) {
        where.institution = {};
        if (state) where.institution.state = { equals: state, mode: "insensitive" };
        if (district) where.institution.district = { equals: district, mode: "insensitive" };
      }
    }

    // 2. Direct filters
    if (status) where.status = status;
    if (type) where.type = type;
    if (institutionId) where.institutionId = institutionId;
    if (inspectorId) where.currentInspectorId = inspectorId;

    // 3. Date filters
    if (scheduledDate) {
      where.scheduledDate = new Date(scheduledDate);
    } else if (startDate || endDate) {
      where.scheduledDate = {};
      if (startDate) where.scheduledDate.gte = new Date(startDate);
      if (endDate) where.scheduledDate.lte = new Date(endDate);
    }

    // 4. Search filter
    if (search) {
      where.OR = [
        { inspectionCode: { contains: search, mode: "insensitive" } },
        { institution: { name: { contains: search, mode: "insensitive" } } },
        { institution: { code: { contains: search, mode: "insensitive" } } },
      ];
    }

    const skip = (page - 1) * limit;
    const orderBy = { [sortBy]: sortOrder };

    const [total, inspections] = await Promise.all([
      prisma.inspection.count({ where }),
      prisma.inspection.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          institution: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              state: true,
              district: true,
              address: true,
              latestRiskScore: true,
              latestRiskLevel: true,
            },
          },
          currentInspector: { select: safeUserSelect },
          assignedBy: { select: safeUserSelect },
        },
      }),
    ]);

    return {
      inspections,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }, CACHE_TTL.STANDARD);
};

/**
 * Get inspections assigned to the authenticated inspector (GET /api/inspections/my)
 */
export const getMyInspections = async (query, currentUser) => {
  if (currentUser.role !== "INSPECTOR") {
    throw new ApiError(403, "Only inspectors can access assigned inspections via this endpoint");
  }

  const cacheKey = buildCacheKey("inspections", "my", currentUser, query);

  return await cacheService.getOrSet(cacheKey, async () => {
    const { page, limit, status, type, scheduledDate, startDate, endDate, sortBy, sortOrder } = query;

    const where = {
      currentInspectorId: currentUser.id,
    };

    if (status) where.status = status;
    if (type) where.type = type;
    if (scheduledDate) {
      where.scheduledDate = new Date(scheduledDate);
    } else if (startDate || endDate) {
      where.scheduledDate = {};
      if (startDate) where.scheduledDate.gte = new Date(startDate);
      if (endDate) where.scheduledDate.lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const orderBy = { [sortBy]: sortOrder };

    const [total, inspections] = await Promise.all([
      prisma.inspection.count({ where }),
      prisma.inspection.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          institution: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              state: true,
              district: true,
              address: true,
              latitude: true,
              longitude: true,
              geofenceRadiusMeters: true,
              contactPerson: true,
              contactPhone: true,
            },
          },
          assignedBy: { select: safeUserSelect },
        },
      }),
    ]);

    return {
      inspections,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }, CACHE_TTL.STANDARD);
};

/**
 * Get detailed inspection information by ID
 */
export const getInspectionById = async (id, currentUser) => {
  const cacheKey = `inspections:detail:${id}`;

  const inspection = await cacheService.getOrSet(cacheKey, async () => {
    return await prisma.inspection.findUnique({
      where: { id },
      include: {
        institution: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            registrationNumber: true,
            address: true,
            state: true,
            district: true,
            pincode: true,
            latitude: true,
            longitude: true,
            geofenceRadiusMeters: true,
            contactPerson: true,
            contactPhone: true,
            contactEmail: true,
            capacity: true,
            currentOccupancy: true,
            status: true,
            latestRiskScore: true,
            latestRiskLevel: true,
          },
        },
        currentInspector: { select: safeUserSelect },
        assignedBy: { select: safeUserSelect },
        assignments: {
          orderBy: { assignedAt: "desc" },
          include: {
            inspector: { select: safeUserSelect },
            assignedBy: { select: safeUserSelect },
          },
        },
      },
    });
  }, CACHE_TTL.STANDARD);

  if (!inspection) {
    throw new ApiError(404, "Inspection not found");
  }

  enforceInspectionAccess(inspection, currentUser);

  return inspection;
};

/**
 * Update inspection details (administrative metadata only)
 */
export const updateInspection = async (id, data, currentUser, reqMeta = {}) => {
  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: { institution: true },
  });

  if (!inspection) {
    throw new ApiError(404, "Inspection not found");
  }

  enforceInspectionAccess(inspection, currentUser);

  if (["COMPLETED", "CANCELLED", "APPROVED", "REJECTED"].includes(inspection.status)) {
    throw new ApiError(400, `Cannot modify inspection in terminal status ${inspection.status}`);
  }

  const updateData = {};
  if (data.type) updateData.type = data.type;
  if (data.scheduledDate) updateData.scheduledDate = new Date(data.scheduledDate);
  if (data.remarks !== undefined) updateData.remarks = data.remarks;

  const updated = await prisma.inspection.update({
    where: { id },
    data: updateData,
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
      currentInspector: { select: safeUserSelect },
      assignedBy: { select: safeUserSelect },
    },
  });

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "INSPECTION_UPDATED",
    entityType: "Inspection",
    entityId: id,
    oldValues: {
      type: inspection.type,
      scheduledDate: inspection.scheduledDate,
      remarks: inspection.remarks,
    },
    newValues: updateData,
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  await invalidateInspectionCaches(id, updated.institution?.id || inspection.institutionId);

  return updated;
};

/**
 * Manually assign an Inspector to an Inspection
 */
export const assignInspector = async (id, data, currentUser, reqMeta = {}) => {
  const { inspectorId } = data;

  // 1. Fetch and validate inspection
  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: { institution: true },
  });

  if (!inspection) {
    throw new ApiError(404, "Inspection not found");
  }

  enforceInspectionAccess(inspection, currentUser);

  if (["COMPLETED", "CANCELLED", "REPORT_SUBMITTED", "APPROVED", "REJECTED"].includes(inspection.status)) {
    throw new ApiError(400, `Cannot assign inspector to an inspection with status ${inspection.status}`);
  }

  // 2. Validate target inspector
  const inspector = await prisma.user.findUnique({
    where: { id: inspectorId },
    include: { inspectorProfile: true },
  });

  if (!inspector || inspector.deletedAt || inspector.role !== "INSPECTOR" || !inspector.isActive) {
    throw new ApiError(400, "Target user is not an active inspector");
  }

  if (!inspector.inspectorProfile) {
    throw new ApiError(400, "Inspector does not have an active InspectorProfile");
  }

  if (inspector.inspectorProfile.status === "INACTIVE" || inspector.inspectorProfile.status === "ON_LEAVE") {
    throw new ApiError(400, `Inspector is currently unavailable (${inspector.inspectorProfile.status})`);
  }

  // 3. Perform atomic writes inside transaction with adequate timeout
  const result = await prisma.$transaction(
    async (tx) => {
      // Mark previous active assignments as REASSIGNED
      await tx.inspectionAssignment.updateMany({
        where: {
          inspectionId: id,
          status: { in: ["PENDING", "ACCEPTED"] },
        },
        data: {
          status: "REASSIGNED",
          respondedAt: new Date(),
        },
      });

      // Create new InspectionAssignment
      const assignment = await tx.inspectionAssignment.create({
        data: {
          inspectionId: id,
          inspectorId,
          assignedById: currentUser.id,
          assignmentMethod: "MANUAL_DISPATCH",
          status: "PENDING",
        },
        include: {
          inspector: { select: safeUserSelect },
          assignedBy: { select: safeUserSelect },
        },
      });

      // Update inspection
      const updatedInspection = await tx.inspection.update({
        where: { id },
        data: {
          currentInspectorId: inspectorId,
          assignedById: currentUser.id,
          status: "ASSIGNED",
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
          currentInspector: { select: safeUserSelect },
          assignedBy: { select: safeUserSelect },
        },
      });

      return { updatedInspection, assignment };
    },
    { maxWait: 15000, timeout: 30000 }
  );

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "INSPECTOR_ASSIGNED",
    entityType: "Inspection",
    entityId: id,
    newValues: {
      inspectorId,
      assignedById: currentUser.id,
      assignmentMethod: "MANUAL_DISPATCH",
      assignmentId: result.assignment.id,
    },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  await invalidateInspectionCaches(id, inspection.institutionId);

  return result;
};

/**
 * Reassign Inspector to an Inspection
 */
export const reassignInspector = async (id, data, currentUser, reqMeta = {}) => {
  const result = await assignInspector(id, data, currentUser, reqMeta);

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "INSPECTION_REASSIGNED",
    entityType: "Inspection",
    entityId: id,
    newValues: {
      newInspectorId: data.inspectorId,
      reassignedById: currentUser.id,
    },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  return result;
};

/**
 * Get Assignment History of an Inspection
 */
export const getInspectionAssignments = async (id, currentUser) => {
  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: { institution: true },
  });

  if (!inspection) {
    throw new ApiError(404, "Inspection not found");
  }

  enforceInspectionAccess(inspection, currentUser);

  const cacheKey = `inspections:assignments:${id}`;

  return await cacheService.getOrSet(cacheKey, async () => {
    return await prisma.inspectionAssignment.findMany({
      where: { inspectionId: id },
      orderBy: { assignedAt: "desc" },
      include: {
        inspector: { select: safeUserSelect },
        assignedBy: { select: safeUserSelect },
      },
    });
  }, CACHE_TTL.STANDARD);
};

/**
 * Inspector Accepts Assignment (POST /api/inspections/:id/accept)
 */
export const acceptAssignment = async (id, currentUser, reqMeta = {}) => {
  const inspection = await prisma.inspection.findUnique({
    where: { id },
  });

  if (!inspection) {
    throw new ApiError(404, "Inspection not found");
  }

  if (inspection.currentInspectorId !== currentUser.id) {
    throw new ApiError(403, "You are not the currently assigned inspector for this inspection");
  }

  if (inspection.status !== "ASSIGNED") {
    throw new ApiError(400, `Cannot accept inspection in status ${inspection.status}. Must be ASSIGNED.`);
  }

  const result = await prisma.$transaction(
    async (tx) => {
      // Update assignment record
      await tx.inspectionAssignment.updateMany({
        where: {
          inspectionId: id,
          inspectorId: currentUser.id,
          status: "PENDING",
        },
        data: {
          status: "ACCEPTED",
          respondedAt: new Date(),
        },
      });

      // Update inspection status
      const updatedInspection = await tx.inspection.update({
        where: { id },
        data: { status: "ACCEPTED" },
        include: {
          institution: {
            select: {
              id: true,
              code: true,
              name: true,
              state: true,
              district: true,
              address: true,
            },
          },
          currentInspector: { select: safeUserSelect },
        },
      });

      return updatedInspection;
    },
    { maxWait: 15000, timeout: 30000 }
  );

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "ASSIGNMENT_ACCEPTED",
    entityType: "Inspection",
    entityId: id,
    newValues: { status: "ACCEPTED" },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  await invalidateInspectionCaches(id, inspection.institutionId);

  return result;
};

/**
 * Inspector Rejects/Declines Assignment (POST /api/inspections/:id/reject)
 */
export const rejectAssignment = async (id, data, currentUser, reqMeta = {}) => {
  const { declineReason } = data;

  const inspection = await prisma.inspection.findUnique({
    where: { id },
  });

  if (!inspection) {
    throw new ApiError(404, "Inspection not found");
  }

  if (inspection.currentInspectorId !== currentUser.id) {
    throw new ApiError(403, "You are not the assigned inspector for this inspection");
  }

  if (!["ASSIGNED", "ACCEPTED"].includes(inspection.status)) {
    throw new ApiError(400, `Cannot decline inspection in status ${inspection.status}`);
  }

  const result = await prisma.$transaction(
    async (tx) => {
      // Update assignment record to DECLINED
      await tx.inspectionAssignment.updateMany({
        where: {
          inspectionId: id,
          inspectorId: currentUser.id,
          status: { in: ["PENDING", "ACCEPTED"] },
        },
        data: {
          status: "DECLINED",
          declineReason: declineReason || null,
          respondedAt: new Date(),
        },
      });

      // Reset inspection back to PLANNED and unassign current inspector
      const updatedInspection = await tx.inspection.update({
        where: { id },
        data: {
          currentInspectorId: null,
          status: "PLANNED",
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
        },
      });

      return updatedInspection;
    },
    { maxWait: 15000, timeout: 30000 }
  );

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "ASSIGNMENT_DECLINED",
    entityType: "Inspection",
    entityId: id,
    newValues: {
      status: "PLANNED",
      declinedByInspectorId: currentUser.id,
      declineReason,
    },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  await invalidateInspectionCaches(id, inspection.institutionId);

  return result;
};

/**
 * Inspector Starts Inspection (POST /api/inspections/:id/start)
 */
export const startInspection = async (id, currentUser, reqMeta = {}) => {
  const inspection = await prisma.inspection.findUnique({
    where: { id },
  });

  if (!inspection) {
    throw new ApiError(404, "Inspection not found");
  }

  if (inspection.currentInspectorId !== currentUser.id) {
    throw new ApiError(403, "Only the assigned inspector can start this inspection");
  }

  if (!["ASSIGNED", "ACCEPTED"].includes(inspection.status)) {
    throw new ApiError(400, `Cannot start inspection in status ${inspection.status}. Must be ACCEPTED or ASSIGNED.`);
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const updatedInspection = await tx.inspection.update({
        where: { id },
        data: {
          status: "IN_PROGRESS",
          startedAt: new Date(),
        },
        include: {
          institution: {
            select: {
              id: true,
              code: true,
              name: true,
              state: true,
              district: true,
              address: true,
              latitude: true,
              longitude: true,
              geofenceRadiusMeters: true,
            },
          },
          currentInspector: { select: safeUserSelect },
        },
      });

      // Update inspector status to ON_DUTY
      await tx.inspectorProfile.updateMany({
        where: { userId: currentUser.id },
        data: { status: "ON_DUTY" },
      });

      return updatedInspection;
    },
    { maxWait: 15000, timeout: 30000 }
  );

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "INSPECTION_STARTED",
    entityType: "Inspection",
    entityId: id,
    newValues: { status: "IN_PROGRESS", startedAt: result.startedAt },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  await invalidateInspectionCaches(id, inspection.institutionId);

  return result;
};

/**
 * Inspector Completes Inspection (POST /api/inspections/:id/complete)
 */
export const completeInspection = async (id, currentUser, reqMeta = {}) => {
  const inspection = await prisma.inspection.findUnique({
    where: { id },
  });

  if (!inspection) {
    throw new ApiError(404, "Inspection not found");
  }

  if (inspection.currentInspectorId !== currentUser.id && currentUser.role !== "ADMIN") {
    throw new ApiError(403, "Only the assigned inspector or ADMIN can complete this inspection");
  }

  if (inspection.status !== "IN_PROGRESS") {
    throw new ApiError(400, `Cannot complete inspection in status ${inspection.status}. Must be IN_PROGRESS.`);
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const updatedInspection = await tx.inspection.update({
        where: { id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
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
          currentInspector: { select: safeUserSelect },
        },
      });

      // Increment inspector count and return to AVAILABLE
      if (inspection.currentInspectorId) {
        await tx.inspectorProfile.updateMany({
          where: { userId: inspection.currentInspectorId },
          data: {
            status: "AVAILABLE",
            totalInspectionsConducted: { increment: 1 },
          },
        });
      }

      return updatedInspection;
    },
    { maxWait: 15000, timeout: 30000 }
  );

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "INSPECTION_COMPLETED",
    entityType: "Inspection",
    entityId: id,
    newValues: { status: "COMPLETED", completedAt: result.completedAt },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  await invalidateInspectionCaches(id, inspection.institutionId);

  return result;
};

/**
 * Cancel an Inspection (POST /api/inspections/:id/cancel)
 */
export const cancelInspection = async (id, currentUser, reqMeta = {}) => {
  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: { institution: true },
  });

  if (!inspection) {
    throw new ApiError(404, "Inspection not found");
  }

  enforceInspectionAccess(inspection, currentUser);

  if (["COMPLETED", "CANCELLED", "APPROVED", "REJECTED"].includes(inspection.status)) {
    throw new ApiError(400, `Cannot cancel inspection in status ${inspection.status}`);
  }

  const updated = await prisma.$transaction(
    async (tx) => {
      // If there were pending assignments, mark them as REASSIGNED
      await tx.inspectionAssignment.updateMany({
        where: {
          inspectionId: id,
          status: { in: ["PENDING", "ACCEPTED"] },
        },
        data: {
          status: "REASSIGNED",
          respondedAt: new Date(),
        },
      });

      // If inspector was on duty for this inspection, reset to AVAILABLE
      if (inspection.currentInspectorId && inspection.status === "IN_PROGRESS") {
        await tx.inspectorProfile.updateMany({
          where: { userId: inspection.currentInspectorId },
          data: { status: "AVAILABLE" },
        });
      }

      return tx.inspection.update({
        where: { id },
        data: {
          status: "CANCELLED",
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
        },
      });
    },
    { maxWait: 15000, timeout: 30000 }
  );

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "INSPECTION_CANCELLED",
    entityType: "Inspection",
    entityId: id,
    newValues: { status: "CANCELLED" },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  await invalidateInspectionCaches(id, inspection.institutionId);

  return updated;
};

