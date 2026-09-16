import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { PendienteListResponse, Pendiente, PendienteCreateInput } from "../models/pendiente.model";

const API_URL = "http://localhost:3000/api/pendientes";

@Injectable({ providedIn: "root" })
export class PendientesService {
  constructor(private http: HttpClient) {}

  listMonth(year: number, month: number): Observable<PendienteListResponse> {
    return this.http.get<PendienteListResponse>(`${API_URL}?year=${year}&month=${month}`);
  }

  create(input: PendienteCreateInput): Observable<{ pendiente: Pendiente }> {
    return this.http.post<{ pendiente: Pendiente }>(API_URL, input);
  }

  markPaid(id: number, origen: string, suscripcionId: number | null, monto?: number | null): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${API_URL}/${id}/pagar`, { origen, suscripcionId, monto });
  }

  revertPaid(id: number): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${API_URL}/${id}/revertir`, {});
  }

  remove(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${API_URL}/${id}`);
  }
}
