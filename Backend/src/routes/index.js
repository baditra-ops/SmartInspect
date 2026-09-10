import { Router } from "express";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import institutionRoutes from "./institution.routes.js";
import inspectionRoutes from "./inspection.routes.js";
import evidenceRoutes from "./evidence.routes.js";
import complianceRoutes from "./compliance.routes.js";
import cctvRoutes from "./cctv.routes.js";
import aiRoutes from "./ai.routes.js";
import alertRoutes from "./alert.routes.js";

const router = Router();

// Health check routes
router.use("/health", healthRoutes);

// Authentication & Identity routes
router.use("/auth", authRoutes);

// Institution Management routes
router.use("/institutions", institutionRoutes);

// Inspection & Assignment routes
router.use("/inspections", inspectionRoutes);

// Evidence Management routes
router.use("/evidence", evidenceRoutes);

// Compliance & Corrective Action routes
router.use("/compliance", complianceRoutes);

// Alert & Notification routes
router.use("/alerts", alertRoutes);

// CCTV Device & Stream Management routes
router.use("/cctv", cctvRoutes);

// AI & Machine Learning Analytics routes
router.use("/ai", aiRoutes);

// Future API routes will be mounted here:
// router.use("/reports", reportRoutes);
// router.use("/dashboard", dashboardRoutes);

export default router;


