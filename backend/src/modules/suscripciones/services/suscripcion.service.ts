import { pool } from "../../../config/database";
import {
  Suscripcion,
  SuscripcionCreateInput,
  SuscripcionListResponse,
  mapSuscripcionRow,
  CICLOS_COBRO,
} from "../models/suscripcion.model";

export class SuscripcionError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "SuscripcionError";
  }
}

export class SuscripcionService {
  async listMonth(
    userId: number,
    year: number,
    month: number
  ): Promise<SuscripcionListResponse> {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    const itemsResult = await pool.query(
      `SELECT id, nombre, monto, ciclo_cobro, proxima_renovacion, estado, descripcion
       FROM suscripciones
       WHERE user_id = $1 AND estado != 'CANCELADA'
       ORDER BY proxima_renovacion ASC, id ASC`,
      [userId]
    );

    const totalMensualResult = await pool.query(
      `SELECT COALESCE(SUM(monto), 0)::numeric AS total,
              COUNT(*)::int AS count
       FROM suscripciones
       WHERE user_id = $1 AND estado = 'ACTIVA'
         AND proxima_renovacion >= $2 AND proxima_renovacion <= $3`,
      [userId, monthStart, monthEnd]
    );

    const totalAnualResult = await pool.query(
      `SELECT COALESCE(SUM(
         CASE ciclo_cobro
           WHEN 'UNA_VEZ'      THEN monto
           WHEN 'SEMANAL'      THEN monto * 4.33
           WHEN 'QUINCENAL'  THEN monto * 2.17
           WHEN 'MENSUAL'    THEN monto * 12
           WHEN 'BIMESTRAL'  THEN monto * 6
           WHEN 'TRIMESTRAL' THEN monto * 4
           WHEN 'SEMESTRAL'  THEN monto * 2
           WHEN 'ANUAL'      THEN monto
           ELSE monto * 12
         END
       ), 0)::numeric AS total
       FROM suscripciones
       WHERE user_id = $1 AND estado = 'ACTIVA'`,
      [userId]
    );

    const countsResult = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE estado = 'ACTIVA')::int AS activas,
         COUNT(*) FILTER (WHERE estado = 'PAUSADA')::int AS pausadas,
         COUNT(*) FILTER (WHERE estado = 'CANCELADA')::int AS canceladas
       FROM suscripciones WHERE user_id = $1`,
      [userId]
    );

    const counts = countsResult.rows[0];

    const mayorResult = await pool.query(
      `SELECT nombre, monto
       FROM suscripciones
       WHERE user_id = $1 AND estado = 'ACTIVA'
         AND proxima_renovacion >= $2 AND proxima_renovacion <= $3
       ORDER BY monto DESC LIMIT 1`,
      [userId, monthStart, monthEnd]
    );

    const activasMes = Number(totalMensualResult.rows[0].count ?? 0);

    return {
      stats: {
        totalMensual: Number(totalMensualResult.rows[0].total),
        totalAnual: Number(totalAnualResult.rows[0].total),
        promedio:
          activasMes > 0 ? Number(totalMensualResult.rows[0].total) / activasMes : 0,
        mayor: mayorResult.rows.length > 0
          ? { nombre: mayorResult.rows[0].nombre, monto: Number(mayorResult.rows[0].monto) }
          : null,
        count: counts.total,
        activas: counts.activas,
        pausadas: counts.pausadas,
        canceladas: counts.canceladas,
      },
      items: itemsResult.rows.map(mapSuscripcionRow),
    };
  }

  async create(userId: number, input: SuscripcionCreateInput): Promise<Suscripcion> {
    const nombre = input.nombre?.trim();
    const monto = Number(input.monto);
    const cicloCobro = input.cicloCobro || "MENSUAL";
    const proximaRenovacion = input.proximaRenovacion;
    const descripcion = input.descripcion?.trim() || null;

    if (!nombre) {
      throw new SuscripcionError("El nombre es obligatorio.", 400);
    }
    if (!Number.isFinite(monto) || monto <= 0) {
      throw new SuscripcionError("El monto debe ser un número mayor a 0.", 400);
    }
    if (!proximaRenovacion) {
      throw new SuscripcionError("La fecha de próxima renovación es obligatoria.", 400);
    }

    const result = await pool.query(
      `INSERT INTO suscripciones (user_id, nombre, monto, ciclo_cobro, proxima_renovacion, descripcion)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, nombre, monto, ciclo_cobro, proxima_renovacion, estado, descripcion, created_at`,
      [userId, nombre, monto, cicloCobro, proximaRenovacion, descripcion]
    );

    return mapRowFull(result.rows[0]);
  }

  async update(userId: number, id: number, input: Partial<SuscripcionCreateInput>): Promise<Suscripcion> {
    const existing = await this.findById(userId, id);
    if (!existing) {
      throw new SuscripcionError("Suscripción no encontrada.", 404);
    }

    const nombre = input.nombre?.trim() ?? existing.nombre;
    const monto = input.monto !== undefined ? Number(input.monto) : existing.monto;
    const cicloCobro = input.cicloCobro ?? existing.cicloCobro;
    const proximaRenovacion = input.proximaRenovacion ?? existing.proximaRenovacion;
    const descripcion = input.descripcion === undefined ? existing.descripcion : (input.descripcion?.trim() || null);

    if (!nombre) {
      throw new SuscripcionError("El nombre es obligatorio.", 400);
    }
    if (!Number.isFinite(monto) || monto <= 0) {
      throw new SuscripcionError("El monto debe ser un número mayor a 0.", 400);
    }

    const result = await pool.query(
      `UPDATE suscripciones
       SET nombre = $1, monto = $2, ciclo_cobro = $3, proxima_renovacion = $4, descripcion = $5
       WHERE id = $6 AND user_id = $7
       RETURNING id, user_id, nombre, monto, ciclo_cobro, proxima_renovacion, estado, descripcion, created_at`,
      [nombre, monto, cicloCobro, proximaRenovacion, descripcion, id, userId]
    );

    if (result.rowCount === 0) {
      throw new SuscripcionError("Suscripción no encontrada.", 404);
    }

    return mapRowFull(result.rows[0]);
  }

  async remove(userId: number, id: number): Promise<void> {
    const result = await pool.query(
      "DELETE FROM suscripciones WHERE id = $1 AND user_id = $2",
      [id, userId]
    );
    if (result.rowCount === 0) {
      throw new SuscripcionError("Suscripción no encontrada.", 404);
    }
  }

  async changeStatus(userId: number, id: number, estado: "ACTIVA" | "PAUSADA" | "CANCELADA"): Promise<Suscripcion> {
    const result = await pool.query(
      `UPDATE suscripciones SET estado = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id, nombre, monto, ciclo_cobro, proxima_renovacion, estado, descripcion, created_at`,
      [estado, id, userId]
    );
    if (result.rowCount === 0) {
      throw new SuscripcionError("Suscripción no encontrada.", 404);
    }
    return mapRowFull(result.rows[0]);
  }

  listCiclos(): { ciclos: string[] } {
    return { ciclos: [...CICLOS_COBRO] };
  }

  private async findById(userId: number, id: number) {
    const result = await pool.query(
      `SELECT id, nombre, monto, ciclo_cobro, proxima_renovacion, estado, descripcion
       FROM suscripciones WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (result.rowCount === 0) return null;
    return mapSuscripcionRow(result.rows[0]);
  }
}

function mapRowFull(row: any): Suscripcion {
  return {
    id: row.id,
    userId: row.user_id,
    nombre: row.nombre,
    monto: Number(row.monto),
    cicloCobro: row.ciclo_cobro,
    proximaRenovacion: row.proxima_renovacion instanceof Date
      ? `${row.proxima_renovacion.getFullYear()}-${String(row.proxima_renovacion.getMonth() + 1).padStart(2, "0")}-${String(row.proxima_renovacion.getDate()).padStart(2, "0")}`
      : String(row.proxima_renovacion).slice(0, 10),
    estado: row.estado,
    descripcion: row.descripcion ?? null,
    createdAt: row.created_at,
  };
}

export const suscripcionService = new SuscripcionService();
