import { Request, Response } from "express";
import { pendienteService, PendienteError } from "../services/pendiente.service";
import { AuthenticatedRequest } from "../../../middlewares/auth.middleware";

export class PendienteController {
  async getMonthList(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).userId as number;
      const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
      const month = parseInt(req.query.month as string, 10) || new Date().getMonth() + 1;

      if (month < 1 || month > 12) {
        res.status(400).json({ message: "Mes inválido." });
        return;
      }

      const data = await pendienteService.listMonth(userId, year, month);
      res.status(200).json(data);
    } catch (error) {
      handleError(error, res);
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).userId as number;
      const pendiente = await pendienteService.create(userId, req.body);
      res.status(201).json({ pendiente });
    } catch (error) {
      handleError(error, res);
    }
  }

  async markPaid(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).userId as number;
      const id = parseInt(req.params.id as string, 10);
      const origen = (req.body.origen as string) || "PENDIENTE";
      const suscripcionId = req.body.suscripcionId as number | null;
      const montoRaw = req.body.monto;
      const monto =
        montoRaw === null || montoRaw === undefined || montoRaw === ""
          ? null
          : Number(montoRaw);

      if (!Number.isInteger(id)) {
        res.status(400).json({ message: "ID inválido." });
        return;
      }

      await pendienteService.markPaid(userId, id, origen, suscripcionId, monto);
      res.status(200).json({ message: "Marcado como pagado." });
    } catch (error) {
      handleError(error, res);
    }
  }

  async revertPaid(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).userId as number;
      const id = parseInt(req.params.id as string, 10);

      if (!Number.isInteger(id)) {
        res.status(400).json({ message: "ID inválido." });
        return;
      }

      await pendienteService.revertPaid(userId, id);
      res.status(200).json({ message: "Pendiente restablecido y pasivo eliminado." });
    } catch (error) {
      handleError(error, res);
    }
  }

  async remove(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).userId as number;
      const id = parseInt(req.params.id as string, 10);

      if (!Number.isInteger(id)) {
        res.status(400).json({ message: "ID inválido." });
        return;
      }

      await pendienteService.remove(userId, id);
      res.status(200).json({ message: "Pendiente eliminado." });
    } catch (error) {
      handleError(error, res);
    }
  }
}

function handleError(error: unknown, res: Response): void {
  if (error instanceof PendienteError) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  console.error("Error en módulo de pendientes:", error);
  res.status(500).json({ message: "Error interno del servidor." });
}

export const pendienteController = new PendienteController();
