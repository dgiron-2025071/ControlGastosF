export type MovimientoOrigen = "ACTIVO" | "PASIVO" | "SUSCRIPCION";

export interface Movimiento {
  id: number;
  nombre: string;
  monto: number;
  tipo: "INGRESO" | "EGRESO";
  categoria: string;
  fecha: string;
  estado: string;
  origen: MovimientoOrigen;
  origenId: number;
}

export interface MovimientoListResponse {
  totalIngresos: number;
  totalEgresos: number;
  balance: number;
  totalActivos: number;
  totalPasivos: number;
  totalSuscripciones: number;
  totalTransacciones: number;
  items: Movimiento[];
}

export function toDateString(value: any): string {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = `${value.getMonth() + 1}`.padStart(2, "0");
    const d = `${value.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

export function mapMovimientoRow(row: any): Movimiento {
  return {
    id: row.id,
    nombre: row.nombre,
    monto: Number(row.monto),
    tipo: row.tipo,
    categoria: row.categoria,
    fecha: toDateString(row.fecha),
    estado: row.estado,
    origen: row.origen,
    origenId: row.origen_id,
  };
}
