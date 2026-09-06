import { Router } from "express";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import institutionRoutes from "./institution.routes.js";

const router = Router();

// Health check routes
router.use("/health", healthRoutes);

// Authentication & Identity routes
router.use("/auth", authRoutes);

// Institution Management routes
router.use("/institutions", institutionRoutes);

// Future API routes will be mounted here:
// router.use("/inspections", inspectionRoutes);
// router.use("/evidence", evidenceRoutes);
// router.use("/reports", reportRoutes);
// router.use("/alerts", alertRoutes);
// router.use("/dashboard", dashboardRoutes);

export default router;
