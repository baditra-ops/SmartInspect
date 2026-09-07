import * as complianceService from "../services/compliance.service.js";
import {
  complianceQuerySchema,
  createComplianceActionSchema,
  createComplianceFromAlertSchema,
  updateComplianceActionSchema,
  assignComplianceActionSchema,
  submitRectificationSchema,
  verifyComplianceActionSchema,
  rejectRectificationSchema,
  reopenComplianceActionSchema,
  escalateComplianceActionSchema,
  validateBody,
  validateQuery,
  validateUuid,
} from "../utils/validation.js";
import { ApiResponse } from "../utils/apiResponse.js";

/**
 * Get Paginated List of Compliance Actions
 * GET /api/compliance
 */
export const getComplianceActions = async (req, res, next) => {
  try {
    const validatedQuery = validateQuery(complianceQuerySchema, req.query);
    const result = await complianceService.getComplianceActions(validatedQuery, req.user);

    return res.status(200).json({
      success: true,
      message: "Compliance actions fetched successfully",
      data: result.actions,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Summary Stats for Compliance Actions
 * GET /api/compliance/stats
 */
export const getComplianceStats = async (req, res, next) => {
  try {
    const validatedQuery = validateQuery(complianceQuerySchema.partial(), req.query);
    const stats = await complianceService.getComplianceStats(validatedQuery, req.user);

    return ApiResponse.success(res, "Compliance metrics fetched successfully", stats, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Compliance Action by ID
 * GET /api/compliance/:id
 */
export const getComplianceActionById = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Compliance Action ID");
    const action = await complianceService.getComplianceActionById(id, req.user);

    return ApiResponse.success(res, "Compliance action details fetched successfully", action, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a New Compliance Action
 * POST /api/compliance
 */
export const createComplianceAction = async (req, res, next) => {
  try {
    const validatedData = validateBody(createComplianceActionSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };
    const action = await complianceService.createComplianceAction(validatedData, req.user, reqMeta);

    return ApiResponse.success(res, "Compliance action created successfully", action, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a Compliance Action from an Existing Alert
 * POST /api/compliance/from-alert
 */
export const createComplianceFromAlert = async (req, res, next) => {
  try {
    const validatedData = validateBody(createComplianceFromAlertSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };
    const action = await complianceService.createComplianceFromAlert(validatedData, req.user, reqMeta);

    return ApiResponse.success(res, "Compliance action created from alert successfully", action, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Update Metadata for a Compliance Action
 * PATCH /api/compliance/:id
 */
export const updateComplianceAction = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Compliance Action ID");
    const validatedData = validateBody(updateComplianceActionSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const updated = await complianceService.updateComplianceAction(id, validatedData, req.user, reqMeta);
    return ApiResponse.success(res, "Compliance action updated successfully", updated, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Assign Responsible User
 * POST /api/compliance/:id/assign
 */
export const assignComplianceAction = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Compliance Action ID");
    const { assignedToUserId } = validateBody(assignComplianceActionSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const updated = await complianceService.assignComplianceAction(id, assignedToUserId, req.user, reqMeta);
    return ApiResponse.success(res, "Responsible user assigned successfully", updated, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Start Work on Action (PENDING -> IN_PROGRESS)
 * POST /api/compliance/:id/start
 */
export const startComplianceAction = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Compliance Action ID");
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const updated = await complianceService.startComplianceAction(id, req.user, reqMeta);
    return ApiResponse.success(res, "Compliance action marked as in progress", updated, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Submit Rectification by Institution or Assignee (IN_PROGRESS -> SUBMITTED_FOR_REVIEW)
 * POST /api/compliance/:id/submit
 */
export const submitRectification = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Compliance Action ID");
    const validatedData = validateBody(submitRectificationSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const updated = await complianceService.submitRectification(id, validatedData, req.user, reqMeta);
    return ApiResponse.success(res, "Rectification submitted for officer review successfully", updated, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Officer Verification & Approval (SUBMITTED_FOR_REVIEW -> VERIFIED_CLOSED)
 * POST /api/compliance/:id/verify
 */
export const verifyComplianceAction = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Compliance Action ID");
    const validatedData = validateBody(verifyComplianceActionSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const updated = await complianceService.verifyComplianceAction(id, validatedData, req.user, reqMeta);
    return ApiResponse.success(res, "Compliance action verified and closed successfully", updated, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Reject Rectification Submission (SUBMITTED_FOR_REVIEW -> IN_PROGRESS)
 * POST /api/compliance/:id/reject
 */
export const rejectRectification = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Compliance Action ID");
    const validatedData = validateBody(rejectRectificationSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const updated = await complianceService.rejectRectification(id, validatedData, req.user, reqMeta);
    return ApiResponse.success(res, "Rectification rejected. Action returned to in-progress for rework.", updated, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Direct Officer Close (-> VERIFIED_CLOSED)
 * POST /api/compliance/:id/close
 */
export const closeComplianceAction = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Compliance Action ID");
    const validatedData = validateBody(verifyComplianceActionSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const updated = await complianceService.closeComplianceAction(id, validatedData, req.user, reqMeta);
    return ApiResponse.success(res, "Compliance action closed successfully", updated, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Reopen Closed Compliance Action (VERIFIED_CLOSED -> IN_PROGRESS)
 * POST /api/compliance/:id/reopen
 */
export const reopenComplianceAction = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Compliance Action ID");
    const validatedData = validateBody(reopenComplianceActionSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const updated = await complianceService.reopenComplianceAction(id, validatedData, req.user, reqMeta);
    return ApiResponse.success(res, "Compliance action reopened for rework successfully", updated, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Escalate Compliance Action (-> ESCALATED)
 * POST /api/compliance/:id/escalate
 */
export const escalateComplianceAction = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Compliance Action ID");
    const validatedData = validateBody(escalateComplianceActionSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const updated = await complianceService.escalateComplianceAction(id, validatedData, req.user, reqMeta);
    return ApiResponse.success(res, "Compliance action escalated successfully", updated, 200);
  } catch (error) {
    next(error);
  }
};
