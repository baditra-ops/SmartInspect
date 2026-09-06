import * as institutionService from "../services/institution.service.js";
import {
  institutionQuerySchema,
  createInstitutionSchema,
  updateInstitutionSchema,
  linkSchemeSchema,
  validateBody,
  validateQuery,
  validateUuid,
} from "../utils/validation.js";
import { ApiResponse } from "../utils/apiResponse.js";

/**
 * Get Paginated List of Institutions
 * GET /api/institutions
 */
export const getInstitutions = async (req, res, next) => {
  try {
    const validatedQuery = validateQuery(institutionQuerySchema, req.query);
    const result = await institutionService.getInstitutions(validatedQuery, req.user);

    return res.status(200).json({
      success: true,
      message: "Institutions fetched successfully",
      data: result.institutions,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Institution By ID
 * GET /api/institutions/:id
 */
export const getInstitutionById = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Institution ID");
    const institution = await institutionService.getInstitutionById(id, req.user);

    return ApiResponse.success(res, "Institution details fetched successfully", institution, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a New Institution
 * POST /api/institutions
 */
export const createInstitution = async (req, res, next) => {
  try {
    const validatedData = validateBody(createInstitutionSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };
    const institution = await institutionService.createInstitution(validatedData, req.user, reqMeta);

    return ApiResponse.success(res, "Institution registered successfully", institution, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Update an Institution
 * PATCH /api/institutions/:id
 */
export const updateInstitution = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Institution ID");
    const validatedData = validateBody(updateInstitutionSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const updated = await institutionService.updateInstitution(id, validatedData, req.user, reqMeta);
    return ApiResponse.success(res, "Institution updated successfully", updated, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate / Soft Delete an Institution
 * DELETE /api/institutions/:id
 */
export const deleteInstitution = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Institution ID");
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const result = await institutionService.deleteInstitution(id, req.user, reqMeta);
    return ApiResponse.success(res, result.message, null, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Schemes of an Institution
 * GET /api/institutions/:id/schemes
 */
export const getInstitutionSchemes = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Institution ID");
    const schemes = await institutionService.getInstitutionSchemes(id, req.user);

    return ApiResponse.success(res, "Institution schemes fetched successfully", schemes, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Link a Scheme to an Institution
 * POST /api/institutions/:id/schemes
 */
export const linkScheme = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Institution ID");
    const validatedData = validateBody(linkSchemeSchema, req.body);
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const link = await institutionService.linkSchemeToInstitution(id, validatedData, req.user, reqMeta);
    return ApiResponse.success(res, "Scheme linked successfully", link, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Unlink a Scheme from an Institution
 * DELETE /api/institutions/:id/schemes/:schemeId
 */
export const unlinkScheme = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Institution ID");
    const schemeId = validateUuid(req.params.schemeId, "Scheme ID");
    const reqMeta = { ip: req.ip, userAgent: req.get("user-agent") };

    const result = await institutionService.unlinkSchemeFromInstitution(id, schemeId, req.user, reqMeta);
    return ApiResponse.success(res, result.message, null, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Beneficiaries of an Institution
 * GET /api/institutions/:id/beneficiaries
 */
export const getInstitutionBeneficiaries = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Institution ID");
    const result = await institutionService.getInstitutionBeneficiaries(id, req.query, req.user);

    return res.status(200).json({
      success: true,
      message: "Institution beneficiaries fetched successfully",
      data: result.beneficiaries,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Attendance of an Institution
 * GET /api/institutions/:id/attendance
 */
export const getInstitutionAttendance = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Institution ID");
    const attendances = await institutionService.getInstitutionAttendance(id, req.query, req.user);

    return ApiResponse.success(res, "Institution attendance fetched successfully", attendances, 200);
  } catch (error) {
    next(error);
  }
};
