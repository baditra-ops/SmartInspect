import api, { unwrap } from "./api";

/**
 * AI & Risk Analytics API Service Layer
 * Interfaces directly with backend /api/ai endpoints
 */

/**
 * Get AI Microservice Health Status
 * GET /api/ai/health
 */
export const getAiHealth = async () => {
  const res = await api.get("/ai/health");
  return unwrap(res);
};

/**
 * Calculate and Persist Institutional Risk Assessment (Admin/Officers)
 * POST /api/ai/risk-assessment
 * @param {Object} data { institutionId, historicalDiscrepancyPct?, daysSinceLastAudit?, cctvDowntimePct?, openComplaints?, unusualEnrollmentSpikePct? }
 */
export const calculateInstitutionRisk = async (data) => {
  const res = await api.post("/ai/risk-assessment", data);
  return unwrap(res);
};

/**
 * Run Computer Vision Attendance Analysis on Evidence Video
 * POST /api/ai/attendance-analysis
 * @param {Object} data { evidenceId, claimedAttendance, sampleIntervalSec? }
 */
export const analyzeAttendance = async (data) => {
  const res = await api.post("/ai/attendance-analysis", data);
  return unwrap(res);
};

/**
 * Get Historical Risk Assessments for an Institution
 * GET /api/ai/risk-assessments/:institutionId
 */
export const getInstitutionRiskHistory = async (institutionId, params = {}) => {
  const res = await api.get(`/ai/risk-assessments/${institutionId}`, { params });
  return unwrap(res);
};

/**
 * Get Latest Risk Assessment for an Institution
 * GET /api/ai/risk-assessments/:institutionId/latest
 */
export const getLatestRiskAssessment = async (institutionId) => {
  const res = await api.get(`/ai/risk-assessments/${institutionId}/latest`);
  return unwrap(res);
};
