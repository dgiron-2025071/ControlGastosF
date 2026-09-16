-- Control-Gastos: schema inicial (autenticación + dashboard + módulos futuros)
-- Ejecutar contra la base de datos control_gastos

-- =========================================================
-- USUARIOS (autenticación)
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(150) NOT NULL,
    email          VARCHAR(150) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    status         VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    role           VARCHAR(20)  NOT NULL DEFAULT 'USER',
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Evita duplicados de correo sin importar mayúsculas/minúsculas
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));

-- =========================================================
-- ACTIVOS (ingresos / bienes)
-- =========================================================
CREATE TABLE IF NOT EXISTS activos (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre         VARCHAR(200) NOT NULL,
    monto          NUMERIC(12,2) NOT NULL CHECK (monto >= 0),
    categoria      VARCHAR(100) NOT NULL DEFAULT 'General',
    empresa        VARCHAR(200),
    descripcion    TEXT,
    fecha          DATE         NOT NULL DEFAULT CURRENT_DATE,
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activos_user_id_idx ON activos (user_id);
CREATE INDEX IF NOT EXISTS activos_user_fecha_idx ON activos (user_id, fecha);

-- Permite agregar la columna empresa a bases de datos ya existentes
ALTER TABLE activos ADD COLUMN IF NOT EXISTS empresa VARCHAR(200);

-- =========================================================
-- PASIVOS (deudas / créditos)
-- =========================================================
CREATE TABLE IF NOT EXISTS pasivos (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre          VARCHAR(200) NOT NULL,
    monto           NUMERIC(12,2) NOT NULL CHECK (monto >= 0),
    tasa_interes    NUMERIC(5,2) DEFAULT 0,
    categoria       VARCHAR(100) NOT NULL DEFAULT 'General',
    fecha_vencimiento DATE,
    estado          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'PAGADO', 'VENCIDO')),
    descripcion     TEXT,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pasivos_user_id_idx ON pasivos (user_id);
CREATE INDEX IF NOT EXISTS pasivos_user_estado_idx ON pasivos (user_id, estado);

-- Permite agregar columnas a bases de datos ya existentes
ALTER TABLE pasivos ADD COLUMN IF NOT EXISTS empresa VARCHAR(200);

-- Vínculo entre un pasivo generado automáticamente y su pendiente de origen
ALTER TABLE pasivos ADD COLUMN IF NOT EXISTS pendiente_id INTEGER REFERENCES pendientes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS pasivos_pendiente_id_idx ON pasivos (pendiente_id);

-- =========================================================
-- PENDIENTES (pagos próximos / facturas por vencer)
-- =========================================================
CREATE TABLE IF NOT EXISTS pendientes (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre          VARCHAR(200) NOT NULL,
    monto           NUMERIC(12,2) NOT NULL CHECK (monto >= 0),
    categoria       VARCHAR(100) NOT NULL DEFAULT 'General',
    frecuencia      VARCHAR(30)  NOT NULL DEFAULT 'MENSUAL' CHECK (frecuencia IN ('UNA_VEZ', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL')),
    fecha_vencimiento DATE         NOT NULL,
    estado          VARCHAR(20)  NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'PAGADO', 'VENCIDO')),
    descripcion     TEXT,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pendientes_user_id_idx ON pendientes (user_id);
CREATE INDEX IF NOT EXISTS pendientes_user_fecha_idx ON pendientes (user_id, fecha_vencimiento);

-- Permite agregar columnas a bases de datos ya existentes
ALTER TABLE pendientes ADD COLUMN IF NOT EXISTS categoria VARCHAR(100) NOT NULL DEFAULT 'General';
ALTER TABLE pendientes ADD COLUMN IF NOT EXISTS frecuencia VARCHAR(30) NOT NULL DEFAULT 'MENSUAL';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pendientes_frecuencia_check') THEN
    ALTER TABLE pendientes ADD CONSTRAINT pendientes_frecuencia_check
      CHECK (frecuencia IN ('UNA_VEZ', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'));
  END IF;
END $$;

-- Grupo de recurrencia: mismo identificador para todas las repeticiones
-- de un pendiente (permite borrarlas de una sola vez).
ALTER TABLE pendientes ADD COLUMN IF NOT EXISTS recurrencia_id UUID;
CREATE INDEX IF NOT EXISTS pendientes_recurrencia_id_idx ON pendientes (recurrencia_id);

-- Indica si el pendiente es un gasto fijo.
ALTER TABLE pendientes ADD COLUMN IF NOT EXISTS fijo BOOLEAN NOT NULL DEFAULT false;

-- Permite dos tipos de pendiente:
--  - MONTO_CONOCIDO: se registra con su monto (obligatorio).
--  - RECORDATORIO:   gastos no fijos (luz, agua...), el monto es opcional.
ALTER TABLE pendientes ALTER COLUMN monto DROP NOT NULL;
ALTER TABLE pendientes ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'MONTO_CONOCIDO';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pendientes_tipo_check') THEN
    ALTER TABLE pendientes ADD CONSTRAINT pendientes_tipo_check
      CHECK (tipo IN ('MONTO_CONOCIDO', 'RECORDATORIO'));
  END IF;
END $$;

-- =========================================================
-- SUSCRIPCIONES (cobros recurrentes)
-- =========================================================
CREATE TABLE IF NOT EXISTS suscripciones (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre          VARCHAR(200) NOT NULL,
    monto           NUMERIC(12,2) NOT NULL CHECK (monto >= 0),
    ciclo_cobro     VARCHAR(30)  NOT NULL DEFAULT 'MENSUAL' CHECK (ciclo_cobro IN ('SEMANAL', 'QUINCENAL', 'MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL')),
    proxima_renovacion DATE       NOT NULL,
    estado          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'PAUSADA', 'CANCELADA')),
    descripcion     TEXT,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS suscripciones_user_id_idx ON suscripciones (user_id);
CREATE INDEX IF NOT EXISTS suscripciones_user_estado_idx ON suscripciones (user_id, estado);

-- =========================================================
-- MOVIMIENTOS (registro de ingresos y egresos del mes)
-- =========================================================
CREATE TABLE IF NOT EXISTS movimientos (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tipo            VARCHAR(10)  NOT NULL CHECK (tipo IN ('INGRESO', 'GASTO')),
    monto           NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    categoria       VARCHAR(100) NOT NULL DEFAULT 'General',
    descripcion     TEXT,
    fecha           DATE         NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS movimientos_user_id_idx ON movimientos (user_id);
CREATE INDEX IF NOT EXISTS movimientos_user_fecha_idx ON movimientos (user_id, fecha);
CREATE INDEX IF NOT EXISTS movimientos_user_tipo_fecha_idx ON movimientos (user_id, tipo, fecha);

-- =========================================================
-- MIGRACIONES IDEMPOTENTES
-- =========================================================

-- Permitir el ciclo de cobro "UNA_VEZ" en suscripciones.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'suscripciones_ciclo_cobro_check'
  ) THEN
    ALTER TABLE suscripciones DROP CONSTRAINT suscripciones_ciclo_cobro_check;
  END IF;

  ALTER TABLE suscripciones ADD CONSTRAINT suscripciones_ciclo_cobro_check
    CHECK (ciclo_cobro IN ('UNA_VEZ', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'));
END $$;
