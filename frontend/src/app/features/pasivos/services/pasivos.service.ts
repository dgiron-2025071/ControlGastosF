import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { PasivoListResponse, Pasivo, PasivoCreateInput } from "../models/pasivo.model";

const API_URL = "http://localhost:3000/api/pasivos";

@Injectable({ providedIn: "root" })
export class PasivosService {
  constructor(private http: HttpClient) {}

  listMonth(year: number, month: number): Observable<PasivoListResponse> {
    return this.http.get<PasivoListResponse>(`${API_URL}?year=${year}&month=${month}`);
  }

  create(input: PasivoCreateInput): Observable<{ pasivo: Pasivo }> {
    return this.http.post<{ pasivo: Pasivo }>(API_URL, input);
  }

  update(id: number, input: PasivoCreateInput): Observable<{ pasivo: Pasivo }> {
    return this.http.put<{ pasivo: Pasivo }>(`${API_URL}/${id}`, input);
  }

  remove(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${API_URL}/${id}`);
  }

  markPaid(id: number): Observable<{ pasivo: Pasivo }> {
    return this.http.patch<{ pasivo: Pasivo }>(`${API_URL}/${id}/pagar`, {});
  }

  getCategorias(): Observable<{ categorias: string[] }> {
    return this.http.get<{ categorias: string[] }>(`${API_URL}/categorias`);
  }
}
