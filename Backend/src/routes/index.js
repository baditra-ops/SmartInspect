import { Router } from "express";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";

const router = Router();

// Health check routes
router.use("/health", healthRoutes);

// Authentication & Identity routes
router.use("/auth", authRoutes);

// Future API routes will be mounted here:
// router.use("/institutions", institutionRoutes);
// router.use("/inspections", inspectionRoutes);
// router.use("/evidence", evidenceRoutes);
// router.use("/reports", reportRoutes);
// router.use("/alerts", alertRoutes);
// router.use("/dashboard", dashboardRoutes);

export default router;
