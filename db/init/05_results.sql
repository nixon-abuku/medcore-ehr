-- ─────────────────────────────────────────────────────────────
--  MedCore EHR — Module 4: Results Schema
--  Schema: results
--
--  LEARNING NOTE:
--  Results flow INTO the EHR from external systems.
--  The message type is ORU^R01 (Observation Result Unsolicited).
--  "Unsolicited" means the lab sends it without being asked —
--  it fires automatically when the analyzer finishes the test.
--
--  Key segments in ORU^R01:
--    MSH — header
--    PID — patient identity
--    PV1 — visit context
--    ORC — order reference (links back to the original order)
--    OBR — what was tested (the order details)
--    OBX — the actual result value (one per test component)
--
--  OBX is the most important segment in results work.
--  A single CBC has ~15 OBX segments — one per component
--  (WBC, RBC, Hemoglobin, Hematocrit, Platelets, etc.)
--
--  Abnormal flags in OBX-8:
--    H  = High
--    L  = Low
--    HH = Critical High (panic value)
--    LL = Critical Low  (panic value)
--    A  = Abnormal
--    N  = Normal
-- ─────────────────────────────────────────────────────────────

-- ── Result Reports ────────────────────────────────────────────
-- One report per ORU^R01 message received
CREATE TABLE IF NOT EXISTS results.result_reports (
  id                  SERIAL PRIMARY KEY,
  placer_order_num    VARCHAR(30),           -- Links back to orders.orders
  filler_order_num    VARCHAR(30),           -- The lab's own order number
  patient_id          INT,
  patient_mrn         VARCHAR(20) NOT NULL,
  encounter_csn       VARCHAR(20),
  order_id            INT,                   -- References orders.orders if matched

  -- What was tested
  test_name           VARCHAR(200) NOT NULL,
  test_code           VARCHAR(50),           -- LOINC code
  test_code_system    VARCHAR(20) DEFAULT 'LOINC',

  -- Report metadata
  report_status       VARCHAR(20) DEFAULT 'FINAL',
  -- PARTIAL, PRELIMINARY, FINAL, CORRECTED, CANCELLED
  result_source       VARCHAR(50) DEFAULT 'LAB', -- LAB, RADIOLOGY, PATHOLOGY
  performing_lab      VARCHAR(200) DEFAULT 'MedCore Reference Laboratory',
  ordering_provider   VARCHAR(200),

  -- Timestamps
  collection_time     TIMESTAMPTZ,
  received_time       TIMESTAMPTZ DEFAULT NOW(),
  verified_time       TIMESTAMPTZ,

  -- Acknowledgment
  acknowledged_by     VARCHAR(100),
  acknowledged_at     TIMESTAMPTZ,

  -- Raw HL7
  raw_hl7             TEXT,

  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Result Observations ───────────────────────────────────────
-- One row per OBX segment — the actual values
CREATE TABLE IF NOT EXISTS results.observations (
  id                SERIAL PRIMARY KEY,
  report_id         INT NOT NULL REFERENCES results.result_reports(id) ON DELETE CASCADE,
  set_id            INT NOT NULL DEFAULT 1,  -- OBX-1: sequence within the report

  -- What was measured (OBX-3)
  observation_code  VARCHAR(50),             -- LOINC code
  observation_name  VARCHAR(200) NOT NULL,   -- Human readable name
  code_system       VARCHAR(20) DEFAULT 'LOINC',

  -- The value (OBX-5)
  value_type        VARCHAR(5) DEFAULT 'NM', -- NM=Numeric, ST=String, TX=Text, CWE=Coded
  value_numeric     DECIMAL(15,4),           -- For numeric results
  value_text        TEXT,                    -- For text/narrative results
  value_display     VARCHAR(500),            -- Formatted display value

  -- Units and range (OBX-6, OBX-7)
  units             VARCHAR(50),
  reference_range   VARCHAR(100),            -- e.g. "3.5-5.0" or "< 200"

  -- Abnormal flag (OBX-8) — this is critical
  abnormal_flag     VARCHAR(5),              -- H, L, HH, LL, A, N, blank=normal
  -- HH and LL = CRITICAL values — must notify provider immediately

  -- Result status (OBX-11)
  result_status     VARCHAR(5) DEFAULT 'F',  -- F=Final, P=Preliminary, C=Corrected

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Document Results ─────────────────────────────────────────
-- For radiology reports, pathology reports — narrative text
CREATE TABLE IF NOT EXISTS results.documents (
  id              SERIAL PRIMARY KEY,
  report_id       INT REFERENCES results.result_reports(id),
  patient_mrn     VARCHAR(20) NOT NULL,
  document_type   VARCHAR(50),               -- RADIOLOGY_REPORT, PATH_REPORT, etc.
  document_title  VARCHAR(200),
  content         TEXT NOT NULL,             -- The narrative report text
  author          VARCHAR(200),
  status          VARCHAR(20) DEFAULT 'FINAL',
  document_date   TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  raw_hl7         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Reference Ranges ─────────────────────────────────────────
-- Normal ranges by test and patient demographics
CREATE TABLE IF NOT EXISTS results.reference_ranges (
  id            SERIAL PRIMARY KEY,
  loinc_code    VARCHAR(20) NOT NULL,
  test_name     VARCHAR(200),
  sex           VARCHAR(5) DEFAULT 'ALL',   -- M, F, ALL
  age_min       INT DEFAULT 0,
  age_max       INT DEFAULT 999,
  low_normal    DECIMAL(15,4),
  high_normal   DECIMAL(15,4),
  low_critical  DECIMAL(15,4),
  high_critical DECIMAL(15,4),
  units         VARCHAR(50),
  display_range VARCHAR(100)
);

-- ── Seed: Reference Ranges ────────────────────────────────────
INSERT INTO results.reference_ranges (loinc_code, test_name, sex, low_normal, high_normal, low_critical, high_critical, units, display_range) VALUES
  -- CBC
  ('6690-2',  'WBC',         'ALL', 4.5,  11.0, 2.0,  30.0,  'K/uL',  '4.5-11.0'),
  ('789-8',   'RBC',         'M',   4.5,  5.9,  2.0,  8.0,   'M/uL',  '4.5-5.9'),
  ('789-8',   'RBC',         'F',   4.0,  5.2,  2.0,  8.0,   'M/uL',  '4.0-5.2'),
  ('718-7',   'Hemoglobin',  'M',   13.5, 17.5, 7.0,  20.0,  'g/dL',  '13.5-17.5'),
  ('718-7',   'Hemoglobin',  'F',   12.0, 15.5, 7.0,  20.0,  'g/dL',  '12.0-15.5'),
  ('4544-3',  'Hematocrit',  'M',   41.0, 53.0, 20.0, 60.0,  '%',     '41-53'),
  ('4544-3',  'Hematocrit',  'F',   36.0, 46.0, 20.0, 60.0,  '%',     '36-46'),
  ('777-3',   'Platelets',   'ALL', 150,  400,  50,   1000,  'K/uL',  '150-400'),
  -- BMP
  ('2951-2',  'Sodium',      'ALL', 136,  145,  120,  160,   'mEq/L', '136-145'),
  ('2823-3',  'Potassium',   'ALL', 3.5,  5.0,  2.5,  6.5,   'mEq/L', '3.5-5.0'),
  ('2075-0',  'Chloride',    'ALL', 98,   107,  80,   120,   'mEq/L', '98-107'),
  ('1963-8',  'Bicarb',      'ALL', 22,   29,   10,   40,    'mEq/L', '22-29'),
  ('3094-0',  'BUN',         'ALL', 7,    20,   2,    100,   'mg/dL', '7-20'),
  ('2160-0',  'Creatinine',  'ALL', 0.6,  1.2,  0.2,  10.0,  'mg/dL', '0.6-1.2'),
  ('2345-7',  'Glucose',     'ALL', 70,   100,  40,   500,   'mg/dL', '70-100'),
  -- Cardiac
  ('42757-5', 'Troponin I',  'ALL', 0,    0.04, 0,    50.0,  'ng/mL', '< 0.04'),
  ('30934-4', 'BNP',         'ALL', 0,    100,  0,    5000,  'pg/mL', '< 100')
ON CONFLICT DO NOTHING;

\echo 'Module 4 Results schema initialized.'
