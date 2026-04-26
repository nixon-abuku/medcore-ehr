-- ─────────────────────────────────────────────────────────────
--  MedCore EHR — Module 1: ADT / Registration Schema
--  Schema: adt
--
--  LEARNING NOTE:
--  In Epic, patient identity lives in a module called "Prelude".
--  The encounter is tied to what Epic calls a "CSN" (Contact Serial Number).
--  Every clinical event — order, result, note, charge — hangs off a CSN.
--  We replicate that concept exactly here.
-- ─────────────────────────────────────────────────────────────

-- ── Sequence for MRN generation ──────────────────────────────
-- MRN = Medical Record Number. One per patient, forever.
-- Epic auto-generates these. We do the same.
CREATE SEQUENCE IF NOT EXISTS adt.mrn_seq START 100000 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS adt.csn_seq START 200000000 INCREMENT 1;

-- ── Providers ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS adt.providers (
  id          SERIAL PRIMARY KEY,
  npi         VARCHAR(10) UNIQUE,           -- National Provider Identifier
  first_name  VARCHAR(100) NOT NULL,
  last_name   VARCHAR(100) NOT NULL,
  specialty   VARCHAR(100),
  department  VARCHAR(100),
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Locations ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS adt.locations (
  id          SERIAL PRIMARY KEY,
  facility    VARCHAR(100) DEFAULT 'MedCore Medical Center',
  building    VARCHAR(50),
  unit        VARCHAR(50) NOT NULL,         -- e.g. "4 WEST", "ICU", "ER"
  room        VARCHAR(20),
  bed         VARCHAR(10),
  bed_status  VARCHAR(20) DEFAULT 'AVAILABLE', -- AVAILABLE, OCCUPIED, CLEANING
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Patients ─────────────────────────────────────────────────
-- This is the Master Patient Index (MPI).
-- In Epic this is the "EPT" record.
CREATE TABLE IF NOT EXISTS adt.patients (
  id              SERIAL PRIMARY KEY,
  mrn             VARCHAR(20) UNIQUE NOT NULL DEFAULT ('M' || nextval('adt.mrn_seq')),
  first_name      VARCHAR(100) NOT NULL,
  middle_name     VARCHAR(100),
  last_name       VARCHAR(100) NOT NULL,
  date_of_birth   DATE NOT NULL,
  sex             VARCHAR(10) NOT NULL,     -- M, F, O, U
  race            VARCHAR(50),
  ethnicity       VARCHAR(50),
  ssn_last4       VARCHAR(4),              -- Never store full SSN
  marital_status  VARCHAR(20),
  preferred_lang  VARCHAR(50) DEFAULT 'English',

  -- Address
  address_line1   VARCHAR(200),
  address_line2   VARCHAR(200),
  city            VARCHAR(100),
  state           VARCHAR(2),
  zip             VARCHAR(10),
  country         VARCHAR(50) DEFAULT 'USA',

  -- Contact
  phone_home      VARCHAR(20),
  phone_mobile    VARCHAR(20),
  phone_work      VARCHAR(20),
  email           VARCHAR(200),

  -- Status
  is_active       BOOLEAN DEFAULT TRUE,
  is_deceased     BOOLEAN DEFAULT FALSE,
  deceased_date   DATE,

  -- FHIR sync
  fhir_id         VARCHAR(100),           -- HAPI FHIR Patient resource ID

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Patient Identifiers ───────────────────────────────────────
-- Patients have many IDs across systems.
-- Epic calls this the "identifier" list on the patient.
-- LEARNING: This is why patient merges are hard — same person, different IDs
CREATE TABLE IF NOT EXISTS adt.patient_identifiers (
  id           SERIAL PRIMARY KEY,
  patient_id   INT NOT NULL REFERENCES adt.patients(id) ON DELETE CASCADE,
  id_type      VARCHAR(50) NOT NULL,  -- MRN, SSN, DL, PASSPORT, INSURANCE_ID, etc.
  id_value     VARCHAR(200) NOT NULL,
  assigning_authority VARCHAR(100),   -- Who issued this ID
  effective_date DATE,
  expiry_date  DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(id_type, id_value, assigning_authority)
);

-- ── Encounters ────────────────────────────────────────────────
-- Every patient visit = one encounter.
-- Epic calls this a "HAR" (Hospital Account Record) for inpatient,
-- and a "CSN" (Contact Serial Number) for any encounter type.
-- LEARNING: The encounter is the atomic unit of healthcare.
--           Orders, results, notes, and charges all link to it.
CREATE TABLE IF NOT EXISTS adt.encounters (
  id                SERIAL PRIMARY KEY,
  csn               VARCHAR(20) UNIQUE NOT NULL DEFAULT nextval('adt.csn_seq')::TEXT,
  patient_id        INT NOT NULL REFERENCES adt.patients(id),

  -- Type & Status
  encounter_type    VARCHAR(50) NOT NULL,  -- INPATIENT, OUTPATIENT, EMERGENCY, OBSERVATION
  encounter_status  VARCHAR(30) NOT NULL DEFAULT 'REGISTERED',
  -- Statuses: REGISTERED → ADMITTED → DISCHARGED | CANCELLED

  -- Timing
  admit_datetime    TIMESTAMPTZ,
  discharge_datetime TIMESTAMPTZ,
  scheduled_datetime TIMESTAMPTZ,

  -- Location
  location_id       INT REFERENCES adt.locations(id),
  admit_source      VARCHAR(50),    -- EMERGENCY, PHYSICIAN_REFERRAL, TRANSFER, etc.
  discharge_disp    VARCHAR(100),   -- HOME, SNF, EXPIRED, AMA, etc.

  -- Providers
  attending_id      INT REFERENCES adt.providers(id),
  admitting_id      INT REFERENCES adt.providers(id),

  -- Clinical
  chief_complaint   TEXT,
  admitting_dx      VARCHAR(500),
  visit_reason      VARCHAR(500),

  -- Financial
  financial_class   VARCHAR(50),    -- COMMERCIAL, MEDICARE, MEDICAID, SELF_PAY
  account_number    VARCHAR(50),

  -- FHIR sync
  fhir_encounter_id VARCHAR(100),

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── ADT Event Log ─────────────────────────────────────────────
-- Every ADT action is logged — admit, discharge, transfer, update.
-- LEARNING: This is exactly what drives HL7 ADT messages.
--           Each row here = one HL7 ADT message sent downstream.
CREATE TABLE IF NOT EXISTS adt.adt_events (
  id            SERIAL PRIMARY KEY,
  encounter_id  INT NOT NULL REFERENCES adt.encounters(id),
  patient_id    INT NOT NULL REFERENCES adt.patients(id),
  event_type    VARCHAR(20) NOT NULL,  -- A01, A03, A04, A08, A11, A40
  event_desc    VARCHAR(100),
  from_location INT REFERENCES adt.locations(id),
  to_location   INT REFERENCES adt.locations(id),
  hl7_message   TEXT,                  -- The actual HL7 message sent
  fhir_payload  JSONB,                 -- The FHIR resource sent
  sent_at       TIMESTAMPTZ DEFAULT NOW(),
  status        VARCHAR(20) DEFAULT 'SENT'
);

-- ── Insurance / Coverage ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS adt.coverages (
  id              SERIAL PRIMARY KEY,
  patient_id      INT NOT NULL REFERENCES adt.patients(id),
  payer_name      VARCHAR(200) NOT NULL,
  plan_name       VARCHAR(200),
  member_id       VARCHAR(100) NOT NULL,
  group_number    VARCHAR(100),
  priority        INT DEFAULT 1,        -- 1=Primary, 2=Secondary, 3=Tertiary
  effective_date  DATE,
  termination_date DATE,
  subscriber_name VARCHAR(200),
  subscriber_dob  DATE,
  relationship    VARCHAR(50) DEFAULT 'SELF',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Seed Data ─────────────────────────────────────────────────
INSERT INTO adt.providers (npi, first_name, last_name, specialty, department) VALUES
  ('1234567890', 'Sarah',   'Chen',    'Internal Medicine',   'Hospitalist'),
  ('1234567891', 'Marcus',  'Johnson', 'Emergency Medicine',  'Emergency'),
  ('1234567892', 'Emily',   'Torres',  'Cardiology',          'Cardiology'),
  ('1234567893', 'David',   'Kim',     'Surgery',             'Surgery'),
  ('1234567894', 'Jennifer','Patel',   'Family Medicine',     'Outpatient')
ON CONFLICT (npi) DO NOTHING;

INSERT INTO adt.locations (building, unit, room, bed, bed_status) VALUES
  ('Main',  '4 WEST',     '401', 'A', 'AVAILABLE'),
  ('Main',  '4 WEST',     '401', 'B', 'AVAILABLE'),
  ('Main',  '4 WEST',     '402', 'A', 'AVAILABLE'),
  ('Main',  '4 WEST',     '402', 'B', 'AVAILABLE'),
  ('Main',  '4 WEST',     '403', 'A', 'AVAILABLE'),
  ('Main',  '4 EAST',     '410', 'A', 'AVAILABLE'),
  ('Main',  '4 EAST',     '410', 'B', 'AVAILABLE'),
  ('Main',  '4 EAST',     '411', 'A', 'AVAILABLE'),
  ('Main',  'ICU',        '501', 'A', 'AVAILABLE'),
  ('Main',  'ICU',        '501', 'B', 'AVAILABLE'),
  ('Main',  'ICU',        '502', 'A', 'AVAILABLE'),
  ('ER',    'EMERGENCY',  'ER1', 'A', 'AVAILABLE'),
  ('ER',    'EMERGENCY',  'ER2', 'A', 'AVAILABLE'),
  ('ER',    'EMERGENCY',  'ER3', 'A', 'AVAILABLE'),
  ('Clinic','OUTPATIENT', 'C1',  '-', 'AVAILABLE')
ON CONFLICT DO NOTHING;

\echo 'Module 1 ADT schema initialized.'
