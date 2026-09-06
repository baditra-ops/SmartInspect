import { Router } from "express";
import {
  getInspections,
  getMyInspections,
  getEligibleInspectors,
  getInspectionById,
  createInspection,
  updateInspection,
  assignInspector,
  reassignInspector,
  getInspectionAssignments,
  acceptAssignment,
  rejectAssignment,
  startInspection,
  completeInspection,
  cancelInspection,
} from "../controllers/inspection.controller.js";
import {
  verifyGpsLocation,
  getGpsHistory,
  getLatestGps,
} from "../controllers/gps.controller.js";
import {
  uploadEvidence,
  getInspectionEvidence,
} from "../controllers/evidence.controller.js";
import { uploadEvidenceFile } from "../middleware/upload.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

const router = Router();

// All inspection routes require authentication
router.use(authenticate);

// 1. Static Query Endpoints (must be declared before :id parameter routes)
router.get("/", getInspections);
router.get("/my", requireRole("INSPECTOR"), getMyInspections);
router.get("/eligible-inspectors", requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"), getEligibleInspectors);
router.post("/", requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"), createInspection);

// 2. Inspection Instance Parameter Endpoints (:id)
router.get("/:id", getInspectionById);
router.patch("/:id", requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"), updateInspection);
router.post("/:id/assign", requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"), assignInspector);
router.post("/:id/reassign", requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"), reassignInspector);
router.get("/:id/assignments", getInspectionAssignments);

// 3. Inspector Lifecycle Endpoints
router.post("/:id/accept", requireRole("INSPECTOR"), acceptAssignment);
router.post("/:id/reject", requireRole("INSPECTOR"), rejectAssignment);
router.post("/:id/start", requireRole("INSPECTOR"), startInspection);
router.post("/:id/complete", requireRole("INSPECTOR", "ADMIN"), completeInspection);
router.post("/:id/cancel", requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"), cancelInspection);

// 4. GPS Geofence & Location Verification Endpoints
router.post("/:id/gps/verify", requireRole("INSPECTOR", "ADMIN"), verifyGpsLocation);
router.get("/:id/gps", getGpsHistory);
router.get("/:id/gps/latest", getLatestGps);

// 5. Evidence Capture & Media Endpoints
router.post(
  "/:id/evidence",
  requireRole("INSPECTOR", "ADMIN"),
  uploadEvidenceFile,
  uploadEvidence
);
router.get("/:id/evidence", getInspectionEvidence);

export default router;


