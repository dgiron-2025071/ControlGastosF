import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  inject,
  NgZone,
  signal,
  computed,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { Subscription } from "rxjs";
import { AuthService } from "../../core/services/auth.service";
import { SessionService } from "../../core/services/session.service";
import { ToastService } from "../../core/services/toast.service";
import { FinanceStoreService } from "../../core/services/finance-store.service";
import { MovimientosService } from "./services/movimientos.service";
import { Movimiento, MovimientoListResponse } from "./models/movimiento.model";
import { SuscripcionesService } from "../suscripciones/services/suscripciones.service";

const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

@Component({
  selector: "app-movimientos",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./movimientos.component.html",
  styleUrl: "./movimientos.component.css",
})
export class MovimientosComponent implements OnInit, AfterViewInit, OnDestroy {
  private authService = inject(AuthService);
  private sessionService = inject(SessionService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private store = inject(FinanceStoreService);
  private movimientosService = inject(MovimientosService);
  private suscripcionesService = inject(SuscripcionesService);
  private ngZone = inject(NgZone);

  yearSignal = this.store.year;
  monthSignal = this.store.month;

  currentYear = this.store.year();
  currentMonth = this.store.month();

  items = signal<Movimiento[]>([]);
  totalIngresos = signal(0);
  totalEgresos = signal(0);
  totalActivos = signal(0);
  totalPasivos = signal(0);
  totalSuscripciones = signal(0);
  totalTransacciones = signal(0);
  balance = signal(0);
  loading = signal(true);
  searchText = signal("");
  tabFilter = signal<"TODOS" | "INGRESO" | "EGRESO" | "SUSCRIPCION">("TODOS");
  showDetailModal = signal(false);
  selectedMovimiento = signal<Movimiento | null>(null);
  cancellingIds = new Set<number>();

  filteredItems = computed(() => {
    const texto = this.searchText().trim().toLowerCase();
    const tab = this.tabFilter();

    return this.items().filter((item) => {
      if (tab === "INGRESO" && item.tipo !== "INGRESO") return false;
      if (tab === "EGRESO") {
        if (item.tipo !== "EGRESO" || item.origen !== "PASIVO") return false;
      }
      if (tab === "SUSCRIPCION" && item.origen !== "SUSCRIPCION") return false;

      if (texto) {
        const hayMatch =
          item.nombre.toLowerCase().includes(texto) ||
          item.categoria.toLowerCase().includes(texto) ||
          item.origen.toLowerCase().includes(texto) ||
          item.fecha.includes(texto) ||
          item.estado.toLowerCase().includes(texto);
        if (!hayMatch) return false;
      }

      return true;
    });
  });

  get user() {
    return this.authService.currentUser();
  }

  get monthLabel(): string {
    return `${MONTH_NAMES_ES[this.currentMonth - 1]} ${this.currentYear}`;
  }

  get ingresosCount(): number {
    return this.items().filter((i) => i.tipo === "INGRESO").length;
  }

  get egresosCount(): number {
    return this.items().filter((i) => i.tipo === "EGRESO").length;
  }

  get suscripcionesCount(): number {
    return this.items().filter((i) => i.origen === "SUSCRIPCION").length;
  }

  private dataSub: Subscription | null = null;
  private animFrameId = 0;

  ngOnInit(): void {
    this.sessionService.start();

    this.dataSub = this.store.refresh$.subscribe(() => {
      this.currentYear = this.store.year();
      this.currentMonth = this.store.month();
      this.loadMonth();
    });
  }

  ngAfterViewInit(): void {
    this.initShader();
  }

  ngOnDestroy(): void {
    this.dataSub?.unsubscribe();
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }

  /* ==================== Datos ==================== */

  loadMonth(): void {
    this.loading.set(true);
    this.movimientosService.listMonth(this.currentYear, this.currentMonth).subscribe({
      next: (data: MovimientoListResponse) => {
        this.items.set(data.items);
        this.totalIngresos.set(data.totalIngresos);
        this.totalEgresos.set(data.totalEgresos);
        this.totalActivos.set(data.totalActivos ?? data.totalIngresos);
        this.totalPasivos.set(data.totalPasivos ?? 0);
        this.totalSuscripciones.set(data.totalSuscripciones ?? 0);
        this.totalTransacciones.set(data.totalTransacciones ?? data.items.length);
        this.balance.set(data.balance);
        this.cancellingIds.clear();
        this.loading.set(false);
      },
      error: () => {
        this.items.set([]);
        this.totalIngresos.set(0);
        this.totalEgresos.set(0);
        this.totalActivos.set(0);
        this.totalPasivos.set(0);
        this.totalSuscripciones.set(0);
        this.totalTransacciones.set(0);
        this.balance.set(0);
        this.loading.set(false);
        this.toastService.error("No se pudieron cargar los movimientos.");
      },
    });
  }

  previousMonth(): void {
    this.moveMonth(-1);
  }

  nextMonth(): void {
    this.moveMonth(1);
  }

  private moveMonth(delta: number): void {
    let month = this.currentMonth + delta;
    let year = this.currentYear;
    if (month < 1) {
      month = 12;
      year--;
    } else if (month > 12) {
      month = 1;
      year++;
    }
    this.store.setYearMonth(year, month);
  }

  /* ==================== Formato ==================== */

  formatCurrency(value: number): string {
    return `Q${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  formatFecha(value: string): string {
    if (!value) return "";
    const [y, m, d] = value.split("-").map(Number);
    const months = [
      "Ene", "Feb", "Mar", "Abr", "May", "Jun",
      "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
    ];
    return `${d} ${months[(m ?? 1) - 1]} ${y}`;
  }

  origenClass(origen: string): string {
    const palette = [
      "origen-c1", "origen-c2", "origen-c3", "origen-c4",
      "origen-c5", "origen-c6", "origen-c7", "origen-c8",
    ];
    let h = 0;
    for (let i = 0; i < origen.length; i++) {
      h = (h * 31 + origen.charCodeAt(i)) >>> 0;
    }
    return palette[h % palette.length];
  }

  tipoClass(tipo: string): string {
    return tipo === "INGRESO" ? "tipo-ingreso" : "tipo-egreso";
  }

  estadoClass(estado: string): string {
    switch (estado) {
      case "COMPLETADO": return "estado-completado";
      case "PENDIENTE": return "estado-pendiente";
      case "PAGADO": return "estado-pagado";
      case "ACTIVA": return "estado-activa";
      default: return "estado-default";
    }
  }

  /* ==================== Filtros ==================== */

  setTabFilter(tab: "TODOS" | "INGRESO" | "EGRESO" | "SUSCRIPCION"): void {
    this.tabFilter.set(tab);
  }

  onSearchInput(event: Event): void {
    this.searchText.set((event.target as HTMLInputElement).value);
  }

  clearSearch(): void {
    this.searchText.set("");
  }

  /* ==================== Detalle (modal) ==================== */

  openDetail(movimiento: Movimiento): void {
    this.selectedMovimiento.set(movimiento);
    this.showDetailModal.set(true);
  }

  closeDetailModal(): void {
    this.showDetailModal.set(false);
    this.selectedMovimiento.set(null);
  }

  /* ==================== Cancelar suscripción ==================== */

  cancelSubscription(movimiento: Movimiento): void {
    const confirmacion = window.confirm(
      `¿Deseas cancelar la suscripción "${movimiento.nombre}"?`
    );
    if (!confirmacion) return;

    this.cancellingIds.add(movimiento.id);
    this.suscripcionesService.changeStatus(movimiento.origenId, "CANCELADA").subscribe({
      next: () => {
        this.cancellingIds.delete(movimiento.id);
        this.store.notifyDataChanged();
        this.toastService.success("Suscripción cancelada correctamente.");
      },
      error: () => {
        this.cancellingIds.delete(movimiento.id);
        this.toastService.error("No se pudo cancelar la suscripción.");
      },
    });
  }

  /* ==================== Navegación ==================== */

  navigateTo(section: string): void {
    this.router.navigate([`/${section}`]);
  }

  logout(): void {
    this.sessionService.stop();
    this.authService.logout();
    this.router.navigate(["/login"], { replaceUrl: true });
  }

  /* ==================== Fondo (mismo shader que el inicio) ==================== */

  private initShader(): void {
    const canvas = document.getElementById(
      "movimientos-shader-canvas"
    ) as HTMLCanvasElement;
    if (!canvas) return;

    const gl =
      canvas.getContext("webgl") ||
      (canvas as any).getContext("experimental-webgl");
    if (!gl) return;

    const MAX_W = 360;
    const syncSize = () => {
      const cw = canvas.clientWidth || 1280;
      const ch = canvas.clientHeight || 720;
      const scale = Math.min(1, MAX_W / Math.max(cw, 1));
      const w = Math.max(1, Math.round(cw * scale));
      const h = Math.max(1, Math.round(ch * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(syncSize).observe(canvas);
    }
    syncSize();

    const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

    const fs = `precision highp float;
varying vec2 v_texCoord;
uniform float u_time;
uniform vec2 u_resolution;

void main() {
    vec2 uv = v_texCoord;
    vec3 c1 = vec3(0.823, 0.455, 0.235);
    vec3 c2 = vec3(0.129, 0.624, 0.761);
    vec3 c3 = vec3(0.125, 0.200, 0.396);
    vec3 c4 = vec3(0.376, 0.663, 0.369);
    vec3 c5 = vec3(0.208, 0.541, 0.592);
    vec3 c6 = vec3(0.490, 0.141, 0.459);
    vec3 c7 = vec3(0.082, 0.369, 0.580);
    vec3 c8 = vec3(0.714, 0.184, 0.424);
    vec3 finalColor = vec3(0.02);
    float t = u_time * 0.2;
    float d1 = distance(uv, vec2(0.1 + 0.1*sin(t), 0.9 + 0.1*cos(t)));
    finalColor += c1 * smoothstep(0.8, 0.0, d1) * 0.4;
    finalColor += c2 * smoothstep(0.6, 0.0, d1) * 0.3;
    float d2 = distance(uv, vec2(0.8 + 0.1*cos(t*1.1), 0.2 + 0.1*sin(t*1.1)));
    finalColor += c6 * smoothstep(0.9, 0.0, d2) * 0.4;
    finalColor += c8 * smoothstep(0.7, 0.0, d2) * 0.3;
    float d3 = distance(uv, vec2(0.5 + 0.2*sin(t*0.5), 0.5 + 0.2*cos(t*0.7)));
    finalColor += c3 * smoothstep(1.0, 0.0, d3) * 0.2;
    finalColor += c4 * smoothstep(0.5, 0.0, d3) * 0.15;
    float d4 = distance(uv, vec2(0.2, 0.3));
    finalColor += c5 * smoothstep(0.4, 0.0, d4) * 0.1;
    float d5 = distance(uv, vec2(0.9, 0.7));
    finalColor += c7 * smoothstep(0.5, 0.0, d5) * 0.1;
    gl_FragColor = vec4(finalColor, 1.0);
}`;

    const createShader = (type: number, source: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = createShader(gl.VERTEX_SHADER, vs);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fs);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const pos = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "u_time");
    const uRes = gl.getUniformLocation(program, "u_resolution");

    // Fondo estático: el shader se dibuja una sola vez. Sin bucle de
    // animación continuo no se acumula carga de GPU (WebGL + backdrop-filter)
    // y la aplicación no puede congelarse por el efecto de fondo.
    const paint = () => {
      syncSize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, performance.now() * 0.001);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    if (typeof ResizeObserver !== "undefined") {
      let pending = false;
      new ResizeObserver(() => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
          pending = false;
          paint();
        });
      }).observe(canvas);
    }

    paint();
  }
}
