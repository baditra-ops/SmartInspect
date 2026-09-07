import { prisma } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";
import { recordAuditLog } from "../utils/audit.js";
import { cacheService, buildCacheKey, CACHE_TTL } from "./cache.service.js";

/**
 * Enforce geographic and role-based access control for a target institution
 */
export const enforceInstitutionAccess = (institution, currentUser) => {
  if (!currentUser) {
    throw new ApiError(401, "Authentication required");
  }

  // National Admin has unrestricted access
  if (currentUser.role === "ADMIN") {
    return true;
  }

  // Inspectors have read access to all institutions
  if (currentUser.role === "INSPECTOR") {
    return true;
  }

  // Institution staff can only access their designated facility
  if (currentUser.role === "INSTITUTION_USER") {
    if (!currentUser.institutionId || currentUser.institutionId !== institution.id) {
      throw new ApiError(403, "Access forbidden. You may only access your assigned institution.");
    }
    return true;
  }

  // State Officers are strictly scoped to their assigned state
  if (currentUser.role === "STATE_OFFICER") {
    if (!currentUser.state || currentUser.state.toLowerCase() !== institution.state.toLowerCase()) {
      throw new ApiError(
        403,
        `Access forbidden. Institution (${institution.state}) is outside your assigned state (${currentUser.state}).`
      );
    }
    return true;
  }

  // District Officers are strictly scoped to their assigned state and district
  if (currentUser.role === "DISTRICT_OFFICER") {
    const isStateMatch =
      currentUser.state && currentUser.state.toLowerCase() === institution.state.toLowerCase();
    const isDistrictMatch =
      currentUser.district && currentUser.district.toLowerCase() === institution.district.toLowerCase();

    if (!isStateMatch || !isDistrictMatch) {
      throw new ApiError(
        403,
        `Access forbidden. Institution (${institution.district}, ${institution.state}) is outside your assigned district jurisdiction (${currentUser.district}, ${currentUser.state}).`
      );
    }
    return true;
  }

  throw new ApiError(403, "Access denied. Insufficient permissions.");
};

/**
 * Get paginated list of institutions with role-based scoping and filters
 */
export const getInstitutions = async (query, currentUser) => {
  const cacheKey = buildCacheKey("institutions", "list", currentUser, query);

  return await cacheService.getOrSet(cacheKey, async () => {
    const { page, limit, search, state, district, type, status, riskLevel, sortBy, sortOrder } = query;

    const where = {
      deletedAt: null,
    };

    // 1. Apply user role geographic constraints
    if (currentUser.role === "STATE_OFFICER") {
      where.state = { equals: currentUser.state, mode: "insensitive" };
    } else if (currentUser.role === "DISTRICT_OFFICER") {
      where.state = { equals: currentUser.state, mode: "insensitive" };
      where.district = { equals: currentUser.district, mode: "insensitive" };
    } else if (currentUser.role === "INSTITUTION_USER") {
      where.id = currentUser.institutionId || "00000000-0000-0000-0000-000000000000";
    } else {
      // ADMIN or INSPECTOR can filter by state/district if requested
      if (state) where.state = { equals: state, mode: "insensitive" };
      if (district) where.district = { equals: district, mode: "insensitive" };
    }

    // 2. Additional filter options
    if (type) where.type = type;
    if (status) where.status = status;
    if (riskLevel) where.latestRiskLevel = riskLevel;

    // 3. Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { registrationNumber: { contains: search, mode: "insensitive" } },
        { district: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (page - 1) * limit;
    const take = limit;

    const [total, institutions] = await Promise.all([
      prisma.institution.count({ where }),
      prisma.institution.findMany({
        where,
        skip,
        take,
        orderBy: {
          [sortBy]: sortOrder,
        },
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
          isAidedByGovt: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              beneficiaries: true,
              schemes: true,
              inspections: true,
            },
          },
        },
      }),
    ]);

    return {
      institutions,
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
 * Get detailed institution by ID
 */
export const getInstitutionById = async (id, currentUser) => {
  const cacheKey = `institutions:detail:${id}`;

  const institution = await cacheService.getOrSet(cacheKey, async () => {
    return await prisma.institution.findUnique({
      where: { id },
      include: {
        schemes: {
          include: {
            scheme: {
              select: {
                id: true,
                code: true,
                name: true,
                sponsoringDepartment: true,
              },
            },
          },
        },
        _count: {
          select: {
            beneficiaries: true,
            attendances: true,
            inspections: true,
            cctvDevices: true,
            complianceActions: true,
          },
        },
        riskAssessments: {
          take: 5,
          orderBy: { assessmentDate: "desc" },
          select: {
            id: true,
            riskScore: true,
            riskLevel: true,
            factors: true,
            modelVersion: true,
            assessmentDate: true,
          },
        },
      },
    });
  }, CACHE_TTL.STANDARD);

  if (!institution || institution.deletedAt !== null) {
    throw new ApiError(404, "Institution not found");
  }

  enforceInstitutionAccess(institution, currentUser);

  return institution;
};

/**
 * Create a new institution
 */
export const createInstitution = async (data, currentUser, reqMeta = {}) => {
  // Authorization: Only Admin and State/District officers can register institutions
  if (!["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"].includes(currentUser.role)) {
    throw new ApiError(403, "Access denied. Insufficient permissions to create an institution.");
  }

  // Geographic boundary check for officers
  if (currentUser.role === "STATE_OFFICER") {
    if (data.state.toLowerCase() !== currentUser.state.toLowerCase()) {
      throw new ApiError(403, `State officers can only register institutions within ${currentUser.state}.`);
    }
  }

  if (currentUser.role === "DISTRICT_OFFICER") {
    if (
      data.state.toLowerCase() !== currentUser.state.toLowerCase() ||
      data.district.toLowerCase() !== currentUser.district.toLowerCase()
    ) {
      throw new ApiError(
        403,
        `District officers can only register institutions within ${currentUser.district}, ${currentUser.state}.`
      );
    }
  }

  // Check unique institution code
  const existing = await prisma.institution.findUnique({
    where: { code: data.code },
  });

  if (existing) {
    throw new ApiError(409, `An institution with code '${data.code}' already exists.`);
  }

  const institution = await prisma.institution.create({
    data: {
      ...data,
      latestRiskScore: 0.00,
      latestRiskLevel: "LOW",
    },
  });

  // Record immutable audit log
  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "CREATE_INSTITUTION",
    entityType: "INSTITUTION",
    entityId: institution.id,
    newValues: institution,
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  // Invalidate cached lists
  await cacheService.delByPattern("institutions:list:*");

  return institution;
};

/**
 * Update an existing institution
 */
export const updateInstitution = async (id, data, currentUser, reqMeta = {}) => {
  if (!["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"].includes(currentUser.role)) {
    throw new ApiError(403, "Access denied. Insufficient permissions to update an institution.");
  }

  const existing = await prisma.institution.findUnique({
    where: { id },
  });

  if (!existing || existing.deletedAt !== null) {
    throw new ApiError(404, "Institution not found");
  }

  enforceInstitutionAccess(existing, currentUser);

  // Prevent moving institution outside jurisdiction
  if (currentUser.role === "STATE_OFFICER" && data.state && data.state.toLowerCase() !== currentUser.state.toLowerCase()) {
    throw new ApiError(403, `Cannot change institution state outside ${currentUser.state}.`);
  }

  if (
    currentUser.role === "DISTRICT_OFFICER" &&
    ((data.state && data.state.toLowerCase() !== currentUser.state.toLowerCase()) ||
      (data.district && data.district.toLowerCase() !== currentUser.district.toLowerCase()))
  ) {
    throw new ApiError(403, `Cannot change institution location outside ${currentUser.district}, ${currentUser.state}.`);
  }

  // If updating code, verify uniqueness
  if (data.code && data.code !== existing.code) {
    const codeConflict = await prisma.institution.findUnique({
      where: { code: data.code },
    });
    if (codeConflict) {
      throw new ApiError(409, `Institution code '${data.code}' is already taken.`);
    }
  }

  // Strip non-updatable / system fields
  const safeData = { ...data };
  delete safeData.id;
  delete safeData.latestRiskScore;
  delete safeData.latestRiskLevel;
  delete safeData.createdAt;
  delete safeData.updatedAt;
  delete safeData.deletedAt;

  const updated = await prisma.institution.update({
    where: { id },
    data: safeData,
  });

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "UPDATE_INSTITUTION",
    entityType: "INSTITUTION",
    entityId: updated.id,
    oldValues: existing,
    newValues: updated,
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  // Invalidate detail and lists
  await Promise.allSettled([
    cacheService.del(`institutions:detail:${id}`),
    cacheService.delByPattern("institutions:list:*"),
  ]);

  return updated;
};

/**
 * Controlled deactivation (Soft delete) of an institution
 */
export const deleteInstitution = async (id, currentUser, reqMeta = {}) => {
  if (!["ADMIN", "STATE_OFFICER"].includes(currentUser.role)) {
    throw new ApiError(403, "Access denied. Only National Admins or State Officers can deactivate institutions.");
  }

  const existing = await prisma.institution.findUnique({
    where: { id },
  });

  if (!existing || existing.deletedAt !== null) {
    throw new ApiError(404, "Institution not found");
  }

  enforceInstitutionAccess(existing, currentUser);

  const deactivated = await prisma.institution.update({
    where: { id },
    data: {
      status: "CLOSED",
      deletedAt: new Date(),
    },
  });

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "DEACTIVATE_INSTITUTION",
    entityType: "INSTITUTION",
    entityId: id,
    oldValues: { status: existing.status, deletedAt: existing.deletedAt },
    newValues: { status: "CLOSED", deletedAt: deactivated.deletedAt },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  // Invalidate detail and lists
  await Promise.allSettled([
    cacheService.del(`institutions:detail:${id}`),
    cacheService.delByPattern("institutions:list:*"),
  ]);

  return { message: "Institution successfully deactivated." };
};

/**
 * Get schemes associated with an institution
 */
export const getInstitutionSchemes = async (institutionId, currentUser) => {
  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
  });

  if (!institution || institution.deletedAt !== null) {
    throw new ApiError(404, "Institution not found");
  }

  enforceInstitutionAccess(institution, currentUser);

  const schemes = await prisma.institutionScheme.findMany({
    where: { institutionId },
    include: {
      scheme: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return schemes;
};

/**
 * Link a scheme to an institution
 */
export const linkSchemeToInstitution = async (institutionId, data, currentUser, reqMeta = {}) => {
  if (!["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"].includes(currentUser.role)) {
    throw new ApiError(403, "Access denied. Insufficient permissions to manage scheme grants.");
  }

  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
  });

  if (!institution || institution.deletedAt !== null) {
    throw new ApiError(404, "Institution not found");
  }

  enforceInstitutionAccess(institution, currentUser);

  const scheme = await prisma.scheme.findUnique({
    where: { id: data.schemeId },
  });

  if (!scheme) {
    throw new ApiError(404, "Target scheme not found");
  }

  const link = await prisma.institutionScheme.upsert({
    where: {
      institutionId_schemeId_grantYear: {
        institutionId,
        schemeId: data.schemeId,
        grantYear: data.grantYear,
      },
    },
    update: {
      grantSanctionedAmount: data.grantSanctionedAmount,
      approvalStatus: data.approvalStatus || "SANCTIONED",
    },
    create: {
      institutionId,
      schemeId: data.schemeId,
      grantSanctionedAmount: data.grantSanctionedAmount,
      grantYear: data.grantYear,
      approvalStatus: data.approvalStatus || "SANCTIONED",
    },
    include: {
      scheme: true,
    },
  });

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "LINK_SCHEME",
    entityType: "INSTITUTION",
    entityId: institutionId,
    newValues: { schemeId: data.schemeId, grantYear: data.grantYear, grantSanctionedAmount: data.grantSanctionedAmount },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  // Invalidate institution detail cache
  await cacheService.del(`institutions:detail:${institutionId}`);

  return link;
};

/**
 * Unlink a scheme from an institution
 */
export const unlinkSchemeFromInstitution = async (institutionId, schemeId, currentUser, reqMeta = {}) => {
  if (!["ADMIN", "STATE_OFFICER"].includes(currentUser.role)) {
    throw new ApiError(403, "Access denied. Insufficient permissions to unlink schemes.");
  }

  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
  });

  if (!institution || institution.deletedAt !== null) {
    throw new ApiError(404, "Institution not found");
  }

  enforceInstitutionAccess(institution, currentUser);

  await prisma.institutionScheme.deleteMany({
    where: {
      institutionId,
      schemeId,
    },
  });

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "UNLINK_SCHEME",
    entityType: "INSTITUTION",
    entityId: institutionId,
    oldValues: { unlinkedSchemeId: schemeId },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  // Invalidate institution detail cache
  await cacheService.del(`institutions:detail:${institutionId}`);

  return { message: "Scheme association successfully removed" };
};

/**
 * Get beneficiaries of an institution
 */
export const getInstitutionBeneficiaries = async (institutionId, query, currentUser) => {
  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
  });

  if (!institution || institution.deletedAt !== null) {
    throw new ApiError(404, "Institution not found");
  }

  enforceInstitutionAccess(institution, currentUser);

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const where = {
    institutionId,
    deletedAt: null,
  };

  if (query.category) where.category = query.category;
  if (query.gender) where.gender = query.gender;
  if (query.status) where.status = query.status;

  if (query.search) {
    where.OR = [
      { fullName: { contains: query.search, mode: "insensitive" } },
      { enrollmentNumber: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const [total, beneficiaries] = await Promise.all([
    prisma.beneficiary.count({ where }),
    prisma.beneficiary.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        scheme: {
          select: { id: true, code: true, name: true },
        },
      },
    }),
  ]);

  return {
    beneficiaries,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get aggregated attendance roll records of an institution
 */
export const getInstitutionAttendance = async (institutionId, query, currentUser) => {
  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
  });

  if (!institution || institution.deletedAt !== null) {
    throw new ApiError(404, "Institution not found");
  }

  enforceInstitutionAccess(institution, currentUser);

  const where = { institutionId };

  if (query.date) {
    where.attendanceDate = new Date(query.date);
  } else if (query.startDate && query.endDate) {
    where.attendanceDate = {
      gte: new Date(query.startDate),
      lte: new Date(query.endDate),
    };
  }

  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 30));

  const attendances = await prisma.institutionAttendance.findMany({
    where,
    take: limit,
    orderBy: { attendanceDate: "desc" },
  });

  return attendances;
};
