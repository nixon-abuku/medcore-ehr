/**
 * MedCore HL7 v2.5.1 Message Builder
 *
 * LEARNING: This is the core of healthcare integration.
 * Every message follows the same structure:
 *
 *   MSH  — Message header (who sent it, when, what type)
 *   EVN  — Event info (when it happened)
 *   PID  — Patient Identity (name, DOB, MRN, address)
 *   PV1  — Patient Visit (encounter, location, provider)
 *
 * Fields are separated by | (pipe)
 * Sub-fields by ^ (caret)
 * Repetitions by ~ (tilde)
 * Each segment ends with \r (carriage return)
 *
 * When you work in Epic Bridges, you'll read and write
 * messages exactly like these every single day.
 */

function now() {
  return new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
}

function hl7Date(dateStr) {
  if (!dateStr) return '';
  return String(dateStr).substring(0, 10).replace(/-/g, '');
}

function safe(val) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/\|/g, '\\F\\').replace(/\^/g, '\\S\\');
}

/**
 * Build MSH segment — always the first segment in any HL7 v2 message
 * MSH defines: encoding, sending app, receiving app, datetime, message type, control ID, version
 */
function buildMSH(messageType, eventCode, controlId) {
  const fields = [
    'MSH',
    '^~\\&',                          // MSH-2: Encoding characters (this exact string, always)
    'MEDCORE_EHR',                    // MSH-3: Sending Application
    'MEDCORE_MEDICAL_CENTER',         // MSH-4: Sending Facility
    'RECEIVING_SYSTEM',               // MSH-5: Receiving Application
    'RECEIVING_FACILITY',             // MSH-6: Receiving Facility
    now(),                            // MSH-7: Date/Time of Message
    '',                               // MSH-8: Security (usually empty)
    `${messageType}^${eventCode}^${messageType}_${eventCode}`, // MSH-9: Message Type
    controlId || `MC${Date.now()}`,   // MSH-10: Message Control ID (must be unique)
    'P',                              // MSH-11: Processing ID (P=Production, T=Test, D=Debug)
    '2.5.1',                          // MSH-12: HL7 Version
  ];
  return fields.join('|');
}

/**
 * Build EVN segment — records when the event actually occurred
 */
function buildEVN(eventCode, eventDatetime) {
  return [
    'EVN',
    eventCode,                        // EVN-1: Event Type Code
    now(),                            // EVN-2: Recorded Date/Time
    '',                               // EVN-3: Date/Time Planned Event
    '',                               // EVN-4: Event Reason Code
    'MEDCORE_USER',                   // EVN-5: Operator ID
    eventDatetime || now(),           // EVN-6: Event Occurred
  ].join('|');
}

/**
 * Build PID segment — Patient Identity
 * LEARNING: PID is THE most important segment. If PID is wrong,
 * the downstream system can't match the patient and the message fails.
 * PID-3 (patient ID list) is especially critical — it carries the MRN.
 */
function buildPID(patient) {
  const dob = hl7Date(patient.date_of_birth);
  const name = `${safe(patient.last_name)}^${safe(patient.first_name)}^${safe(patient.middle_name || '')}`;
  const address = [
    safe(patient.address_line1 || ''),
    safe(patient.address_line2 || ''),
    safe(patient.city || ''),
    safe(patient.state || ''),
    safe(patient.zip || ''),
    safe(patient.country || 'USA'),
    'H'  // Address type: H=Home
  ].join('^');

  return [
    'PID',
    '1',                              // PID-1: Set ID
    '',                               // PID-2: Patient ID (external, deprecated)
    `${safe(patient.mrn)}^^^MEDCORE^MR`, // PID-3: Patient ID List (MRN with assigning authority)
    '',                               // PID-4: Alternate Patient ID
    name,                             // PID-5: Patient Name (Last^First^Middle)
    '',                               // PID-6: Mother's Maiden Name
    dob,                              // PID-7: Date of Birth (YYYYMMDD)
    safe(patient.sex?.[0]?.toUpperCase() || 'U'), // PID-8: Sex (M/F/O/U)
    '',                               // PID-9: Patient Alias
    safe(patient.race || ''),         // PID-10: Race
    address,                          // PID-11: Patient Address
    '',                               // PID-12: County Code
    safe(patient.phone_home || patient.phone_mobile || ''), // PID-13: Phone Home
    safe(patient.phone_work || ''),   // PID-14: Phone Work
    safe(patient.preferred_lang || 'English'), // PID-15: Primary Language
    safe(patient.marital_status || ''), // PID-16: Marital Status
    '',                               // PID-17: Religion
    '',                               // PID-18: Account Number
    '',                               // PID-19: SSN (intentionally blank — HIPAA)
    '',                               // PID-20: Driver License
    '',                               // PID-21: Mother's ID
    safe(patient.ethnicity || ''),    // PID-22: Ethnic Group
    '',                               // PID-23: Birth Place
    safe(patient.is_deceased ? 'Y' : 'N'), // PID-30: Patient Death Indicator
  ].join('|');
}

/**
 * Build PV1 segment — Patient Visit
 * LEARNING: PV1 tells downstream systems WHERE the patient is and WHO their doctor is.
 * The lab needs this to print on the report. Billing needs this to charge correctly.
 */
function buildPV1(encounter, location, provider) {
  const locStr = location
    ? `${safe(location.unit)}^${safe(location.room || '')}^${safe(location.bed || '')}^${safe(location.facility || 'MEDCORE')}`
    : '^^^MEDCORE';

  const attendingStr = provider
    ? `${safe(provider.id)}^${safe(provider.last_name)}^${safe(provider.first_name)}^^^${safe(provider.npi || '')}^NPI`
    : '';

  const encTypeCode = {
    'INPATIENT':    'I',
    'OUTPATIENT':   'O',
    'EMERGENCY':    'E',
    'OBSERVATION':  'O',
  }[encounter.encounter_type] || 'O';

  return [
    'PV1',
    '1',                              // PV1-1: Set ID
    encTypeCode,                      // PV1-2: Patient Class (I=Inpatient, O=Outpatient, E=Emergency)
    locStr,                           // PV1-3: Assigned Patient Location (unit^room^bed^facility)
    safe(encounter.admit_source || ''), // PV1-4: Admission Type
    '',                               // PV1-5: Pre-admit Number
    '',                               // PV1-6: Prior Patient Location
    attendingStr,                     // PV1-7: Attending Doctor
    '',                               // PV1-8: Referring Doctor
    '',                               // PV1-9: Consulting Doctor
    '',                               // PV1-10: Hospital Service
    '',                               // PV1-11: Temporary Location
    '',                               // PV1-12: Pre-Admit Test Indicator
    '',                               // PV1-13: Readmission Indicator
    safe(encounter.admit_source || ''), // PV1-14: Admit Source
    '',                               // PV1-15: Ambulatory Status
    '',                               // PV1-16: VIP Indicator
    '',                               // PV1-17: Admitting Doctor
    safe(encounter.financial_class || 'COMMERCIAL'), // PV1-20: Financial Class
    '',                               // PV1-36: Discharge Disposition
    '',                               // PV1-37: Discharge to Location
    '',                               // PV1-44: Admit Date/Time
    encounter.discharge_datetime ? hl7Date(encounter.discharge_datetime) : '', // PV1-45: Discharge Date/Time
    '',                               // PV1-50: Alt Visit ID
    safe(encounter.csn),              // PV1-19: Visit Number (CSN)
  ].join('|');
}

// ── Public message builders ───────────────────────────────────

/**
 * ADT^A01 — Admit a patient (inpatient admission)
 * LEARNING: This fires when a patient is admitted to the hospital.
 * Every downstream system (lab, pharmacy, radiology, dietary) gets this.
 * They use it to "open" the patient in their system.
 */
function buildA01(patient, encounter, location, provider) {
  const controlId = `A01${Date.now()}`;
  return [
    buildMSH('ADT', 'A01', controlId),
    buildEVN('A01', encounter.admit_datetime),
    buildPID(patient),
    buildPV1(encounter, location, provider),
  ].join('\r') + '\r';
}

/**
 * ADT^A03 — Discharge a patient
 * LEARNING: Fires when a patient leaves the hospital.
 * Downstream systems use this to "close" the visit and finalize charges.
 */
function buildA03(patient, encounter, location, provider) {
  const controlId = `A03${Date.now()}`;
  return [
    buildMSH('ADT', 'A03', controlId),
    buildEVN('A03', encounter.discharge_datetime),
    buildPID(patient),
    buildPV1(encounter, location, provider),
  ].join('\r') + '\r';
}

/**
 * ADT^A04 — Register an outpatient visit
 * LEARNING: Used for clinic visits, ED visits, outpatient procedures.
 * Similar to A01 but for non-admitted patients.
 */
function buildA04(patient, encounter, location, provider) {
  const controlId = `A04${Date.now()}`;
  return [
    buildMSH('ADT', 'A04', controlId),
    buildEVN('A04'),
    buildPID(patient),
    buildPV1(encounter, location, provider),
  ].join('\r') + '\r';
}

/**
 * ADT^A08 — Update patient information
 * LEARNING: Fires whenever demographics change (address, phone, insurance).
 * This is the most common ADT message by volume in any hospital.
 * A single registration desk update generates dozens of A08s.
 */
function buildA08(patient, encounter, location, provider) {
  const controlId = `A08${Date.now()}`;
  return [
    buildMSH('ADT', 'A08', controlId),
    buildEVN('A08'),
    buildPID(patient),
    buildPV1(encounter, location, provider),
  ].join('\r') + '\r';
}

/**
 * ADT^A11 — Cancel admit
 * LEARNING: Sent when an admission is cancelled (patient refused, wrong patient, etc.)
 * Downstream systems must "undo" what they did for the A01.
 * This is why idempotency matters in integration.
 */
function buildA11(patient, encounter, location, provider) {
  const controlId = `A11${Date.now()}`;
  return [
    buildMSH('ADT', 'A11', controlId),
    buildEVN('A11'),
    buildPID(patient),
    buildPV1(encounter, location, provider),
  ].join('\r') + '\r';
}

/**
 * ADT^A40 — Merge patient records
 * LEARNING: When two MRNs turn out to be the same person.
 * This is one of the hardest problems in healthcare IT.
 * Every downstream system must merge their records too.
 */
function buildA40(survivingPatient, mergedMrn) {
  const controlId = `A40${Date.now()}`;
  const mrg = `MRG|${safe(mergedMrn)}^^^MEDCORE^MR`;
  return [
    buildMSH('ADT', 'A40', controlId),
    buildEVN('A40'),
    buildPID(survivingPatient),
    mrg,
  ].join('\r') + '\r';
}

module.exports = { buildA01, buildA03, buildA04, buildA08, buildA11, buildA40 };
