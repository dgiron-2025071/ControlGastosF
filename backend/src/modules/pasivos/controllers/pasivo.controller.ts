import { Request, Response } from "express";
import { pasivoService, PasivoError } from "../services/pasivo.service";
import { AuthenticatedRequest } from "../../../middlewares/auth.middleware";

export class PasivoController {
  async getMonthList(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).userId as number;
      const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
      const month = parseInt(req.query.month as string, 10) || new Date().getMonth() + 1;

      if (month < 1 || month > 12) {
        res.status(400).json({ message: "Mes inválido. Debe ser entre 1 y 12." });
        return;
      }

      const data = await pasivoService.listMonth(userId, year, month);
      res.status(200).json(data);
    } catch (error) {
      handleError(error, res);
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).userId as number;
      const pasivo = await pasivoService.create(userId, req.body);
      res.status(201).json({ pasivo });
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
      const pasivo = await pasivoService.update(userId, id, req.body);
      res.status(200).json({ pasivo });
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
      await pasivoService.remove(userId, id);
      res.status(200).json({ message: "Pasivo eliminado correctamente." });
    } catch (error) {
      handleError(error, res);
    }
  }

  async markPaid(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).userId as number;
      const id = parseInt(req.params.id as string, 10);
      if (!Number.isInteger(id)) {
        res.status(400).json({ message: "ID inválido." });
        return;
      }
      const pasivo = await pasivoService.markPaid(userId, id);
      res.status(200).json({ pasivo });
    } catch (error) {
      handleError(error, res);
    }
  }

  async getCategorias(_req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json(pasivoService.listCategorias());
    } catch (error) {
      handleError(error, res);
    }
  }
}

function handleError(error: unknown, res: Response): void {
  if (error instanceof PasivoError) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  console.error("Error en módulo de pasivos:", error);
  res.status(500).json({ message: "Error interno del servidor." });
}

export const pasivoController = new PasivoController();
