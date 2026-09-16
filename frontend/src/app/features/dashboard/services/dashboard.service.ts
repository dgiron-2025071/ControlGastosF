import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { DashboardData } from "../models/dashboard.model";

const API_URL = "http://localhost:3000";

@Injectable({ providedIn: "root" })
export class DashboardService {
  private http = inject(HttpClient);

  getDashboard(year: number, month: number): Observable<DashboardData> {
    return this.http.get<DashboardData>(`${API_URL}/api/dashboard`, {
      params: { year: year.toString(), month: month.toString() },
    });
  }
}
