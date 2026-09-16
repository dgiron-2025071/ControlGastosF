import { Router } from "express";
import { pasivoController } from "../controllers/pasivo.controller";
import { authMiddleware } from "../../../middlewares/auth.middleware";

const router = Router();

router.get("/", authMiddleware, (req, res) => pasivoController.getMonthList(req, res));
router.get("/categorias", authMiddleware, (req, res) => pasivoController.getCategorias(req, res));
router.post("/", authMiddleware, (req, res) => pasivoController.create(req, res));
router.put("/:id", authMiddleware, (req, res) => pasivoController.update(req, res));
router.delete("/:id", authMiddleware, (req, res) => pasivoController.remove(req, res));
router.patch("/:id/pagar", authMiddleware, (req, res) => pasivoController.markPaid(req, res));

export default router;
