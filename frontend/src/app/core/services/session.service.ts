import { Injectable, NgZone, inject } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "./auth.service";
import { ToastService } from "./toast.service";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MS = 15 * 1000;
// Renueva el token si le faltan menos de 5 minutos para expirar.
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;
// Evita llamadas de refresh en cadena: mínimo 1 minuto entre cada una.
const MIN_REFRESH_INTERVAL_MS = 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"];

@Injectable({ providedIn: "root" })
export class SessionService {
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private expiryCheckInterval: ReturnType<typeof setInterval> | null = null;
  private listening = false;
  private lastRefreshAt = 0;
  private resetHandler = () => {
    this.restartIdleTimer();
    this.checkTokenRefresh();
  };

  /** Debe llamarse una vez que el usuario tiene una sesión activa. */
  start(): void {
    if (this.listening || !this.authService.isAuthenticated()) {
      return;
    }

    this.listening = true;

    this.ngZone.runOutsideAngular(() => {
      ACTIVITY_EVENTS.forEach((eventName) =>
        document.addEventListener(eventName, this.resetHandler, { passive: true })
      );

      this.expiryCheckInterval = setInterval(() => this.checkExpiry(), CHECK_INTERVAL_MS);
    });

    this.restartIdleTimer();
  }

  stop(): void {
    if (!this.listening) {
      return;
    }

    this.listening = false;
    ACTIVITY_EVENTS.forEach((eventName) =>
      document.removeEventListener(eventName, this.resetHandler)
    );

    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    if (this.expiryCheckInterval) {
      clearInterval(this.expiryCheckInterval);
      this.expiryCheckInterval = null;
    }
  }

  /** Cierre de sesión voluntario desde la interfaz: limpia el estado, detiene el control de inactividad y va al login. */
  logout(): void {
    if (!this.authService.getToken()) {
      this.stop();
      return;
    }

    this.stop();
    this.authService.logout();
    this.ngZone.run(() => this.router.navigate(["/login"]));
  }

  /** Cierra la sesión y notifica al usuario. Usado por inactividad, expiración de JWT o un 401 del backend. */
  expireSession(reason: "idle" | "token" | "unauthorized" = "token"): void {
    if (!this.authService.getToken()) {
      this.stop();
      return;
    }

    this.stop();
    this.authService.logout();

    this.ngZone.run(() => {
      const detail =
        reason === "idle"
          ? "Cerramos tu sesión por inactividad prolongada."
          : undefined;

      // Aviso persistente: solo desaparece cuando el usuario hace clic en cerrar.
      this.toastService.persistent("Su sesión expiró. Debe iniciar sesión de nuevo.", detail);
      this.router.navigate(["/login"]);
    });
  }

  private restartIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.idleTimer = setTimeout(() => this.expireSession("idle"), IDLE_TIMEOUT_MS);
  }

  private checkExpiry(): void {
    if (this.authService.isTokenExpired()) {
      this.expireSession("token");
      return;
    }

    this.checkTokenRefresh();
  }

  /**
   * Sesión deslizante: mientras el usuario interactúa, el token se renueva
   * antes de expirar. El conteo de expiración inicia en la inactividad, no
   * en el momento del login.
   */
  private checkTokenRefresh(): void {
    if (!this.authService.getToken()) {
      return;
    }

    const expiry = this.authService.getTokenExpiryMs();
    if (expiry === null) {
      return;
    }

    const now = Date.now();
    if (now - this.lastRefreshAt < MIN_REFRESH_INTERVAL_MS) {
      return;
    }

    if (expiry - now <= REFRESH_BEFORE_EXPIRY_MS) {
      this.lastRefreshAt = now;
      this.authService.refreshToken().subscribe({
        error: () => {
          // El interceptor maneja los 401; aquí solo dejamos de intentar.
          this.lastRefreshAt = 0;
        },
      });
    }
  }
}
