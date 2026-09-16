export interface Pasivo {
  id: number;
  nombre: string;
  monto: number;
  categoria: string;
  empresa: string | null;
  tasaInteres: number;
  fechaVencimiento: string | null;
  estado: string;
  descripcion: string | null;
}

export interface PasivoCreateInput {
  nombre: string;
  monto: number;
  categoria?: string;
  empresa?: string | null;
  tasaInteres?: number;
  fechaVencimiento?: string | null;
  descripcion?: string | null;
}

export interface PasivoMonthStats {
  totalMensual: number;
  promedio: number;
  count: number;
  mayorCategoria: { nombre: string; total: number; porcentaje: number } | null;
  menorCategoria: { nombre: string; total: number; porcentaje: number } | null;
  vsMesAnterior: {
    percentChange: number;
    diferencia: number;
    totalMesAnterior: number;
  };
}

export interface PasivoListResponse {
  stats: PasivoMonthStats;
  items: Pasivo[];
}
