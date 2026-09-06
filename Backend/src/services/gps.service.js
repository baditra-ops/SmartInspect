import { prisma } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";
import { recordAuditLog } from "../utils/audit.js";
import { enforceInspectionAccess } from "./inspection.service.js";

/**
 * Standard User projection excluding sensitive credentials
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
    },
  },
};

/**
 * Calculate Great-Circle Distance between two coordinates using the Haversine Formula
 * Returns distance in meters (rounded to 2 decimal places)
 */
export const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const EARTH_RADIUS_METERS = 6371000;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c * 100) / 100;
};

/**
 * Check if a calculated distance is within the allowed geofence boundary
 */
export const isWithinGeofence = (distanceMeters, allowedRadiusMeters) => {
  return distanceMeters <= allowedRadiusMeters;
};

/**
 * Verify Inspector GPS Coordinates against Target Institution Location
 */
export const verifyInspectionLocation = async (inspectionId, data, currentUser, reqMeta = {}) => {
  const { latitude, longitude, accuracyMeters = 10, verificationType = "CHECK_IN", deviceInfo } = data;

  // 1. Fetch target inspection and its associated institution
  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: {
      institution: {
        select: {
          id: true,
          code: true,
          name: true,
          state: true,
          district: true,
          latitude: true,
          longitude: true,
          geofenceRadiusMeters: true,
          status: true,
        },
      },
    },
  });

  if (!inspection) {
    throw new ApiError(404, "Inspection not found");
  }

  // 2. Validate inspection lifecycle state
  if (inspection.status === "COMPLETED") {
    throw new ApiError(400, "Cannot perform GPS verification on an already COMPLETED inspection");
  }

  if (inspection.status === "CANCELLED") {
    throw new ApiError(400, "Cannot perform GPS verification on a CANCELLED inspection");
  }

  // 3. Verify inspector assignment authorization
  if (currentUser.role !== "ADMIN") {
    if (!inspection.currentInspectorId || inspection.currentInspectorId !== currentUser.id) {
      throw new ApiError(403, "Access forbidden. You are not the currently assigned inspector for this inspection.");
    }
  }

  // 4. Validate institution coordinates
  if (inspection.institution.latitude === null || inspection.institution.longitude === null) {
    throw new ApiError(
      400,
      "GPS verification cannot be performed because the target institution location coordinates are unavailable in the registry."
    );
  }

  const instLat = Number(inspection.institution.latitude);
  const instLon = Number(inspection.institution.longitude);

  // 5. Determine configured geofence radius
  const fallbackRadius = parseInt(process.env.GPS_GEOFENCE_RADIUS_METERS, 10) || 150;
  const allowedRadiusMeters = inspection.institution.geofenceRadiusMeters || fallbackRadius;

  // 6. Calculate Haversine distance
  const distanceMeters = calculateHaversineDistance(latitude, longitude, instLat, instLon);

  // 7. Evaluate geofence compliance and GPS accuracy
  const insideGeofence = isWithinGeofence(distanceMeters, allowedRadiusMeters);
  const hasTamperWarning = accuracyMeters > 500;
  const isVerified = insideGeofence;

  // 8. Persist GpsVerification record
  const verification = await prisma.gpsVerification.create({
    data: {
      inspectionId,
      inspectorId: currentUser.id,
      verificationType,
      latitude,
      longitude,
      accuracyMeters,
      distanceFromInstitutionMeters: distanceMeters,
      isWithinGeofence: isVerified,
      deviceInfo: deviceInfo || null,
      tamperFlag: hasTamperWarning,
    },
  });

  // 9. Update Inspection.isGeofenceVerified if verified on CHECK_IN
  if (isVerified && verificationType === "CHECK_IN") {
    await prisma.inspection.update({
      where: { id: inspectionId },
      data: { isGeofenceVerified: true },
    });
  }

  // 10. Audit Logging
  await recordAuditLog({
    actorUserId: currentUser.id,
    action: isVerified ? "GPS_VERIFICATION_SUCCESS" : "GPS_VERIFICATION_OUTSIDE_GEOFENCE",
    entityType: "GpsVerification",
    entityId: verification.id,
    newValues: {
      inspectionId,
      verificationType,
      distanceMeters,
      allowedRadiusMeters,
      accuracyMeters,
      isWithinGeofence: isVerified,
    },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  return {
    verified: isVerified,
    isWithinGeofence: isVerified,
    distanceMeters,
    allowedRadiusMeters,
    accuracyMeters,
    verificationType: verification.verificationType,
    tamperFlag: verification.tamperFlag,
    capturedAt: verification.capturedAt,
    institution: {
      id: inspection.institution.id,
      code: inspection.institution.code,
      name: inspection.institution.name,
      latitude: instLat,
      longitude: instLon,
    },
    verificationId: verification.id,
  };
};

/**
 * Get GPS Verification History for an Inspection
 */
export const getInspectionGpsHistory = async (inspectionId, currentUser) => {
  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { institution: true },
  });

  if (!inspection) {
    throw new ApiError(404, "Inspection not found");
  }

  enforceInspectionAccess(inspection, currentUser);

  const verifications = await prisma.gpsVerification.findMany({
    where: { inspectionId },
    orderBy: { capturedAt: "desc" },
    include: {
      inspector: { select: safeUserSelect },
    },
  });

  return verifications;
};

/**
 * Get Latest GPS Verification for an Inspection
 */
export const getLatestGpsVerification = async (inspectionId, currentUser) => {
  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { institution: true },
  });

  if (!inspection) {
    throw new ApiError(404, "Inspection not found");
  }

  enforceInspectionAccess(inspection, currentUser);

  const latest = await prisma.gpsVerification.findFirst({
    where: { inspectionId },
    orderBy: { capturedAt: "desc" },
    include: {
      inspector: { select: safeUserSelect },
    },
  });

  return latest;
};
