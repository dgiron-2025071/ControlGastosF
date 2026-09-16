import { Component, inject, signal, NgZone, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormBuilder, Validators } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from "../../core/services/auth.service";
import { SessionService } from "../../core/services/session.service";
import { ToastService } from "../../core/services/toast.service";
import { environment } from "../../../environments/environment";

declare const google: any;

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.css",
})
export class LoginComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private sessionService = inject(SessionService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  loading = signal(false);
  errorMessage = signal<string | null>(null);
  shake = signal(false);
  showPassword = signal(false);
  googleLoading = signal(false);
  googleVisible = signal(true);
  googleButtonReady = signal(false);

  private googleInitialized = false;
  private loadingGoogleScript = false;

  form = this.fb.group({
    email: ["", [Validators.required, Validators.email]],
    password: ["", [Validators.required]],
  });

  get email() {
    return this.form.controls.email;
  }

  get password() {
    return this.form.controls.password;
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  ngOnInit(): void {
    this.ensureGoogleScriptLoaded();
  }

  ngOnDestroy(): void {
    if (this.googleInitialized && google?.accounts?.id) {
      google.accounts.id.cancel();
    }
  }

  submit(): void {
    this.errorMessage.set(null);

    if (this.loading()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.triggerShake();
      return;
    }

    this.loading.set(true);

    const { email, password } = this.form.getRawValue();

    this.authService.login(email!, password!).subscribe({
      next: () => {
        this.loading.set(false);
        this.sessionService.start();
        this.toastService.success(
          "Sesión iniciada correctamente.",
          "Por seguridad, tu sesión expirará después de un tiempo de inactividad."
        );
        this.router.navigate(["/dashboard"]);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(
          err?.error?.message === "Invalid credentials" || err?.status === 401
            ? "No pudimos iniciar sesión. Verifica tus credenciales e inténtalo nuevamente."
            : "Ocurrió un problema al iniciar sesión. Inténtalo de nuevo en unos segundos."
        );
        this.triggerShake();
      },
    });
  }

  loginWithGoogle(): void {
    if (this.loading() || this.googleLoading()) return;

    if (!google?.accounts?.id) {
      this.errorMessage.set(
        "Google aún no está disponible. Intenta de nuevo en unos segundos."
      );
      this.triggerShake();
      return;
    }

    if (!this.googleInitialized) {
      this.initializeGoogle();
      if (!this.googleInitialized) return;
    }

    try {
      google.accounts.id.cancel();
      google.accounts.id.prompt();
      this.errorMessage.set(null);
    } catch {
      this.errorMessage.set(
        "No se pudo abrir el selector de Google. Intenta de nuevo."
      );
      this.triggerShake();
    }
  }

  private ensureGoogleScriptLoaded(): void {
    if (google?.accounts?.id) {
      this.initializeGoogle();
      return;
    }

    if (this.loadingGoogleScript) return;
    this.loadingGoogleScript = true;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      this.loadingGoogleScript = false;
      this.ngZone.run(() => this.initializeGoogle());
    };
    script.onerror = () => {
      this.loadingGoogleScript = false;
    };
    document.head.appendChild(script);
  }

  private initializeGoogle(): void {
    if (this.googleInitialized || !google?.accounts?.id) return;

    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: (response: any) => {
        this.ngZone.run(() => {
          this.handleGoogleResponse(response?.credential);
        });
      },
    });

    this.googleInitialized = true;
    this.errorMessage.set(null);

    setTimeout(() => this.renderGoogleButton(), 150);
  }

  /** Renderiza el botón oficial de Google sobre el botón personalizado para garantizar el flujo real. */
  private renderGoogleButton(): void {
    const host = document.getElementById("google-btn-host") as HTMLElement | null;
    if (!host || !google?.accounts?.id) return;

    const width = Math.max(host.clientWidth, 280);

    try {
      google.accounts.id.renderButton(host, {
        type: "standard",
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width,
      });
      this.googleButtonReady.set(true);
    } catch {
      this.googleButtonReady.set(false);
    }
  }

  private handleGoogleResponse(idToken: string | undefined): void {
    if (!idToken) {
      this.errorMessage.set("Google no entregó un token válido.");
      this.triggerShake();
      return;
    }

    this.googleLoading.set(true);
    this.errorMessage.set(null);

    this.authService.loginWithGoogle(idToken).subscribe({
      next: () => {
        this.googleLoading.set(false);
        this.sessionService.start();
        this.toastService.success(
          "Sesión iniciada correctamente.",
          "Por seguridad, tu sesión expirará después de un tiempo de inactividad."
        );
        this.router.navigate(["/dashboard"]);
      },
      error: (err) => {
        this.googleLoading.set(false);
        this.errorMessage.set(
          err?.error?.message || "Error al iniciar sesión con Google."
        );
        this.triggerShake();
      },
    });
  }

  private triggerShake(): void {
    this.shake.set(true);
    setTimeout(() => this.shake.set(false), 420);
  }
}