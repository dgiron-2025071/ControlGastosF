import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { MovimientoListResponse } from "../models/movimiento.model";

const API_URL = "http://localhost:3000/api/movimientos";

@Injectable({ providedIn: "root" })
export class MovimientosService {
  constructor(private http: HttpClient) {}

  listMonth(year: number, month: number): Observable<MovimientoListResponse> {
    return this.http.get<MovimientoListResponse>(`${API_URL}?year=${year}&month=${month}`);
  }
}
