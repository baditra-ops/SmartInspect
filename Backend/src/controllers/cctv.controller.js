import * as cctvService from "../services/cctv.service.js";
import {
  cctvQuerySchema,
  createCctvDeviceSchema,
  updateCctvDeviceSchema,
  updateCctvStatusSchema,
  validateBody,
  validateQuery,
  validateUuid,
} from "../utils/validation.js";
import { ApiResponse } from "../utils/apiResponse.js";

/**
 * Get Paginated List of CCTV Devices
 * GET /api/cctv
 */
export const getCctvDevices = async (req, res, next) => {
  try {
    const validatedQuery = validateQuery(cctvQuerySchema, req.query);
    const result = await cctvService.getCctvDevices(validatedQuery, req.user);

    return res.status(200).json({
      success: true,
      message: "CCTV devices fetched successfully",
      data: result.devices,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get CCTV Device Details by ID
 * GET /api/cctv/:id
 */
export const getCctvDeviceById = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "CCTV Device ID");
    const device = await cctvService.getCctvDeviceById(id, req.user);

    return ApiResponse.success(res, "CCTV device details fetched successfully", device, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Authorized CCTV Live Stream Metadata
 * GET /api/cctv/:id/stream
 */
export const getCctvStream = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "CCTV Device ID");
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };
    const streamInfo = await cctvService.getCctvStream(id, req.user, reqMeta);

    return ApiResponse.success(res, "CCTV live stream authorized successfully", streamInfo, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Register a New CCTV Device
 * POST /api/cctv
 */
export const createCctvDevice = async (req, res, next) => {
  try {
    const validatedData = validateBody(createCctvDeviceSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };
    const device = await cctvService.createCctvDevice(validatedData, req.user, reqMeta);

    return ApiResponse.success(res, "CCTV device registered successfully", device, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Update CCTV Device Metadata
 * PATCH /api/cctv/:id
 */
export const updateCctvDevice = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "CCTV Device ID");
    const validatedData = validateBody(updateCctvDeviceSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const updated = await cctvService.updateCctvDevice(id, validatedData, req.user, reqMeta);
    return ApiResponse.success(res, "CCTV device updated successfully", updated, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Update CCTV Device Status
 * PATCH /api/cctv/:id/status
 */
export const updateCctvStatus = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "CCTV Device ID");
    const validatedData = validateBody(updateCctvStatusSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const updated = await cctvService.updateCctvStatus(id, validatedData, req.user, reqMeta);
    return ApiResponse.success(res, "CCTV device status updated successfully", updated, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete / Decommission CCTV Device
 * DELETE /api/cctv/:id
 */
export const deleteCctvDevice = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "CCTV Device ID");
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const result = await cctvService.deleteCctvDevice(id, req.user, reqMeta);
    return ApiResponse.success(res, "CCTV device deleted successfully", result, 200);
  } catch (error) {
    next(error);
  }
};
