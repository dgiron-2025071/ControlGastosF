import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ToastService } from "../../core/services/toast.service";

@Component({
  selector: "app-toast",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-stack">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [class]="'toast-' + toast.type" role="status">
          <div class="toast-icon">
            @switch (toast.type) {
              @case ("success") {
                <svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              }
              @case ("error") {
                <svg viewBox="0 0 24 24" fill="none"><path d="M12 8v5M12 16h.01M12 3l9 16H3L12 3z" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              }
              @default {
                <svg viewBox="0 0 24 24" fill="none"><path d="M12 16v-4M12 8h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              }
            }
          </div>
          <div class="toast-body">
            <p class="toast-title">{{ toast.title }}</p>
            @if (toast.detail) {
              <p class="toast-detail">{{ toast.detail }}</p>
            }
          </div>
          <button type="button" class="toast-close" (click)="toastService.dismiss(toast.id)" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-stack {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 360px;
      width: calc(100% - 40px);
    }

    .toast {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 14px;
      border-radius: 10px;
      background: var(--cg-slate-800);
      border: 1px solid var(--cg-border);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.4);
      animation: cg-fade-up 0.25s ease;
    }

    .toast-icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .toast-icon svg {
      width: 100%;
      height: 100%;
    }

    .toast-success .toast-icon { color: var(--cg-teal); }
    .toast-error .toast-icon { color: var(--cg-danger); }
    .toast-info .toast-icon { color: var(--cg-amber); }

    .toast-success { border-left: 3px solid var(--cg-teal); }
    .toast-error { border-left: 3px solid var(--cg-danger); }
    .toast-info { border-left: 3px solid var(--cg-amber); }

    .toast-body {
      flex: 1;
      min-width: 0;
    }

    .toast-title {
      margin: 0;
      font-size: 13.5px;
      font-weight: 600;
      color: var(--cg-white);
      line-height: 1.4;
    }

    .toast-detail {
      margin: 4px 0 0;
      font-size: 12.5px;
      color: var(--cg-muted);
      line-height: 1.4;
    }

    .toast-close {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      border: none;
      background: transparent;
      color: var(--cg-muted);
      cursor: pointer;
      padding: 0;
    }

    .toast-close svg {
      width: 100%;
      height: 100%;
    }

    .toast-close:hover {
      color: var(--cg-white);
    }

    @media (max-width: 480px) {
      .toast-stack {
        left: 16px;
        right: 16px;
        top: 16px;
        max-width: none;
        width: auto;
      }
    }
  `],
})
export class ToastComponent {
  toastService = inject(ToastService);
}
