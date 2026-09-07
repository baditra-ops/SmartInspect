import { aiService } from "../services/ai.service.js";
import { ApiResponse } from "../utils/apiResponse.js";
import {
  validateBody,
  validateQuery,
  validateUuid,
  calculateRiskSchema,
  analyzeAttendanceSchema,
  riskHistoryQuerySchema,
} from "../utils/validation.js";

/**
 * Controller handling AI & Risk Assessment operations
 */
export class AiController {
  /**
   * Health status of AI Microservice
   * GET /api/ai/health
   */
  async getHealth(req, res, next) {
    try {
      const health = await aiService.getAiHealthStatus();
      return res.status(200).json(new ApiResponse(200, health, "AI Service health status"));
    } catch (err) {
      next(err);
    }
  }

  /**
   * Calculate Institutional Risk Assessment
   * POST /api/ai/risk-assessment
   */
  async calculateRisk(req, res, next) {
    try {
      const validatedData = validateBody(calculateRiskSchema, req.body);
      const { institutionId, ...customInputs } = validatedData;

      const reqMeta = {
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers["user-agent"],
      };

      const result = await aiService.calculateInstitutionRisk(
        institutionId,
        customInputs,
        req.user,
        reqMeta
      );

      return res
        .status(201)
        .json(new ApiResponse(201, result, "Institutional risk calculated and persisted successfully"));
    } catch (err) {
      next(err);
    }
  }

  /**
   * Run Computer Vision Attendance Verification
   * POST /api/ai/attendance-analysis
   */
  async analyzeAttendance(req, res, next) {
    try {
      const validatedData = validateBody(analyzeAttendanceSchema, req.body);
      const { evidenceId, claimedAttendance, sampleIntervalSec } = validatedData;

      const reqMeta = {
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers["user-agent"],
      };

      const result = await aiService.analyzeEvidenceAttendance(
        evidenceId,
        { claimedAttendance, sampleIntervalSec },
        req.user,
        reqMeta
      );

      return res
        .status(200)
        .json(new ApiResponse(200, result, "Computer vision attendance analysis completed successfully"));
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get Paginated Historical Risk Assessments for an Institution
   * GET /api/ai/risk-assessments/:institutionId
   */
  async getRiskHistory(req, res, next) {
    try {
      const institutionId = validateUuid(req.params.institutionId, "Institution ID");
      const validatedQuery = validateQuery(riskHistoryQuerySchema, req.query);

      const result = await aiService.getInstitutionRiskHistory(
        institutionId,
        validatedQuery,
        req.user
      );

      return res
        .status(200)
        .json(new ApiResponse(200, result, "Historical risk assessments retrieved successfully"));
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get Latest Risk Assessment for an Institution
   * GET /api/ai/risk-assessments/:institutionId/latest
   */
  async getLatestRisk(req, res, next) {
    try {
      const institutionId = validateUuid(req.params.institutionId, "Institution ID");

      const result = await aiService.getLatestRiskAssessment(institutionId, req.user);

      return res
        .status(200)
        .json(new ApiResponse(200, result, "Latest risk assessment retrieved successfully"));
    } catch (err) {
      next(err);
    }
  }
}

export const aiController = new AiController();
export default aiController;
