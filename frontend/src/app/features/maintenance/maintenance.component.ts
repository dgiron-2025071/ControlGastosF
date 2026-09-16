import { Component, OnDestroy, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { AuthService } from "../../core/services/auth.service";
import { SessionService } from "../../core/services/session.service";

@Component({
  selector: "app-maintenance",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./maintenance.component.html",
  styleUrl: "./maintenance.component.css",
})
export class MaintenanceComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private sessionService = inject(SessionService);
  private router = inject(Router);

  get user() {
    return this.authService.currentUser();
  }

  ngOnInit(): void {
    this.sessionService.start();
  }

  ngOnDestroy(): void {
    // No detenemos el watcher aquí a propósito: si el usuario navega dentro de la
    // app autenticada, la sesión sigue vigilándose. Solo se detiene en logout/expiración.
  }

  logout(): void {
    this.sessionService.stop();
    this.authService.logout();
    this.router.navigate(["/login"], { replaceUrl: true });
  }
}
