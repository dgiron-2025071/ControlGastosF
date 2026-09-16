import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import {
  Activo,
  ActivoMonthResponse,
  ActivoPayload,
} from "../models/activo.model";

const API_URL = "http://localhost:3000";

@Injectable({ providedIn: "root" })
export class ActivosService {
  private http = inject(HttpClient);

  getMonth(year: number, month: number): Observable<ActivoMonthResponse> {
    return this.http.get<ActivoMonthResponse>(`${API_URL}/api/activos`, {
      params: { year: year.toString(), month: month.toString() },
    });
  }

  crearActivo(payload: ActivoPayload): Observable<{ activo: Activo }> {
    return this.http.post<{ activo: Activo }>(`${API_URL}/api/activos`, payload);
  }

  actualizarActivo(
    id: number,
    payload: ActivoPayload
  ): Observable<{ activo: Activo }> {
    return this.http.put<{ activo: Activo }>(
      `${API_URL}/api/activos/${id}`,
      payload
    );
  }

  eliminarActivo(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${API_URL}/api/activos/${id}`);
  }

  getOrigenes(): Observable<{ origenes: string[] }> {
    return this.http.get<{ origenes: string[] }>(`${API_URL}/api/activos/origenes`);
  }
}