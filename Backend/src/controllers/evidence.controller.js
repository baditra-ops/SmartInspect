import * as evidenceService from "../services/evidence.service.js";
import {
  uploadEvidenceSchema,
  evidenceQuerySchema,
  validateBody,
  validateQuery,
  validateUuid,
} from "../utils/validation.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";

/**
 * Upload Evidence for an Inspection
 * POST /api/inspections/:id/evidence
 */
export const uploadEvidence = async (req, res, next) => {
  try {
    const inspectionId = validateUuid(req.params.id, "Inspection ID");

    if (!req.file) {
      throw new ApiError(400, "Evidence file is required");
    }

    const validatedData = validateBody(uploadEvidenceSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const evidence = await evidenceService.uploadInspectionEvidence(
      inspectionId,
      req.file,
      validatedData,
      req.user,
      reqMeta
    );

    return ApiResponse.success(res, "Evidence uploaded and securely stored successfully", evidence, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Evidence List for an Inspection
 * GET /api/inspections/:id/evidence
 */
export const getInspectionEvidence = async (req, res, next) => {
  try {
    const inspectionId = validateUuid(req.params.id, "Inspection ID");
    const validatedQuery = validateQuery(evidenceQuerySchema, req.query);

    const result = await evidenceService.getInspectionEvidence(
      inspectionId,
      validatedQuery,
      req.user
    );

    return res.status(200).json({
      success: true,
      message: "Inspection evidence fetched successfully",
      data: result.evidences,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Single Evidence Record by ID
 * GET /api/evidence/:id
 */
export const getEvidenceById = async (req, res, next) => {
  try {
    const evidenceId = validateUuid(req.params.id, "Evidence ID");
    const evidence = await evidenceService.getEvidenceById(evidenceId, req.user);

    return ApiResponse.success(res, "Evidence record fetched successfully", evidence, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Remote Integrity of Evidence
 * GET /api/evidence/:id/integrity
 */
export const verifyEvidenceIntegrity = async (req, res, next) => {
  try {
    const evidenceId = validateUuid(req.params.id, "Evidence ID");
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const integrityReport = await evidenceService.verifyEvidenceIntegrity(
      evidenceId,
      req.user,
      reqMeta
    );

    return ApiResponse.success(
      res,
      integrityReport.integrityVerified
        ? "Evidence integrity verified: remote Cloudinary asset matches SHA-256 fingerprint"
        : "Evidence integrity alert: remote asset does NOT match stored SHA-256 fingerprint",
      integrityReport,
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Administrative Deletion of Evidence Record
 * DELETE /api/evidence/:id
 */
export const deleteEvidence = async (req, res, next) => {
  try {
    const evidenceId = validateUuid(req.params.id, "Evidence ID");
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const result = await evidenceService.deleteEvidence(evidenceId, req.user, reqMeta);

    return ApiResponse.success(res, result.message, result, 200);
  } catch (error) {
    next(error);
  }
};
