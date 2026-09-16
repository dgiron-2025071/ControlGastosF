export interface ResumenMonth {
  monthNum: number;
  mes: string;
  mesCorto: string;
  ingresos: number;
  gastos: number;
  balance: number;
}

export interface ResumenYear {
  year: number;
  meses: ResumenMonth[];
  totalIngresos: number;
  totalGastos: number;
  balance: number;
}

export interface ResumenData {
  selectedYear: number;
  selectedMonth: number;
  years: ResumenYear[];
  mayorPendiente?: { nombre: string; monto: number } | null;
}