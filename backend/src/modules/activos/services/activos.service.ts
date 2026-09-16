import { pool } from "../../../config/database";
import {
  Activo,
  ActivoListResponse,
  ActivoCreateInput,
  mapActivoRow,
  ORIGENES,
  toDateString,
} from "../models/activo.model";

export class ActivosService {
  async listMonth(
    userId: number,
    year: number,
    month: number
  ): Promise<ActivoListResponse> {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    const itemsResult = await pool.query(
      `SELECT id, nombre, monto, categoria, empresa, descripcion, fecha
       FROM activos
       WHERE user_id = $1 AND fecha >= $2 AND fecha <= $3
       ORDER BY fecha ASC, id ASC`,
      [userId, monthStart, monthEnd]
    );

    const totalResult = await pool.query(
      `SELECT COALESCE(SUM(monto), 0)::numeric AS total, COUNT(*)::int AS count
       FROM activos
       WHERE user_id = $1 AND fecha >= $2 AND fecha <= $3`,
      [userId, monthStart, monthEnd]
    );

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonthStart = new Date(prevYear, prevMonth - 1, 1);
    const prevMonthEnd = new Date(prevYear, prevMonth, 0);

    const prevTotalResult = await pool.query(
      `SELECT COALESCE(SUM(monto), 0)::numeric AS total
       FROM activos
       WHERE user_id = $1 AND fecha >= $2 AND fecha <= $3`,
      [userId, prevMonthStart, prevMonthEnd]
    );

    const totalMensual = Number(totalResult.rows[0].total);
    const count = Number(totalResult.rows[0].count);
    const prevTotal = Number(prevTotalResult.rows[0].total);

    let percentChange = 0;
    if (prevTotal !== 0) {
      percentChange = ((totalMensual - prevTotal) / Math.abs(prevTotal)) * 100;
    } else if (totalMensual !== 0) {
      percentChange = 100;
    }

    return {
      stats: {
        totalMensual,
        promedio: count > 0 ? totalMensual / count : 0,
        count,
        vsMesAnterior: {
          percentChange: Math.round(percentChange * 10) / 10,
          diferencia: totalMensual - prevTotal,
          totalMesAnterior: prevTotal,
        },
      },
      items: itemsResult.rows.map(mapActivoRow),
    };
  }

  async create(userId: number, input: ActivoCreateInput): Promise<Activo> {
    const nombre = input.nombre?.trim();
    const monto = Number(input.monto);
    const categoria = (input.categoria?.trim() || "General").trim();
    const empresa = input.empresa?.trim() || null;
    const descripcion = input.descripcion?.trim() || null;
    const fecha = input.fecha || new Date().toISOString().slice(0, 10);

    if (!nombre) {
      throw new ActivoError("El nombre o descripción es obligatorio.", 400);
    }

    if (!Number.isFinite(monto) || monto <= 0) {
      throw new ActivoError("El monto debe ser un número mayor a 0.", 400);
    }

    this.assertNotFutureDate(fecha);

    const result = await pool.query(
      `INSERT INTO activos (user_id, nombre, monto, categoria, empresa, descripcion, fecha)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, nombre, monto, categoria, empresa, descripcion, fecha, created_at`,
      [userId, nombre, monto, categoria, empresa, descripcion, fecha]
    );

    return mapRow(result.rows[0]);
  }

  async update(
    userId: number,
    id: number,
    input: ActivoCreateInput
  ): Promise<Activo> {
    const existing = await this.findById(userId, id);
    if (!existing) {
      throw new ActivoError("Activo no encontrado.", 404);
    }

    const nombre = input.nombre?.trim() ?? existing.nombre;
    const monto =
      input.monto !== undefined ? Number(input.monto) : existing.monto;
    const categoria =
      (input.categoria?.trim() || existing.categoria || "General").trim();
    const empresa =
      input.empresa === undefined
        ? existing.empresa
        : (input.empresa?.trim() || null);
    const descripcion =
      input.descripcion === undefined
        ? existing.descripcion
        : (input.descripcion?.trim() || null);
    const fecha = input.fecha || existing.fecha;

    if (!nombre) {
      throw new ActivoError("El nombre o descripción es obligatorio.", 400);
    }

    if (!Number.isFinite(monto) || monto <= 0) {
      throw new ActivoError("El monto debe ser un número mayor a 0.", 400);
    }

    this.assertNotFutureDate(fecha);

    const result = await pool.query(
      `UPDATE activos
       SET nombre = $1, monto = $2, categoria = $3, empresa = $4,
           descripcion = $5, fecha = $6
       WHERE id = $7 AND user_id = $8
       RETURNING id, user_id, nombre, monto, categoria, empresa, descripcion, fecha, created_at`,
      [nombre, monto, categoria, empresa, descripcion, fecha, id, userId]
    );

    if (result.rowCount === 0) {
      throw new ActivoError("Activo no encontrado.", 404);
    }

    return mapRow(result.rows[0]);
  }

  async remove(userId: number, id: number): Promise<void> {
    const result = await pool.query(
      "DELETE FROM activos WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (result.rowCount === 0) {
      throw new ActivoError("Activo no encontrado.", 404);
    }
  }

  listOrigenes(): { origenes: string[] } {
    return { origenes: [...ORIGENES] };
  }

  private async findById(
    userId: number,
    id: number
  ): Promise<Omit<Activo, "userId" | "createdAt"> | null> {
    const result = await pool.query(
      `SELECT id, nombre, monto, categoria, empresa, descripcion, fecha
       FROM activos WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapActivoRow(result.rows[0]);
  }

  /** Bloquea registros con fechas futuras (la fecha del sistema no puede superarse). */
  private assertNotFutureDate(fecha: string): void {
    const hoy = new Date().toISOString().slice(0, 10);
    if (fecha && fecha > hoy) {
      throw new ActivoError("No puede agregar el dato hasta que se cumpla la fecha deseada.", 400);
    }
  }
}

function mapRow(row: any): Activo {
  return {
    id: row.id,
    userId: row.user_id,
    nombre: row.nombre,
    monto: Number(row.monto),
    categoria: row.categoria,
    empresa: row.empresa ?? null,
    descripcion: row.descripcion ?? null,
    fecha: toDateString(row.fecha),
    createdAt: row.created_at,
  };
}

export class ActivoError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ActivoError";
  }
}

export const activosService = new ActivosService();