export type CicloCobro = "UNA_VEZ" | "SEMANAL" | "QUINCENAL" | "MENSUAL" | "BIMESTRAL" | "TRIMESTRAL" | "SEMESTRAL" | "ANUAL";

export interface Suscripcion {
  id: number;
  nombre: string;
  monto: number;
  cicloCobro: CicloCobro;
  proximaRenovacion: string;
  estado: string;
  descripcion: string | null;
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
  items: Suscripcion[];
}
