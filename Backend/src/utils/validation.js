import { z } from "zod";
import { ApiError } from "./apiError.js";

const institutionTypes = [
  "SENIOR_CITIZEN_HOME",
  "DE_ADDICTION_CENTRE",
  "RESIDENTIAL_HOSTEL_SC_OBC",
  "DIVYANGJAN_REHAB_CENTRE",
  "NGO_AIDED_CENTRE",
  "OTHER",
];

const institutionStatuses = ["ACTIVE", "SUSPENDED", "UNDER_SCRUTINY", "CLOSED"];
const riskLevels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

/**
 * UUID Validation
 */
export const uuidSchema = z.string().uuid("Invalid UUID format");

/**
 * Login Input Validation Schema
 */
export const loginSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .email("Invalid email format"),
  password: z
    .string({ required_error: "Password is required" })
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password exceeds maximum length"),
});

/**
 * Institution List Query Parameters Schema
 */
export const institutionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  state: z.string().trim().optional(),
  district: z.string().trim().optional(),
  type: z.enum(institutionTypes, { errorMap: () => ({ message: "Invalid institution type" }) }).optional(),
  status: z.enum(institutionStatuses, { errorMap: () => ({ message: "Invalid institution status" }) }).optional(),
  riskLevel: z.enum(riskLevels, { errorMap: () => ({ message: "Invalid risk level" }) }).optional(),
  sortBy: z.enum(["name", "code", "createdAt", "latestRiskScore", "capacity", "currentOccupancy"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * Create Institution Schema
 */
export const createInstitutionSchema = z.object({
  code: z
    .string({ required_error: "Institution code is required" })
    .trim()
    .min(3, "Institution code must be at least 3 characters")
    .max(50, "Institution code cannot exceed 50 characters"),
  name: z
    .string({ required_error: "Institution name is required" })
    .trim()
    .min(3, "Institution name must be at least 3 characters")
    .max(255),
  type: z.enum(institutionTypes, {
    required_error: "Institution type is required",
    errorMap: () => ({ message: "Invalid institution type" }),
  }),
  registrationNumber: z
    .string({ required_error: "Registration number is required" })
    .trim()
    .min(3, "Registration number must be at least 3 characters")
    .max(100),
  address: z
    .string({ required_error: "Address is required" })
    .trim()
    .min(5, "Address must be at least 5 characters"),
  state: z
    .string({ required_error: "State is required" })
    .trim()
    .min(2, "State must be at least 2 characters")
    .max(100),
  district: z
    .string({ required_error: "District is required" })
    .trim()
    .min(2, "District must be at least 2 characters")
    .max(100),
  pincode: z
    .string({ required_error: "Pincode is required" })
    .trim()
    .regex(/^\d{6}$/, "Pincode must be a 6-digit number"),
  latitude: z.coerce
    .number({ required_error: "Latitude is required" })
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z.coerce
    .number({ required_error: "Longitude is required" })
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  geofenceRadiusMeters: z.coerce.number().int().min(50).max(2000).default(150),
  contactPerson: z
    .string({ required_error: "Contact person is required" })
    .trim()
    .min(2, "Contact person must be at least 2 characters")
    .max(150),
  contactPhone: z
    .string({ required_error: "Contact phone is required" })
    .trim()
    .min(8, "Contact phone must be at least 8 digits")
    .max(20),
  contactEmail: z.string().trim().email("Invalid contact email").optional().nullable(),
  capacity: z.coerce.number().int().min(0, "Capacity cannot be negative").default(0),
  currentOccupancy: z.coerce.number().int().min(0, "Current occupancy cannot be negative").default(0),
  status: z.enum(institutionStatuses).default("ACTIVE"),
  isAidedByGovt: z.boolean().default(true),
});

/**
 * Update Institution Schema
 */
export const updateInstitutionSchema = createInstitutionSchema.partial();

/**
 * Link Scheme Schema
 */
export const linkSchemeSchema = z.object({
  schemeId: z.string({ required_error: "Scheme ID is required" }).uuid("Invalid Scheme ID format"),
  grantSanctionedAmount: z.coerce.number().min(0, "Grant amount cannot be negative").default(0),
  grantYear: z
    .string({ required_error: "Grant year is required" })
    .trim()
    .regex(/^\d{4}-\d{4}$|^\d{4}$/, "Grant year must be in format YYYY-YYYY or YYYY (e.g. 2025-2026)"),
  approvalStatus: z.string().trim().max(50).default("SANCTIONED"),
});

// Inspection & Assignment Enums exactly matching schema.prisma
const inspectionTypes = ["SCHEDULED", "SURPRISE", "FOLLOW_UP", "COMPLAINT_DRIVEN"];
const inspectionStatuses = [
  "PLANNED",
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "COMPLETED",
  "REPORT_SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];
const assignmentMethods = ["RANDOM_AUTOMATED", "MANUAL_DISPATCH", "RISK_TRIGGERED"];
const assignmentStatuses = ["PENDING", "ACCEPTED", "DECLINED", "REASSIGNED"];
const inspectorStatuses = ["AVAILABLE", "ON_DUTY", "ON_LEAVE", "INACTIVE"];

/**
 * Inspection List Query Parameters Schema
 */
export const inspectionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(inspectionStatuses, { errorMap: () => ({ message: "Invalid inspection status" }) }).optional(),
  type: z.enum(inspectionTypes, { errorMap: () => ({ message: "Invalid inspection type" }) }).optional(),
  institutionId: z.string().uuid("Invalid Institution ID").optional(),
  inspectorId: z.string().uuid("Invalid Inspector ID").optional(),
  state: z.string().trim().optional(),
  district: z.string().trim().optional(),
  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Scheduled date must be in YYYY-MM-DD format")
    .optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format")
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format")
    .optional(),
  search: z.string().trim().optional(),
  sortBy: z.enum(["scheduledDate", "createdAt", "status", "type", "overallScore"]).default("scheduledDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * Create Inspection Schema
 */
export const createInspectionSchema = z.object({
  institutionId: z.string({ required_error: "Institution ID is required" }).uuid("Invalid Institution ID format"),
  type: z.enum(inspectionTypes, {
    required_error: "Inspection type is required",
    errorMap: () => ({ message: "Invalid inspection type" }),
  }).default("SCHEDULED"),
  scheduledDate: z
    .string({ required_error: "Scheduled date is required (YYYY-MM-DD)" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Scheduled date must be in YYYY-MM-DD format"),
  remarks: z.string().trim().max(2000).optional(),
});

/**
 * Update Inspection Schema
 */
export const updateInspectionSchema = z.object({
  type: z.enum(inspectionTypes, { errorMap: () => ({ message: "Invalid inspection type" }) }).optional(),
  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Scheduled date must be in YYYY-MM-DD format")
    .optional(),
  remarks: z.string().trim().max(2000).optional(),
});

/**
 * Assign Inspector Schema
 */
export const assignInspectorSchema = z.object({
  inspectorId: z.string({ required_error: "Inspector ID is required" }).uuid("Invalid Inspector ID format"),
});

/**
 * Reject Assignment Schema
 */
export const rejectAssignmentSchema = z.object({
  declineReason: z
    .string({ required_error: "Decline reason is required" })
    .trim()
    .min(3, "Decline reason must be at least 3 characters")
    .max(1000, "Decline reason cannot exceed 1000 characters"),
});

/**
 * Eligible Inspectors Query Schema
 */
export const eligibleInspectorsQuerySchema = z.object({
  institutionId: z.string().uuid("Invalid Institution ID").optional(),
  district: z.string().trim().optional(),
  state: z.string().trim().optional(),
});

// GPS Verification Types exactly matching schema.prisma
const gpsVerificationTypes = ["CHECK_IN", "CHECK_OUT", "INTERMEDIATE_PING"];

// Media Enums exactly matching schema.prisma
export const mediaTypes = ["IMAGE", "VIDEO", "DOCUMENT_PDF", "DIGITAL_SIGNATURE"];
export const mediaCategories = [
  "KITCHEN_FOOD",
  "WASHROOM_SANITATION",
  "DORMITORY",
  "FIRE_SAFETY",
  "ATTENDANCE_REGISTER",
  "SUPERINTENDENT_SIGNATURE",
  "INSPECTOR_SIGNATURE",
  "GENERAL",
];

/**
 * GPS Verification Submission Schema
 */
export const gpsVerificationSchema = z.object({
  latitude: z.coerce
    .number({ required_error: "Latitude is required" })
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z.coerce
    .number({ required_error: "Longitude is required" })
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  accuracyMeters: z.coerce
    .number()
    .min(0, "Accuracy cannot be negative")
    .max(5000, "Accuracy exceeds maximum reasonable threshold")
    .default(10),
  verificationType: z
    .enum(gpsVerificationTypes, {
      errorMap: () => ({ message: "Invalid verification type. Must be CHECK_IN, CHECK_OUT, or INTERMEDIATE_PING" }),
    })
    .default("CHECK_IN"),
  deviceInfo: z.string().trim().max(255).optional(),
});

/**
 * Evidence Upload Schema
 */
export const uploadEvidenceSchema = z.object({
  category: z
    .enum(mediaCategories, {
      errorMap: () => ({
        message: `Invalid category. Must be one of: ${mediaCategories.join(", ")}`,
      }),
    })
    .default("GENERAL"),
  mediaType: z
    .enum(mediaTypes, {
      errorMap: () => ({
        message: `Invalid mediaType. Must be one of: ${mediaTypes.join(", ")}`,
      }),
    })
    .optional(),
  checklistItemId: z.string().uuid("Invalid checklistItemId format").optional().nullable(),
  latitude: z.coerce
    .number({ required_error: "Latitude is required for evidence geo-tagging" })
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z.coerce
    .number({ required_error: "Longitude is required for evidence geo-tagging" })
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  capturedAt: z.coerce.date().optional(),
  isWatermarked: z
    .union([z.boolean(), z.string().transform((v) => v === "true" || v === "1")])
    .default(true),
});

/**
 * Evidence Query Filter Schema
 */
export const evidenceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  category: z.enum(mediaCategories).optional(),
  mediaType: z.enum(mediaTypes).optional(),
  checklistItemId: z.string().uuid().optional(),
  sortBy: z.enum(["createdAt", "capturedAt", "fileSizeBytes"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Compliance & Corrective Action Enums exactly matching schema.prisma
export const complianceSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
export const complianceActionStatuses = [
  "PENDING",
  "IN_PROGRESS",
  "SUBMITTED_FOR_REVIEW",
  "VERIFIED_CLOSED",
  "ESCALATED",
];

/**
 * Compliance Action List Query Parameters Schema
 */
export const complianceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(complianceActionStatuses, {
      errorMap: () => ({ message: `Invalid status. Must be one of: ${complianceActionStatuses.join(", ")}` }),
    })
    .optional(),
  severity: z
    .enum(complianceSeverities, {
      errorMap: () => ({ message: `Invalid severity. Must be one of: ${complianceSeverities.join(", ")}` }),
    })
    .optional(),
  institutionId: z.string().uuid("Invalid Institution ID").optional(),
  inspectionId: z.string().uuid("Invalid Inspection ID").optional(),
  assignedToUserId: z.string().uuid("Invalid Assigned User ID").optional(),
  isOverdue: z
    .union([z.boolean(), z.string().transform((v) => v === "true" || v === "1")])
    .optional(),
  state: z.string().trim().optional(),
  district: z.string().trim().optional(),
  search: z.string().trim().optional(),
  sortBy: z.enum(["deadline", "createdAt", "updatedAt", "severity", "status", "title"]).default("deadline"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

/**
 * Create Compliance Action Schema
 */
export const createComplianceActionSchema = z.object({
  institutionId: z.string({ required_error: "Institution ID is required" }).uuid("Invalid Institution ID format"),
  inspectionId: z.string({ required_error: "Inspection ID is required" }).uuid("Invalid Inspection ID format"),
  checklistItemId: z.string().uuid("Invalid Checklist Item ID format").optional().nullable(),
  title: z
    .string({ required_error: "Title is required" })
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(255, "Title cannot exceed 255 characters"),
  description: z
    .string({ required_error: "Description is required" })
    .trim()
    .min(5, "Description must be at least 5 characters"),
  severity: z
    .enum(complianceSeverities, {
      errorMap: () => ({ message: `Invalid severity. Must be one of: ${complianceSeverities.join(", ")}` }),
    })
    .default("MEDIUM"),
  deadline: z
    .string({ required_error: "Deadline date is required" })
    .refine((d) => !isNaN(Date.parse(d)), {
      message: "Deadline must be a valid date format (e.g. YYYY-MM-DD or ISO 8601)",
    }),
  assignedToUserId: z.string().uuid("Invalid Assigned User ID format").optional().nullable(),
});

/**
 * Create Compliance Action From Alert Schema
 */
export const createComplianceFromAlertSchema = z.object({
  alertId: z.string({ required_error: "Alert ID is required" }).uuid("Invalid Alert ID format"),
  inspectionId: z.string().uuid("Invalid Inspection ID format").optional().nullable(),
  checklistItemId: z.string().uuid("Invalid Checklist Item ID format").optional().nullable(),
  title: z.string().trim().min(3).max(255).optional(),
  description: z.string().trim().min(5).optional(),
  severity: z.enum(complianceSeverities).optional(),
  deadline: z
    .string({ required_error: "Deadline date is required" })
    .refine((d) => !isNaN(Date.parse(d)), {
      message: "Deadline must be a valid date format (e.g. YYYY-MM-DD or ISO 8601)",
    }),
  assignedToUserId: z.string().uuid("Invalid Assigned User ID format").optional().nullable(),
});

/**
 * Update Compliance Action Schema (Metadata updates only)
 */
export const updateComplianceActionSchema = z.object({
  title: z.string().trim().min(3).max(255).optional(),
  description: z.string().trim().min(5).optional(),
  severity: z.enum(complianceSeverities).optional(),
  deadline: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), {
      message: "Deadline must be a valid date format (e.g. YYYY-MM-DD or ISO 8601)",
    })
    .optional(),
  checklistItemId: z.string().uuid("Invalid Checklist Item ID format").optional().nullable(),
});

/**
 * Assign Compliance Action Schema
 */
export const assignComplianceActionSchema = z.object({
  assignedToUserId: z
    .string({ required_error: "Assigned User ID is required" })
    .uuid("Invalid Assigned User ID format"),
});

/**
 * Submit Rectification Schema
 */
export const submitRectificationSchema = z.object({
  institutionResponse: z
    .string({ required_error: "Institution response / explanation is required" })
    .trim()
    .min(3, "Institution response must be at least 3 characters"),
  resolutionEvidenceUrl: z
    .string()
    .trim()
    .url("Resolution evidence must be a valid URL")
    .optional()
    .nullable()
    .or(z.literal("")),
});

/**
 * Verify Compliance Action Schema
 */
export const verifyComplianceActionSchema = z.object({
  remarks: z.string().trim().max(2000).optional(),
});

/**
 * Reject Rectification Schema
 */
export const rejectRectificationSchema = z.object({
  rejectionReason: z
    .string({ required_error: "Rejection reason is required" })
    .trim()
    .min(3, "Rejection reason must be at least 3 characters")
    .max(2000, "Rejection reason cannot exceed 2000 characters"),
});

/**
 * Reopen Compliance Action Schema
 */
export const reopenComplianceActionSchema = z.object({
  reopenReason: z
    .string({ required_error: "Reopen reason is required" })
    .trim()
    .min(3, "Reopen reason must be at least 3 characters")
    .max(2000, "Reopen reason cannot exceed 2000 characters"),
});

/**
 * Escalate Compliance Action Schema
 */
export const escalateComplianceActionSchema = z.object({
  escalationReason: z
    .string({ required_error: "Escalation reason is required" })
    .trim()
    .min(3, "Escalation reason must be at least 3 characters")
    .max(2000, "Escalation reason cannot exceed 2000 characters"),
});

// CCTV Device Enums exactly matching schema.prisma
export const cctvStatuses = ["ONLINE", "OFFLINE", "FAULTY"];

/**
 * CCTV Device List Query Parameters Schema
 */
export const cctvQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  institutionId: z.string().uuid("Invalid Institution ID format").optional(),
  status: z
    .enum(cctvStatuses, {
      errorMap: () => ({ message: `Invalid CCTV status. Must be one of: ${cctvStatuses.join(", ")}` }),
    })
    .optional(),
  isAiMonitoringEnabled: z
    .union([z.boolean(), z.string().transform((v) => v === "true" || v === "1")])
    .optional(),
  search: z.string().trim().optional(),
  state: z.string().trim().optional(),
  district: z.string().trim().optional(),
  sortBy: z.enum(["deviceName", "cameraLocation", "status", "lastPingAt", "createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * Create CCTV Device Schema
 */
export const createCctvDeviceSchema = z.object({
  institutionId: z.string({ required_error: "Institution ID is required" }).uuid("Invalid Institution ID format"),
  deviceName: z
    .string({ required_error: "Device name is required" })
    .trim()
    .min(2, "Device name must be at least 2 characters")
    .max(100, "Device name cannot exceed 100 characters"),
  cameraLocation: z
    .string({ required_error: "Camera location is required" })
    .trim()
    .min(2, "Camera location must be at least 2 characters")
    .max(100, "Camera location cannot exceed 100 characters"),
  streamUrl: z
    .string({ required_error: "Stream URL is required" })
    .trim()
    .min(5, "Stream URL must be at least 5 characters")
    .max(1000, "Stream URL cannot exceed 1000 characters"),
  status: z
    .enum(cctvStatuses, {
      errorMap: () => ({ message: `Invalid CCTV status. Must be one of: ${cctvStatuses.join(", ")}` }),
    })
    .default("ONLINE"),
  isAiMonitoringEnabled: z.boolean().default(false),
});

/**
 * Update CCTV Device Metadata Schema
 */
export const updateCctvDeviceSchema = z.object({
  deviceName: z.string().trim().min(2).max(100).optional(),
  cameraLocation: z.string().trim().min(2).max(100).optional(),
  streamUrl: z.string().trim().min(5).max(1000).optional(),
  isAiMonitoringEnabled: z.boolean().optional(),
});

/**
 * Update CCTV Device Status Schema
 */
export const updateCctvStatusSchema = z.object({
  status: z.enum(cctvStatuses, {
    required_error: "Status is required",
    errorMap: () => ({ message: `Invalid CCTV status. Must be one of: ${cctvStatuses.join(", ")}` }),
  }),
});

/**
 * Helper to validate request payload against a Zod schema
 */
export const validateBody = (schema, data) => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues || result.error.errors || [];
    const errorMessages = issues.map((err) => `${err.path.join(".")}: ${err.message}`);
    const firstMessage = errorMessages[0] || "Invalid request payload";
    throw new ApiError(400, firstMessage, errorMessages);
  }
  return result.data;
};

/**
 * Helper to validate query params against a Zod schema
 */
export const validateQuery = (schema, data) => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues || result.error.errors || [];
    const errorMessages = issues.map((err) => `${err.path.join(".")}: ${err.message}`);
    const firstMessage = errorMessages[0] || "Invalid query parameters";
    throw new ApiError(400, firstMessage, errorMessages);
  }
  return result.data;
};

/**
 * Validate UUID string
 */
export const validateUuid = (id, paramName = "ID") => {
  const result = uuidSchema.safeParse(id);
  if (!result.success) {
    throw new ApiError(400, `Invalid ${paramName} format. Must be a valid UUID.`);
  }
  return id;
};

