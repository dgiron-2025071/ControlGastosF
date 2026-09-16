export type PendienteEstado = "PENDIENTE" | "PAGADO" | "VENCIDO";
export type PendienteFrecuencia = "UNA_VEZ" | "SEMANAL" | "QUINCENAL" | "MENSUAL" | "BIMESTRAL" | "TRIMESTRAL" | "SEMESTRAL" | "ANUAL";
export type PendienteTipo = "MONTO_CONOCIDO" | "RECORDATORIO";

export interface Pendiente {
  id: number;
  userId: number;
  nombre: string;
  monto: number | null;
  tipo: PendienteTipo;
  categoria: string;
  frecuencia: PendienteFrecuencia;
  fechaVencimiento: string;
  estado: PendienteEstado;
  descripcion: string | null;
  origen: "PENDIENTE" | "SUSCRIPCION";
  suscripcionId: number | null;
  recurrenciaId: string | null;
  fijo: boolean;
  createdAt: Date;
}

export interface PendienteCreateInput {
  nombre: string;
  monto?: number | null;
  tipo?: PendienteTipo;
  categoria?: string;
  frecuencia?: PendienteFrecuencia;
  fechaVencimiento: string;
  descripcion?: string | null;
  fijo?: boolean;
}

export interface PendienteMonthStats {
  totalPendiente: number;
  totalSuscripciones: number;
  count: number;
  mayorPendiente: { nombre: string; monto: number } | null;
}

export interface PendienteListResponse {
  stats: PendienteMonthStats;
  items: Array<Omit<Pendiente, "userId" | "createdAt">>;
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

export function mapPendienteRow(row: any): Omit<Pendiente, "userId" | "createdAt"> {
  return {
    id: row.id,
    nombre: row.nombre,
    monto: row.monto === null || row.monto === undefined ? null : Number(row.monto),
    tipo: row.tipo ?? "MONTO_CONOCIDO",
    categoria: row.categoria ?? "General",
    frecuencia: row.frecuencia ?? "MENSUAL",
    fechaVencimiento: toDateString(row.fecha_vencimiento),
    estado: row.estado,
    descripcion: row.descripcion ?? null,
    origen: row.origen ?? "PENDIENTE",
    suscripcionId: row.suscripcion_id ?? null,
    recurrenciaId: row.recurrencia_id ?? null,
    fijo: row.fijo === true || row.fijo === "t" || row.fijo === 1,
  };
}
