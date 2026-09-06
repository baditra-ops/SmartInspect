import * as gpsService from "../services/gps.service.js";
import { gpsVerificationSchema, validateBody, validateUuid } from "../utils/validation.js";
import { ApiResponse } from "../utils/apiResponse.js";

/**
 * Submit and Verify Inspector GPS Coordinates
 * POST /api/inspections/:id/gps/verify
 */
export const verifyGpsLocation = async (req, res, next) => {
  try {
    const inspectionId = validateUuid(req.params.id, "Inspection ID");
    const validatedData = validateBody(gpsVerificationSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const result = await gpsService.verifyInspectionLocation(inspectionId, validatedData, req.user, reqMeta);
    const message = result.verified
      ? "GPS check-in verified within institution geofence"
      : "GPS verification recorded: coordinates outside allowed geofence boundary";

    return ApiResponse.success(res, message, result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get GPS Verification History for an Inspection
 * GET /api/inspections/:id/gps
 */
export const getGpsHistory = async (req, res, next) => {
  try {
    const inspectionId = validateUuid(req.params.id, "Inspection ID");
    const history = await gpsService.getInspectionGpsHistory(inspectionId, req.user);

    return ApiResponse.success(res, "GPS verification history fetched successfully", history, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Latest GPS Verification for an Inspection
 * GET /api/inspections/:id/gps/latest
 */
export const getLatestGps = async (req, res, next) => {
  try {
    const inspectionId = validateUuid(req.params.id, "Inspection ID");
    const latest = await gpsService.getLatestGpsVerification(inspectionId, req.user);

    return ApiResponse.success(res, "Latest GPS verification fetched successfully", latest, 200);
  } catch (error) {
    next(error);
  }
};
