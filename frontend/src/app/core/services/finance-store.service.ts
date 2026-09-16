import { Injectable, signal } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { Observable } from "rxjs";

@Injectable({ providedIn: "root" })
export class FinanceStoreService {
  /** Año seleccionado en el selector compartido (inicio, activos y resumen). */
  year = signal<number>(new Date().getFullYear());

  /** Mes seleccionado (1-12) en el selector compartido. */
  month = signal<number>(new Date().getMonth() + 1);

  /** Versión de los datos: sube cada vez que se registra un cambio. */
  private dataVersionInternal = signal(0);

  readonly dataVersion = this.dataVersionInternal.asReadonly();

  /**
   * Emite en cuanto cambia el año, el mes o los datos. Es la única fuente de
   * refresco en tiempo real para el inicio, Activos y el Resumen Completo.
   * Se usa `toObservable` (no los signals directos) porque RxJS no acepta
   * signals como fuente.
   */
  private revisionInternal = signal(0);

  readonly refresh$: Observable<number> = toObservable(this.revisionInternal);

  setYearMonth(year: number, month: number): void {
    this.year.set(year);
    this.month.set(month);
    this.revisionInternal.update((v) => v + 1);
  }

  /** Notifica que los datos cambiaron (p.ej. nuevo ingreso) para que
   *  el inicio y el resumen se refresquen de inmediato. */
  notifyDataChanged(): void {
    this.dataVersionInternal.update((v) => v + 1);
    this.revisionInternal.update((v) => v + 1);
  }
}