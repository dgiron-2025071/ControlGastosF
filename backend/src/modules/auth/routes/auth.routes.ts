import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authMiddleware } from "../../../middlewares/auth.middleware";

const router = Router();
const authController = new AuthController();

router.post("/register", (req, res) => authController.register(req, res));
router.post("/login", (req, res) => authController.login(req, res));
router.post("/google", (req, res) => authController.googleLogin(req, res));
router.post("/refresh", authMiddleware, (req, res) => authController.refresh(req, res));
router.get("/me", authMiddleware, (req, res) => authController.me(req, res));

export default router;
