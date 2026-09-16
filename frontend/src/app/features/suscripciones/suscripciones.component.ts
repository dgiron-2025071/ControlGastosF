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
import { SuscripcionesService } from "./services/suscripciones.service";
import { Suscripcion, CicloCobro, SuscripcionMonthStats } from "./models/suscripcion.model";

const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const CICLOS_DE_COBRO: CicloCobro[] = [
  "UNA_VEZ", "SEMANAL", "QUINCENAL", "MENSUAL", "BIMESTRAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL",
];

const ESTADOS = ["ACTIVA", "PAUSADA", "CANCELADA"];

export interface FiltroSuscripciones {
  texto: string;
  ciclo: string;
  estado: string;
}

const FILTRO_VACIO: FiltroSuscripciones = {
  texto: "",
  ciclo: "",
  estado: "",
};

@Component({
  selector: "app-suscripciones",
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: "./suscripciones.component.html",
  styleUrl: "./suscripciones.component.css",
})
export class SuscripcionesComponent implements OnInit, AfterViewInit, OnDestroy {
  private authService = inject(AuthService);
  private sessionService = inject(SessionService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private store = inject(FinanceStoreService);
  private suscripcionesService = inject(SuscripcionesService);
  private fb = inject(FormBuilder);
  private ngZone = inject(NgZone);

  yearSignal = this.store.year;
  monthSignal = this.store.month;

  currentYear = this.store.year();
  currentMonth = this.store.month();

  items = signal<Suscripcion[]>([]);
  stats = signal<SuscripcionMonthStats | null>(null);
  loading = signal(true);
  saving = signal(false);
  editMode = signal(false);
  showFilters = signal(false);
  showCreateModal = signal(false);
  filters = signal<FiltroSuscripciones>({ ...FILTRO_VACIO });

  editCopies: Record<number, Suscripcion> = {};
  deleting = new Set<number>();
  changingStatus = new Set<number>();

  ciclos = CICLOS_DE_COBRO;
  estados = ESTADOS;

  createForm = this.fb.group({
    nombre: ["", Validators.required],
    monto: [null as number | null, [Validators.required, Validators.min(0.01)]],
    cicloCobro: ["MENSUAL", Validators.required],
    proximaRenovacion: [this.fechaDelMesSeleccionado(), Validators.required],
    descripcion: [""],
  });

  filteredItems = computed(() => {
    const f = this.filters();
    const texto = f.texto.trim().toLowerCase();

    return this.items().filter((item) => {
      if (texto) {
        const matches =
          item.nombre.toLowerCase().includes(texto) ||
          (item.descripcion ?? "").toLowerCase().includes(texto) ||
          item.cicloCobro.toLowerCase().includes(texto) ||
          item.estado.toLowerCase().includes(texto);
        if (!matches) return false;
      }
      if (f.ciclo && item.cicloCobro !== f.ciclo) return false;
      if (f.estado && item.estado !== f.estado) return false;
      return true;
    });
  });

  activeFilterCount = computed(() => {
    const f = this.filters();
    let n = 0;
    if (f.texto) n++;
    if (f.ciclo) n++;
    if (f.estado) n++;
    return n;
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
    this.suscripcionesService.listMonth(this.currentYear, this.currentMonth).subscribe({
      next: (data) => {
        this.items.set(data.items);
        this.stats.set(data.stats);
        this.cleanupEditCopies();
        this.deleting.clear();
        this.loading.set(false);
      },
      error: () => {
        this.items.set([]);
        this.stats.set(null);
        this.loading.set(false);
        this.toastService.error("No se pudieron cargar las suscripciones.");
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

  cicloLabel(ciclo: string): string {
    const labels: Record<string, string> = {
      "UNA_VEZ": "Una vez",
      "SEMANAL": "Semanal",
      "QUINCENAL": "Quincenal",
      "MENSUAL": "Mensual",
      "BIMESTRAL": "Bimestral",
      "TRIMESTRAL": "Trimestral",
      "SEMESTRAL": "Semestral",
      "ANUAL": "Anual",
    };
    return labels[ciclo] ?? ciclo;
  }

  estadoClass(estado: string): string {
    switch (estado) {
      case "ACTIVA": return "estado-activa";
      case "PAUSADA": return "estado-pausada";
      case "CANCELADA": return "estado-cancelada";
      default: return "";
    }
  }

  private toDateInput(date: Date): string {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, "0");
    const d = `${date.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  private fechaDelMesSeleccionado(): string {
    return this.toDateInput(new Date(this.currentYear, this.currentMonth - 1, 1));
  }

  /* ==================== Filtros ==================== */

  toggleFilters(): void {
    this.showFilters.update((v) => !v);
  }

  setFilter(key: keyof FiltroSuscripciones, value: string): void {
    this.filters.update((f) => ({
      ...f,
      [key]: String(value ?? ""),
    }));
  }

  clearFilters(): void {
    this.filters.set({ ...FILTRO_VACIO });
  }

  /* ==================== Edición en línea ==================== */

  getCopy(id: number): Suscripcion {
    if (!this.editCopies[id]) {
      const original = this.items().find((i) => i.id === id);
      if (original) this.editCopies[id] = { ...original };
    }
    return this.editCopies[id];
  }

  toggleEditMode(): void {
    this.editMode.update((v) => !v);
    if (this.editMode()) {
      this.items()
        .filter((i) => !this.editCopies[i.id])
        .forEach((i) => (this.editCopies[i.id] = { ...i }));
    }
  }

  startEditingRow(id: number): void {
    if (!this.editMode()) {
      this.editMode.set(true);
    }
    if (!this.editCopies[id]) {
      const original = this.items().find((i) => i.id === id);
      if (original) this.editCopies[id] = { ...original };
    }
  }

  isDirty(id: number): boolean {
    const copy = this.editCopies[id];
    const original = this.items().find((i) => i.id === id);
    if (!copy || !original) return false;
    return (
      copy.nombre !== original.nombre ||
      copy.proximaRenovacion !== original.proximaRenovacion ||
      copy.cicloCobro !== original.cicloCobro ||
      Number(copy.monto) !== Number(original.monto) ||
      copy.descripcion !== original.descripcion
    );
  }

  saveEdit(id: number): void {
    const copy = this.editCopies[id];
    if (!copy) return;

    const monto = Number(copy.monto);
    if (!copy.nombre?.trim()) {
      this.toastService.error("El nombre es obligatorio.");
      return;
    }
    if (!monto || monto <= 0) {
      this.toastService.error("El monto debe ser mayor a 0.");
      return;
    }

    this.saving.set(true);
    this.suscripcionesService
      .update(id, {
        nombre: copy.nombre.trim(),
        monto,
        cicloCobro: copy.cicloCobro,
        proximaRenovacion: copy.proximaRenovacion || this.fechaDelMesSeleccionado(),
        descripcion: copy.descripcion ?? "",
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          delete this.editCopies[id];
          this.store.notifyDataChanged();
          this.toastService.success("Suscripción actualizada correctamente.");
        },
        error: () => {
          this.saving.set(false);
          this.toastService.error("No se pudo actualizar la suscripción.");
        },
      });
  }

  cancelEdit(id: number): void {
    delete this.editCopies[id];
  }

  deleteItem(id: number, nombre: string): void {
    const confirmacion = window.confirm(
      `¿Deseas eliminar la suscripción "${nombre}"?`
    );
    if (!confirmacion) return;

    this.deleting.add(id);
    this.suscripcionesService.remove(id).subscribe({
      next: () => {
        this.deleting.delete(id);
        this.store.notifyDataChanged();
        this.toastService.success("Suscripción eliminada correctamente.");
      },
      error: () => {
        this.deleting.delete(id);
        this.toastService.error("No se pudo eliminar la suscripción.");
      },
    });
  }

  /* ==================== Cambio de estado ==================== */

  pauseItem(id: number): void {
    this.changeStatus(id, "PAUSADA");
  }

  resumeItem(id: number): void {
    this.changeStatus(id, "ACTIVA");
  }

  cancelItem(id: number, nombre: string): void {
    const confirmacion = window.confirm(
      `¿Deseas cancelar la suscripción "${nombre}"?`
    );
    if (!confirmacion) return;
    this.changeStatus(id, "CANCELADA");
  }

  private changeStatus(id: number, estado: string): void {
    this.changingStatus.add(id);
    this.suscripcionesService.changeStatus(id, estado).subscribe({
      next: () => {
        this.changingStatus.delete(id);
        this.store.notifyDataChanged();
        this.toastService.success(`Suscripción ${estado.toLowerCase()} correctamente.`);
      },
      error: () => {
        this.changingStatus.delete(id);
        this.toastService.error("No se pudo cambiar el estado.");
      },
    });
  }

  /* ==================== Creación (modal) ==================== */

  openCreateModal(): void {
    this.createForm.reset({
      nombre: "",
      monto: null,
      cicloCobro: "MENSUAL",
      proximaRenovacion: this.fechaDelMesSeleccionado(),
      descripcion: "",
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
      this.toastService.error("Complete los campos obligatorios (nombre, monto, ciclo y fecha de inicio).");
      return;
    }

    const raw = this.createForm.value;
    const monto = Number(raw.monto ?? 0);
    const proximaRenovacion = String(raw.proximaRenovacion ?? this.fechaDelMesSeleccionado());

    this.saving.set(true);
    this.suscripcionesService
      .create({
        nombre: String(raw.nombre ?? "").trim(),
        monto,
        cicloCobro: (raw.cicloCobro as CicloCobro) ?? "MENSUAL",
        proximaRenovacion,
        descripcion: raw.descripcion ?? "",
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showCreateModal.set(false);
          this.createForm.reset();
          this.store.notifyDataChanged();
          this.syncSelectorToDate(proximaRenovacion);
          this.toastService.success("Suscripción registrada correctamente.");
        },
        error: () => {
          this.saving.set(false);
          this.toastService.error("No se pudo registrar la suscripción.");
        },
      });
  }

  private syncSelectorToDate(fecha: string): void {
    const [y, m] = fecha.split("-").map(Number);
    if (!y || !m || m < 1 || m > 12) return;
    if (y !== this.currentYear || m !== this.currentMonth) {
      this.store.setYearMonth(y, m);
      this.currentYear = y;
      this.currentMonth = m;
    }
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
      "suscripciones-shader-canvas"
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

  private cleanupEditCopies(): void {
    const ids = new Set(this.items().map((i) => i.id));
    Object.keys(this.editCopies).forEach((key) => {
      if (!ids.has(Number(key))) delete this.editCopies[Number(key)];
    });
    if (Object.keys(this.editCopies).length === 0) {
      this.editMode.set(false);
    }
  }
}
