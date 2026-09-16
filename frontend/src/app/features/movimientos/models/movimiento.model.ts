export interface Movimiento {
  id: number;
  nombre: string;
  monto: number;
  tipo: "INGRESO" | "EGRESO";
  categoria: string;
  fecha: string;
  estado: string;
  origen: string;
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
