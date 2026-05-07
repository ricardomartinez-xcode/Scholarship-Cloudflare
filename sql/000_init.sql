-- ReCalc normalized schema (Neon/Postgres)

create table if not exists recalc_programa (
  id bigserial primary key,
  key text unique not null,
  label text
);

create table if not exists recalc_nivel (
  id bigserial primary key,
  key text unique not null,
  label text
);

create table if not exists recalc_modalidad (
  id bigserial primary key,
  key text unique not null,
  label text
);

create table if not exists recalc_plantel (
  id bigserial primary key,
  name text unique not null
);

create table if not exists recalc_regla_beca (
  id bigserial primary key,
  programa_key text not null references recalc_programa(key),
  nivel_key text not null references recalc_nivel(key),
  modalidad_key text not null references recalc_modalidad(key),
  plan integer not null,
  tier text,
  rango_min numeric(4,2),
  rango_max numeric(4,2),
  porcentaje numeric(5,2),
  monto numeric(12,2),
  origen text,
  created_at timestamptz default now()
);

create table if not exists recalc_regreso_materias (
  id bigserial primary key,
  plantel text not null references recalc_plantel(name),
  modalidad text not null,
  materias_count integer not null,
  costo numeric(12,2) not null,
  created_at timestamptz default now()
);

create table if not exists recalc_meta (
  id bigserial primary key,
  version text not null,
  generated_at_utc timestamptz,
  fuentes jsonb,
  rango_promedio_a_beca jsonb,
  reglas_base jsonb,
  reglas_excepciones_por_plantel jsonb,
  disponibilidad jsonb,
  planteles jsonb,
  notas jsonb,
  created_at timestamptz default now()
);

-- Base JSON snapshot (control / audit, not used by UI)
create table if not exists recalc_base_json (
  id bigserial primary key,
  kind text not null,
  version text,
  payload jsonb not null,
  created_at timestamptz default now()
);
