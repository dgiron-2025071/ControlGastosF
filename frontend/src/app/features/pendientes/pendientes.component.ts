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
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { Subscription } from "rxjs";
import { AuthService } from "../../core/services/auth.service";
import { SessionService } from "../../core/services/session.service";
import { ToastService } from "../../core/services/toast.service";
import { FinanceStoreService } from "../../core/services/finance-store.service";
import { PendientesService } from "./services/pendientes.service";
import { Pendiente, PendienteMonthStats } from "./models/pendiente.model";

const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const CATEGORIAS = [
  "General", "Suscripciones", "Tarjetas", "Alimentacion", "Transporte",
  "Servicios", "Vivienda", "Prestamos", "Deudas", "Salud", "Educacion",
  "Entretenimiento", "Vestimenta", "Estetica", "Mantenimiento", "Impuestos",
];

const FRECUENCIAS = [
  "UNA_VEZ", "SEMANAL", "QUINCENAL", "MENSUAL", "BIMESTRAL",
  "TRIMESTRAL", "SEMESTRAL", "ANUAL",
];

export interface FiltroPendientes {
  texto: string;
  categoria: string;
  frecuencia: string;
  origen: string;
  estado: string;
}

const FILTRO_VACIO: FiltroPendientes = {
  texto: "",
  categoria: "",
  frecuencia: "",
  origen: "",
  estado: "",
};

@Component({
  selector: "app-pendientes",
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: "./pendientes.component.html",
  styleUrl: "./pendientes.component.css",
})
export class PendientesComponent implements OnInit, AfterViewInit, OnDestroy {
  private authService = inject(AuthService);
  private sessionService = inject(SessionService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private store = inject(FinanceStoreService);
  private pendientesService = inject(PendientesService);
  private fb = inject(FormBuilder);
  private ngZone = inject(NgZone);

  yearSignal = this.store.year;
  monthSignal = this.store.month;

  currentYear = this.store.year();
  currentMonth = this.store.month();

  items = signal<Pendiente[]>([]);
  stats = signal<PendienteMonthStats | null>(null);
  loading = signal(true);
  saving = signal(false);
  showFilters = signal(false);
  showCreateModal = signal(false);
  showPayModal = signal(false);
  payingItem = signal<Pendiente | null>(null);
  payMonto = signal("");
  filters = signal<FiltroPendientes>({ ...FILTRO_VACIO });

  payingIds = new Set<number>();
  revertingIds = new Set<number>();
  deletingIds = new Set<number>();

  categorias = CATEGORIAS;
  frecuencias = FRECUENCIAS;

  createForm = this.fb.group({
    nombre: ["", Validators.required],
    tipo: ["MONTO_CONOCIDO" as string],
    monto: [null as number | null],
    categoria: ["General"],
    frecuencia: ["MENSUAL"],
    fechaVencimiento: [this.fechaDeHoy(), Validators.required],
    descripcion: [""],
    fijo: [false],
  });

  filteredItems = computed(() => {
    const f = this.filters();
    const texto = f.texto.trim().toLowerCase();

    return this.items().filter((item) => {
      if (!f.estado && item.estado === "PAGADO") return false;
      if (texto) {
        const hayMatch =
          item.nombre.toLowerCase().includes(texto) ||
          item.categoria.toLowerCase().includes(texto) ||
          item.origen.toLowerCase().includes(texto);
        if (!hayMatch) return false;
      }
      if (f.categoria && item.categoria !== f.categoria) return false;
      if (f.frecuencia && item.frecuencia !== f.frecuencia) return false;
      if (f.origen && item.origen !== f.origen) return false;
      if (f.estado && item.estado !== f.estado) return false;
      return true;
    });
  });

  activeFilterCount = computed(() => {
    const f = this.filters();
    let n = 0;
    if (f.texto) n++;
    if (f.categoria) n++;
    if (f.frecuencia) n++;
    if (f.origen) n++;
    if (f.estado) n++;
    return n;
  });

  totalPendiente = computed(() => this.stats()?.totalPendiente ?? 0);
  totalSuscripciones = computed(() => this.stats()?.totalSuscripciones ?? 0);
  totalCount = computed(() => this.stats()?.count ?? 0);
  mayorPendiente = computed(() => this.stats()?.mayorPendiente ?? null);

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
    this.pendientesService.listMonth(this.currentYear, this.currentMonth).subscribe({
      next: (data) => {
        this.items.set(data.items);
        this.stats.set(data.stats);
        this.payingIds.clear();
        this.loading.set(false);
      },
      error: () => {
        this.items.set([]);
        this.stats.set(null);
        this.loading.set(false);
        this.toastService.error("No se pudieron cargar los pendientes.");
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

  formatMonto(value: number | null): string {
    return value === null ? "Sin monto" : this.formatCurrency(value);
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

  origenClass(categoria: string): string {
    const palette = [
      "origen-c1", "origen-c2", "origen-c3", "origen-c4",
      "origen-c5", "origen-c6", "origen-c7", "origen-c8",
    ];
    let h = 0;
    for (let i = 0; i < categoria.length; i++) {
      h = (h * 31 + categoria.charCodeAt(i)) >>> 0;
    }
    return palette[h % palette.length];
  }

  estadoClass(estado: string): string {
    switch (estado) {
      case "PENDIENTE": return "estado-pendiente";
      case "PAGADO": return "estado-pagado";
      case "VENCIDO": return "estado-vencido";
      default: return "";
    }
  }

  estadoLabel(estado: string): string {
    switch (estado) {
      case "PENDIENTE": return "Pendiente";
      case "PAGADO": return "Pagado";
      case "VENCIDO": return "Vencido";
      default: return estado;
    }
  }

  origenBadgeClass(origen: string): string {
    return origen === "SUSCRIPCION" ? "origen-suscripcion" : "origen-pendiente";
  }

  private fechaDelMesSeleccionado(): string {
    return this.toDateInput(new Date(this.currentYear, this.currentMonth - 1, 1));
  }

  private fechaDeHoy(): string {
    return this.toDateInput(new Date());
  }

  private toDateInput(date: Date): string {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, "0");
    const d = `${date.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  /* ==================== Filtros ==================== */

  toggleFilters(): void {
    this.showFilters.update((v) => !v);
  }

  setFilter(key: keyof FiltroPendientes, value: string): void {
    this.filters.update((f) => ({
      ...f,
      [key]: String(value ?? ""),
    }));
  }

  clearFilters(): void {
    this.filters.set({ ...FILTRO_VACIO });
  }

  /* ==================== Creación (modal) ==================== */

  openCreateModal(): void {
    this.createForm.reset({
      nombre: "",
      tipo: "MONTO_CONOCIDO",
      monto: null,
      categoria: "General",
      frecuencia: "MENSUAL",
      fechaVencimiento: this.fechaDeHoy(),
      descripcion: "",
      fijo: false,
    });
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    if (this.saving()) return;
    this.showCreateModal.set(false);
    this.createForm.reset();
  }

  submitCreate(): void {
    if (this.createForm.invalid) {
      this.toastService.error("Complete los campos obligatorios (nombre y fecha).");
      return;
    }

    const raw = this.createForm.value;
    const tipo = raw.tipo === "RECORDATORIO" ? "RECORDATORIO" : "MONTO_CONOCIDO";
    const montoRaw = raw.monto as number | null | undefined;
    const monto: number | null =
      tipo === "RECORDATORIO" && (montoRaw === null || montoRaw === undefined)
        ? null
        : Number(montoRaw ?? 0);

    if (tipo === "MONTO_CONOCIDO" && (!Number.isFinite(monto!) || (monto as number) <= 0)) {
      this.toastService.error("El monto debe ser un número mayor a 0.");
      return;
    }

    this.saving.set(true);
    this.pendientesService
      .create({
        nombre: String(raw.nombre ?? "").trim(),
        tipo,
        monto,
        categoria: raw.categoria ?? "General",
        frecuencia: raw.frecuencia ?? "MENSUAL",
        fechaVencimiento: String(raw.fechaVencimiento ?? this.fechaDelMesSeleccionado()),
        descripcion: raw.descripcion ?? "",
        fijo: raw.fijo === true,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showCreateModal.set(false);
          this.createForm.reset();
          this.store.notifyDataChanged();
          this.toastService.success("Pendiente registrado correctamente.");
        },
        error: (err) => {
          this.saving.set(false);
          this.toastService.error(
            err?.error?.message || "No se pudo registrar el pendiente."
          );
        },
      });
  }

  /* ==================== Marcar pagado ==================== */

  markPaid(item: Pendiente): void {
    if (item.origen === "SUSCRIPCION") {
      const confirmacion = window.confirm(
        `¿Deseas marcar como pagada la suscripción "${item.nombre}"?`
      );
      if (!confirmacion) return;
      this.confirmarPago(item, null);
      return;
    }

    if (item.tipo === "RECORDATORIO" && (item.monto === null || item.monto === undefined)) {
      this.payingItem.set(item);
      this.payMonto.set("");
      this.showPayModal.set(true);
      return;
    }

    const confirmacion = window.confirm(
      `¿Deseas marcar como pagado "${item.nombre}"? Se creará un pasivo automáticamente.`
    );
    if (!confirmacion) return;
    this.confirmarPago(item, null);
  }

  closePayModal(): void {
    if (this.saving()) return;
    this.showPayModal.set(false);
    this.payingItem.set(null);
    this.payMonto.set("");
  }

  confirmPagoConMonto(): void {
    const item = this.payingItem();
    if (!item) return;

    const raw = this.payMonto().trim();
    const monto = Number(raw);
    if (!raw || !Number.isFinite(monto) || monto <= 0) {
      this.toastService.error("Ingresa un monto válido mayor a 0.");
      return;
    }

    this.confirmarPago(item, monto);
  }

  private confirmarPago(item: Pendiente, monto: number | null): void {
    this.payingIds.add(item.id);
    this.showPayModal.set(false);
    this.payingItem.set(null);

    this.pendientesService
      .markPaid(item.id, item.origen, item.suscripcionId, monto)
      .subscribe({
        next: () => {
          this.payingIds.delete(item.id);
          this.store.notifyDataChanged();
          const montoPagado = monto ?? item.monto;
          if (montoPagado !== null && montoPagado !== undefined) {
            this.toastService.success(
              `${item.nombre} pagado por ${this.formatCurrency(montoPagado)}.`
            );
          } else {
            this.toastService.success("Marcado como pagado correctamente.");
          }
        },
        error: (err) => {
          this.payingIds.delete(item.id);
          this.toastService.error(
            err?.error?.message || "No se pudo marcar como pagado."
          );
        },
      });
  }

  /* ==================== Borrar ==================== */

  deletePendiente(item: Pendiente): void {
    if (this.deletingIds.has(item.id)) return;

    const repetido = item.recurrenciaId !== null;
    const confirmacion = window.confirm(
      repetido
        ? `¿Deseas eliminar "${item.nombre}" junto con TODAS sus repeticiones futuras?`
        : `¿Deseas eliminar "${item.nombre}"?`
    );
    if (!confirmacion) return;

    this.deletingIds.add(item.id);
    this.pendientesService.remove(item.id).subscribe({
      next: () => {
        this.deletingIds.delete(item.id);
        this.store.notifyDataChanged();
        this.toastService.success(
          repetido ? "Pendiente y sus repeticiones eliminados." : "Pendiente eliminado."
        );
      },
      error: (err) => {
        this.deletingIds.delete(item.id);
        this.toastService.error(
          err?.error?.message || "No se pudo eliminar el pendiente."
        );
      },
    });
  }

  /* ==================== Regresar a pendiente ==================== */

  revertPaid(item: Pendiente): void {
    if (item.origen !== "PENDIENTE" || item.estado !== "PAGADO") return;

    const confirmacion = window.confirm(
      `¿Deseas regresar "${item.nombre}" a pendiente? Se eliminará su pasivo asociado.`
    );
    if (!confirmacion) return;

    this.revertingIds.add(item.id);
    this.pendientesService.revertPaid(item.id).subscribe({
      next: () => {
        this.revertingIds.delete(item.id);
        this.store.notifyDataChanged();
        this.toastService.success("Pendiente restablecido y pasivo eliminado.");
      },
      error: () => {
        this.revertingIds.delete(item.id);
        this.toastService.error("No se pudo restablecer el pendiente.");
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

  /* ==================== Fondo (shader) ==================== */

  private initShader(): void {
    const canvas = document.getElementById(
      "pendientes-shader-canvas"
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
