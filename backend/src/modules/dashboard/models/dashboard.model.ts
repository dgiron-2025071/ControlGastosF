export interface DashboardSummary {
  totalBalance: number;
  totalActivos: number;
  totalPasivos: number;
  monthBalance: number;
  percentChange: number;
}

export interface ChartDataPoint {
  month: string;
  year: number;
  monthNum: number;
  ingresos: number;
  gastos: number;
}

export interface PendingItem {
  id: number;
  nombre: string;
  monto: number;
  fechaVencimiento: string;
  diasRestantes: number;
}

export interface SubscriptionItem {
  id: number;
  nombre: string;
  monto: number;
  proximaRenovacion: string;
  diasRestantes: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  chart: ChartDataPoint[];
  pending: PendingItem[];
  subscriptions: SubscriptionItem[];
}
