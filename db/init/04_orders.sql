-- ─────────────────────────────────────────────────────────────
--  MedCore EHR — Module 3: Orders (CPOE) Schema
--  Schema: orders
--
--  LEARNING NOTE:
--  In Epic, orders live across multiple modules:
--    Beaker  = lab orders
--    Willow  = pharmacy/medication orders
--    Radiant = radiology/imaging orders
--  All of them use the same core HL7 order workflow:
--    ORC (common order) + OBR (observation request) for lab/rad
--    ORC (common order) + RXO/RXE for pharmacy
--
--  The two most important concepts in orders:
--    PLACER = who placed the order (the EHR, the clinician)
--    FILLER = who fulfills the order (the lab, pharmacy, radiology)
--  Every order has both a placer order number AND a filler order number.
-- ─────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS orders.placer_seq START 300000 INCREMENT 1;

-- ── Order Catalog ─────────────────────────────────────────────
-- The menu of orderable items — what clinicians can order
CREATE TABLE IF NOT EXISTS orders.order_catalog (
  id              SERIAL PRIMARY KEY,
  order_type      VARCHAR(20) NOT NULL,  -- LAB, MED, IMAGING, PROCEDURE
  name            VARCHAR(200) NOT NULL,
  code            VARCHAR(50),           -- LOINC for lab, NDC for med, CPT for procedure
  code_system     VARCHAR(20),           -- LOINC, NDC, CPT, SNOMED
  description     TEXT,
  default_priority VARCHAR(10) DEFAULT 'ROUTINE', -- STAT, ROUTINE, ASAP
  specimen_type   VARCHAR(50),           -- for lab: Blood, Urine, CSF, etc.
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Orders ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders.orders (
  id                    SERIAL PRIMARY KEY,
  placer_order_num      VARCHAR(30) UNIQUE NOT NULL DEFAULT ('PLO' || nextval('orders.placer_seq')::TEXT),
  filler_order_num      VARCHAR(30),           -- Set by the fulfilling system when they accept it
  patient_id            INT NOT NULL,
  patient_mrn           VARCHAR(20) NOT NULL,
  encounter_csn         VARCHAR(20),           -- Which encounter this order belongs to
  catalog_id            INT REFERENCES orders.order_catalog(id),

  -- Order details
  order_type            VARCHAR(20) NOT NULL,  -- LAB, MED, IMAGING, PROCEDURE
  order_name            VARCHAR(200) NOT NULL,
  order_code            VARCHAR(50),
  order_code_system     VARCHAR(20),
  priority              VARCHAR(10) DEFAULT 'ROUTINE',
  status                VARCHAR(30) DEFAULT 'PENDING',
  -- PENDING → SENT → ACKNOWLEDGED → IN_PROGRESS → COMPLETED | CANCELLED | ERROR

  -- Clinical context
  ordering_provider_id  INT,
  clinical_indication   TEXT,
  special_instructions  TEXT,

  -- Lab specific
  specimen_type         VARCHAR(50),
  specimen_collected_at TIMESTAMPTZ,

  -- Medication specific
  dose                  VARCHAR(50),
  dose_unit             VARCHAR(20),
  route                 VARCHAR(50),
  frequency             VARCHAR(50),
  duration              VARCHAR(50),
  dispense_quantity     VARCHAR(50),

  -- Imaging specific
  body_part             VARCHAR(100),
  laterality            VARCHAR(20),

  -- Timestamps
  ordered_at            TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at       TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  cancelled_reason      TEXT,

  -- HL7 tracking
  hl7_sent_at           TIMESTAMPTZ,
  fhir_request_id       VARCHAR(100),

  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── Order Sets ────────────────────────────────────────────────
-- Bundled orders commonly ordered together
CREATE TABLE IF NOT EXISTS orders.order_sets (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  category    VARCHAR(100),   -- Admit, Pre-op, Discharge, etc.
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders.order_set_items (
  id            SERIAL PRIMARY KEY,
  order_set_id  INT NOT NULL REFERENCES orders.order_sets(id),
  catalog_id    INT NOT NULL REFERENCES orders.order_catalog(id),
  default_priority VARCHAR(10) DEFAULT 'ROUTINE',
  default_instructions TEXT,
  display_order INT DEFAULT 0
);

-- ── ORM Event Log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders.orm_events (
  id            SERIAL PRIMARY KEY,
  order_id      INT NOT NULL REFERENCES orders.orders(id),
  event_type    VARCHAR(20) NOT NULL,  -- O01_NW, O01_CA, O01_DC
  direction     VARCHAR(10) DEFAULT 'OUTBOUND',
  destination   VARCHAR(50),           -- LAB, PHARMACY, RADIOLOGY
  hl7_message   TEXT,
  sent_at       TIMESTAMPTZ DEFAULT NOW(),
  status        VARCHAR(20) DEFAULT 'SENT',
  error_detail  TEXT
);

-- ── Seed: Order Catalog ───────────────────────────────────────
INSERT INTO orders.order_catalog (order_type, name, code, code_system, specimen_type, default_priority) VALUES
  -- Lab orders
  ('LAB', 'Complete Blood Count (CBC)',           '58410-2',  'LOINC', 'Blood',  'ROUTINE'),
  ('LAB', 'Basic Metabolic Panel (BMP)',          '51990-0',  'LOINC', 'Blood',  'ROUTINE'),
  ('LAB', 'Comprehensive Metabolic Panel (CMP)',  '24323-8',  'LOINC', 'Blood',  'ROUTINE'),
  ('LAB', 'Lipid Panel',                          '24331-1',  'LOINC', 'Blood',  'ROUTINE'),
  ('LAB', 'Hemoglobin A1c',                       '59261-8',  'LOINC', 'Blood',  'ROUTINE'),
  ('LAB', 'Thyroid Stimulating Hormone (TSH)',    '11580-8',  'LOINC', 'Blood',  'ROUTINE'),
  ('LAB', 'Prothrombin Time (PT/INR)',            '5902-2',   'LOINC', 'Blood',  'ROUTINE'),
  ('LAB', 'Blood Culture',                        '600-7',    'LOINC', 'Blood',  'STAT'),
  ('LAB', 'Urinalysis with Microscopy',           '5767-9',   'LOINC', 'Urine',  'ROUTINE'),
  ('LAB', 'Urine Culture',                        '630-4',    'LOINC', 'Urine',  'ROUTINE'),
  ('LAB', 'Troponin I',                           '42757-5',  'LOINC', 'Blood',  'STAT'),
  ('LAB', 'BNP (B-type Natriuretic Peptide)',     '30934-4',  'LOINC', 'Blood',  'STAT'),
  ('LAB', 'Lactic Acid',                          '2519-9',   'LOINC', 'Blood',  'STAT'),
  ('LAB', 'Arterial Blood Gas (ABG)',             '24336-0',  'LOINC', 'Blood',  'STAT'),
  -- Imaging orders
  ('IMAGING', 'Chest X-Ray PA and Lateral',      '36643-5',  'LOINC', NULL, 'ROUTINE'),
  ('IMAGING', 'CT Head without Contrast',         '24727-0',  'LOINC', NULL, 'ROUTINE'),
  ('IMAGING', 'CT Chest with Contrast',           '36643-5',  'LOINC', NULL, 'ROUTINE'),
  ('IMAGING', 'MRI Brain without Contrast',       '24558-9',  'LOINC', NULL, 'ROUTINE'),
  ('IMAGING', 'Echocardiogram',                   '42148-7',  'LOINC', NULL, 'ROUTINE'),
  ('IMAGING', 'Right Lower Extremity Ultrasound', '45036-5',  'LOINC', NULL, 'ROUTINE'),
  -- Medication orders
  ('MED', 'Metoprolol Succinate 25mg PO Daily',   '41493-7',  'NDC',   NULL, 'ROUTINE'),
  ('MED', 'Lisinopril 10mg PO Daily',             '29046-9',  'NDC',   NULL, 'ROUTINE'),
  ('MED', 'Aspirin 81mg PO Daily',                '1191',     'NDC',   NULL, 'ROUTINE'),
  ('MED', 'Heparin 5000 units SQ Q8H',            '237057',   'NDC',   NULL, 'ROUTINE'),
  ('MED', 'Ondansetron 4mg IV Q6H PRN nausea',    '221107',   'NDC',   NULL, 'ROUTINE'),
  ('MED', 'Morphine 2mg IV Q4H PRN pain',         '7052',     'NDC',   NULL, 'ROUTINE'),
  ('MED', 'Normal Saline 0.9% 1L IV at 125ml/hr','313002',   'NDC',   NULL, 'ROUTINE'),
  ('MED', 'Ceftriaxone 1g IV Daily',              '309045',   'NDC',   NULL, 'ROUTINE')
ON CONFLICT DO NOTHING;

-- ── Seed: Order Sets ──────────────────────────────────────────
INSERT INTO orders.order_sets (name, description, category) VALUES
  ('Chest Pain Admit Orders',   'Standard orders for chest pain admission', 'Admit'),
  ('Sepsis Bundle',             'CMS sepsis core measure bundle',           'Emergency'),
  ('Pre-Op Orders',             'Standard pre-operative orders',            'Pre-Op')
ON CONFLICT DO NOTHING;

-- Link chest pain set to labs
INSERT INTO orders.order_set_items (order_set_id, catalog_id, default_priority, display_order)
SELECT 1, id, 'STAT', ROW_NUMBER() OVER (ORDER BY id)
FROM orders.order_catalog
WHERE name IN ('Troponin I','BNP (B-type Natriuretic Peptide)','Complete Blood Count (CBC)','Basic Metabolic Panel (BMP)','Chest X-Ray PA and Lateral')
ON CONFLICT DO NOTHING;

\echo 'Module 3 Orders schema initialized.'
