import { Router } from "express";
import {
  getCctvDevices,
  getCctvDeviceById,
  getCctvStream,
  createCctvDevice,
  updateCctvDevice,
  updateCctvStatus,
  deleteCctvDevice,
} from "../controllers/cctv.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

const router = Router();

// All CCTV routes require valid authentication
router.use(authenticate);

// 1. Static Query & Creation Endpoints
router.get("/", getCctvDevices);
router.post(
  "/",
  requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"),
  createCctvDevice
);

// 2. Instance Parameter Endpoints (:id)
router.get("/:id", getCctvDeviceById);
router.get("/:id/stream", getCctvStream);

router.patch(
  "/:id",
  requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"),
  updateCctvDevice
);

router.patch(
  "/:id/status",
  requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER", "INSPECTOR"),
  updateCctvStatus
);

router.delete(
  "/:id",
  requireRole("ADMIN", "STATE_OFFICER"),
  deleteCctvDevice
);

export default router;
