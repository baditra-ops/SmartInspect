import { Router } from "express";
import {
  getEvidenceById,
  verifyEvidenceIntegrity,
  deleteEvidence,
} from "../controllers/evidence.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

const router = Router();

// All evidence endpoints require authentication
router.use(authenticate);

// 1. Get Single Evidence by ID
router.get("/:id", getEvidenceById);

// 2. Verify SHA-256 Remote Integrity
router.get("/:id/integrity", verifyEvidenceIntegrity);

// 3. Administrative Deletion
router.delete("/:id", requireRole("ADMIN", "STATE_OFFICER"), deleteEvidence);

export default router;
