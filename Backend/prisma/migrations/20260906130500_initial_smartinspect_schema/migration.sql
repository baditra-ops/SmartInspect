-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STATE_OFFICER', 'DISTRICT_OFFICER', 'INSPECTOR', 'INSTITUTION_USER');

-- CreateEnum
CREATE TYPE "InspectorStatus" AS ENUM ('AVAILABLE', 'ON_DUTY', 'ON_LEAVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('SENIOR_CITIZEN_HOME', 'DE_ADDICTION_CENTRE', 'RESIDENTIAL_HOSTEL_SC_OBC', 'DIVYANGJAN_REHAB_CENTRE', 'NGO_AIDED_CENTRE', 'OTHER');

-- CreateEnum
CREATE TYPE "InstitutionStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'UNDER_SCRUTINY', 'CLOSED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('SCHEDULED', 'SURPRISE', 'FOLLOW_UP', 'COMPLAINT_DRIVEN');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('PLANNED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REPORT_SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssignmentMethod" AS ENUM ('RANDOM_AUTOMATED', 'MANUAL_DISPATCH', 'RISK_TRIGGERED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REASSIGNED');

-- CreateEnum
CREATE TYPE "GpsVerificationType" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'INTERMEDIATE_PING');

-- CreateEnum
CREATE TYPE "ChecklistCategory" AS ENUM ('INFRASTRUCTURE', 'HYGIENE_SANITATION', 'FOOD_NUTRITION', 'MEDICAL_CARE', 'SAFETY_FIRE', 'STAFF_BENEFICIARY_RATIO', 'DOCUMENT_REGISTERS');

-- CreateEnum
CREATE TYPE "ResponseOption" AS ENUM ('PASS', 'FAIL', 'NA');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT_PDF', 'DIGITAL_SIGNATURE');

-- CreateEnum
CREATE TYPE "MediaCategory" AS ENUM ('KITCHEN_FOOD', 'WASHROOM_SANITATION', 'DORMITORY', 'FIRE_SAFETY', 'ATTENDANCE_REGISTER', 'SUPERINTENDENT_SIGNATURE', 'INSPECTOR_SIGNATURE', 'GENERAL');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('COMPLIANT', 'PARTIALLY_COMPLIANT', 'NON_COMPLIANT');

-- CreateEnum
CREATE TYPE "ComplianceActionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED_FOR_REVIEW', 'VERIFIED_CLOSED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "CctvStatus" AS ENUM ('ONLINE', 'OFFLINE', 'FAULTY');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "fullName" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'INSPECTOR',
    "state" VARCHAR(100),
    "district" VARCHAR(100),
    "institutionId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectorProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "badgeNumber" VARCHAR(50) NOT NULL,
    "designation" VARCHAR(100) NOT NULL,
    "assignedDistrict" VARCHAR(100) NOT NULL,
    "status" "InspectorStatus" NOT NULL DEFAULT 'AVAILABLE',
    "totalInspectionsConducted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Institution" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "InstitutionType" NOT NULL,
    "registrationNumber" VARCHAR(100) NOT NULL,
    "address" TEXT NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "district" VARCHAR(100) NOT NULL,
    "pincode" VARCHAR(10) NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "geofenceRadiusMeters" INTEGER NOT NULL DEFAULT 150,
    "contactPerson" VARCHAR(150) NOT NULL,
    "contactPhone" VARCHAR(20) NOT NULL,
    "contactEmail" VARCHAR(255),
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "currentOccupancy" INTEGER NOT NULL DEFAULT 0,
    "status" "InstitutionStatus" NOT NULL DEFAULT 'ACTIVE',
    "latestRiskScore" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "latestRiskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "isAidedByGovt" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scheme" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "sponsoringDepartment" VARCHAR(200) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionScheme" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "schemeId" UUID NOT NULL,
    "grantSanctionedAmount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "grantYear" VARCHAR(10) NOT NULL,
    "approvalStatus" VARCHAR(50) NOT NULL DEFAULT 'SANCTIONED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beneficiary" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "schemeId" UUID,
    "enrollmentNumber" VARCHAR(50) NOT NULL,
    "fullName" VARCHAR(150) NOT NULL,
    "gender" VARCHAR(20) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "age" INTEGER NOT NULL,
    "admissionDate" DATE NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ENROLLED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionAttendance" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "attendanceDate" DATE NOT NULL,
    "totalPresent" INTEGER NOT NULL,
    "totalEnrolled" INTEGER NOT NULL,
    "verifiedByInspectionId" UUID,
    "anomalyFlag" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" UUID NOT NULL,
    "inspectionCode" VARCHAR(50) NOT NULL,
    "institutionId" UUID NOT NULL,
    "currentInspectorId" UUID,
    "assignedById" UUID,
    "type" "InspectionType" NOT NULL DEFAULT 'SCHEDULED',
    "status" "InspectionStatus" NOT NULL DEFAULT 'PLANNED',
    "scheduledDate" DATE NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "overallScore" DECIMAL(5,2),
    "complianceStatus" "ComplianceStatus",
    "riskLevelAtInspection" "RiskLevel",
    "isGeofenceVerified" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionAssignment" (
    "id" UUID NOT NULL,
    "inspectionId" UUID NOT NULL,
    "inspectorId" UUID NOT NULL,
    "assignedById" UUID,
    "assignmentMethod" "AssignmentMethod" NOT NULL DEFAULT 'RANDOM_AUTOMATED',
    "algorithmSeed" VARCHAR(100),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "declineReason" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "InspectionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GpsVerification" (
    "id" UUID NOT NULL,
    "inspectionId" UUID NOT NULL,
    "inspectorId" UUID NOT NULL,
    "verificationType" "GpsVerificationType" NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "accuracyMeters" DECIMAL(6,2) NOT NULL,
    "distanceFromInstitutionMeters" DECIMAL(8,2) NOT NULL,
    "isWithinGeofence" BOOLEAN NOT NULL,
    "deviceInfo" VARCHAR(255),
    "tamperFlag" BOOLEAN NOT NULL DEFAULT false,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GpsVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "institutionType" "InstitutionType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "category" "ChecklistCategory" NOT NULL,
    "questionText" TEXT NOT NULL,
    "guidelines" TEXT,
    "weightage" DECIMAL(4,2) NOT NULL DEFAULT 1.00,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "requiresPhotoEvidence" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionChecklistResponse" (
    "id" UUID NOT NULL,
    "inspectionId" UUID NOT NULL,
    "checklistItemId" UUID NOT NULL,
    "response" "ResponseOption" NOT NULL,
    "scoreAwarded" DECIMAL(4,2) NOT NULL DEFAULT 0.00,
    "inspectorNotes" TEXT,
    "isDeficiency" BOOLEAN NOT NULL DEFAULT false,
    "aiFlaggedAnomaly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionChecklistResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" UUID NOT NULL,
    "inspectionId" UUID NOT NULL,
    "checklistItemId" UUID,
    "inspectorId" UUID NOT NULL,
    "mediaType" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "category" "MediaCategory" NOT NULL DEFAULT 'GENERAL',
    "cloudinaryPublicId" VARCHAR(255) NOT NULL,
    "cloudinaryUrl" TEXT NOT NULL,
    "secureUrl" TEXT NOT NULL,
    "fileSizeBytes" BIGINT NOT NULL,
    "fileHash" VARCHAR(64) NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "isWatermarked" BOOLEAN NOT NULL DEFAULT true,
    "aiSanitationScore" DECIMAL(4,2),
    "aiDamageDetected" BOOLEAN NOT NULL DEFAULT false,
    "aiConfidence" DECIMAL(4,2),
    "aiNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionReport" (
    "id" UUID NOT NULL,
    "inspectionId" UUID NOT NULL,
    "reportNumber" VARCHAR(50) NOT NULL,
    "executiveSummary" TEXT NOT NULL,
    "keyDeficiencies" JSONB,
    "infrastructureScore" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "hygieneScore" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "foodNutritionScore" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "medicalCareScore" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "finalScore" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "inspectorSignatureUrl" TEXT,
    "superintendentSignatureUrl" TEXT,
    "pdfReportUrl" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" UUID,
    "approvalStatus" VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED',

    CONSTRAINT "InspectionReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "assessmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "riskScore" DECIMAL(5,2) NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "factors" JSONB NOT NULL,
    "modelVersion" VARCHAR(50) NOT NULL DEFAULT 'v1.0.0',
    "triggeredBy" VARCHAR(100) NOT NULL DEFAULT 'SCHEDULED_CRON',
    "recommendedAction" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceAction" (
    "id" UUID NOT NULL,
    "inspectionId" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "checklistItemId" UUID,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'MEDIUM',
    "deadline" DATE NOT NULL,
    "status" "ComplianceActionStatus" NOT NULL DEFAULT 'PENDING',
    "assignedToUserId" UUID,
    "createdByUserId" UUID NOT NULL,
    "institutionResponse" TEXT,
    "resolutionEvidenceUrl" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "inspectionId" UUID,
    "alertType" VARCHAR(100) NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'MEDIUM',
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "acknowledgedById" UUID,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CctvDevice" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "deviceName" VARCHAR(100) NOT NULL,
    "cameraLocation" VARCHAR(100) NOT NULL,
    "streamUrl" TEXT NOT NULL,
    "status" "CctvStatus" NOT NULL DEFAULT 'ONLINE',
    "lastPingAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAiMonitoringEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CctvDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "linkUrl" VARCHAR(255),
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" UUID NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(255),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_state_district_idx" ON "User"("role", "state", "district");

-- CreateIndex
CREATE UNIQUE INDEX "InspectorProfile_userId_key" ON "InspectorProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectorProfile_badgeNumber_key" ON "InspectorProfile"("badgeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_code_key" ON "Institution"("code");

-- CreateIndex
CREATE INDEX "Institution_state_district_idx" ON "Institution"("state", "district");

-- CreateIndex
CREATE INDEX "Institution_latestRiskLevel_latestRiskScore_idx" ON "Institution"("latestRiskLevel", "latestRiskScore" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Scheme_code_key" ON "Scheme"("code");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionScheme_institutionId_schemeId_grantYear_key" ON "InstitutionScheme"("institutionId", "schemeId", "grantYear");

-- CreateIndex
CREATE UNIQUE INDEX "Beneficiary_institutionId_enrollmentNumber_key" ON "Beneficiary"("institutionId", "enrollmentNumber");

-- CreateIndex
CREATE INDEX "InstitutionAttendance_institutionId_attendanceDate_idx" ON "InstitutionAttendance"("institutionId", "attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionAttendance_institutionId_attendanceDate_key" ON "InstitutionAttendance"("institutionId", "attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_inspectionCode_key" ON "Inspection"("inspectionCode");

-- CreateIndex
CREATE INDEX "Inspection_status_scheduledDate_idx" ON "Inspection"("status", "scheduledDate");

-- CreateIndex
CREATE INDEX "Inspection_institutionId_createdAt_idx" ON "Inspection"("institutionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Inspection_currentInspectorId_status_idx" ON "Inspection"("currentInspectorId", "status");

-- CreateIndex
CREATE INDEX "InspectionAssignment_inspectorId_status_idx" ON "InspectionAssignment"("inspectorId", "status");

-- CreateIndex
CREATE INDEX "InspectionAssignment_inspectionId_assignedAt_idx" ON "InspectionAssignment"("inspectionId", "assignedAt" DESC);

-- CreateIndex
CREATE INDEX "GpsVerification_inspectionId_verificationType_idx" ON "GpsVerification"("inspectionId", "verificationType");

-- CreateIndex
CREATE INDEX "ChecklistItem_templateId_orderIndex_idx" ON "ChecklistItem"("templateId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionChecklistResponse_inspectionId_checklistItemId_key" ON "InspectionChecklistResponse"("inspectionId", "checklistItemId");

-- CreateIndex
CREATE INDEX "Evidence_inspectionId_category_idx" ON "Evidence"("inspectionId", "category");

-- CreateIndex
CREATE INDEX "Evidence_fileHash_idx" ON "Evidence"("fileHash");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionReport_inspectionId_key" ON "InspectionReport"("inspectionId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionReport_reportNumber_key" ON "InspectionReport"("reportNumber");

-- CreateIndex
CREATE INDEX "RiskAssessment_institutionId_assessmentDate_idx" ON "RiskAssessment"("institutionId", "assessmentDate" DESC);

-- CreateIndex
CREATE INDEX "ComplianceAction_institutionId_status_deadline_idx" ON "ComplianceAction"("institutionId", "status", "deadline");

-- CreateIndex
CREATE INDEX "Alert_status_severity_createdAt_idx" ON "Alert"("status", "severity", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Alert_institutionId_status_idx" ON "Alert"("institutionId", "status");

-- CreateIndex
CREATE INDEX "CctvDevice_institutionId_status_idx" ON "CctvDevice"("institutionId", "status");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_timestamp_idx" ON "AuditLog"("entityType", "entityId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_timestamp_idx" ON "AuditLog"("actorUserId", "timestamp" DESC);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectorProfile" ADD CONSTRAINT "InspectorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionScheme" ADD CONSTRAINT "InstitutionScheme_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionScheme" ADD CONSTRAINT "InstitutionScheme_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beneficiary" ADD CONSTRAINT "Beneficiary_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beneficiary" ADD CONSTRAINT "Beneficiary_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionAttendance" ADD CONSTRAINT "InstitutionAttendance_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionAttendance" ADD CONSTRAINT "InstitutionAttendance_verifiedByInspectionId_fkey" FOREIGN KEY ("verifiedByInspectionId") REFERENCES "Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_currentInspectorId_fkey" FOREIGN KEY ("currentInspectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionAssignment" ADD CONSTRAINT "InspectionAssignment_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionAssignment" ADD CONSTRAINT "InspectionAssignment_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionAssignment" ADD CONSTRAINT "InspectionAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GpsVerification" ADD CONSTRAINT "GpsVerification_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GpsVerification" ADD CONSTRAINT "GpsVerification_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionChecklistResponse" ADD CONSTRAINT "InspectionChecklistResponse_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionChecklistResponse" ADD CONSTRAINT "InspectionChecklistResponse_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionReport" ADD CONSTRAINT "InspectionReport_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionReport" ADD CONSTRAINT "InspectionReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceAction" ADD CONSTRAINT "ComplianceAction_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceAction" ADD CONSTRAINT "ComplianceAction_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceAction" ADD CONSTRAINT "ComplianceAction_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceAction" ADD CONSTRAINT "ComplianceAction_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceAction" ADD CONSTRAINT "ComplianceAction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceAction" ADD CONSTRAINT "ComplianceAction_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CctvDevice" ADD CONSTRAINT "CctvDevice_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

