export type PendienteTipo = "MONTO_CONOCIDO" | "RECORDATORIO";

export interface Pendiente {
  id: number;
  nombre: string;
  monto: number | null;
  tipo: PendienteTipo;
  categoria: string;
  frecuencia: string;
  fechaVencimiento: string;
  estado: string;
  descripcion: string | null;
  origen: "PENDIENTE" | "SUSCRIPCION";
  suscripcionId: number | null;
  recurrenciaId: string | null;
  fijo: boolean;
}

export interface PendienteCreateInput {
  nombre: string;
  monto?: number | null;
  tipo?: PendienteTipo;
  categoria?: string;
  frecuencia?: string;
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
  items: Pendiente[];
}
