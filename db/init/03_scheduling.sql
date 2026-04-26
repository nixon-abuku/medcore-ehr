-- ─────────────────────────────────────────────────────────────
--  MedCore EHR — Module 2: Scheduling Schema
--  Schema: scheduling
--
--  LEARNING NOTE:
--  In Epic, scheduling lives in the "Cadence" module.
--  The core concept is: Providers have Schedules, Schedules have
--  Slots, Slots get booked as Appointments.
--  HL7 SIU messages fire on every appointment action.
-- ─────────────────────────────────────────────────────────────

-- ── Visit Types ───────────────────────────────────────────────
-- Defines what kind of appointment it is and how long it takes
CREATE TABLE IF NOT EXISTS scheduling.visit_types (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,   -- "New Patient", "Follow-Up", "Annual Physical"
  code          VARCHAR(20) NOT NULL UNIQUE,
  duration_min  INT NOT NULL DEFAULT 30, -- Length of appointment in minutes
  color         VARCHAR(7) DEFAULT '#3B82F6', -- Hex color for calendar display
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Provider Schedules ────────────────────────────────────────
-- Each schedule is a provider's availability template for a given date
CREATE TABLE IF NOT EXISTS scheduling.provider_schedules (
  id            SERIAL PRIMARY KEY,
  provider_id   INT NOT NULL,            -- References adt.providers
  schedule_date DATE NOT NULL,
  start_time    TIME NOT NULL,           -- When the day starts
  end_time      TIME NOT NULL,           -- When the day ends
  department    VARCHAR(100),
  location_name VARCHAR(100),
  active        BOOLEAN DEFAULT TRUE,
  fhir_schedule_id VARCHAR(100),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider_id, schedule_date)
);

-- ── Appointment Slots ─────────────────────────────────────────
-- Individual bookable time slots within a schedule
CREATE TABLE IF NOT EXISTS scheduling.slots (
  id              SERIAL PRIMARY KEY,
  schedule_id     INT NOT NULL REFERENCES scheduling.provider_schedules(id) ON DELETE CASCADE,
  provider_id     INT NOT NULL,
  slot_date       DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  status          VARCHAR(20) DEFAULT 'AVAILABLE', -- AVAILABLE, BOOKED, BLOCKED, CANCELLED
  visit_type_id   INT REFERENCES scheduling.visit_types(id),
  fhir_slot_id    VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Appointments ──────────────────────────────────────────────
-- A booked slot tied to a patient
-- LEARNING: In Epic, appointments link to the patient's MRN and
-- generate a CSN when the patient checks in (becomes an encounter)
CREATE TABLE IF NOT EXISTS scheduling.appointments (
  id                SERIAL PRIMARY KEY,
  appt_id           VARCHAR(20) UNIQUE NOT NULL DEFAULT ('APT' || nextval('scheduling.appt_seq')::TEXT),
  patient_id        INT NOT NULL,            -- References adt.patients
  patient_mrn       VARCHAR(20) NOT NULL,
  slot_id           INT REFERENCES scheduling.slots(id),
  provider_id       INT NOT NULL,
  visit_type_id     INT REFERENCES scheduling.visit_types(id),

  -- Timing
  appt_date         DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,

  -- Status
  status            VARCHAR(30) DEFAULT 'SCHEDULED',
  -- SCHEDULED → ARRIVED → IN_PROGRESS → COMPLETED | CANCELLED | NO_SHOW

  -- Clinical
  chief_complaint   TEXT,
  notes             TEXT,
  department        VARCHAR(100),
  location_name     VARCHAR(100),

  -- Scheduling metadata
  scheduled_by      VARCHAR(100) DEFAULT 'MEDCORE_USER',
  scheduled_at      TIMESTAMPTZ DEFAULT NOW(),
  cancelled_reason  TEXT,
  cancelled_at      TIMESTAMPTZ,

  -- Linked encounter (set when patient arrives and encounter is created)
  encounter_csn     VARCHAR(20),

  -- FHIR
  fhir_appt_id      VARCHAR(100),

  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── SIU Event Log ─────────────────────────────────────────────
-- Every scheduling action → one SIU message logged here
CREATE TABLE IF NOT EXISTS scheduling.siu_events (
  id              SERIAL PRIMARY KEY,
  appointment_id  INT REFERENCES scheduling.appointments(id),
  event_type      VARCHAR(10) NOT NULL,  -- S12, S14, S15, S17, S26
  event_desc      VARCHAR(100),
  hl7_message     TEXT,
  sent_at         TIMESTAMPTZ DEFAULT NOW(),
  status          VARCHAR(20) DEFAULT 'SENT'
);

-- ── Sequences ─────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS scheduling.appt_seq START 10000 INCREMENT 1;

-- ── Seed: Visit Types ─────────────────────────────────────────
INSERT INTO scheduling.visit_types (name, code, duration_min, color) VALUES
  ('New Patient',           'NEW_PT',   60, '#3B82F6'),
  ('Follow-Up',             'FOLLOW',   30, '#10B981'),
  ('Annual Physical',       'ANNUAL',   60, '#8B5CF6'),
  ('Urgent Care',           'URGENT',   20, '#EF4444'),
  ('Procedure',             'PROC',     90, '#F59E0B'),
  ('Telehealth',            'TELE',     30, '#06B6D4'),
  ('Lab Review',            'LAB_REV',  15, '#84CC16'),
  ('Post-Op',               'POST_OP',  30, '#F97316')
ON CONFLICT (code) DO NOTHING;

\echo 'Module 2 Scheduling schema initialized.'
