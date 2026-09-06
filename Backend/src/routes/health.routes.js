import { Router } from "express";
import { getHealth, getDbHealth, getRedisHealth } from "../controllers/health.controller.js";

const router = Router();

router.get("/", getHealth);
router.get("/db", getDbHealth);
router.get("/redis", getRedisHealth);

export default router;
