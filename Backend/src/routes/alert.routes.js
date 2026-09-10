import { Router } from "express";
import {
  getAlerts,
  getAlertStats,
  getAlertById,
  createAlert,
  acknowledgeAlert,
  resolveAlert,
  dismissAlert,
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/alert.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

const router = Router();

// All alert routes require valid authentication
router.use(authenticate);

// 1. User Notifications Endpoints
router.get("/notifications", getUserNotifications);
router.get("/notifications/unread-count", getUnreadNotificationCount);
router.post("/notifications/read-all", markAllNotificationsRead);
router.post("/notifications/:id/read", markNotificationRead);

// 2. Alert Collection & Metrics Endpoints
router.get("/", getAlerts);
router.get("/stats", getAlertStats);

// 3. Alert Creation (Authorized Officers and Admin)
router.post(
  "/",
  requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"),
  createAlert
);

// 4. Alert Lifecycle Parameterized Endpoints (:id)
router.get("/:id", getAlertById);
router.post("/:id/acknowledge", acknowledgeAlert);
router.post("/:id/resolve", resolveAlert);
router.post(
  "/:id/dismiss",
  requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"),
  dismissAlert
);

export default router;
