import { pool } from "../../../config/database";

const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const FULL_MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export class DashboardService {
  async getDashboard(userId: number, year: number, month: number) {
    const [summary, chart, pending, subscriptions] = await Promise.all([
      this.getSummary(userId, year, month),
      this.getChartData(userId, year, month),
      this.getPending(userId),
      this.getSubscriptions(userId),
    ]);

    return { summary, chart, pending, subscriptions };
  }

  async getResumen(userId: number, year: number, month: number) {
    const years = [];
    const startYear = year - 2;
    const endYear = year + 1;

    for (let y = startYear; y <= endYear; y++) {
      const months = [];

      for (let m = 1; m <= 12; m++) {
        const ingresos = await this.getMonthTotal(userId, y, m, "INGRESO");
        const gastos = await this.getMonthTotal(userId, y, m, "GASTO");

        months.push({
          monthNum: m,
          mes: FULL_MONTH_NAMES[m - 1],
          mesCorto: MONTH_NAMES[m - 1],
          ingresos,
          gastos,
          balance: ingresos - gastos,
        });
      }

      years.push({
        year: y,
        meses: months,
        totalIngresos: months.reduce((acc, m) => acc + m.ingresos, 0),
        totalGastos: months.reduce((acc, m) => acc + m.gastos, 0),
        balance: months.reduce((acc, m) => acc + m.balance, 0),
      });
    }

    // Mayor pendiente del mes seleccionado (pendientes + suscripciones), usado
    // por el Resumen para mostrar el dato con su nombre.
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

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

    return { selectedYear: year, selectedMonth: month, years, mayorPendiente };
  }

  private async getSummary(userId: number, year: number, month: number) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    const activosResult = await pool.query(
      `SELECT COALESCE(SUM(monto), 0)::numeric AS total
       FROM activos WHERE user_id = $1`,
      [userId]
    );

    const pasivosResult = await pool.query(
      `SELECT COALESCE(SUM(monto), 0)::numeric AS total
       FROM pasivos WHERE user_id = $1 AND estado = 'ACTIVO'`,
      [userId]
    );

    const monthIngresosResult = await pool.query(
      `SELECT COALESCE(SUM(monto), 0)::numeric AS total
       FROM activos
       WHERE user_id = $1
         AND fecha >= $2 AND fecha <= $3`,
      [userId, monthStart, monthEnd]
    );

    const monthGastosResult = await pool.query(
      `SELECT
         (
           (SELECT COALESCE(SUM(monto), 0)::numeric
            FROM pasivos
            WHERE user_id = $1 AND fecha_vencimiento >= $2 AND fecha_vencimiento <= $3)
           +
           (SELECT COALESCE(SUM(monto), 0)::numeric
            FROM suscripciones
            WHERE user_id = $1 AND estado = 'ACTIVA'
              AND proxima_renovacion >= $2 AND proxima_renovacion <= $3)
         ) AS total`,
      [userId, monthStart, monthEnd]
    );

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonthStart = new Date(prevYear, prevMonth - 1, 1);
    const prevMonthEnd = new Date(prevYear, prevMonth, 0);

    const prevIngresosResult = await pool.query(
      `SELECT COALESCE(SUM(monto), 0)::numeric AS total
       FROM activos
       WHERE user_id = $1
         AND fecha >= $2 AND fecha <= $3`,
      [userId, prevMonthStart, prevMonthEnd]
    );

    const prevGastosResult = await pool.query(
      `SELECT
         (
           (SELECT COALESCE(SUM(monto), 0)::numeric
            FROM pasivos
            WHERE user_id = $1 AND fecha_vencimiento >= $2 AND fecha_vencimiento <= $3)
           +
           (SELECT COALESCE(SUM(monto), 0)::numeric
            FROM suscripciones
            WHERE user_id = $1 AND estado = 'ACTIVA'
              AND proxima_renovacion >= $2 AND proxima_renovacion <= $3)
         ) AS total`,
      [userId, prevMonthStart, prevMonthEnd]
    );

    const totalActivos = Number(activosResult.rows[0].total);
    const totalPasivos = Number(pasivosResult.rows[0].total);
    const monthIngresos = Number(monthIngresosResult.rows[0].total);
    const monthGastos = Number(monthGastosResult.rows[0].total);
    const monthBalance = monthIngresos - monthGastos;

    const prevIngresos = Number(prevIngresosResult.rows[0].total);
    const prevGastos = Number(prevGastosResult.rows[0].total);
    const prevBalance = prevIngresos - prevGastos;

    let percentChange = 0;
    if (prevBalance !== 0) {
      percentChange = ((monthBalance - prevBalance) / Math.abs(prevBalance)) * 100;
    } else if (monthBalance !== 0) {
      percentChange = 100;
    }

    return {
      totalBalance: totalActivos - totalPasivos,
      totalActivos,
      totalPasivos,
      monthBalance,
      percentChange: Math.round(percentChange * 10) / 10,
    };
  }

  private async getChartData(userId: number, year: number, month: number) {
    const points: { month: string; year: number; monthNum: number; ingresos: number; gastos: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      let m = month - i;
      let y = year;
      while (m <= 0) { m += 12; y--; }

      const ingresos = await this.getMonthTotal(userId, y, m, "INGRESO");
      const gastos = await this.getMonthTotal(userId, y, m, "GASTO");

      points.push({
        month: MONTH_NAMES[m - 1],
        year: y,
        monthNum: m,
        ingresos,
        gastos,
      });
    }

    return points;
  }

  /**
   * Los ingresos se toman de la tabla `activos` y los gastos de la suma
   * de `pasivos` (deudas/egresos del mes) + `suscripciones` activas con
   * renovación en el mes consultado.
   */
  private async getMonthTotal(
    userId: number,
    year: number,
    month: number,
    kind: "INGRESO" | "GASTO"
  ): Promise<number> {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    if (kind === "INGRESO") {
      const result = await pool.query(
        `SELECT COALESCE(SUM(monto), 0)::numeric AS total
         FROM activos
         WHERE user_id = $1 AND fecha >= $2 AND fecha <= $3`,
        [userId, monthStart, monthEnd]
      );
      return Number(result.rows[0].total);
    }

    const result = await pool.query(
      `SELECT
         (
           (SELECT COALESCE(SUM(monto), 0)::numeric
            FROM pasivos
            WHERE user_id = $1 AND fecha_vencimiento >= $2 AND fecha_vencimiento <= $3)
           +
           (SELECT COALESCE(SUM(monto), 0)::numeric
            FROM suscripciones
            WHERE user_id = $1 AND estado = 'ACTIVA'
              AND proxima_renovacion >= $2 AND proxima_renovacion <= $3)
         ) AS total`,
      [userId, monthStart, monthEnd]
    );
    return Number(result.rows[0].total);
  }

  private async getPending(userId: number) {
    const result = await pool.query(
      `SELECT id, nombre, monto, fecha_vencimiento, recurrencia_id,
              (fecha_vencimiento - CURRENT_DATE)::int AS dias_restantes
       FROM pendientes
       WHERE user_id = $1 AND estado = 'PENDIENTE' AND fecha_vencimiento >= CURRENT_DATE
       ORDER BY fecha_vencimiento ASC, id ASC`,
      [userId]
    );

    // Un pendiente recurrente se pre-genera en todos los meses, pero en el
    // inicio solo debe verse el PRÓXIMO a vencer de cada tipo: al marcarlo
    // pagado, la siguiente instancia del grupo pasa a ser la más próxima.
    const vistos = new Set<string>();
    const unicos: any[] = [];
    for (const row of result.rows) {
      const clave = row.recurrencia_id ?? `single-${row.id}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      unicos.push(row);
      if (unicos.length >= 5) break;
    }

    return unicos.map((r: any) => ({
      id: r.id,
      nombre: r.nombre,
      monto: Number(r.monto),
      fechaVencimiento: r.fecha_vencimiento,
      diasRestantes: r.dias_restantes,
    }));
  }

  private async getSubscriptions(userId: number) {
    const result = await pool.query(
      `SELECT id, nombre, monto, proxima_renovacion,
              (proxima_renovacion - CURRENT_DATE)::int AS dias_restantes
       FROM suscripciones
       WHERE user_id = $1 AND estado = 'ACTIVA'
         AND proxima_renovacion >= CURRENT_DATE
       ORDER BY proxima_renovacion ASC
       LIMIT 5`,
      [userId]
    );

    return result.rows.map((r: any) => ({
      id: r.id,
      nombre: r.nombre,
      monto: Number(r.monto),
      proximaRenovacion: r.proxima_renovacion,
      diasRestantes: r.dias_restantes,
    }));
  }
}

export const dashboardService = new DashboardService();