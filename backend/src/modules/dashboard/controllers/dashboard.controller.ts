import { Request, Response } from "express";
import { dashboardService } from "../services/dashboard.service";

export class DashboardController {
  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId as number;
      const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
      const month = parseInt(req.query.month as string, 10) || new Date().getMonth() + 1;

      if (month < 1 || month > 12) {
        res.status(400).json({ message: "Mes invalido. Debe ser entre 1 y 12." });
        return;
      }

      const data = await dashboardService.getDashboard(userId, year, month);
      res.status(200).json(data);
    } catch (error) {
      console.error("Error al obtener dashboard:", error);
      res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async getResumen(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId as number;
      const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
      const month = parseInt(req.query.month as string, 10) || new Date().getMonth() + 1;

      if (month < 1 || month > 12) {
        res.status(400).json({ message: "Mes invalido. Debe ser entre 1 y 12." });
        return;
      }

      const data = await dashboardService.getResumen(userId, year, month);
      res.status(200).json(data);
    } catch (error) {
      console.error("Error al obtener resumen:", error);
      res.status(500).json({ message: "Error interno del servidor." });
    }
  }
}

export const dashboardController = new DashboardController();
