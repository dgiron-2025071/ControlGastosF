export const CATEGORIAS_GASTO = [
  "Suscripciones",
  "Tarjetas",
  "Alimentacion",
  "Transporte",
  "Servicios",
  "Vivienda",
  "Prestamos",
  "Deudas",
  "Salud",
  "Educacion",
  "Entretenimiento",
  "Vestimenta",
  "Estetica",
  "Mantenimiento",
  "Impuestos",
] as const;

export type PasivoEstado = "ACTIVO" | "PAGADO" | "VENCIDO";

export interface Pasivo {
  id: number;
  userId: number;
  nombre: string;
  monto: number;
  categoria: string;
  empresa: string | null;
  tasaInteres: number;
  fechaVencimiento: string | null;
  estado: PasivoEstado;
  descripcion: string | null;
  createdAt: Date;
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
  items: Array<Omit<Pasivo, "userId" | "createdAt">>;
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

export function mapPasoRow(row: any): Omit<Pasivo, "userId" | "createdAt"> {
  return {
    id: row.id,
    nombre: row.nombre,
    monto: Number(row.monto),
    categoria: row.categoria,
    empresa: row.empresa ?? null,
    tasaInteres: Number(row.tasa_interes ?? 0),
    fechaVencimiento: row.fecha_vencimiento ? toDateString(row.fecha_vencimiento) : null,
    estado: row.estado,
    descripcion: row.descripcion ?? null,
  };
}
