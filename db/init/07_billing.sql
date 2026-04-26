-- ─────────────────────────────────────────────────────────────
--  MedCore EHR — Module 6: Billing & Charging Schema
--  Schema: billing
--
--  LEARNING NOTE:
--  In Epic, billing lives in Resolute (Hospital Billing + Professional Billing).
--  The revenue cycle flow:
--
--  Clinical event → Charge drops (DFT^P03) → Charge review →
--  Claim built (X12 837) → Submitted to payer →
--  Payment/denial back (X12 835) → Posted to account
--
--  Key concepts:
--    CPT code  = what procedure was done (charges)
--    ICD-10 code = why it was done (diagnosis, medical necessity)
--    Every claim needs BOTH — CPT without ICD-10 = denial
--
--  X12 transactions:
--    270/271 = Eligibility inquiry/response
--    837P    = Professional claim (physician services)
--    837I    = Institutional claim (hospital services)
--    835     = Electronic Remittance Advice (payment/denial)
-- ─────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS billing.charge_seq  START 700000 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS billing.claim_seq   START 800000 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS billing.account_seq START 900000 INCREMENT 1;

-- ── Payers ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing.payers (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  payer_id      VARCHAR(50) UNIQUE,  -- Electronic payer ID for X12
  payer_type    VARCHAR(20) DEFAULT 'COMMERCIAL', -- COMMERCIAL, MEDICARE, MEDICAID, SELF_PAY
  address       VARCHAR(300),
  phone         VARCHAR(20),
  active        BOOLEAN DEFAULT TRUE
);

-- ── Charge Master (CDM) ───────────────────────────────────────
-- The hospital's price list — every billable service has an entry
CREATE TABLE IF NOT EXISTS billing.charge_master (
  id            SERIAL PRIMARY KEY,
  cdm_code      VARCHAR(20) UNIQUE NOT NULL,  -- Internal charge code
  description   VARCHAR(300) NOT NULL,
  cpt_code      VARCHAR(10),                  -- CPT/HCPCS procedure code
  revenue_code  VARCHAR(10),                  -- UB-04 revenue code
  department    VARCHAR(100),
  charge_amount DECIMAL(10,2) NOT NULL,       -- Gross charge (before insurance)
  active        BOOLEAN DEFAULT TRUE
);

-- ── Patient Accounts ──────────────────────────────────────────
-- One account per encounter/visit
CREATE TABLE IF NOT EXISTS billing.accounts (
  id              SERIAL PRIMARY KEY,
  account_num     VARCHAR(30) UNIQUE NOT NULL DEFAULT ('ACC' || nextval('billing.account_seq')::TEXT),
  patient_mrn     VARCHAR(20) NOT NULL,
  encounter_csn   VARCHAR(20),
  financial_class VARCHAR(50),    -- COMMERCIAL, MEDICARE, MEDICAID, SELF_PAY
  payer_id        INT REFERENCES billing.payers(id),
  member_id       VARCHAR(100),
  group_number    VARCHAR(100),
  status          VARCHAR(30) DEFAULT 'OPEN', -- OPEN, BILLED, PAID, DENIED, WRITTEN_OFF
  admit_date      DATE,
  discharge_date  DATE,
  total_charges   DECIMAL(10,2) DEFAULT 0,
  total_payments  DECIMAL(10,2) DEFAULT 0,
  balance         DECIMAL(10,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Charges ───────────────────────────────────────────────────
-- Each billable event = one charge line
-- LEARNING: In Epic, charges drop automatically from clinical events.
-- Place a lab order → charge drops. Admit patient → room charge drops.
CREATE TABLE IF NOT EXISTS billing.charges (
  id              SERIAL PRIMARY KEY,
  charge_num      VARCHAR(30) UNIQUE NOT NULL DEFAULT ('CHG' || nextval('billing.charge_seq')::TEXT),
  account_id      INT REFERENCES billing.accounts(id),
  patient_mrn     VARCHAR(20) NOT NULL,
  encounter_csn   VARCHAR(20),

  -- What was done
  cdm_code        VARCHAR(20),
  cpt_code        VARCHAR(10) NOT NULL,
  cpt_description VARCHAR(300),
  revenue_code    VARCHAR(10),
  quantity        INT DEFAULT 1,
  charge_amount   DECIMAL(10,2) NOT NULL,

  -- Why it was done (medical necessity)
  icd10_primary   VARCHAR(20),
  icd10_desc      VARCHAR(300),

  -- Source of the charge
  charge_source   VARCHAR(50),   -- ORDER, PROCEDURE, ROOM_BOARD, SUPPLY, MANUAL
  source_id       VARCHAR(50),   -- order ID, procedure ID, etc.
  department      VARCHAR(100),
  ordering_provider VARCHAR(200),
  performing_provider VARCHAR(200),

  -- Status
  status          VARCHAR(30) DEFAULT 'PENDING', -- PENDING, APPROVED, BILLED, VOIDED

  -- Dates
  service_date    DATE DEFAULT CURRENT_DATE,
  posted_at       TIMESTAMPTZ DEFAULT NOW(),
  voided_at       TIMESTAMPTZ,
  void_reason     TEXT,

  -- HL7
  hl7_message     TEXT
);

-- ── Claims ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing.claims (
  id              SERIAL PRIMARY KEY,
  claim_num       VARCHAR(30) UNIQUE NOT NULL DEFAULT ('CLM' || nextval('billing.claim_seq')::TEXT),
  account_id      INT REFERENCES billing.accounts(id),
  patient_mrn     VARCHAR(20) NOT NULL,
  payer_id        INT REFERENCES billing.payers(id),
  claim_type      VARCHAR(10) DEFAULT '837P',  -- 837P or 837I
  status          VARCHAR(30) DEFAULT 'DRAFT', -- DRAFT, SUBMITTED, ACCEPTED, DENIED, PAID, PARTIAL
  total_billed    DECIMAL(10,2) DEFAULT 0,
  total_paid      DECIMAL(10,2) DEFAULT 0,
  total_denied    DECIMAL(10,2) DEFAULT 0,
  denial_reason   TEXT,
  submitted_at    TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  x12_837         TEXT,   -- The raw X12 claim
  x12_835         TEXT,   -- The raw X12 remittance
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Claim Lines ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing.claim_lines (
  id          SERIAL PRIMARY KEY,
  claim_id    INT NOT NULL REFERENCES billing.claims(id),
  charge_id   INT REFERENCES billing.charges(id),
  line_num    INT NOT NULL,
  cpt_code    VARCHAR(10),
  cpt_desc    VARCHAR(300),
  icd10_codes VARCHAR(200),  -- comma separated
  quantity    INT DEFAULT 1,
  billed_amt  DECIMAL(10,2),
  paid_amt    DECIMAL(10,2) DEFAULT 0,
  status      VARCHAR(20) DEFAULT 'PENDING'
);

-- ── DFT/BAR Event Log ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing.hl7_events (
  id          SERIAL PRIMARY KEY,
  charge_id   INT REFERENCES billing.charges(id),
  account_id  INT REFERENCES billing.accounts(id),
  event_type  VARCHAR(20) NOT NULL,  -- DFT_P03, BAR_P01, X12_270, X12_837, X12_835
  direction   VARCHAR(10) DEFAULT 'OUTBOUND',
  hl7_message TEXT,
  sent_at     TIMESTAMPTZ DEFAULT NOW(),
  status      VARCHAR(20) DEFAULT 'SENT'
);

-- ── Seed: Payers ──────────────────────────────────────────────
INSERT INTO billing.payers (name, payer_id, payer_type) VALUES
  ('Blue Cross Blue Shield',  'BCBS001',  'COMMERCIAL'),
  ('Aetna',                   'AETNA001', 'COMMERCIAL'),
  ('UnitedHealthcare',        'UHC001',   'COMMERCIAL'),
  ('Cigna',                   'CIGNA001', 'COMMERCIAL'),
  ('Medicare Part A',         'MCARE_A',  'MEDICARE'),
  ('Medicare Part B',         'MCARE_B',  'MEDICARE'),
  ('Medicaid',                'MCAID001', 'MEDICAID'),
  ('Self Pay',                'SELFPAY',  'SELF_PAY')
ON CONFLICT (payer_id) DO NOTHING;

-- ── Seed: Charge Master ───────────────────────────────────────
INSERT INTO billing.charge_master (cdm_code, description, cpt_code, revenue_code, department, charge_amount) VALUES
  -- Room & Board
  ('RM-MED-01',   'Medical/Surgical Room - Daily',      '99220', '0120', 'MED_SURG',    1850.00),
  ('RM-ICU-01',   'ICU Room - Daily',                   '99291', '0200', 'ICU',         4200.00),
  ('RM-ER-01',    'Emergency Room Visit - Level 4',     '99284', '0450', 'EMERGENCY',    875.00),
  -- Lab
  ('LAB-CBC-01',  'Complete Blood Count',               '85025', '0300', 'LABORATORY',    85.00),
  ('LAB-BMP-01',  'Basic Metabolic Panel',              '80048', '0300', 'LABORATORY',   125.00),
  ('LAB-CMP-01',  'Comprehensive Metabolic Panel',      '80053', '0300', 'LABORATORY',   145.00),
  ('LAB-TROP-01', 'Troponin I',                         '84484', '0300', 'LABORATORY',   210.00),
  ('LAB-BNP-01',  'BNP',                                '83880', '0300', 'LABORATORY',   185.00),
  ('LAB-UA-01',   'Urinalysis with Micro',              '81001', '0300', 'LABORATORY',    65.00),
  ('LAB-BC-01',   'Blood Culture',                      '87040', '0300', 'LABORATORY',   175.00),
  -- Imaging
  ('RAD-CXR-01',  'Chest X-Ray PA & Lateral',          '71046', '0320', 'RADIOLOGY',    285.00),
  ('RAD-CTH-01',  'CT Head without Contrast',           '70450', '0350', 'RADIOLOGY',    850.00),
  ('RAD-CTC-01',  'CT Chest with Contrast',             '71250', '0350', 'RADIOLOGY',   1250.00),
  ('RAD-MRI-01',  'MRI Brain without Contrast',         '70553', '0610', 'RADIOLOGY',   2100.00),
  ('RAD-ECH-01',  'Echocardiogram',                     '93306', '0480', 'CARDIOLOGY',  1650.00),
  -- Pharmacy
  ('PHARM-ASA',   'Aspirin 81mg',                       '99070', '0250', 'PHARMACY',       2.50),
  ('PHARM-METRO', 'Metoprolol 25mg',                    '99070', '0250', 'PHARMACY',       4.75),
  ('PHARM-HEPARIN','Heparin 5000u SQ',                  '99070', '0250', 'PHARMACY',      12.00),
  ('PHARM-NS',    'Normal Saline 1L',                   '99070', '0250', 'PHARMACY',      18.50),
  -- Procedures
  ('PROC-EKG',    'Electrocardiogram 12-lead',          '93000', '0730', 'CARDIOLOGY',   185.00),
  ('PROC-IV',     'IV Insertion',                       '36000', '0260', 'NURSING',       95.00)
ON CONFLICT (cdm_code) DO NOTHING;

\echo 'Module 6 Billing schema initialized.'
