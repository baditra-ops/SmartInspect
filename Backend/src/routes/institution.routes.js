import { Router } from "express";
import {
  getInstitutions,
  getInstitutionById,
  createInstitution,
  updateInstitution,
  deleteInstitution,
  getInstitutionSchemes,
  linkScheme,
  unlinkScheme,
  getInstitutionBeneficiaries,
  getInstitutionAttendance,
} from "../controllers/institution.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

const router = Router();

// All institution routes require authentication
router.use(authenticate);

// 1. Institution Core Endpoints
router.get("/", getInstitutions);
router.get("/:id", getInstitutionById);
router.post("/", requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"), createInstitution);
router.patch("/:id", requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"), updateInstitution);
router.delete("/:id", requireRole("ADMIN", "STATE_OFFICER"), deleteInstitution);

// 2. Institution Schemes Endpoints
router.get("/:id/schemes", getInstitutionSchemes);
router.post("/:id/schemes", requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"), linkScheme);
router.delete("/:id/schemes/:schemeId", requireRole("ADMIN", "STATE_OFFICER"), unlinkScheme);

// 3. Beneficiaries & Attendance Data Access
router.get("/:id/beneficiaries", getInstitutionBeneficiaries);
router.get("/:id/attendance", getInstitutionAttendance);

export default router;
