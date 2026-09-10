import crypto from "crypto";
import { prisma } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";
import { recordAuditLog } from "../utils/audit.js";
import { eventPublisher } from "../sockets/publisher.js";
import { WS_EVENTS } from "../sockets/events.js";
import { invalidateInspectionCaches, enforceInspectionAccess } from "./inspection.service.js";

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
      totalInspectionsConducted: true,
    },
  },
};

/**
 * Generate cryptographic, audit-verifiable seed for random selection
 */
export const generateAlgorithmSeed = (inspectionId, institutionId, scheduledDate, salt = "") => {
  const nonce = crypto.randomBytes(8).toString("hex");
  const payload = `${inspectionId}:${institutionId}:${new Date(scheduledDate).toISOString()}:${salt}:${nonce}`;
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 32);
};

/**
 * Generate human-readable inspection code (e.g. INSP-SR-2026-X8Y2K)
 */
const generateSurpriseInspectionCode = () => {
  const year = new Date().getFullYear();
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  const timePart = Date.now().toString(36).substring(4).toUpperCase();
  return `INSP-SR-${year}-${timePart}${randomPart}`;
};

/**
 * Find eligible inspectors for an institution respecting anti-collusion & workload constraints
 */
export const findEligibleInspectors = async ({
  institutionId,
  state,
  district,
  antiCollusionCooldownDays = 90,
  allowFallbackToStatePool = false,
}) => {
  const cooldownDate = new Date(Date.now() - antiCollusionCooldownDays * 24 * 60 * 60 * 1000);

  // 1. Find all inspectors who conducted or were assigned inspections for this institution within cooldown window
  const recentAssignments = await prisma.inspectionAssignment.findMany({
    where: {
      inspection: { institutionId },
      assignedAt: { gte: cooldownDate },
      status: { in: ["ACCEPTED", "PENDING", "REASSIGNED"] },
    },
    select: { inspectorId: true },
  });

  const excludedInspectorIds = new Set(recentAssignments.map((a) => a.inspectorId));

  // 2. Query active inspectors with profile
  const baseWhere = {
    role: "INSPECTOR",
    isActive: true,
    deletedAt: null,
    inspectorProfile: {
      is: {
        status: { in: ["AVAILABLE", "ON_DUTY"] },
      },
    },
  };

  // First try matching district
  let candidateInspectors = [];
  if (district) {
    candidateInspectors = await prisma.user.findMany({
      where: {
        ...baseWhere,
        OR: [
          { district: { equals: district, mode: "insensitive" } },
          {
            inspectorProfile: {
              is: {
                assignedDistrict: { equals: district, mode: "insensitive" },
              },
            },
          },
        ],
      },
      include: {
        inspectorProfile: true,
        assignedInspections: {
          where: {
            status: { in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"] },
          },
          select: { id: true },
        },
      },
    });
  }

  // Fallback to state pool if no candidates in district
  if (candidateInspectors.length === 0 && state) {
    candidateInspectors = await prisma.user.findMany({
      where: {
        ...baseWhere,
        state: { equals: state, mode: "insensitive" },
      },
      include: {
        inspectorProfile: true,
        assignedInspections: {
          where: {
            status: { in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"] },
          },
          select: { id: true },
        },
      },
    });
  }

  // Fallback to national pool if still no candidates
  if (candidateInspectors.length === 0) {
    candidateInspectors = await prisma.user.findMany({
      where: baseWhere,
      include: {
        inspectorProfile: true,
        assignedInspections: {
          where: {
            status: { in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"] },
          },
          select: { id: true },
        },
      },
    });
  }

  // 3. Filter out anti-collusion excluded inspectors
  const eligibleCandidates = candidateInspectors.filter(
    (inspector) => !excludedInspectorIds.has(inspector.id)
  );

  // 4. Score / rank candidates by current active workload (ascending)
  eligibleCandidates.sort((a, b) => {
    const activeA = a.assignedInspections ? a.assignedInspections.length : 0;
    const activeB = b.assignedInspections ? b.assignedInspections.length : 0;
    if (activeA !== activeB) return activeA - activeB;
    return (a.inspectorProfile?.totalInspectionsConducted || 0) - (b.inspectorProfile?.totalInspectionsConducted || 0);
  });

  return {
    eligibleCandidates,
    totalPoolSize: candidateInspectors.length,
    antiCollusionExcludedCount: candidateInspectors.length - eligibleCandidates.length,
    isStateFallback: candidateInspectors.length > 0 && candidateInspectors[0].district?.toLowerCase() !== district?.toLowerCase(),
  };
};

/**
 * Deterministically select a candidate inspector using the cryptographic algorithmSeed
 */
export const selectCandidateBySeed = (candidates, seed) => {
  if (!candidates || candidates.length === 0) return null;
  // If only 1 candidate, return it
  if (candidates.length === 1) return candidates[0];

  // Take top candidates with the lowest workload (e.g. within 1 inspection of minimum)
  const minWorkload = candidates[0].assignedInspections ? candidates[0].assignedInspections.length : 0;
  const topTierCandidates = candidates.filter(
    (c) => (c.assignedInspections ? c.assignedInspections.length : 0) <= minWorkload + 1
  );

  // Convert hex seed to integer modulo candidate list length
  const seedNum = parseInt(seed.slice(0, 8), 16);
  const selectedIndex = Math.abs(seedNum) % topTierCandidates.length;

  return topTierCandidates[selectedIndex];
};

export class JitService {
  /**
   * JIT Dispatch a single Planned/Assigned Inspection
   */
  async jitDispatchInspection(inspectionId, options = {}, currentUser = null, reqMeta = {}) {
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: {
        institution: true,
        currentInspector: { select: safeUserSelect },
      },
    });

    if (!inspection) {
      throw new ApiError(404, "Inspection record not found");
    }

    if (currentUser) {
      enforceInspectionAccess(inspection, currentUser);
    }

    if (!["PLANNED", "ASSIGNED"].includes(inspection.status)) {
      throw new ApiError(
        400,
        `Cannot JIT dispatch inspection in '${inspection.status}' status. Must be PLANNED or ASSIGNED.`
      );
    }

    const {
      antiCollusionCooldownDays = 90,
      allowFallbackToStatePool = false,
      algorithmSeedOverride = null,
      assignmentMethod = "RANDOM_AUTOMATED",
    } = options;

    const { eligibleCandidates, totalPoolSize, antiCollusionExcludedCount, isStateFallback } =
      await findEligibleInspectors({
        institutionId: inspection.institutionId,
        state: inspection.institution.state,
        district: inspection.institution.district,
        antiCollusionCooldownDays,
        allowFallbackToStatePool,
      });

    if (eligibleCandidates.length === 0) {
      throw new ApiError(
        409,
        `No eligible inspectors available in ${inspection.institution.district} meeting anti-collusion rules (${antiCollusionCooldownDays} days cooldown). Total pool: ${totalPoolSize}, Excluded for anti-collusion: ${antiCollusionExcludedCount}.`
      );
    }

    const algorithmSeed =
      algorithmSeedOverride ||
      generateAlgorithmSeed(
        inspection.id,
        inspection.institutionId,
        inspection.scheduledDate || new Date()
      );

    const selectedInspector = selectCandidateBySeed(eligibleCandidates, algorithmSeed);

    const assignedById = currentUser ? currentUser.id : inspection.assignedById;

    // Perform atomic transaction
    const result = await prisma.$transaction(
      async (tx) => {
        // Mark previous pending/accepted assignments as REASSIGNED
        await tx.inspectionAssignment.updateMany({
          where: {
            inspectionId: inspection.id,
            status: { in: ["PENDING", "ACCEPTED"] },
          },
          data: {
            status: "REASSIGNED",
            respondedAt: new Date(),
          },
        });

        // Create new randomized InspectionAssignment
        const assignment = await tx.inspectionAssignment.create({
          data: {
            inspectionId: inspection.id,
            inspectorId: selectedInspector.id,
            assignedById: assignedById || null,
            assignmentMethod,
            algorithmSeed,
            status: "PENDING",
          },
          include: {
            inspector: { select: safeUserSelect },
            assignedBy: { select: safeUserSelect },
          },
        });

        // Update Inspection
        const updatedInspection = await tx.inspection.update({
          where: { id: inspection.id },
          data: {
            currentInspectorId: selectedInspector.id,
            assignedById: assignedById || null,
            status: "ASSIGNED",
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
            currentInspector: { select: safeUserSelect },
            assignedBy: { select: safeUserSelect },
          },
        });

        return { updatedInspection, assignment };
      },
      { maxWait: 15000, timeout: 30000 }
    );

    // Invalidate caches
    await invalidateInspectionCaches(inspection.id, inspection.institutionId);

    // Publish WebSocket Events
    await eventPublisher.publishInspectionEvent(WS_EVENTS.INSPECTION_ASSIGNED, result.updatedInspection);
    await eventPublisher.notifyUser(selectedInspector.id, {
      title: "New Automated JIT Inspection Assigned",
      message: `You have been randomly dispatched for inspection ${result.updatedInspection.inspectionCode} at ${result.updatedInspection.institution.name}.`,
      type: "INSPECTION_ASSIGNMENT",
      inspectionId: inspection.id,
    });

    // Record Audit Log
    await recordAuditLog({
      actorUserId: currentUser ? currentUser.id : null,
      action: "INSPECTOR_JIT_DISPATCHED",
      entityType: "Inspection",
      entityId: inspection.id,
      newValues: {
        inspectorId: selectedInspector.id,
        assignmentMethod,
        algorithmSeed,
        antiCollusionCooldownDays,
        totalEligibleCandidates: eligibleCandidates.length,
        isStateFallback,
      },
      ipAddress: reqMeta.ip || null,
      userAgent: reqMeta.userAgent || null,
    });

    return {
      inspection: result.updatedInspection,
      assignment: result.assignment,
      algorithmSeed,
      metrics: {
        eligibleCandidatesCount: eligibleCandidates.length,
        totalDistrictPool: totalPoolSize,
        antiCollusionExcludedCount,
        isStateFallback,
      },
    };
  }

  /**
   * Trigger a Surprise Inspection from AI Risk Detection with Immediate JIT Dispatch
   */
  async triggerSurpriseInspectionFromRisk(institutionId, options = {}, currentUser = null, reqMeta = {}) {
    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
    });

    if (!institution) {
      throw new ApiError(404, "Institution not found");
    }

    if (currentUser) {
      enforceInspectionAccess({ institutionId, institution }, currentUser);
    }

    // Check if an active surprise or scheduled inspection already exists
    const activeInspection = await prisma.inspection.findFirst({
      where: {
        institutionId,
        status: { in: ["PLANNED", "ASSIGNED", "ACCEPTED", "IN_PROGRESS"] },
      },
      include: {
        currentInspector: { select: safeUserSelect },
      },
    });

    if (activeInspection) {
      return {
        isNew: false,
        message: `An active inspection (${activeInspection.inspectionCode}, status: ${activeInspection.status}) is already underway for ${institution.name}.`,
        inspection: activeInspection,
      };
    }

    const inspectionCode = generateSurpriseInspectionCode();
    const today = new Date();

    // Create Surprise Inspection
    const newInspection = await prisma.inspection.create({
      data: {
        inspectionCode,
        institutionId: institution.id,
        type: "SURPRISE",
        status: "PLANNED",
        scheduledDate: today,
        riskLevelAtInspection: institution.latestRiskLevel || "HIGH",
        assignedById: currentUser ? currentUser.id : null,
        remarks: options.remarks || "Auto-triggered surprise inspection by AI Risk Engine",
      },
      include: {
        institution: true,
      },
    });

    await eventPublisher.publishInspectionEvent(WS_EVENTS.INSPECTION_CREATED, newInspection);

    // Immediately execute JIT Dispatch with RISK_TRIGGERED method
    const dispatchResult = await this.jitDispatchInspection(
      newInspection.id,
      {
        ...options,
        assignmentMethod: "RISK_TRIGGERED",
      },
      currentUser,
      reqMeta
    );

    // Record Audit Log
    await recordAuditLog({
      actorUserId: currentUser ? currentUser.id : null,
      action: "SURPRISE_INSPECTION_AUTO_TRIGGERED",
      entityType: "Inspection",
      entityId: newInspection.id,
      newValues: {
        institutionId: institution.id,
        inspectionCode,
        assignedInspectorId: dispatchResult.assignment.inspectorId,
        riskLevel: institution.latestRiskLevel,
      },
      ipAddress: reqMeta.ip || null,
      userAgent: reqMeta.userAgent || null,
    });

    return {
      isNew: true,
      inspection: dispatchResult.inspection,
      assignment: dispatchResult.assignment,
      algorithmSeed: dispatchResult.algorithmSeed,
      metrics: dispatchResult.metrics,
    };
  }

  /**
   * Run Batch JIT Dispatch for all pending planned inspections in a target window
   */
  async runBatchJitDispatch(filter = {}, currentUser = null, reqMeta = {}) {
    const {
      targetDate = new Date().toISOString().slice(0, 10),
      state,
      district,
      antiCollusionCooldownDays = 90,
      allowFallbackToStatePool = false,
    } = filter;

    const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
    const endOfDay = new Date(`${targetDate}T23:59:59.999Z`);

    const where = {
      status: "PLANNED",
      scheduledDate: { gte: startOfDay, lte: endOfDay },
    };

    if (state || district) {
      where.institution = {};
      if (state) where.institution.state = { equals: state, mode: "insensitive" };
      if (district) where.institution.district = { equals: district, mode: "insensitive" };
    }

    const pendingInspections = await prisma.inspection.findMany({
      where,
      include: { institution: true },
    });

    const results = {
      totalFound: pendingInspections.length,
      dispatchedCount: 0,
      failedCount: 0,
      dispatches: [],
      errors: [],
    };

    for (const insp of pendingInspections) {
      try {
        const dispatch = await this.jitDispatchInspection(
          insp.id,
          { antiCollusionCooldownDays, allowFallbackToStatePool },
          currentUser,
          reqMeta
        );
        results.dispatchedCount += 1;
        results.dispatches.push({
          inspectionId: insp.id,
          inspectionCode: insp.inspectionCode,
          inspectorId: dispatch.assignment.inspectorId,
          inspectorName: dispatch.assignment.inspector.fullName,
          algorithmSeed: dispatch.algorithmSeed,
        });
      } catch (err) {
        results.failedCount += 1;
        results.errors.push({
          inspectionId: insp.id,
          inspectionCode: insp.inspectionCode,
          institution: insp.institution.name,
          error: err.message,
        });
      }
    }

    return results;
  }
}

export const jitService = new JitService();
export default jitService;
