export const CICLOS_COBRO = [
  "UNA_VEZ",
  "SEMANAL",
  "QUINCENAL",
  "MENSUAL",
  "BIMESTRAL",
  "TRIMESTRAL",
  "SEMESTRAL",
  "ANUAL",
] as const;

export type SuscripcionEstado = "ACTIVA" | "PAUSADA" | "CANCELADA";
export type CicloCobro = typeof CICLOS_COBRO[number];

export interface Suscripcion {
  id: number;
  userId: number;
  nombre: string;
  monto: number;
  cicloCobro: CicloCobro;
  proximaRenovacion: string;
  estado: SuscripcionEstado;
  descripcion: string | null;
  createdAt: Date;
}

export interface SuscripcionCreateInput {
  nombre: string;
  monto: number;
  cicloCobro?: CicloCobro;
  proximaRenovacion: string;
  descripcion?: string | null;
}

export interface SuscripcionMonthStats {
  totalMensual: number;
  totalAnual: number;
  promedio: number;
  mayor: { nombre: string; monto: number } | null;
  count: number;
  activas: number;
  pausadas: number;
  canceladas: number;
}

export interface SuscripcionListResponse {
  stats: SuscripcionMonthStats;
  items: Array<Omit<Suscripcion, "userId" | "createdAt">>;
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

export function mapSuscripcionRow(row: any): Omit<Suscripcion, "userId" | "createdAt"> {
  return {
    id: row.id,
    nombre: row.nombre,
    monto: Number(row.monto),
    cicloCobro: row.ciclo_cobro,
    proximaRenovacion: toDateString(row.proxima_renovacion),
    estado: row.estado,
    descripcion: row.descripcion ?? null,
  };
}
