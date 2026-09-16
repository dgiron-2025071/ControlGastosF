import { Router } from "express";
import { dashboardController } from "../controllers/dashboard.controller";
import { authMiddleware } from "../../../middlewares/auth.middleware";

const router = Router();

router.get("/", authMiddleware, (req, res) => dashboardController.getDashboard(req, res));
router.get("/resumen", authMiddleware, (req, res) => dashboardController.getResumen(req, res));

export default router;
