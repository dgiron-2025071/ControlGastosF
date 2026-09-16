import { randomUUID } from "crypto";
import { pool } from "../../../config/database";
import {
  Pendiente,
  PendienteCreateInput,
  PendienteListResponse,
  mapPendienteRow,
  toDateString,
} from "../models/pendiente.model";

export class PendienteError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "PendienteError";
  }
}

export class PendienteService {
  async listMonth(
    userId: number,
    year: number,
    month: number
  ): Promise<PendienteListResponse> {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    const propiosResult = await pool.query(
      `SELECT id, nombre, monto, tipo, categoria, frecuencia, fecha_vencimiento, estado, descripcion,
              recurrencia_id, fijo,
              'PENDIENTE' AS origen, NULL AS suscripcion_id
       FROM pendientes
       WHERE user_id = $1 AND estado IN ('PENDIENTE', 'VENCIDO')
         AND fecha_vencimiento >= $2 AND fecha_vencimiento <= $3
       ORDER BY fecha_vencimiento ASC, id ASC`,
      [userId, monthStart, monthEnd]
    );

    const suscripcionesResult = await pool.query(
      `SELECT id, nombre, monto, 'Suscripciones' AS categoria, 'MENSUAL' AS frecuencia,
              'MONTO_CONOCIDO' AS tipo,
              proxima_renovacion AS fecha_vencimiento,
              'PENDIENTE' AS estado,
              descripcion,
              'SUSCRIPCION' AS origen, id AS suscripcion_id
       FROM suscripciones
       WHERE user_id = $1 AND estado = 'ACTIVA'
         AND proxima_renovacion >= $2 AND proxima_renovacion <= $3
       ORDER BY proxima_renovacion ASC, id ASC`,
      [userId, monthStart, monthEnd]
    );

    const allItems = [
      ...propiosResult.rows.map((r: any) => ({ ...r, origen: "PENDIENTE", suscripcion_id: null })),
      ...suscripcionesResult.rows,
    ].sort((a: any, b: any) => {
      const da = new Date(a.fecha_vencimiento).getTime();
      const db = new Date(b.fecha_vencimiento).getTime();
      return da - db;
    });

    const totalPendienteResult = await pool.query(
      `SELECT COALESCE(SUM(monto), 0)::numeric AS total
       FROM pendientes
       WHERE user_id = $1 AND fecha_vencimiento >= $2 AND fecha_vencimiento <= $3 AND estado = 'PENDIENTE'`,
      [userId, monthStart, monthEnd]
    );

    const totalSuscripcionesResult = await pool.query(
      `SELECT COALESCE(SUM(monto), 0)::numeric AS total
       FROM suscripciones
       WHERE user_id = $1 AND estado = 'ACTIVA'
         AND proxima_renovacion >= $2 AND proxima_renovacion <= $3`,
      [userId, monthStart, monthEnd]
    );

    const countResult = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM pendientes WHERE user_id = $1 AND fecha_vencimiento >= $2 AND fecha_vencimiento <= $3 AND estado = 'PENDIENTE')
         +
         (SELECT COUNT(*)::int FROM suscripciones WHERE user_id = $1 AND estado = 'ACTIVA' AND proxima_renovacion >= $2 AND proxima_renovacion <= $3)
         AS count`,
      [userId, monthStart, monthEnd]
    );

    const totalPendiente = Number(totalPendienteResult.rows[0].total);
    const totalSuscripciones = Number(totalSuscripcionesResult.rows[0].total);
    const count = Number(countResult.rows[0].count);

    const mayorResult = await pool.query(
      `(
        SELECT nombre, monto FROM pendientes
        WHERE user_id = $1 AND fecha_vencimiento >= $2 AND fecha_vencimiento <= $3 AND estado = 'PENDIENTE'
        ORDER BY monto DESC LIMIT 1
       )
       UNION ALL
       (
        SELECT nombre, monto FROM suscripciones
        WHERE user_id = $1 AND estado = 'ACTIVA'
          AND proxima_renovacion >= $2 AND proxima_renovacion <= $3
        ORDER BY monto DESC LIMIT 1
       )
       ORDER BY monto DESC LIMIT 1`,
      [userId, monthStart, monthEnd]
    );

    const mayorPendiente = mayorResult.rows.length > 0
      ? { nombre: mayorResult.rows[0].nombre, monto: Number(mayorResult.rows[0].monto) }
      : null;

    return {
      stats: {
        totalPendiente,
        totalSuscripciones,
        count,
        mayorPendiente,
      },
      items: allItems.map(mapPendienteRow),
    };
  }

  async create(userId: number, input: PendienteCreateInput): Promise<Pendiente> {
    const nombre = input.nombre?.trim();
    const tipo = input.tipo === "RECORDATORIO" ? "RECORDATORIO" : "MONTO_CONOCIDO";
    const montoRaw = input.monto;
    const monto =
      tipo === "RECORDATORIO" && (montoRaw === undefined || montoRaw === null)
        ? null
        : Number(montoRaw);
    const categoria = (input.categoria?.trim() || "General").trim();
    const frecuencia = input.frecuencia || "MENSUAL";
    const fechaVencimiento = input.fechaVencimiento;
    const descripcion = input.descripcion?.trim() || null;
    const fijo = input.fijo === true;

    if (!nombre) {
      throw new PendienteError("El nombre es obligatorio.", 400);
    }
    if (tipo === "MONTO_CONOCIDO" && (!Number.isFinite(monto as number) || (monto as number) <= 0)) {
      throw new PendienteError("El monto debe ser un número mayor a 0.", 400);
    }
    if (tipo === "RECORDATORIO" && monto !== null && (!Number.isFinite(monto as number) || (monto as number) < 0)) {
      throw new PendienteError("El monto, si se indica, debe ser un número mayor o igual a 0.", 400);
    }
    if (!fechaVencimiento) {
      throw new PendienteError("La fecha de vencimiento es obligatoria.", 400);
    }

    // Solo se admiten fechas de hoy en adelante. El "hoy" se calcula en la
    // hora LOCAL del servidor (la fecha llega como YYYY-MM-DD local), no en UTC.
    const ahora = new Date();
    const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
    if (fechaVencimiento < hoy) {
      throw new PendienteError("Solo puedes registrar pendientes con fecha de hoy o futura.", 400);
    }

    // Los pendientes recurrentes comparten un identificador de grupo para
    // poder borrarlos todos de una sola vez.
    const recurrenciaId = frecuencia === "UNA_VEZ" ? null : randomUUID();

    const fechas = generarFechas(frecuencia, fechaVencimiento);
    let firstRow: any = null;

    for (const fecha of fechas) {
      const result = await pool.query(
        `INSERT INTO pendientes (user_id, nombre, monto, tipo, categoria, frecuencia, fecha_vencimiento, descripcion, recurrencia_id, fijo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, user_id, nombre, monto, tipo, categoria, frecuencia, fecha_vencimiento, estado, descripcion, recurrencia_id, fijo, created_at`,
        [userId, nombre, monto, tipo, categoria, frecuencia, fecha, descripcion, recurrenciaId, fijo]
      );

      const pendienteRow = result.rows[0];
      if (!firstRow) firstRow = pendienteRow;

      await pool.query(
        `INSERT INTO pasivos (user_id, nombre, monto, categoria, empresa, fecha_vencimiento, descripcion, pendiente_id)
         VALUES ($1, $2, $3, $4, NULL, $5, $6, $7)`,
        [userId, nombre, monto ?? 0, categoria, fecha, `Pendiente: ${nombre}`, pendienteRow.id]
      );
    }

    return {
      id: firstRow.id,
      userId,
      nombre: firstRow.nombre,
      monto: firstRow.monto === null ? null : Number(firstRow.monto),
      tipo: firstRow.tipo ?? "MONTO_CONOCIDO",
      categoria: firstRow.categoria,
      frecuencia: firstRow.frecuencia,
      fechaVencimiento: toDateString(firstRow.fecha_vencimiento),
      estado: firstRow.estado,
      descripcion: firstRow.descripcion ?? null,
      origen: "PENDIENTE",
      suscripcionId: null,
      recurrenciaId: firstRow.recurrencia_id ?? null,
      fijo: firstRow.fijo === true || firstRow.fijo === "t" || firstRow.fijo === 1,
      createdAt: firstRow.created_at,
    };
  }

  async remove(userId: number, id: number): Promise<void> {
    const target = await pool.query(
      `SELECT recurrencia_id FROM pendientes WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (target.rowCount === 0) {
      throw new PendienteError("Pendiente no encontrado.", 404);
    }

    const recurrenciaId = target.rows[0].recurrencia_id;
    if (recurrenciaId) {
      // Borra el pendiente y todas sus repeticiones (los pasivos asociados
      // se eliminan en cascada por la FK pasivos.pendiente_id).
      await pool.query(
        `DELETE FROM pendientes WHERE recurrencia_id = $1 AND user_id = $2`,
        [recurrenciaId, userId]
      );
    } else {
      await pool.query(
        `DELETE FROM pendientes WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );
    }
  }

  async markPaid(
    userId: number,
    id: number,
    origen: string,
    suscripcionId: number | null,
    monto?: number | null
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (origen !== "SUSCRIPCION") {
        const pasivoSel = await client.query(
          `SELECT monto FROM pasivos
           WHERE pendiente_id = $1 AND user_id = $2 AND estado = 'ACTIVO'
           ORDER BY id ASC LIMIT 1`,
          [id, userId]
        );

        const montoPago =
          monto !== null && monto !== undefined && Number.isFinite(monto)
            ? monto
            : pasivoSel.rows.length > 0
              ? Number(pasivoSel.rows[0].monto)
              : 0;

        // Disponible = activos totales menos pasivos ACTIVO comprometidos,
        // sin descontar el pasivo del propio pendiente que se está pagando.
        const disp = await client.query(
          `SELECT
             (
               (SELECT COALESCE(SUM(monto), 0)::numeric FROM activos WHERE user_id = $1)
               -
               (SELECT COALESCE(SUM(monto), 0)::numeric FROM pasivos
                WHERE user_id = $1 AND estado = 'ACTIVO'
                  AND fecha_vencimiento <= CURRENT_DATE
                  AND pendiente_id IS DISTINCT FROM $2)
             ) AS disponible`,
          [userId, id]
        );
        const disponible = Number(disp.rows[0]?.disponible ?? 0);

        if (Number(montoPago) > disponible) {
          throw new PendienteError("Sin fondos suficientes.", 400);
        }
      }

      if (origen === "SUSCRIPCION" && suscripcionId) {
        const sel = await client.query(
          `SELECT ciclo_cobro, proxima_renovacion, monto
           FROM suscripciones WHERE id = $1 AND user_id = $2 AND estado = 'ACTIVA'`,
          [suscripcionId, userId]
        );
        if (sel.rows.length === 0) {
          await client.query("ROLLBACK");
          return;
        }

        const ciclo = sel.rows[0].ciclo_cobro;
        const montoSub = Number(sel.rows[0].monto);

        // Las suscripciones aplican la misma validación de fondos que
        // pendientes y pasivos (su pago no genera pasivo).
        const disp = await client.query(
          `SELECT
             (
               (SELECT COALESCE(SUM(monto), 0)::numeric FROM activos WHERE user_id = $1)
               -
               (SELECT COALESCE(SUM(monto), 0)::numeric FROM pasivos
                WHERE user_id = $1 AND estado = 'ACTIVO'
                  AND fecha_vencimiento <= CURRENT_DATE)
             ) AS disponible`,
          [userId]
        );
        const disponible = Number(disp.rows[0]?.disponible ?? 0);

        if (montoSub > disponible) {
          throw new PendienteError("Sin fondos suficientes.", 400);
        }

        if (ciclo === "UNA_VEZ") {
          await client.query(
            `UPDATE suscripciones SET estado = 'CANCELADA' WHERE id = $1 AND user_id = $2`,
            [suscripcionId, userId]
          );
        } else {
          const next = addCiclo(toDateString(sel.rows[0].proxima_renovacion), ciclo);
          await client.query(
            `UPDATE suscripciones SET proxima_renovacion = $3 WHERE id = $1 AND user_id = $2`,
            [suscripcionId, userId, next]
          );
        }
      } else {
        if (monto !== null && monto !== undefined && Number.isFinite(monto) && monto >= 0) {
          await client.query(
            `UPDATE pasivos SET monto = $3
             WHERE pendiente_id = $1 AND user_id = $2 AND estado = 'ACTIVO'`,
            [id, userId, monto]
          );
        }
        await client.query(
          `UPDATE pendientes SET estado = 'PAGADO' WHERE id = $1 AND user_id = $2`,
          [id, userId]
        );
        await client.query(
          `UPDATE pasivos SET estado = 'PAGADO'
           WHERE pendiente_id = $1 AND user_id = $2 AND estado = 'ACTIVO'`,
          [id, userId]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async revertPaid(userId: number, id: number): Promise<void> {
    const result = await pool.query(
      `UPDATE pendientes SET estado = 'PENDIENTE'
       WHERE id = $1 AND user_id = $2 AND estado = 'PAGADO'`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      throw new PendienteError("Este pendiente no está en estado pagado.", 400);
    }

    await pool.query(
      `DELETE FROM pasivos WHERE pendiente_id = $1 AND user_id = $2`,
      [id, userId]
    );
  }
}

export const pendienteService = new PendienteService();

/**
 * Devuelve la fecha inicial y todas sus repeticiones de ciclo hasta un
 * horizonte de 12 meses (con tope de seguridad de 60 instancias).
 */
function generarFechas(frecuencia: string, fechaInicio: string): string[] {
  const fechas: string[] = [fechaInicio];
  if (frecuencia === "UNA_VEZ") return fechas;

  const [y, m, d] = fechaInicio.split("-").map(Number);
  const inicio = new Date(y, m - 1, d);
  const horizonte = new Date(inicio);
  horizonte.setMonth(horizonte.getMonth() + 12);

  let actual = fechaInicio;
  while (fechas.length < 60) {
    const siguiente = addCiclo(actual, frecuencia);
    const [ny, nm, nd] = siguiente.split("-").map(Number);
    const fechaSiguiente = new Date(ny, nm - 1, nd);
    if (fechaSiguiente > horizonte) break;
    fechas.push(siguiente);
    actual = siguiente;
  }
  return fechas;
}

function addMonths(date: Date, months: number): Date {
  const day = date.getDate();
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, maxDay));
  return target;
}

function addCiclo(fecha: string, ciclo: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDate();

  let target: Date;
  switch (ciclo) {
    case "SEMANAL":
      target = new Date(date);
      target.setDate(date.getDate() + 7);
      break;
    case "QUINCENAL":
      target = new Date(date);
      target.setDate(date.getDate() + 15);
      break;
    case "BIMESTRAL":
      target = addMonths(date, 2);
      break;
    case "TRIMESTRAL":
      target = addMonths(date, 3);
      break;
    case "SEMESTRAL":
      target = addMonths(date, 6);
      break;
    case "ANUAL":
      target = addMonths(date, 12);
      break;
    case "MENSUAL":
    default:
      target = addMonths(date, 1);
      break;
  }

  const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  if (day > maxDay) {
    target = new Date(target.getFullYear(), target.getMonth(), maxDay);
  }

  const yy = target.getFullYear();
  const mm = `${target.getMonth() + 1}`.padStart(2, "0");
  const dd = `${target.getDate()}`.padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
