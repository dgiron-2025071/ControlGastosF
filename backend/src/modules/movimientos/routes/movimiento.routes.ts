import { Router } from "express";
import { movimientoController } from "../controllers/movimiento.controller";
import { authMiddleware } from "../../../middlewares/auth.middleware";

const router = Router();

router.get("/", authMiddleware, (req, res) => movimientoController.getMonthList(req, res));

export default router;
