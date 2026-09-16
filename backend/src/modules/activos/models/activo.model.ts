export const ORIGENES = [
  "Salario",
  "Honorarios",
  "Bonos",
  "Comisiones",
  "Rentas",
  "Intereses",
  "Dividendos",
  "Pensiones",
  "Remesas",
  "Regalías",
  "Ventas",
  "Servicios",
  "Suscripciones",
  "Préstamos",
  "Inversiones",
  "Capital",
  "Subvenciones",
] as const;

export interface Activo {
  id: number;
  userId: number;
  nombre: string;
  monto: number;
  categoria: string;
  empresa: string | null;
  descripcion: string | null;
  fecha: string;
  createdAt: Date;
}

export interface ActivoCreateInput {
  nombre: string;
  monto: number;
  categoria?: string;
  empresa?: string | null;
  descripcion?: string | null;
  fecha?: string;
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

export interface ActivoListResponse {
  stats: ActivoMonthStats;
  items: Array<Omit<Activo, "userId" | "createdAt">>;
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

export function mapActivoRow(row: any): Omit<Activo, "userId" | "createdAt"> {
  return {
    id: row.id,
    nombre: row.nombre,
    monto: Number(row.monto),
    categoria: row.categoria,
    empresa: row.empresa ?? null,
    descripcion: row.descripcion ?? null,
    fecha: toDateString(row.fecha),
  };
}