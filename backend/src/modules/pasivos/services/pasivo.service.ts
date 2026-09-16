import { pool } from "../../../config/database";
import {
  Pasivo,
  PasivoCreateInput,
  PasivoListResponse,
  mapPasoRow,
  toDateString,
  CATEGORIAS_GASTO,
} from "../models/paso.model";

export class PasivoError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "PasivoError";
  }
}

export class PasivoService {
  async listMonth(
    userId: number,
    year: number,
    month: number
  ): Promise<PasivoListResponse> {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    const itemsResult = await pool.query(
      `SELECT id, nombre, monto, categoria, empresa, tasa_interes,
              fecha_vencimiento, estado, descripcion
       FROM pasivos
       WHERE user_id = $1 AND fecha_vencimiento >= $2 AND fecha_vencimiento <= $3
       ORDER BY fecha_vencimiento ASC, id ASC`,
      [userId, monthStart, monthEnd]
    );

    const totalResult = await pool.query(
      `SELECT COALESCE(SUM(monto), 0)::numeric AS total, COUNT(*)::int AS count
       FROM pasivos
       WHERE user_id = $1 AND fecha_vencimiento >= $2 AND fecha_vencimiento <= $3`,
      [userId, monthStart, monthEnd]
    );

    const catResult = await pool.query(
      `SELECT categoria, SUM(monto)::numeric AS total
       FROM pasivos
       WHERE user_id = $1 AND fecha_vencimiento >= $2 AND fecha_vencimiento <= $3
       GROUP BY categoria ORDER BY total DESC`,
      [userId, monthStart, monthEnd]
    );

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonthStart = new Date(prevYear, prevMonth - 1, 1);
    const prevMonthEnd = new Date(prevYear, prevMonth, 0);

    const prevTotalResult = await pool.query(
      `SELECT COALESCE(SUM(monto), 0)::numeric AS total
       FROM pasivos
       WHERE user_id = $1 AND fecha_vencimiento >= $2 AND fecha_vencimiento <= $3`,
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

    const categories = catResult.rows.map((r: any) => ({
      nombre: r.categoria,
      total: Number(r.total),
      porcentaje: totalMensual > 0 ? Math.round((Number(r.total) / totalMensual) * 1000) / 10 : 0,
    }));

    const mayorCategoria = categories.length > 0 ? categories[0] : null;
    const menorCategoria = categories.length > 1 ? categories[categories.length - 1] : null;

    return {
      stats: {
        totalMensual,
        promedio: count > 0 ? totalMensual / count : 0,
        count,
        mayorCategoria,
        menorCategoria,
        vsMesAnterior: {
          percentChange: Math.round(percentChange * 10) / 10,
          diferencia: totalMensual - prevTotal,
          totalMesAnterior: prevTotal,
        },
      },
      items: itemsResult.rows.map(mapPasoRow),
    };
  }

  async create(userId: number, input: PasivoCreateInput): Promise<Pasivo> {
    const nombre = input.nombre?.trim();
    const monto = Number(input.monto);
    const categoria = (input.categoria?.trim() || "General").trim();
    const empresa = input.empresa?.trim() || null;
    const tasaInteres = Number(input.tasaInteres ?? 0);
    const fechaVencimiento = input.fechaVencimiento || null;
    const descripcion = input.descripcion?.trim() || null;

    if (!nombre) {
      throw new PasivoError("El nombre o descripción es obligatorio.", 400);
    }
    if (!Number.isFinite(monto) || monto <= 0) {
      throw new PasivoError("El monto debe ser un número mayor a 0.", 400);
    }
    await this.assertValidGasto(userId, monto, fechaVencimiento, null);

    const result = await pool.query(
      `INSERT INTO pasivos (user_id, nombre, monto, categoria, empresa, tasa_interes, fecha_vencimiento, descripcion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, user_id, nombre, monto, categoria, empresa, tasa_interes, fecha_vencimiento, estado, descripcion, created_at`,
      [userId, nombre, monto, categoria, empresa, tasaInteres, fechaVencimiento, descripcion]
    );

    return mapRowFull(result.rows[0]);
  }

  async update(userId: number, id: number, input: PasivoCreateInput): Promise<Pasivo> {
    const existing = await this.findById(userId, id);
    if (!existing) {
      throw new PasivoError("Pasivo no encontrado.", 404);
    }

    const nombre = input.nombre?.trim() ?? existing.nombre;
    const monto = input.monto !== undefined ? Number(input.monto) : existing.monto;
    const categoria = (input.categoria?.trim() || existing.categoria || "General").trim();
    const empresa = input.empresa === undefined ? existing.empresa : (input.empresa?.trim() || null);
    const tasaInteres = input.tasaInteres !== undefined ? Number(input.tasaInteres) : existing.tasaInteres;
    const fechaVencimiento = input.fechaVencimiento !== undefined ? (input.fechaVencimiento || null) : existing.fechaVencimiento;
    const descripcion = input.descripcion === undefined ? existing.descripcion : (input.descripcion?.trim() || null);

    if (!nombre) {
      throw new PasivoError("El nombre o descripción es obligatorio.", 400);
    }
    if (!Number.isFinite(monto) || monto <= 0) {
      throw new PasivoError("El monto debe ser un número mayor a 0.", 400);
    }
    await this.assertValidGasto(userId, monto, fechaVencimiento, id);

    const result = await pool.query(
      `UPDATE pasivos
       SET nombre = $1, monto = $2, categoria = $3, empresa = $4,
           tasa_interes = $5, fecha_vencimiento = $6, descripcion = $7
       WHERE id = $8 AND user_id = $9
       RETURNING id, user_id, nombre, monto, categoria, empresa, tasa_interes, fecha_vencimiento, estado, descripcion, created_at`,
      [nombre, monto, categoria, empresa, tasaInteres, fechaVencimiento, descripcion, id, userId]
    );

    if (result.rowCount === 0) {
      throw new PasivoError("Pasivo no encontrado.", 404);
    }

    return mapRowFull(result.rows[0]);
  }

  async remove(userId: number, id: number): Promise<void> {
    const result = await pool.query(
      "DELETE FROM pasivos WHERE id = $1 AND user_id = $2",
      [id, userId]
    );
    if (result.rowCount === 0) {
      throw new PasivoError("Pasivo no encontrado.", 404);
    }
  }

  async markPaid(userId: number, id: number): Promise<Pasivo> {
    const sel = await pool.query(
      `SELECT monto FROM pasivos WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (sel.rowCount === 0) {
      throw new PasivoError("Pasivo no encontrado.", 404);
    }

    const monto = Number(sel.rows[0].monto);

    // Misma validación de fondos que en pendientes: disponible = activos
    // totales menos pasivos ACTIVO comprometidos, sin descontar el pasivo
    // propio que se está pagando.
    const disp = await pool.query(
      `SELECT
         (
           (SELECT COALESCE(SUM(monto), 0)::numeric FROM activos WHERE user_id = $1)
           -
           (SELECT COALESCE(SUM(monto), 0)::numeric FROM pasivos
            WHERE user_id = $1 AND estado = 'ACTIVO' AND fecha_vencimiento <= CURRENT_DATE AND id != $2)
         ) AS disponible`,
      [userId, id]
    );
    const disponible = Number(disp.rows[0]?.disponible ?? 0);

    if (monto > disponible) {
      throw new PasivoError("Sin fondos suficientes.", 400);
    }

    const result = await pool.query(
      `UPDATE pasivos SET estado = 'PAGADO'
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, nombre, monto, categoria, empresa, tasa_interes, fecha_vencimiento, estado, descripcion, created_at`,
      [id, userId]
    );
    if (result.rowCount === 0) {
      throw new PasivoError("Pasivo no encontrado.", 404);
    }
    return mapRowFull(result.rows[0]);
  }

  listCategorias(): { categorias: string[] } {
    return { categorias: [...CATEGORIAS_GASTO] };
  }

  /**
   * Validaciones aplicadas a cualquier gasto:
   *  - No se pueden registrar gastos en fechas futuras (según la fecha real del sistema).
   *  - No se puede gastar más de lo que el usuario tiene disponible
   *    (ingresos totales menos pasivos activos ya comprometidos).
   */
  private async assertValidGasto(
    userId: number,
    monto: number,
    fechaVencimiento: string | null,
    excludePasivoId: number | null
  ): Promise<void> {
    if (fechaVencimiento) {
      // "Hoy" en hora LOCAL del servidor: la fecha llega como YYYY-MM-DD local.
      const ahora = new Date();
      const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
      if (fechaVencimiento > hoy) {
        throw new PasivoError("No puede agregar el dato hasta que se cumpla la fecha deseada.", 400);
      }
    }

    const excludeClause = excludePasivoId ? "AND id != $2" : "";
    const params: any[] = [userId];
    if (excludePasivoId) params.push(excludePasivoId);

    const result = await pool.query(
      `SELECT
         (
           (SELECT COALESCE(SUM(monto), 0)::numeric FROM activos WHERE user_id = $1)
           -
           (SELECT COALESCE(SUM(monto), 0)::numeric FROM pasivos
            WHERE user_id = $1 AND estado = 'ACTIVO' AND fecha_vencimiento <= CURRENT_DATE ${excludeClause})
         ) AS disponible`,
      params
    );
    const disponible = Number(result.rows[0]?.disponible ?? 0);

    if (monto > disponible) {
      throw new PasivoError("Sin fondos suficientes.", 400);
    }
  }

  private async findById(userId: number, id: number) {
    const result = await pool.query(
      `SELECT id, nombre, monto, categoria, empresa, tasa_interes, fecha_vencimiento, estado, descripcion
       FROM pasivos WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (result.rowCount === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      nombre: row.nombre,
      monto: Number(row.monto),
      categoria: row.categoria,
      empresa: row.empresa ?? null,
      tasaInteres: Number(row.tasa_interes ?? 0),
      fechaVencimiento: row.fecha_vencimiento ? toDateString(row.fecha_vencimiento) : null,
      estado: row.estado,
      descripcion: row.descripcion ?? null,
    };
  }
}

function mapRowFull(row: any): Pasivo {
  return {
    id: row.id,
    userId: row.user_id,
    nombre: row.nombre,
    monto: Number(row.monto),
    categoria: row.categoria,
    empresa: row.empresa ?? null,
    tasaInteres: Number(row.tasa_interes ?? 0),
    fechaVencimiento: row.fecha_vencimiento ? toDateString(row.fecha_vencimiento) : null,
    estado: row.estado,
    descripcion: row.descripcion ?? null,
    createdAt: row.created_at,
  };
}

export const pasivoService = new PasivoService();
