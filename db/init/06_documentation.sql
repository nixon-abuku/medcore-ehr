-- ─────────────────────────────────────────────────────────────
--  MedCore EHR — Module 5: Clinical Documentation Schema
--  Schema: documentation
--
--  LEARNING NOTE:
--  In Epic, clinical documentation lives in ClinDoc.
--  Providers write notes using SmartText and SmartPhrases —
--  templates with auto-populated fields.
--
--  HL7 messages for documentation:
--    MDM^T02 — Original document (new note)
--    MDM^T08 — Document edit (amendment)
--    MDM^T11 — Document cancellation
--
--  FHIR resources:
--    Composition     — the clinical note
--    Condition       — problem list item
--    AllergyIntolerance — allergy
--    Observation     — vitals
--    MedicationStatement — medication list
-- ─────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS documentation.doc_seq START 500000 INCREMENT 1;

-- ── Note Types ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentation.note_types (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  code        VARCHAR(20) NOT NULL UNIQUE,
  loinc_code  VARCHAR(20),
  description TEXT,
  active      BOOLEAN DEFAULT TRUE
);

-- ── Note Templates ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentation.note_templates (
  id            SERIAL PRIMARY KEY,
  note_type_id  INT REFERENCES documentation.note_types(id),
  name          VARCHAR(200) NOT NULL,
  content       TEXT NOT NULL,   -- Template with {placeholders}
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Clinical Notes ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentation.clinical_notes (
  id              SERIAL PRIMARY KEY,
  doc_id          VARCHAR(30) UNIQUE NOT NULL DEFAULT ('DOC' || nextval('documentation.doc_seq')::TEXT),
  patient_id      INT NOT NULL,
  patient_mrn     VARCHAR(20) NOT NULL,
  encounter_csn   VARCHAR(20),
  note_type_id    INT REFERENCES documentation.note_types(id),
  note_type_name  VARCHAR(100),

  -- Content
  title           VARCHAR(300),
  content         TEXT NOT NULL,

  -- Status
  status          VARCHAR(20) DEFAULT 'DRAFT',
  -- DRAFT → SIGNED → AMENDED | CANCELLED

  -- Authorship
  author_id       INT,
  author_name     VARCHAR(200),
  cosigner_id     INT,
  cosigner_name   VARCHAR(200),

  -- Timestamps
  authored_at     TIMESTAMPTZ DEFAULT NOW(),
  signed_at       TIMESTAMPTZ,
  amended_at      TIMESTAMPTZ,

  -- HL7
  hl7_message     TEXT,
  fhir_doc_id     VARCHAR(100),

  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Vitals ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentation.vitals (
  id              SERIAL PRIMARY KEY,
  patient_id      INT NOT NULL,
  patient_mrn     VARCHAR(20) NOT NULL,
  encounter_csn   VARCHAR(20),
  recorded_by     VARCHAR(200),
  recorded_at     TIMESTAMPTZ DEFAULT NOW(),

  -- The vital signs
  temperature     DECIMAL(5,1),  -- Fahrenheit
  temperature_route VARCHAR(20), -- Oral, Axillary, Rectal, Temporal
  heart_rate      INT,           -- bpm
  respiratory_rate INT,          -- breaths/min
  bp_systolic     INT,           -- mmHg
  bp_diastolic    INT,           -- mmHg
  bp_position     VARCHAR(20),   -- Sitting, Standing, Supine
  oxygen_sat      DECIMAL(4,1),  -- %
  oxygen_delivery VARCHAR(50),   -- Room air, 2L NC, etc.
  weight_kg       DECIMAL(6,2),
  height_cm       DECIMAL(6,2),
  pain_score      INT,           -- 0-10
  bmi             DECIMAL(5,2)
);

-- ── Problem List ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentation.problems (
  id              SERIAL PRIMARY KEY,
  patient_id      INT NOT NULL,
  patient_mrn     VARCHAR(20) NOT NULL,
  description     VARCHAR(500) NOT NULL,
  icd10_code      VARCHAR(20),
  icd10_display   VARCHAR(200),
  onset_date      DATE,
  status          VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, RESOLVED, INACTIVE
  noted_by        VARCHAR(200),
  noted_at        TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  fhir_condition_id VARCHAR(100)
);

-- ── Allergies ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentation.allergies (
  id              SERIAL PRIMARY KEY,
  patient_id      INT NOT NULL,
  patient_mrn     VARCHAR(20) NOT NULL,
  allergen        VARCHAR(200) NOT NULL,
  allergen_type   VARCHAR(50) DEFAULT 'DRUG', -- DRUG, FOOD, ENVIRONMENTAL, OTHER
  reaction        VARCHAR(500),
  severity        VARCHAR(20) DEFAULT 'MODERATE', -- MILD, MODERATE, SEVERE, LIFE_THREATENING
  status          VARCHAR(20) DEFAULT 'ACTIVE',
  noted_by        VARCHAR(200),
  noted_at        TIMESTAMPTZ DEFAULT NOW(),
  fhir_allergy_id VARCHAR(100)
);

-- ── MDM Event Log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentation.mdm_events (
  id          SERIAL PRIMARY KEY,
  note_id     INT REFERENCES documentation.clinical_notes(id),
  event_type  VARCHAR(10) NOT NULL, -- T02, T08, T11
  hl7_message TEXT,
  sent_at     TIMESTAMPTZ DEFAULT NOW(),
  status      VARCHAR(20) DEFAULT 'SENT'
);

-- ── Seed: Note Types ──────────────────────────────────────────
INSERT INTO documentation.note_types (name, code, loinc_code, description) VALUES
  ('Progress Note',         'PROG',    '11506-3', 'Daily progress note'),
  ('History & Physical',    'HNP',     '34117-2', 'Admission H&P'),
  ('Discharge Summary',     'DISCH',   '18842-5', 'Discharge summary'),
  ('Procedure Note',        'PROC',    '28570-0', 'Procedure documentation'),
  ('Consult Note',          'CONSULT', '11488-4', 'Specialist consultation'),
  ('Nursing Note',          'NURS',    '34746-8', 'Nursing assessment note'),
  ('Operative Note',        'OP',      '11504-8', 'Operative/surgical note')
ON CONFLICT (code) DO NOTHING;

-- ── Seed: Note Templates ──────────────────────────────────────
INSERT INTO documentation.note_templates (note_type_id, name, content) VALUES
  (1, 'Standard Progress Note',
'SUBJECTIVE:
Patient is a {age}-year-old {sex} presenting with {chief_complaint}.

OBJECTIVE:
Vitals: T {temp}F, HR {hr} bpm, BP {bp} mmHg, RR {rr}, SpO2 {o2}% on {o2_delivery}

ASSESSMENT:
{assessment}

PLAN:
{plan}

Electronically signed by: {provider}'),

  (2, 'Admission H&P',
'CHIEF COMPLAINT:
{chief_complaint}

HISTORY OF PRESENT ILLNESS:
{hpi}

PAST MEDICAL HISTORY:
{pmh}

MEDICATIONS:
{medications}

ALLERGIES:
{allergies}

PHYSICAL EXAMINATION:
General: {general_exam}
Vitals: T {temp}F, HR {hr}, BP {bp}, RR {rr}, SpO2 {o2}%

ASSESSMENT & PLAN:
{assessment_plan}

Electronically signed by: {provider}'),

  (3, 'Discharge Summary',
'ADMISSION DATE: {admit_date}
DISCHARGE DATE: {discharge_date}
DISCHARGE DISPOSITION: {disposition}

PRINCIPAL DIAGNOSIS:
{principal_dx}

HOSPITAL COURSE:
{hospital_course}

DISCHARGE MEDICATIONS:
{discharge_meds}

FOLLOW-UP:
{follow_up}

Electronically signed by: {provider}')
ON CONFLICT DO NOTHING;

\echo 'Module 5 Clinical Documentation schema initialized.'
