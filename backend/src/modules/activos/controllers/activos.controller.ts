import { Request, Response } from "express";
import {
  activosService,
  ActivoError,
} from "../services/activos.service";
import { AuthenticatedRequest } from "../../../middlewares/auth.middleware";

export class ActivosController {
  async getMonthList(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).userId as number;
      const year =
        parseInt(req.query.year as string, 10) || new Date().getFullYear();
      const month = parseInt(req.query.month as string, 10) || new Date().getMonth() + 1;

      if (month < 1 || month > 12) {
        res.status(400).json({ message: "Mes inválido. Debe ser entre 1 y 12." });
        return;
      }

      const data = await activosService.listMonth(userId, year, month);
      res.status(200).json(data);
    } catch (error) {
      handleError(error, res);
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).userId as number;
      const activo = await activosService.create(userId, req.body);
      res.status(201).json({ activo });
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

      const activo = await activosService.update(userId, id, req.body);
      res.status(200).json({ activo });
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

      await activosService.remove(userId, id);
      res.status(200).json({ message: "Activo eliminado correctamente." });
    } catch (error) {
      handleError(error, res);
    }
  }

  async getOrigenes(_req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json(activosService.listOrigenes());
    } catch (error) {
      handleError(error, res);
    }
  }
}

function handleError(error: unknown, res: Response): void {
  if (error instanceof ActivoError) {
    res.status(error.status).json({ message: error.message });
    return;
  }

  console.error("Error en módulo de activos:", error);
  res.status(500).json({ message: "Error interno del servidor." });
}

export const activosController = new ActivosController();