import { Router } from "express";
import {
  getComplianceActions,
  getComplianceStats,
  getComplianceActionById,
  createComplianceAction,
  createComplianceFromAlert,
  updateComplianceAction,
  assignComplianceAction,
  startComplianceAction,
  submitRectification,
  verifyComplianceAction,
  rejectRectification,
  closeComplianceAction,
  reopenComplianceAction,
  escalateComplianceAction,
} from "../controllers/compliance.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

const router = Router();

// All compliance routes require valid authentication
router.use(authenticate);

// 1. Static Query Endpoints (must be declared before :id parameter routes)
router.get("/", getComplianceActions);
router.get("/stats", getComplianceStats);

// 2. Creation Endpoints (Authorized Government Officers Only)
router.post(
  "/",
  requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"),
  createComplianceAction
);
router.post(
  "/from-alert",
  requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"),
  createComplianceFromAlert
);

// 3. Compliance Action Instance Parameter Endpoints (:id)
router.get("/:id", getComplianceActionById);
router.patch(
  "/:id",
  requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"),
  updateComplianceAction
);
router.post(
  "/:id/assign",
  requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"),
  assignComplianceAction
);

// 4. Lifecycle & Workflow Transitions
router.post("/:id/start", startComplianceAction);
router.post("/:id/submit", submitRectification);
router.post(
  "/:id/verify",
  requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"),
  verifyComplianceAction
);
router.post(
  "/:id/reject",
  requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"),
  rejectRectification
);
router.post(
  "/:id/close",
  requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"),
  closeComplianceAction
);
router.post(
  "/:id/reopen",
  requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"),
  reopenComplianceAction
);
router.post(
  "/:id/escalate",
  requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"),
  escalateComplianceAction
);

export default router;
