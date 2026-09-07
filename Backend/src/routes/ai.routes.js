import { Router } from "express";
import { aiController } from "../controllers/ai.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

const router = Router();

// All AI routes require valid JWT authentication
router.use(authenticate);

// 1. Health Status of AI Microservice
router.get("/health", (req, res, next) => aiController.getHealth(req, res, next));

// 2. Risk Calculation & Persistence
router.post(
  "/risk-assessment",
  requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"),
  (req, res, next) => aiController.calculateRisk(req, res, next)
);

// 3. Computer Vision Attendance Verification
router.post(
  "/attendance-analysis",
  requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER", "INSPECTOR"),
  (req, res, next) => aiController.analyzeAttendance(req, res, next)
);

// 4. Historical Risk Assessments for an Institution
router.get(
  "/risk-assessments/:institutionId",
  requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER", "INSPECTOR", "INSTITUTION_USER"),
  (req, res, next) => aiController.getRiskHistory(req, res, next)
);

// 5. Latest Risk Assessment for an Institution
router.get(
  "/risk-assessments/:institutionId/latest",
  requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER", "INSPECTOR", "INSTITUTION_USER"),
  (req, res, next) => aiController.getLatestRisk(req, res, next)
);

export default router;
