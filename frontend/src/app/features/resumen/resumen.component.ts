import { Component, OnInit, OnDestroy, AfterViewInit, inject, NgZone, signal, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { Subscription } from "rxjs";
import { AuthService } from "../../core/services/auth.service";
import { SessionService } from "../../core/services/session.service";
import { ToastService } from "../../core/services/toast.service";
import { FinanceStoreService } from "../../core/services/finance-store.service";
import { ResumenService } from "./services/resumen.service";
import { ResumenData, ResumenMonth } from "./models/resumen.model";

const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

@Component({
  selector: "app-resumen",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./resumen.component.html",
  styleUrl: "./resumen.component.css",
})
export class ResumenComponent implements OnInit, AfterViewInit, OnDestroy {
  private authService = inject(AuthService);
  private sessionService = inject(SessionService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private store = inject(FinanceStoreService);
  private resumenService = inject(ResumenService);
  private ngZone = inject(NgZone);

  currentYear = this.store.year();
  currentMonth = this.store.month();

  data = signal<ResumenData | null>(null);
  loading = signal(true);

  mayorPendienteMes = computed<{ nombre: string; monto: number } | null>(
    () => this.data()?.mayorPendiente ?? null
  );

  maxValue = computed(() => {
    const years = this.data()?.years ?? [];
    const values = years.flatMap((y) =>
      y.meses.flatMap((m) => [m.ingresos, m.gastos])
    );
    return Math.max(...values, 1);
  });

  /** Meses disponibles para el selector directo. */
  monthOptions = [...MONTH_NAMES_ES];

  /** Años disponibles para el selector directo (los que muestra la gráfica). */
  yearOptions = computed(() => {
    const years = this.data()?.years.map((y) => y.year) ?? [];
    if (years.length > 0) return years;
    const base = this.store.year();
    return [base - 2, base - 1, base, base + 1];
  });

  get user() {
    return this.authService.currentUser();
  }

  get monthLabel(): string {
    return `${MONTH_NAMES_ES[this.currentMonth - 1]} ${this.currentYear}`;
  }

  private dataSub: Subscription | null = null;
  private animFrameId = 0;

  ngOnInit(): void {
    this.sessionService.start();

    // Comparte el estado con el inicio y Activos; cualquier cambio de mes/año
    // o de datos se refleja aquí de inmediato (usa `refresh$`, no signals
    // directos, porque RxJS no los acepta como fuente).
    this.dataSub = this.store.refresh$.subscribe(() => {
      this.currentYear = this.store.year();
      this.currentMonth = this.store.month();
      this.loadResumen();
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

  loadResumen(): void {
    this.loading.set(true);
    this.resumenService.getResumen(this.currentYear, this.currentMonth).subscribe({
      next: (resumen) => {
        this.data.set(resumen);
        this.loading.set(false);
      },
      error: () => {
        this.data.set(null);
        this.loading.set(false);
        this.toastService.error("No se pudo cargar el resumen completo.");
      },
    });
  }

  /** Selector directo de mes: actualiza de inmediato la gráfica y el resumen. */
  onMonthSelected(month: number): void {
    this.store.setYearMonth(this.currentYear, month);
  }

  /** Selector directo de año: actualiza de inmediato la gráfica y el resumen. */
  onYearSelected(year: number): void {
    this.store.setYearMonth(year, this.currentMonth);
  }

  isCurrentYear(year: number): boolean {
    return year === this.currentYear;
  }

  isSelectedMonth(year: number, month: ResumenMonth): boolean {
    return year === this.currentYear && month.monthNum === this.currentMonth;
  }

  yearSelected(year: number): void {
    this.store.setYearMonth(year, this.currentMonth);
  }

  ingresosAnio(year: number): number {
    return this.data()?.years.find((y) => y.year === year)?.totalIngresos ?? 0;
  }

  gastosAnio(year: number): number {
    return this.data()?.years.find((y) => y.year === year)?.totalGastos ?? 0;
  }

  balanceAnio(year: number): number {
    return this.data()?.years.find((y) => y.year === year)?.balance ?? 0;
  }

  barHeight(value: number): number {
    if (this.maxValue() === 0) return 0;
    return (value / this.maxValue()) * 100;
  }

  formatCurrency(value: number): string {
    return `Q${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  formatCurrencyCompact(value: number): string {
    if (value >= 1000) {
      return `Q${(value / 1000).toFixed(1)}k`;
    }
    return `Q${value.toFixed(0)}`;
  }

  navigateTo(section: string): void {
    this.router.navigate([`/${section}`]);
  }

  logout(): void {
    this.sessionService.stop();
    this.authService.logout();
    this.router.navigate(["/login"], { replaceUrl: true });
  }

  /* Fondo: mismo shader que el inicio y activos. */
  private initShader(): void {
    const canvas = document.getElementById(
      "resumen-shader-canvas"
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