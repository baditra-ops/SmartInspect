import * as inspectionService from "../services/inspection.service.js";
import { jitService } from "../services/jit.service.js";
import {
  inspectionQuerySchema,
  createInspectionSchema,
  updateInspectionSchema,
  assignInspectorSchema,
  rejectAssignmentSchema,
  eligibleInspectorsQuerySchema,
  jitDispatchSchema,
  batchJitDispatchSchema,
  triggerSurpriseInspectionSchema,
  validateBody,
  validateQuery,
  validateUuid,
} from "../utils/validation.js";
import { ApiResponse } from "../utils/apiResponse.js";

/**
 * Get Paginated List of Inspections
 * GET /api/inspections
 */
export const getInspections = async (req, res, next) => {
  try {
    const validatedQuery = validateQuery(inspectionQuerySchema, req.query);
    const result = await inspectionService.getInspections(validatedQuery, req.user);

    return res.status(200).json({
      success: true,
      message: "Inspections fetched successfully",
      data: result.inspections,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Inspections Assigned to Authenticated Inspector
 * GET /api/inspections/my
 */
export const getMyInspections = async (req, res, next) => {
  try {
    const validatedQuery = validateQuery(inspectionQuerySchema, req.query);
    const result = await inspectionService.getMyInspections(validatedQuery, req.user);

    return res.status(200).json({
      success: true,
      message: "Assigned inspections fetched successfully",
      data: result.inspections,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Query Eligible Inspectors for Assignment
 * GET /api/inspections/eligible-inspectors
 */
export const getEligibleInspectors = async (req, res, next) => {
  try {
    const validatedQuery = validateQuery(eligibleInspectorsQuerySchema, req.query);
    const inspectors = await inspectionService.getEligibleInspectors(validatedQuery, req.user);

    return ApiResponse.success(res, "Eligible inspectors fetched successfully", inspectors, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Inspection By ID
 * GET /api/inspections/:id
 */
export const getInspectionById = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Inspection ID");
    const inspection = await inspectionService.getInspectionById(id, req.user);

    return ApiResponse.success(res, "Inspection details fetched successfully", inspection, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a New Inspection
 * POST /api/inspections
 */
export const createInspection = async (req, res, next) => {
  try {
    const validatedData = validateBody(createInspectionSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };
    const inspection = await inspectionService.createInspection(validatedData, req.user, reqMeta);

    return ApiResponse.success(res, "Inspection created successfully", inspection, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Update Inspection Metadata
 * PATCH /api/inspections/:id
 */
export const updateInspection = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Inspection ID");
    const validatedData = validateBody(updateInspectionSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const updated = await inspectionService.updateInspection(id, validatedData, req.user, reqMeta);
    return ApiResponse.success(res, "Inspection updated successfully", updated, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Manually Assign Inspector to Inspection
 * POST /api/inspections/:id/assign
 */
export const assignInspector = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Inspection ID");
    const validatedData = validateBody(assignInspectorSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const result = await inspectionService.assignInspector(id, validatedData, req.user, reqMeta);
    return ApiResponse.success(res, "Inspector assigned successfully", result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Reassign Inspector to Inspection
 * POST /api/inspections/:id/reassign
 */
export const reassignInspector = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Inspection ID");
    const validatedData = validateBody(assignInspectorSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const result = await inspectionService.reassignInspector(id, validatedData, req.user, reqMeta);
    return ApiResponse.success(res, "Inspector reassigned successfully", result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Assignment History for an Inspection
 * GET /api/inspections/:id/assignments
 */
export const getInspectionAssignments = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Inspection ID");
    const assignments = await inspectionService.getInspectionAssignments(id, req.user);

    return ApiResponse.success(res, "Inspection assignments fetched successfully", assignments, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Inspector Accepts Assignment
 * POST /api/inspections/:id/accept
 */
export const acceptAssignment = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Inspection ID");
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const result = await inspectionService.acceptAssignment(id, req.user, reqMeta);
    return ApiResponse.success(res, "Inspection assignment accepted", result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Inspector Declines/Rejects Assignment
 * POST /api/inspections/:id/reject
 */
export const rejectAssignment = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Inspection ID");
    const validatedData = validateBody(rejectAssignmentSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const result = await inspectionService.rejectAssignment(id, validatedData, req.user, reqMeta);
    return ApiResponse.success(res, "Inspection assignment declined", result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Inspector Starts Inspection
 * POST /api/inspections/:id/start
 */
export const startInspection = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Inspection ID");
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const result = await inspectionService.startInspection(id, req.user, reqMeta);
    return ApiResponse.success(res, "Inspection started successfully", result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Inspector Completes Inspection
 * POST /api/inspections/:id/complete
 */
export const completeInspection = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Inspection ID");
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const result = await inspectionService.completeInspection(id, req.user, reqMeta);
    return ApiResponse.success(res, "Inspection marked as completed", result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel an Inspection
 * POST /api/inspections/:id/cancel
 */
export const cancelInspection = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Inspection ID");
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const result = await inspectionService.cancelInspection(id, req.user, reqMeta);
    return ApiResponse.success(res, "Inspection cancelled successfully", result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Just-In-Time (JIT) Automated Randomized Dispatch
 * POST /api/inspections/:id/jit-dispatch
 */
export const jitDispatch = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Inspection ID");
    const validatedData = validateBody(jitDispatchSchema, req.body || {});
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const result = await jitService.jitDispatchInspection(id, validatedData, req.user, reqMeta);
    return ApiResponse.success(
      res,
      "Inspection successfully assigned via Automated JIT Dispatch",
      result,
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Batch JIT Dispatch for Pending Scheduled Inspections
 * POST /api/inspections/batch-jit-dispatch
 */
export const batchJitDispatch = async (req, res, next) => {
  try {
    const validatedFilter = validateBody(batchJitDispatchSchema, req.body || {});
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const result = await jitService.runBatchJitDispatch(validatedFilter, req.user, reqMeta);
    return ApiResponse.success(
      res,
      `Batch JIT dispatch completed (${result.dispatchedCount} dispatched, ${result.failedCount} failed)`,
      result,
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Trigger Risk-Based Surprise Inspection with Immediate JIT Dispatch
 * POST /api/inspections/trigger-surprise
 */
export const triggerSurpriseInspection = async (req, res, next) => {
  try {
    const validatedData = validateBody(triggerSurpriseInspectionSchema, req.body);
    const { institutionId, ...options } = validatedData;
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const result = await jitService.triggerSurpriseInspectionFromRisk(
      institutionId,
      options,
      req.user,
      reqMeta
    );

    const statusCode = result.isNew ? 201 : 200;
    const message = result.isNew
      ? "Surprise inspection created and randomly dispatched via JIT Engine"
      : result.message;

    return ApiResponse.success(res, message, result, statusCode);
  } catch (error) {
    next(error);
  }
};

