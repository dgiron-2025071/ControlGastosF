import { Component, OnInit, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { ToastComponent } from "./shared/toast/toast.component";
import { AuthService } from "./core/services/auth.service";
import { SessionService } from "./core/services/session.service";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, ToastComponent],
  template: `
    <router-outlet></router-outlet>
    <app-toast></app-toast>
  `,
})
export class AppComponent implements OnInit {
  private authService = inject(AuthService);
  private sessionService = inject(SessionService);

  ngOnInit(): void {
    // Si el usuario recarga la página con una sesión activa, reanudamos el control de inactividad.
    if (this.authService.isAuthenticated()) {
      this.sessionService.start();
    }
  }
}
