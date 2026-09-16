import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, throwError } from "rxjs";
import { AuthService } from "../services/auth.service";
import { SessionService } from "../services/session.service";

const PUBLIC_AUTH_ENDPOINTS = ["/auth/login", "/auth/register"];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const sessionService = inject(SessionService);
  const token = authService.getToken();

  const cloned = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  const isPublicAuthCall = PUBLIC_AUTH_ENDPOINTS.some((path) => req.url.includes(path));

  return next(cloned).pipe(
    catchError((error: HttpErrorResponse) => {
      // Un 401 en login/registro es "credenciales inválidas", no una sesión expirada.
      if (error.status === 401 && !isPublicAuthCall) {
        sessionService.expireSession("unauthorized");
      }
      return throwError(() => error);
    })
  );
};
