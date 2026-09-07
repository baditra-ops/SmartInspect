import { prisma } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";
import { recordAuditLog } from "../utils/audit.js";
import { eventPublisher } from "../sockets/publisher.js";
import { WS_EVENTS } from "../sockets/events.js";
import { cacheService } from "./cache.service.js";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_SERVICE_TIMEOUT_MS = parseInt(process.env.AI_SERVICE_TIMEOUT_MS, 10) || 15000;
const AI_SERVICE_API_KEY = process.env.AI_SERVICE_API_KEY || "";

/**
 * Helper to call AI Service Microservice via HTTP with timeout and error handling
 */
const callAiService = async (endpoint, method = "GET", body = null) => {
  const url = `${AI_SERVICE_URL.replace(/\/+$/, "")}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (AI_SERVICE_API_KEY) {
    headers["X-API-Key"] = AI_SERVICE_API_KEY;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_SERVICE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorDetail = `AI Service returned HTTP ${response.status}`;
      try {
        const errorJson = await response.json();
        if (errorJson.detail) {
          errorDetail = typeof errorJson.detail === "string" ? errorJson.detail : JSON.stringify(errorJson.detail);
        }
      } catch (_) {
        // ignore json parse error
      }
      throw new ApiError(502, `AI Engine Error: ${errorDetail}`);
    }

    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError" || err.code === "ECONNABORTED") {
      throw new ApiError(504, `AI Engine request timed out after ${AI_SERVICE_TIMEOUT_MS}ms`);
    }
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(503, `AI Microservice is currently unavailable: ${err.message}`);
  }
};

/**
 * Maps AI Risk Engine Score & Level to Prisma RiskLevel enum
 */
export const mapAiRiskToPrisma = (score, aiLevel) => {
  const clampedScore = Math.max(0, Math.min(100, Number(score) || 0));

  if (clampedScore >= 70 || aiLevel === "CRITICAL_HIGH") {
    return { score: clampedScore, level: "CRITICAL" };
  }
  if (clampedScore >= 50) {
    return { score: clampedScore, level: "HIGH" };
  }
  if (clampedScore >= 25 || aiLevel === "MODERATE") {
    return { score: clampedScore, level: "MEDIUM" };
  }
  return { score: clampedScore, level: "LOW" };
};

/**
 * Enforce RBAC and geographic access for institution-scoped AI operations
 */
export const enforceInstitutionAccess = (currentUser, institution) => {
  if (!currentUser) {
    throw new ApiError(401, "Authentication required for AI operations");
  }

  if (currentUser.role === "ADMIN") {
    return true;
  }

  if (currentUser.role === "STATE_OFFICER") {
    if (institution.state && currentUser.state && institution.state.toLowerCase() !== currentUser.state.toLowerCase()) {
      throw new ApiError(403, `Access forbidden: State Officer cannot access institutions in ${institution.state}`);
    }
    return true;
  }

  if (currentUser.role === "DISTRICT_OFFICER") {
    if (
      institution.state &&
      currentUser.state &&
      institution.state.toLowerCase() !== currentUser.state.toLowerCase()
    ) {
      throw new ApiError(403, `Access forbidden: District Officer cannot access institutions outside ${currentUser.state}`);
    }
    if (
      institution.district &&
      currentUser.district &&
      institution.district.toLowerCase() !== currentUser.district.toLowerCase()
    ) {
      throw new ApiError(403, `Access forbidden: District Officer cannot access institutions in district ${institution.district}`);
    }
    return true;
  }

  if (currentUser.role === "INSTITUTION_USER") {
    if (currentUser.institutionId !== institution.id) {
      throw new ApiError(403, "Access forbidden: Institution users can only access their own institution");
    }
    return true;
  }

  if (currentUser.role === "INSPECTOR") {
    return true;
  }

  throw new ApiError(403, "Access forbidden for your user role");
};

export class AiService {
  /**
   * Health check on AI Microservice
   */
  async getAiHealthStatus() {
    try {
      const data = await callAiService("/api/ai/health", "GET");
      return {
        status: "ONLINE",
        microserviceUrl: AI_SERVICE_URL,
        details: data,
      };
    } catch (err) {
      return {
        status: "OFFLINE",
        microserviceUrl: AI_SERVICE_URL,
        error: err.message,
      };
    }
  }

  /**
   * Calculate and persist Risk Assessment for an Institution
   */
  async calculateInstitutionRisk(institutionId, customInputs = {}, currentUser = null, reqMeta = {}) {
    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      include: {
        inspections: {
          where: { status: "COMPLETED" },
          orderBy: { completedAt: "desc" },
          take: 1,
        },
        cctvDevices: true,
        alerts: {
          where: { status: "OPEN" },
        },
        complianceActions: {
          where: { status: { in: ["PENDING", "IN_PROGRESS", "ESCALATED"] } },
        },
      },
    });

    if (!institution) {
      throw new ApiError(404, "Institution not found");
    }

    if (currentUser) {
      enforceInstitutionAccess(currentUser, institution);
    }

    // Derive inputs from actual database metrics if not explicitly passed
    let daysSinceLastAudit = customInputs.daysSinceLastAudit;
    if (daysSinceLastAudit === undefined || daysSinceLastAudit === null) {
      if (institution.inspections && institution.inspections.length > 0 && institution.inspections[0].completedAt) {
        const diffMs = Date.now() - new Date(institution.inspections[0].completedAt).getTime();
        daysSinceLastAudit = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      } else {
        daysSinceLastAudit = 90; // Default when no audit exists yet
      }
    }

    let cctvDowntimePct = customInputs.cctvDowntimePct;
    if (cctvDowntimePct === undefined || cctvDowntimePct === null) {
      if (institution.cctvDevices && institution.cctvDevices.length > 0) {
        const offlineCount = institution.cctvDevices.filter((d) => d.status !== "ONLINE").length;
        cctvDowntimePct = roundToTwo((offlineCount / institution.cctvDevices.length) * 100);
      } else {
        cctvDowntimePct = 0.0;
      }
    }

    let openComplaints = customInputs.openComplaints;
    if (openComplaints === undefined || openComplaints === null) {
      const openAlertsCount = institution.alerts ? institution.alerts.length : 0;
      const openComplianceCount = institution.complianceActions ? institution.complianceActions.length : 0;
      openComplaints = openAlertsCount + openComplianceCount;
    }

    const historicalDiscrepancyPct =
      customInputs.historicalDiscrepancyPct !== undefined && customInputs.historicalDiscrepancyPct !== null
        ? Number(customInputs.historicalDiscrepancyPct)
        : Number(institution.latestRiskScore) > 0
        ? Number(institution.latestRiskScore) * 0.3
        : 5.0;

    const unusualEnrollmentSpikePct =
      customInputs.unusualEnrollmentSpikePct !== undefined && customInputs.unusualEnrollmentSpikePct !== null
        ? Number(customInputs.unusualEnrollmentSpikePct)
        : 0.0;

    const payload = {
      institution_id: institution.id,
      ngo_id: institution.code || institution.id,
      historical_discrepancy_pct: historicalDiscrepancyPct,
      days_since_last_audit: daysSinceLastAudit,
      cctv_downtime_pct: cctvDowntimePct,
      open_complaints: openComplaints,
      unusual_enrollment_spike_pct: unusualEnrollmentSpikePct,
    };

    // Call FastAPI AI microservice
    const aiResponse = await callAiService("/api/ai/calculate-risk", "POST", payload);

    if (!aiResponse || typeof aiResponse.risk_score !== "number") {
      throw new ApiError(502, "Invalid response payload received from AI Risk Engine");
    }

    const { score: prismaRiskScore, level: prismaRiskLevel } = mapAiRiskToPrisma(
      aiResponse.risk_score,
      aiResponse.risk_level
    );

    const triggeredBy = currentUser ? `${currentUser.role}:${currentUser.id}` : "SCHEDULED_CRON";

    // Persist RiskAssessment into PostgreSQL
    const savedAssessment = await prisma.riskAssessment.create({
      data: {
        institutionId: institution.id,
        riskScore: prismaRiskScore,
        riskLevel: prismaRiskLevel,
        factors: {
          raw_inputs: payload,
          breakdown: aiResponse.factor_breakdown,
          anomaly_detected: aiResponse.anomaly_detected,
          anomaly_boost_points: aiResponse.anomaly_boost_points,
          ai_risk_level: aiResponse.risk_level,
        },
        modelVersion: aiResponse.model_version || "risk-engine-v1.0",
        triggeredBy,
        recommendedAction: aiResponse.recommended_action || "STANDBY",
      },
      include: {
        institution: {
          select: {
            id: true,
            code: true,
            name: true,
            state: true,
            district: true,
          },
        },
      },
    });

    // Update Institution latest risk fields
    await prisma.institution.update({
      where: { id: institution.id },
      data: {
        latestRiskScore: prismaRiskScore,
        latestRiskLevel: prismaRiskLevel,
      },
    });

    // Proactively trigger Alert if risk level is HIGH or CRITICAL
    if (prismaRiskLevel === "CRITICAL" || prismaRiskLevel === "HIGH") {
      const existingAlert = await prisma.alert.findFirst({
        where: {
          institutionId: institution.id,
          alertType: "HIGH_RISK_INSTITUTION_DETECTED",
          status: { in: ["OPEN", "IN_PROGRESS", "ACKNOWLEDGED"] },
        },
      });

      if (!existingAlert) {
        const newAlert = await prisma.alert.create({
          data: {
            institutionId: institution.id,
            alertType: "HIGH_RISK_INSTITUTION_DETECTED",
            severity: prismaRiskLevel === "CRITICAL" ? "CRITICAL" : "HIGH",
            title: `High Risk Detected for ${institution.name}`,
            description: `AI Risk Engine evaluated risk score at ${prismaRiskScore}/100 (${prismaRiskLevel}). Recommended Action: ${aiResponse.recommended_action}`,
            status: "OPEN",
          },
          include: {
            institution: {
              select: {
                id: true,
                name: true,
                state: true,
                district: true,
              },
            },
          },
        });

        await eventPublisher.publishAlertEvent(WS_EVENTS.ALERT_CREATED, newAlert);
      }
    }

    // Publish WebSocket events
    await eventPublisher.publishAiRiskEvent(WS_EVENTS.AI_RISK_ASSESSED, savedAssessment);
    if (aiResponse.anomaly_detected) {
      await eventPublisher.publishAiRiskEvent(WS_EVENTS.AI_ANOMALY_DETECTED, savedAssessment);
    }

    // Record immutable Audit Log
    await recordAuditLog({
      actorUserId: currentUser ? currentUser.id : null,
      action: "AI_RISK_ASSESSMENT_CREATED",
      entityType: "RiskAssessment",
      entityId: savedAssessment.id,
      newValues: {
        institutionId: institution.id,
        riskScore: prismaRiskScore,
        riskLevel: prismaRiskLevel,
        recommendedAction: savedAssessment.recommendedAction,
        anomalyDetected: aiResponse.anomaly_detected,
      },
      ipAddress: reqMeta.ipAddress || null,
      userAgent: reqMeta.userAgent || null,
    });

    // Invalidate Redis caches
    await cacheService.deleteByPattern(`institution:*`);
    await cacheService.deleteByPattern(`ai:risk:*`);

    return savedAssessment;
  }

  /**
   * Run Computer Vision Attendance Analysis on Evidence Media
   */
  async analyzeEvidenceAttendance(evidenceId, { claimedAttendance, sampleIntervalSec = 1 } = {}, currentUser = null, reqMeta = {}) {
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: {
        inspection: {
          include: {
            institution: true,
          },
        },
        checklistItem: true,
      },
    });

    if (!evidence) {
      throw new ApiError(404, "Evidence record not found");
    }

    if (currentUser) {
      enforceInstitutionAccess(currentUser, evidence.inspection.institution);
    }

    const videoSource = evidence.secureUrl || evidence.cloudinaryUrl;
    if (!videoSource) {
      throw new ApiError(400, "Evidence record contains no valid media URL for analysis");
    }

    let headcountClaimed = claimedAttendance;
    if (headcountClaimed === undefined || headcountClaimed === null) {
      // Fall back to institution occupancy or 0
      headcountClaimed = evidence.inspection.institution.currentOccupancy || 0;
    }

    const payload = {
      institution_id: evidence.inspection.institutionId,
      inspection_id: evidence.inspectionId,
      claimed_attendance: headcountClaimed,
      video_source: videoSource,
      sample_interval_sec: sampleIntervalSec,
    };

    // Call FastAPI Vision endpoint
    const aiResponse = await callAiService("/api/ai/analyze-attendance", "POST", payload);

    if (!aiResponse || typeof aiResponse.detected_attendance !== "number") {
      throw new ApiError(502, "Invalid response payload from AI Vision Engine");
    }

    const discrepancyPct = Number(aiResponse.discrepancy_percentage) || 0.0;
    const isAnomaly = Boolean(aiResponse.anomaly_detected || discrepancyPct >= 20.0);

    const aiNotesText = `Headcount Analysis: Claimed=${headcountClaimed}, Detected=${aiResponse.detected_attendance} (Peak: ${aiResponse.peak_detected_attendance}), Discrepancy=${discrepancyPct}%. Anomaly=${isAnomaly ? "YES" : "NO"}`;

    // Update Evidence record
    const updatedEvidence = await prisma.evidence.update({
      where: { id: evidence.id },
      data: {
        aiConfidence: aiResponse.confidence ? Number(aiResponse.confidence) : 0.85,
        aiDamageDetected: isAnomaly,
        aiNotes: aiNotesText,
      },
    });

    // If linked to a checklist response, flag anomaly
    if (evidence.checklistItemId) {
      await prisma.inspectionChecklistResponse.updateMany({
        where: {
          inspectionId: evidence.inspectionId,
          checklistItemId: evidence.checklistItemId,
        },
        data: {
          aiFlaggedAnomaly: isAnomaly,
        },
      });
    }

    // If significant discrepancy (> 20%), trigger Alert
    if (isAnomaly) {
      const newAlert = await prisma.alert.create({
        data: {
          institutionId: evidence.inspection.institutionId,
          inspectionId: evidence.inspectionId,
          alertType: "ATTENDANCE_DISCREPANCY_DETECTED",
          severity: discrepancyPct >= 40.0 ? "CRITICAL" : "HIGH",
          title: `Attendance Anomaly in ${evidence.inspection.institution.name}`,
          description: `AI video analysis detected ${aiResponse.detected_attendance} attendees vs ${headcountClaimed} claimed (${discrepancyPct}% discrepancy).`,
          status: "OPEN",
        },
        include: {
          institution: {
            select: {
              id: true,
              name: true,
              state: true,
              district: true,
            },
          },
        },
      });

      await eventPublisher.publishAlertEvent(WS_EVENTS.ALERT_CREATED, newAlert);
      await eventPublisher.publishAiAttendanceEvent(WS_EVENTS.AI_ANOMALY_DETECTED, {
        institutionId: evidence.inspection.institutionId,
        institution: evidence.inspection.institution,
        inspectionId: evidence.inspectionId,
        evidenceId: evidence.id,
        claimedAttendance: headcountClaimed,
        detectedAttendance: aiResponse.detected_attendance,
        discrepancyPercentage: discrepancyPct,
        anomalyDetected: true,
        confidence: aiResponse.confidence,
      });
    }

    // Publish WebSocket event
    await eventPublisher.publishAiAttendanceEvent(WS_EVENTS.AI_ATTENDANCE_ANALYZED, {
      institutionId: evidence.inspection.institutionId,
      institution: evidence.inspection.institution,
      inspectionId: evidence.inspectionId,
      evidenceId: evidence.id,
      claimedAttendance: headcountClaimed,
      detectedAttendance: aiResponse.detected_attendance,
      discrepancyPercentage: discrepancyPct,
      anomalyDetected: isAnomaly,
      confidence: aiResponse.confidence,
    });

    // Record Audit Log
    await recordAuditLog({
      actorUserId: currentUser ? currentUser.id : null,
      action: "AI_ATTENDANCE_ANALYZED",
      entityType: "Evidence",
      entityId: evidence.id,
      newValues: {
        claimedAttendance: headcountClaimed,
        detectedAttendance: aiResponse.detected_attendance,
        discrepancyPercentage: discrepancyPct,
        anomalyDetected: isAnomaly,
      },
      ipAddress: reqMeta.ipAddress || null,
      userAgent: reqMeta.userAgent || null,
    });

    return {
      evidence: updatedEvidence,
      analysis: aiResponse,
    };
  }

  /**
   * Get paginated historical Risk Assessments for an institution
   */
  async getInstitutionRiskHistory(institutionId, query = {}, currentUser = null) {
    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      select: { id: true, code: true, name: true, state: true, district: true },
    });

    if (!institution) {
      throw new ApiError(404, "Institution not found");
    }

    if (currentUser) {
      enforceInstitutionAccess(currentUser, institution);
    }

    const { page = 1, limit = 20, riskLevel, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where = { institutionId };

    if (riskLevel) {
      where.riskLevel = riskLevel;
    }

    if (startDate || endDate) {
      where.assessmentDate = {};
      if (startDate) where.assessmentDate.gte = new Date(startDate);
      if (endDate) where.assessmentDate.lte = new Date(endDate);
    }

    const [total, assessments] = await Promise.all([
      prisma.riskAssessment.count({ where }),
      prisma.riskAssessment.findMany({
        where,
        orderBy: { assessmentDate: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: assessments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      institution,
    };
  }

  /**
   * Get latest Risk Assessment for an institution
   */
  async getLatestRiskAssessment(institutionId, currentUser = null) {
    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      select: {
        id: true,
        code: true,
        name: true,
        state: true,
        district: true,
        latestRiskScore: true,
        latestRiskLevel: true,
      },
    });

    if (!institution) {
      throw new ApiError(404, "Institution not found");
    }

    if (currentUser) {
      enforceInstitutionAccess(currentUser, institution);
    }

    const latestAssessment = await prisma.riskAssessment.findFirst({
      where: { institutionId },
      orderBy: { assessmentDate: "desc" },
    });

    return {
      institution,
      latestAssessment: latestAssessment || null,
    };
  }
}

const roundToTwo = (num) => Math.round((Number(num) + Number.EPSILON) * 100) / 100;

export const aiService = new AiService();
export default aiService;
