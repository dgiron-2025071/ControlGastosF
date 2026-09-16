import { pool } from "../../../config/database";
import { Movimiento, MovimientoListResponse, mapMovimientoRow } from "../models/movimiento.model";

export class MovimientoService {
  async listMonth(
    userId: number,
    year: number,
    month: number
  ): Promise<MovimientoListResponse> {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    const result = await pool.query(
      `
      (
        SELECT id, nombre, monto, 'INGRESO' AS tipo, categoria, fecha,
               'ACTIVO' AS origen, id AS origen_id, 'COMPLETADO' AS estado
        FROM activos
        WHERE user_id = $1 AND fecha >= $2 AND fecha <= $3
      )
      UNION ALL
      (
        SELECT id, nombre, monto, 'EGRESO' AS tipo, categoria,
               fecha_vencimiento AS fecha, 'PASIVO' AS origen, id AS origen_id, estado
        FROM pasivos
        WHERE user_id = $1 AND fecha_vencimiento >= $2 AND fecha_vencimiento <= $3
      )
      UNION ALL
      (
        SELECT id, nombre, monto, 'EGRESO' AS tipo, 'Suscripciones' AS categoria,
               proxima_renovacion AS fecha, 'SUSCRIPCION' AS origen, id AS origen_id, estado
        FROM suscripciones
        WHERE user_id = $1 AND estado = 'ACTIVA'
          AND proxima_renovacion >= $2 AND proxima_renovacion <= $3
      )
      ORDER BY fecha ASC, tipo ASC
      `,
      [userId, monthStart, monthEnd]
    );

    const items = result.rows.map(mapMovimientoRow);

    const totalIngresos = items
      .filter((i) => i.tipo === "INGRESO")
      .reduce((sum, i) => sum + i.monto, 0);

    const totalPasivos = items
      .filter((i) => i.tipo === "EGRESO" && i.origen === "PASIVO")
      .reduce((sum, i) => sum + i.monto, 0);

    const totalSuscripciones = items
      .filter((i) => i.tipo === "EGRESO" && i.origen === "SUSCRIPCION")
      .reduce((sum, i) => sum + i.monto, 0);

    const totalEgresos = totalPasivos + totalSuscripciones;

    return {
      totalIngresos,
      totalEgresos,
      balance: totalIngresos - totalEgresos,
      totalActivos: totalIngresos,
      totalPasivos,
      totalSuscripciones,
      totalTransacciones: items.length,
      items,
    };
  }
}

export const movimientoService = new MovimientoService();
