import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { ResumenData } from "../models/resumen.model";

const API_URL = "http://localhost:3000";

@Injectable({ providedIn: "root" })
export class ResumenService {
  private http = inject(HttpClient);

  getResumen(year: number, month: number): Observable<ResumenData> {
    return this.http.get<ResumenData>(`${API_URL}/api/dashboard/resumen`, {
      params: { year: year.toString(), month: month.toString() },
    });
  }
}