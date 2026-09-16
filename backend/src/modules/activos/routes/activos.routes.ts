import { Router } from "express";
import { activosController } from "../controllers/activos.controller";
import { authMiddleware } from "../../../middlewares/auth.middleware";

const router = Router();

router.get("/", authMiddleware, (req, res) => activosController.getMonthList(req, res));
router.get("/origenes", authMiddleware, (req, res) => activosController.getOrigenes(req, res));
router.post("/", authMiddleware, (req, res) => activosController.create(req, res));
router.put("/:id", authMiddleware, (req, res) => activosController.update(req, res));
router.delete("/:id", authMiddleware, (req, res) => activosController.remove(req, res));

export default router;