import { prisma } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";
import { recordAuditLog } from "../utils/audit.js";
import { cacheService, buildCacheKey, CACHE_TTL } from "./cache.service.js";
import { eventPublisher } from "../sockets/publisher.js";
import { WS_EVENTS } from "../sockets/events.js";

/**
 * Standard Institution projection for CCTV responses
 */
const safeInstitutionSelect = {
  id: true,
  code: true,
  name: true,
  type: true,
  state: true,
  district: true,
  status: true,
};

/**
 * Invalidate CCTV and institution-related caches safely
 */
export const invalidateCctvCaches = async (cctvId = null, institutionId = null) => {
  const promises = [
    cacheService.delByPattern("cctv:list:*"),
  ];

  if (cctvId) {
    promises.push(cacheService.del(`cctv:detail:${cctvId}`));
  }
  if (institutionId) {
    promises.push(cacheService.del(`institutions:detail:${institutionId}`));
  }

  await Promise.allSettled(promises);
};

/**
 * Enforce geographic and role-based access control for CCTV device entities
 */
export const enforceCctvAccess = (cctvDevice, currentUser) => {
  if (!currentUser) {
    throw new ApiError(401, "Authentication required");
  }

  // National Admin has unrestricted nationwide access
  if (currentUser.role === "ADMIN") {
    return true;
  }

  // Inspectors have read access within their jurisdiction or general inspection scoping
  if (currentUser.role === "INSPECTOR") {
    return true;
  }

  // Institution staff can ONLY access CCTV devices belonging to their designated facility
  if (currentUser.role === "INSTITUTION_USER") {
    if (!currentUser.institutionId || currentUser.institutionId !== cctvDevice.institutionId) {
      throw new ApiError(
        403,
        "Access forbidden. You may only view CCTV devices belonging to your designated institution."
      );
    }
    return true;
  }

  const instState = cctvDevice.institution?.state;
  const instDistrict = cctvDevice.institution?.district;

  // State Officers are strictly scoped to their assigned state
  if (currentUser.role === "STATE_OFFICER") {
    if (!currentUser.state || !instState || currentUser.state.toLowerCase() !== instState.toLowerCase()) {
      throw new ApiError(
        403,
        `Access forbidden. CCTV device institution (${instState}) is outside your assigned state jurisdiction (${currentUser.state}).`
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
        `Access forbidden. CCTV device institution (${instDistrict}, ${instState}) is outside your assigned district jurisdiction (${currentUser.district}, ${currentUser.state}).`
      );
    }
    return true;
  }

  throw new ApiError(403, "Access denied. Insufficient permissions.");
};

/**
 * Enforce geographic jurisdiction when mutating CCTV devices for an institution
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
 * Create a new CCTV Device
 */
export const createCctvDevice = async (data, currentUser, reqMeta = {}) => {
  if (!["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"].includes(currentUser.role)) {
    throw new ApiError(
      403,
      `Access denied. Only government officers can register CCTV devices. Current role: ${currentUser.role}`
    );
  }

  const { institutionId, deviceName, cameraLocation, streamUrl, status = "ONLINE", isAiMonitoringEnabled = false } = data;

  // 1. Verify target institution exists and is within officer jurisdiction
  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
  });

  if (!institution) {
    throw new ApiError(404, `Target institution with ID ${institutionId} not found.`);
  }

  enforceInstitutionJurisdiction(institution, currentUser);

  // 2. Create CCTV Device in PostgreSQL
  const device = await prisma.cctvDevice.create({
    data: {
      institutionId,
      deviceName,
      cameraLocation,
      streamUrl,
      status,
      isAiMonitoringEnabled,
      lastPingAt: new Date(),
    },
    include: {
      institution: {
        select: safeInstitutionSelect,
      },
    },
  });

  // 3. Record Audit Log
  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "CCTV_DEVICE_CREATED",
    entityType: "CctvDevice",
    entityId: device.id,
    newValues: {
      id: device.id,
      institutionId: device.institutionId,
      deviceName: device.deviceName,
      cameraLocation: device.cameraLocation,
      status: device.status,
      isAiMonitoringEnabled: device.isAiMonitoringEnabled,
    },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  // 4. Invalidate Caches
  await invalidateCctvCaches(device.id, institutionId);

  // 5. Emit Real-Time WebSocket Event
  eventPublisher.publishCctvEvent(WS_EVENTS.CCTV_CREATED, device).catch(() => {});

  return device;
};

/**
 * Get paginated list of CCTV devices with geographic scoping and filters
 */
export const getCctvDevices = async (query, currentUser) => {
  const cacheKey = buildCacheKey("cctv", "list", currentUser, query);

  return await cacheService.getOrSet(cacheKey, async () => {
    const { page, limit, institutionId, status, isAiMonitoringEnabled, search, state, district, sortBy, sortOrder } = query;

    const where = {};

    // 1. Role-based geographic scoping
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
      // ADMIN or INSPECTOR
      if (state || district) {
        where.institution = {};
        if (state) where.institution.state = { equals: state, mode: "insensitive" };
        if (district) where.institution.district = { equals: district, mode: "insensitive" };
      }
    }

    // 2. Direct Filters
    if (institutionId) where.institutionId = institutionId;
    if (status) where.status = status;
    if (isAiMonitoringEnabled !== undefined) where.isAiMonitoringEnabled = isAiMonitoringEnabled === true || isAiMonitoringEnabled === "true";

    // 3. Search Filter
    if (search) {
      where.OR = [
        { deviceName: { contains: search, mode: "insensitive" } },
        { cameraLocation: { contains: search, mode: "insensitive" } },
        { institution: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const skip = (page - 1) * limit;
    const take = limit;

    const [total, devices] = await Promise.all([
      prisma.cctvDevice.count({ where }),
      prisma.cctvDevice.findMany({
        where,
        skip,
        take,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          institution: {
            select: safeInstitutionSelect,
          },
        },
      }),
    ]);

    return {
      devices,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }, CACHE_TTL.SHORT);
};

/**
 * Get single CCTV device details by ID
 */
export const getCctvDeviceById = async (id, currentUser) => {
  const cacheKey = `cctv:detail:${id}`;

  const device = await cacheService.getOrSet(cacheKey, async () => {
    const item = await prisma.cctvDevice.findUnique({
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
            status: true,
          },
        },
      },
    });

    if (!item) {
      throw new ApiError(404, `CCTV device with ID ${id} not found.`);
    }

    return item;
  }, CACHE_TTL.SHORT);

  // Enforce access control dynamically on retrieved device
  enforceCctvAccess(device, currentUser);

  return device;
};

/**
 * Securely retrieve live stream metadata for an authorized device
 */
export const getCctvStream = async (id, currentUser, reqMeta = {}) => {
  const device = await prisma.cctvDevice.findUnique({
    where: { id },
    include: {
      institution: {
        select: safeInstitutionSelect,
      },
    },
  });

  if (!device) {
    throw new ApiError(404, `CCTV device with ID ${id} not found.`);
  }

  // Strict resource-level geographic and role authorization
  enforceCctvAccess(device, currentUser);

  // Record Audit Log for Stream Access
  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "CCTV_STREAM_ACCESSED",
    entityType: "CctvDevice",
    entityId: id,
    newValues: {
      institutionId: device.institutionId,
      deviceName: device.deviceName,
      status: device.status,
    },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  return {
    id: device.id,
    deviceName: device.deviceName,
    cameraLocation: device.cameraLocation,
    streamUrl: device.streamUrl,
    status: device.status,
    isAiMonitoringEnabled: device.isAiMonitoringEnabled,
    lastPingAt: device.lastPingAt,
    institution: device.institution,
  };
};

/**
 * Update CCTV Device Metadata
 */
export const updateCctvDevice = async (id, data, currentUser, reqMeta = {}) => {
  if (!["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"].includes(currentUser.role)) {
    throw new ApiError(
      403,
      `Access denied. Only government officers can update CCTV devices. Current role: ${currentUser.role}`
    );
  }

  const existing = await prisma.cctvDevice.findUnique({
    where: { id },
    include: { institution: true },
  });

  if (!existing) {
    throw new ApiError(404, `CCTV device with ID ${id} not found.`);
  }

  enforceInstitutionJurisdiction(existing.institution, currentUser);

  const updatePayload = {};
  if (data.deviceName !== undefined) updatePayload.deviceName = data.deviceName;
  if (data.cameraLocation !== undefined) updatePayload.cameraLocation = data.cameraLocation;
  if (data.streamUrl !== undefined) updatePayload.streamUrl = data.streamUrl;
  if (data.isAiMonitoringEnabled !== undefined) updatePayload.isAiMonitoringEnabled = data.isAiMonitoringEnabled;

  const updated = await prisma.cctvDevice.update({
    where: { id },
    data: updatePayload,
    include: {
      institution: {
        select: safeInstitutionSelect,
      },
    },
  });

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "CCTV_DEVICE_UPDATED",
    entityType: "CctvDevice",
    entityId: id,
    oldValues: existing,
    newValues: updated,
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  await invalidateCctvCaches(id, existing.institutionId);

  eventPublisher.publishCctvEvent(WS_EVENTS.CCTV_UPDATED, updated).catch(() => {});

  return updated;
};

/**
 * Update CCTV Device Status (ONLINE, OFFLINE, FAULTY)
 */
export const updateCctvStatus = async (id, data, currentUser, reqMeta = {}) => {
  if (!["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER", "INSPECTOR"].includes(currentUser.role)) {
    throw new ApiError(
      403,
      `Access denied. Insufficient permissions to update CCTV device status. Current role: ${currentUser.role}`
    );
  }

  const existing = await prisma.cctvDevice.findUnique({
    where: { id },
    include: { institution: true },
  });

  if (!existing) {
    throw new ApiError(404, `CCTV device with ID ${id} not found.`);
  }

  enforceCctvAccess(existing, currentUser);

  const { status } = data;
  const lastPingAt = new Date();

  const updated = await prisma.cctvDevice.update({
    where: { id },
    data: {
      status,
      lastPingAt,
    },
    include: {
      institution: {
        select: safeInstitutionSelect,
      },
    },
  });

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "CCTV_DEVICE_STATUS_CHANGED",
    entityType: "CctvDevice",
    entityId: id,
    oldValues: { status: existing.status, lastPingAt: existing.lastPingAt },
    newValues: { status, lastPingAt },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  await invalidateCctvCaches(id, existing.institutionId);

  eventPublisher.publishCctvEvent(WS_EVENTS.CCTV_STATUS_CHANGED, updated).catch(() => {});

  return updated;
};

/**
 * Delete / Decommission a CCTV Device
 */
export const deleteCctvDevice = async (id, currentUser, reqMeta = {}) => {
  if (!["ADMIN", "STATE_OFFICER"].includes(currentUser.role)) {
    throw new ApiError(
      403,
      `Access denied. Only National Admin and State Officers can delete CCTV devices. Current role: ${currentUser.role}`
    );
  }

  const existing = await prisma.cctvDevice.findUnique({
    where: { id },
    include: { institution: true },
  });

  if (!existing) {
    throw new ApiError(404, `CCTV device with ID ${id} not found.`);
  }

  enforceInstitutionJurisdiction(existing.institution, currentUser);

  await prisma.cctvDevice.delete({
    where: { id },
  });

  await recordAuditLog({
    actorUserId: currentUser.id,
    action: "CCTV_DEVICE_DELETED",
    entityType: "CctvDevice",
    entityId: id,
    oldValues: existing,
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  await invalidateCctvCaches(id, existing.institutionId);

  eventPublisher.publishCctvEvent(WS_EVENTS.CCTV_DELETED, existing).catch(() => {});

  return { id, message: "CCTV device deleted successfully" };
};
