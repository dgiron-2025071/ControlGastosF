import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { SuscripcionListResponse, Suscripcion, SuscripcionCreateInput } from "../models/suscripcion.model";

const API_URL = "http://localhost:3000/api/suscripciones";

@Injectable({ providedIn: "root" })
export class SuscripcionesService {
  constructor(private http: HttpClient) {}

  listMonth(year: number, month: number): Observable<SuscripcionListResponse> {
    return this.http.get<SuscripcionListResponse>(`${API_URL}?year=${year}&month=${month}`);
  }

  create(input: SuscripcionCreateInput): Observable<{ suscripcion: Suscripcion }> {
    return this.http.post<{ suscripcion: Suscripcion }>(API_URL, input);
  }

  update(id: number, input: Partial<SuscripcionCreateInput>): Observable<{ suscripcion: Suscripcion }> {
    return this.http.put<{ suscripcion: Suscripcion }>(`${API_URL}/${id}`, input);
  }

  remove(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${API_URL}/${id}`);
  }

  changeStatus(id: number, estado: string): Observable<{ suscripcion: Suscripcion }> {
    return this.http.patch<{ suscripcion: Suscripcion }>(`${API_URL}/${id}/estado`, { estado });
  }

  getCiclos(): Observable<{ ciclos: string[] }> {
    return this.http.get<{ ciclos: string[] }>(`${API_URL}/ciclos`);
  }
}
