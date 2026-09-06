import crypto from "crypto";
import { prisma } from "../config/db.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary.js";
import { ApiError } from "../utils/apiError.js";
import { recordAuditLog } from "../utils/audit.js";

/**
 * Format Evidence record safely for API responses
 * Serializes BigInt fileSizeBytes to string to avoid JSON serialization crash
 */
export const formatEvidence = (evidence) => {
  if (!evidence) return null;
  return {
    ...evidence,
    fileSizeBytes: evidence.fileSizeBytes !== undefined && evidence.fileSizeBytes !== null
      ? evidence.fileSizeBytes.toString()
      : null,
    latitude: evidence.latitude !== undefined && evidence.latitude !== null
      ? Number(evidence.latitude)
      : null,
    longitude: evidence.longitude !== undefined && evidence.longitude !== null
      ? Number(evidence.longitude)
      : null,
    aiSanitationScore: evidence.aiSanitationScore !== undefined && evidence.aiSanitationScore !== null
      ? Number(evidence.aiSanitationScore)
      : null,
    aiConfidence: evidence.aiConfidence !== undefined && evidence.aiConfidence !== null
      ? Number(evidence.aiConfidence)
      : null,
  };
};

/**
 * Helper to map MIME type and category to MediaType enum
 */
const inferMediaType = (mimetype = "", category = "GENERAL", explicitType = null) => {
  if (explicitType) return explicitType;
  const mime = mimetype.toLowerCase();

  if (category === "SUPERINTENDENT_SIGNATURE" || category === "INSPECTOR_SIGNATURE") {
    return "DIGITAL_SIGNATURE";
  }
  if (mime.startsWith("video/")) {
    return "VIDEO";
  }
  if (mime === "application/pdf") {
    return "DOCUMENT_PDF";
  }
  return "IMAGE";
};

/**
 * Helper to check geographic / role scoping for an institution
 */
const checkInstitutionScope = (institution, user) => {
  if (!institution) return false;
  if (user.role === "ADMIN") return true;

  if (user.role === "STATE_OFFICER") {
    return institution.state?.toLowerCase() === user.state?.toLowerCase();
  }

  if (user.role === "DISTRICT_OFFICER") {
    return (
      institution.state?.toLowerCase() === user.state?.toLowerCase() &&
      institution.district?.toLowerCase() === user.district?.toLowerCase()
    );
  }

  if (user.role === "INSTITUTION_USER") {
    return institution.id === user.institutionId;
  }

  if (user.role === "INSPECTOR") {
    return (
      !user.state ||
      institution.state?.toLowerCase() === user.state?.toLowerCase()
    );
  }

  return false;
};

/**
 * Upload and Persist Evidence for an Inspection
 */
export const uploadInspectionEvidence = async (inspectionId, file, data, user, reqMeta = {}) => {
  if (!file || !file.buffer) {
    throw new ApiError(400, "Evidence file is required for upload");
  }

  // 1. Validate Inspection exists
  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: {
      institution: true,
      currentInspector: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });

  if (!inspection) {
    throw new ApiError(404, "Inspection not found");
  }

  // 2. Validate Lifecycle State (cannot upload to COMPLETED or CANCELLED)
  const invalidStates = ["COMPLETED", "CANCELLED", "REPORT_SUBMITTED", "APPROVED", "REJECTED"];
  if (invalidStates.includes(inspection.status)) {
    throw new ApiError(
      400,
      `Cannot upload evidence for inspection in ${inspection.status} status. Evidence must be captured during an active inspection.`
    );
  }

  // 3. Authorization Check
  if (user.role === "INSPECTOR") {
    if (inspection.currentInspectorId !== user.id) {
      throw new ApiError(
        403,
        "You are not the assigned inspector for this inspection. Only the currently assigned inspector can upload field evidence."
      );
    }
  } else if (user.role !== "ADMIN") {
    throw new ApiError(403, "Only the assigned inspector or an administrator can upload inspection evidence");
  }

  // 4. Validate Checklist Item if supplied
  if (data.checklistItemId) {
    const checklistItem = await prisma.checklistItem.findUnique({
      where: { id: data.checklistItemId },
    });
    if (!checklistItem) {
      throw new ApiError(400, "Referenced checklist item not found");
    }
  }

  // 5. Generate SHA-256 Hash of original file buffer
  const fileHash = crypto.createHash("sha256").update(file.buffer).digest("hex");

  // 6. Infer MediaType
  const mediaType = inferMediaType(file.mimetype, data.category, data.mediaType);

  // 7. Authoritative Captured Timestamp (cannot be in the future)
  let capturedAt = new Date();
  if (data.capturedAt) {
    const clientDate = new Date(data.capturedAt);
    if (!isNaN(clientDate.getTime()) && clientDate <= new Date()) {
      capturedAt = clientDate;
    }
  }

  // 8. Upload to Cloudinary Stream
  const categoryFolder = data.category || "GENERAL";
  const folder = `smartinspect/inspections/${inspectionId}/${categoryFolder}`;
  const randomSuffix = crypto.randomBytes(4).toString("hex");
  const publicId = `evidence_${Date.now()}_${randomSuffix}`;

  let uploadResult;
  try {
    uploadResult = await uploadToCloudinary(file.buffer, {
      folder,
      public_id: publicId,
      resource_type: "auto",
      mimetype: file.mimetype,
    });
  } catch (cloudErr) {
    console.error("Cloudinary upload error:", cloudErr);
    throw new ApiError(500, "Failed to upload media to Cloudinary storage");
  }

  // 9. Persist Evidence DB Record with compensating Cloudinary cleanup on failure
  let evidenceRecord;
  try {
    evidenceRecord = await prisma.evidence.create({
      data: {
        inspectionId,
        checklistItemId: data.checklistItemId || null,
        inspectorId: user.id,
        mediaType,
        category: data.category || "GENERAL",
        cloudinaryPublicId: uploadResult.public_id,
        cloudinaryUrl: uploadResult.url || uploadResult.secure_url,
        secureUrl: uploadResult.secure_url || uploadResult.url,
        fileSizeBytes: BigInt(file.size),
        fileHash,
        latitude: data.latitude,
        longitude: data.longitude,
        capturedAt,
        isWatermarked: data.isWatermarked !== undefined ? data.isWatermarked : true,
      },
      include: {
        inspector: {
          select: { id: true, fullName: true, email: true, role: true },
        },
        checklistItem: {
          select: { id: true, category: true, questionText: true },
        },
      },
    });
  } catch (dbErr) {
    console.error("Database persistence error after Cloudinary upload. Cleaning up asset...", dbErr);
    try {
      await deleteFromCloudinary(uploadResult.public_id, uploadResult.resource_type || "image");
    } catch (cleanupErr) {
      console.error("Failed to cleanup orphaned Cloudinary asset:", cleanupErr.message);
    }
    throw new ApiError(500, "Failed to persist evidence record in database");
  }

  // 10. Record AuditLog
  await recordAuditLog({
    actorUserId: user.id,
    action: "EVIDENCE_UPLOADED",
    entityType: "Evidence",
    entityId: evidenceRecord.id,
    newValues: {
      inspectionId,
      mediaType,
      category: evidenceRecord.category,
      fileHash,
      fileSizeBytes: file.size,
      cloudinaryPublicId: uploadResult.public_id,
      latitude: data.latitude,
      longitude: data.longitude,
    },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  return formatEvidence(evidenceRecord);
};

/**
 * Get Evidence List for an Inspection with Scoping & Filtering
 */
export const getInspectionEvidence = async (inspectionId, query = {}, user) => {
  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { institution: true },
  });

  if (!inspection) {
    throw new ApiError(404, "Inspection not found");
  }

  // Check Scope
  if (!checkInstitutionScope(inspection.institution, user)) {
    throw new ApiError(403, "Access forbidden: you do not have permission to view evidence for this inspection");
  }

  const { page = 1, limit = 50, category, mediaType, checklistItemId, sortBy = "createdAt", sortOrder = "desc" } = query;
  const skip = (page - 1) * limit;

  const where = {
    inspectionId,
    ...(category && { category }),
    ...(mediaType && { mediaType }),
    ...(checklistItemId && { checklistItemId }),
  };

  const [total, evidences] = await Promise.all([
    prisma.evidence.count({ where }),
    prisma.evidence.findMany({
      where,
      include: {
        inspector: {
          select: { id: true, fullName: true, email: true, role: true },
        },
        checklistItem: {
          select: { id: true, category: true, questionText: true },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
  ]);

  return {
    evidences: evidences.map(formatEvidence),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get Single Evidence Record by ID with Scoping
 */
export const getEvidenceById = async (evidenceId, user) => {
  const evidence = await prisma.evidence.findUnique({
    where: { id: evidenceId },
    include: {
      inspection: {
        include: { institution: true },
      },
      inspector: {
        select: { id: true, fullName: true, email: true, role: true },
      },
      checklistItem: {
        select: { id: true, category: true, questionText: true },
      },
    },
  });

  if (!evidence) {
    throw new ApiError(404, "Evidence record not found");
  }

  if (!checkInstitutionScope(evidence.inspection.institution, user)) {
    throw new ApiError(403, "Access forbidden: you do not have permission to view this evidence record");
  }

  return formatEvidence(evidence);
};

/**
 * Verify Remote Evidence Integrity by Re-hashing Cloudinary Asset
 */
export const verifyEvidenceIntegrity = async (evidenceId, user, reqMeta = {}) => {
  const evidence = await prisma.evidence.findUnique({
    where: { id: evidenceId },
    include: {
      inspection: {
        include: { institution: true },
      },
    },
  });

  if (!evidence) {
    throw new ApiError(404, "Evidence record not found");
  }

  if (!checkInstitutionScope(evidence.inspection.institution, user)) {
    throw new ApiError(403, "Access forbidden: you do not have permission to verify this evidence");
  }

  if (!evidence.secureUrl) {
    throw new ApiError(400, "Evidence record does not contain a valid media storage URL");
  }

  // Fetch asset from stored Cloudinary delivery URL
  let recalculatedHash;
  try {
    const res = await fetch(evidence.secureUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch media from Cloudinary (HTTP ${res.status})`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    recalculatedHash = crypto.createHash("sha256").update(buffer).digest("hex");
  } catch (fetchErr) {
    console.error(`Error downloading asset for integrity verification (${evidenceId}):`, fetchErr.message);
    throw new ApiError(502, "Unable to retrieve stored evidence media from Cloudinary for integrity verification");
  }

  const integrityVerified = recalculatedHash.toLowerCase() === evidence.fileHash.toLowerCase();

  // Record AuditLog
  await recordAuditLog({
    actorUserId: user.id,
    action: "EVIDENCE_INTEGRITY_CHECKED",
    entityType: "Evidence",
    entityId: evidence.id,
    newValues: {
      integrityVerified,
      storedHash: evidence.fileHash,
      recalculatedHash,
      algorithm: "SHA-256",
    },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  return {
    evidenceId: evidence.id,
    inspectionId: evidence.inspectionId,
    integrityVerified,
    storedHash: evidence.fileHash,
    recalculatedHash,
    algorithm: "SHA-256",
    verifiedAt: new Date().toISOString(),
  };
};

/**
 * Administrative Deletion of Evidence (ADMIN or STATE_OFFICER only)
 */
export const deleteEvidence = async (evidenceId, user, reqMeta = {}) => {
  const evidence = await prisma.evidence.findUnique({
    where: { id: evidenceId },
    include: {
      inspection: {
        include: { institution: true },
      },
    },
  });

  if (!evidence) {
    throw new ApiError(404, "Evidence record not found");
  }

  // Only ADMIN or STATE_OFFICER for their state can administratively delete evidence
  if (user.role !== "ADMIN" && user.role !== "STATE_OFFICER") {
    throw new ApiError(403, "Only administrators or state officers can delete evidence records");
  }

  if (user.role === "STATE_OFFICER" && !checkInstitutionScope(evidence.inspection.institution, user)) {
    throw new ApiError(403, "Access forbidden: you can only delete evidence within your state jurisdiction");
  }

  // 1. Delete from Cloudinary
  try {
    const resourceType = evidence.mediaType === "VIDEO" ? "video" : "image";
    await deleteFromCloudinary(evidence.cloudinaryPublicId, resourceType);
  } catch (cloudErr) {
    console.warn(`Warning: Failed to delete Cloudinary asset ${evidence.cloudinaryPublicId}:`, cloudErr.message);
  }

  // 2. Delete from DB
  await prisma.evidence.delete({
    where: { id: evidenceId },
  });

  // 3. Record AuditLog
  await recordAuditLog({
    actorUserId: user.id,
    action: "EVIDENCE_DELETED",
    entityType: "Evidence",
    entityId: evidenceId,
    oldValues: {
      inspectionId: evidence.inspectionId,
      fileHash: evidence.fileHash,
      cloudinaryPublicId: evidence.cloudinaryPublicId,
      mediaType: evidence.mediaType,
      category: evidence.category,
    },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  });

  return {
    deleted: true,
    evidenceId,
    message: "Evidence record and associated Cloudinary asset removed successfully",
  };
};
