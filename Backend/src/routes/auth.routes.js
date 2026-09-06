import { Router } from "express";
import { login, getMe, logout } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

// Public Authentication Endpoints
router.post("/login", login);

// Protected User Endpoints
router.get("/me", authenticate, getMe);
router.post("/logout", authenticate, logout);

export default router;
