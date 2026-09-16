import { Router } from "express";
import { suscripcionController } from "../controllers/suscripcion.controller";
import { authMiddleware } from "../../../middlewares/auth.middleware";

const router = Router();

router.get("/", authMiddleware, (req, res) => suscripcionController.getMonthList(req, res));
router.get("/ciclos", authMiddleware, (req, res) => suscripcionController.getCiclos(req, res));
router.post("/", authMiddleware, (req, res) => suscripcionController.create(req, res));
router.put("/:id", authMiddleware, (req, res) => suscripcionController.update(req, res));
router.delete("/:id", authMiddleware, (req, res) => suscripcionController.remove(req, res));
router.patch("/:id/estado", authMiddleware, (req, res) => suscripcionController.changeStatus(req, res));

export default router;
