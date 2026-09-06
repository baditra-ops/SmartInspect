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

