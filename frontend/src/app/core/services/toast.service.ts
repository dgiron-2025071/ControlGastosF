import { Injectable, signal } from "@angular/core";

export type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: number;
  type: ToastType;
  title: string;
  detail?: string;
}

@Injectable({ providedIn: "root" })
export class ToastService {
  private nextId = 1;
  toasts = signal<ToastMessage[]>([]);

  show(title: string, type: ToastType = "info", detail?: string, durationMs = 5000): void {
    const id = this.nextId++;
    this.toasts.update((current) => [...current, { id, type, title, detail }]);

    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs);
    }
  }

  success(title: string, detail?: string): void {
    this.show(title, "success", detail);
  }

  error(title: string, detail?: string): void {
    this.show(title, "error", detail, 6000);
  }

  /** El aviso permanece visible hasta que el usuario lo cierra manualmente. */
  persistent(title: string, detail?: string): void {
    this.show(title, "error", detail, 0);
  }

  dismiss(id: number): void {
    this.toasts.update((current) => current.filter((t) => t.id !== id));
  }
}
