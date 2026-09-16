export interface Activo {
  id: number;
  nombre: string;
  monto: number;
  categoria: string;
  empresa: string | null;
  descripcion: string | null;
  fecha: string;
}

export interface ActivoPayload {
  nombre: string;
  monto: number;
  categoria: string;
  empresa?: string | null;
  descripcion?: string | null;
  fecha: string;
}

export interface ActivoMonthStats {
  totalMensual: number;
  promedio: number;
  count: number;
  vsMesAnterior: {
    percentChange: number;
    diferencia: number;
    totalMesAnterior: number;
  };
}

export interface ActivoMonthResponse {
  stats: ActivoMonthStats;
  items: Activo[];
}