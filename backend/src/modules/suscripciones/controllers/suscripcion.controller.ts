import { Request, Response } from "express";
import { suscripcionService, SuscripcionError } from "../services/suscripcion.service";
import { AuthenticatedRequest } from "../../../middlewares/auth.middleware";

export class SuscripcionController {
  async getMonthList(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).userId as number;
      const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
      const month = parseInt(req.query.month as string, 10) || new Date().getMonth() + 1;

      if (month < 1 || month > 12) {
        res.status(400).json({ message: "Mes inválido." });
        return;
      }

      const data = await suscripcionService.listMonth(userId, year, month);
      res.status(200).json(data);
    } catch (error) {
      handleError(error, res);
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).userId as number;
      const suscripcion = await suscripcionService.create(userId, req.body);
      res.status(201).json({ suscripcion });
    } catch (error) {
      handleError(error, res);
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).userId as number;
      const id = parseInt(req.params.id as string, 10);
      if (!Number.isInteger(id)) {
        res.status(400).json({ message: "ID inválido." });
        return;
      }
      const suscripcion = await suscripcionService.update(userId, id, req.body);
      res.status(200).json({ suscripcion });
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
      await suscripcionService.remove(userId, id);
      res.status(200).json({ message: "Suscripción eliminada correctamente." });
    } catch (error) {
      handleError(error, res);
    }
  }

  async changeStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).userId as number;
      const id = parseInt(req.params.id as string, 10);
      const { estado } = req.body;

      if (!Number.isInteger(id)) {
        res.status(400).json({ message: "ID inválido." });
        return;
      }
      if (!["ACTIVA", "PAUSADA", "CANCELADA"].includes(estado)) {
        res.status(400).json({ message: "Estado inválido." });
        return;
      }

      const suscripcion = await suscripcionService.changeStatus(userId, id, estado);
      res.status(200).json({ suscripcion });
    } catch (error) {
      handleError(error, res);
    }
  }

  async getCiclos(_req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json(suscripcionService.listCiclos());
    } catch (error) {
      handleError(error, res);
    }
  }
}

function handleError(error: unknown, res: Response): void {
  if (error instanceof SuscripcionError) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  console.error("Error en módulo de suscripciones:", error);
  res.status(500).json({ message: "Error interno del servidor." });
}

export const suscripcionController = new SuscripcionController();
