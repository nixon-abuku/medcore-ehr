-- MedCore EHR — Database Initialization
-- Runs automatically when the postgres container first starts.
-- Each clinical module gets its own schema to mirror real EHR separation.

-- ── Schemas (one per module) ─────────────────
CREATE SCHEMA IF NOT EXISTS adt;
CREATE SCHEMA IF NOT EXISTS scheduling;
CREATE SCHEMA IF NOT EXISTS orders;
CREATE SCHEMA IF NOT EXISTS results;
CREATE SCHEMA IF NOT EXISTS documentation;
CREATE SCHEMA IF NOT EXISTS billing;
CREATE SCHEMA IF NOT EXISTS integration;  -- message logs, channel history

-- ── Integration audit log ─────────────────────
-- Every HL7 message that flows through Mirth gets logged here.
-- This mirrors how Epic and real health systems audit message traffic.
CREATE TABLE IF NOT EXISTS integration.message_log (
  id            BIGSERIAL PRIMARY KEY,
  message_id    VARCHAR(100),
  message_type  VARCHAR(20),   -- e.g. ADT^A01, ORU^R01
  direction     VARCHAR(10),   -- INBOUND or OUTBOUND
  channel_name  VARCHAR(100),
  sending_app   VARCHAR(100),
  receiving_app VARCHAR(100),
  patient_mrn   VARCHAR(50),
  raw_message   TEXT,
  status        VARCHAR(20) DEFAULT 'RECEIVED',
  error_detail  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── System config ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_config (
  key   VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.system_config (key, value) VALUES
  ('facility_name',    'MedCore Medical Center'),
  ('facility_oid',     '2.16.840.1.113883.3.9999'),
  ('hl7_version',      '2.5.1'),
  ('fhir_version',     'R4'),
  ('environment',      'TRAINING'),
  ('module_0_status',  'complete'),
  ('module_1_status',  'pending')
ON CONFLICT (key) DO NOTHING;

-- ── Done ──────────────────────────────────────
\echo 'MedCore database initialized successfully.'
