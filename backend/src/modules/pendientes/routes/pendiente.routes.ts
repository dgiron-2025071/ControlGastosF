import { Router } from "express";
import { pendienteController } from "../controllers/pendiente.controller";
import { authMiddleware } from "../../../middlewares/auth.middleware";

const router = Router();

router.get("/", authMiddleware, (req, res) => pendienteController.getMonthList(req, res));
router.post("/", authMiddleware, (req, res) => pendienteController.create(req, res));
router.patch("/:id/pagar", authMiddleware, (req, res) => pendienteController.markPaid(req, res));
router.patch("/:id/revertir", authMiddleware, (req, res) => pendienteController.revertPaid(req, res));
router.delete("/:id", authMiddleware, (req, res) => pendienteController.remove(req, res));

export default router;
