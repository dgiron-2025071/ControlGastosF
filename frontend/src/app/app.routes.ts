import { Routes } from "@angular/router";
import { authGuard } from "./core/guards/auth.guard";
import { loginGuard } from "./core/guards/login.guard";

export const routes: Routes = [
  { path: "", redirectTo: "login", pathMatch: "full" },
  {
    path: "login",
    canActivate: [loginGuard],
    loadComponent: () =>
      import("./features/login/login.component").then((m) => m.LoginComponent),
  },
  {
    path: "register",
    canActivate: [loginGuard],
    loadComponent: () =>
      import("./features/register/register.component").then(
        (m) => m.RegisterComponent
      ),
  },
  {
    path: "dashboard",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./features/dashboard/dashboard.component").then(
        (m) => m.DashboardComponent
      ),
  },
  {
    path: "activos",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./features/activos/activos.component").then(
        (m) => m.ActivosComponent
      ),
  },
  {
    path: "resumen",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./features/resumen/resumen.component").then(
        (m) => m.ResumenComponent
      ),
  },
  {
    path: "pasivos",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./features/pasivos/pasivos.component").then(
        (m) => m.PasivosComponent
      ),
  },
  {
    path: "pendientes",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./features/pendientes/pendientes.component").then(
        (m) => m.PendientesComponent
      ),
  },
  {
    path: "suscripciones",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./features/suscripciones/suscripciones.component").then(
        (m) => m.SuscripcionesComponent
      ),
  },
  {
    path: "movimientos",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./features/movimientos/movimientos.component").then(
        (m) => m.MovimientosComponent
      ),
  },
  {
    path: "maintenance",
    redirectTo: "dashboard",
    pathMatch: "full",
  },
  { path: "**", redirectTo: "login" },
];
