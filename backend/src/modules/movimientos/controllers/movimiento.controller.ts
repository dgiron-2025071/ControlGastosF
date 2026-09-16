import { Request, Response } from "express";
import { movimientoService } from "../services/movimiento.service";
import { AuthenticatedRequest } from "../../../middlewares/auth.middleware";

export class MovimientoController {
  async getMonthList(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).userId as number;
      const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
      const month = parseInt(req.query.month as string, 10) || new Date().getMonth() + 1;

      if (month < 1 || month > 12) {
        res.status(400).json({ message: "Mes inválido." });
        return;
      }

      const data = await movimientoService.listMonth(userId, year, month);
      res.status(200).json(data);
    } catch (error) {
      console.error("Error en módulo de movimientos:", error);
      res.status(500).json({ message: "Error interno del servidor." });
    }
  }
}

export const movimientoController = new MovimientoController();
