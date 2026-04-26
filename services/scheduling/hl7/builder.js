/**
 * MedCore HL7 v2.5.1 SIU Message Builder
 *
 * LEARNING: SIU = Scheduling Information Unsolicited
 * These messages notify downstream systems about appointment events.
 *
 * Common SIU event codes:
 *   S12 — New appointment booked
 *   S13 — Appointment rescheduled  
 *   S14 — Appointment modified
 *   S15 — Appointment cancelled
 *   S17 — Appointment deleted
 *   S26 — Patient did not show (no-show)
 *
 * SIU message structure:
 *   MSH — Message header
 *   SCH — Scheduling Activity Information (the appointment details)
 *   PID — Patient Identity
 *   AIL — Appointment Information - Location
 *   AIP — Appointment Information - Personnel (provider)
 */

function now() {
  return new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
}
function hl7Date(d) {
  if (!d) return '';
  return String(d).replace(/-/g, '').substring(0, 8);
}
function hl7Time(t) {
  if (!t) return '';
  return String(t).replace(/:/g, '').substring(0, 4);
}
function safe(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\|/g, '\\F\\').replace(/\^/g, '\\S\\');
}

function buildMSH(eventCode, controlId) {
  return [
    'MSH', '^~\\&', 'MEDCORE_SCHEDULING', 'MEDCORE_MEDICAL_CENTER',
    'RECEIVING_SYSTEM', 'RECEIVING_FACILITY', now(), '',
    `SIU^${eventCode}^SIU_${eventCode}`,
    controlId || `SIU${Date.now()}`, 'P', '2.5.1'
  ].join('|');
}

/**
 * SCH — Schedule Activity Information
 * LEARNING: SCH is the core of SIU messages — it describes the appointment.
 * SCH-1 is the placer appointment ID (who requested it)
 * SCH-2 is the filler appointment ID (who fulfilled it — the scheduling system)
 */
function buildSCH(appt, visitType) {
  const duration = visitType?.duration_min || 30;
  return [
    'SCH',
    safe(appt.appt_id),            // SCH-1: Placer Appointment ID
    safe(appt.id),                 // SCH-2: Filler Appointment ID
    '',                            // SCH-3: Occurrence Number
    '',                            // SCH-4: Placer Group Number
    '',                            // SCH-5: Schedule ID
    safe(visitType?.name || ''),   // SCH-6: Event Reason
    '',                            // SCH-7: Appointment Reason
    safe(visitType?.code || ''),   // SCH-8: Appointment Type
    duration.toString(),           // SCH-9: Appointment Duration
    'MIN',                         // SCH-10: Duration Units
    `${hl7Date(appt.appt_date)}${hl7Time(appt.start_time)}^^${duration}^MIN`, // SCH-11: Start Date/Time
    '',                            // SCH-12: Priority
    '',                            // SCH-13: Repeating Interval
    '',                            // SCH-14: Repeating Interval Duration
    'MEDCORE_USER',                // SCH-15: Placer Contact Person
    '',                            // SCH-16: Placer Contact Phone
    '',                            // SCH-17: Placer Contact Address
    '',                            // SCH-18: Placer Contact Location
    'MEDCORE_SCHEDULING',          // SCH-19: Filler Contact Person
    '',                            // SCH-20: Filler Contact Phone
    safe(appt.department || ''),   // SCH-21: Filler Contact Address
    '',                            // SCH-22: Filler Contact Location
    safe(appt.status),             // SCH-25: Filler Status Code
  ].join('|');
}

function buildPID(patient) {
  const dob = hl7Date(patient.date_of_birth);
  return [
    'PID', '1', '',
    `${safe(patient.mrn)}^^^MEDCORE^MR`,
    '', `${safe(patient.last_name)}^${safe(patient.first_name)}`,
    '', dob, safe(patient.sex?.[0]?.toUpperCase() || 'U'),
    '', '', '', '',
    safe(patient.phone_home || patient.phone_mobile || ''),
  ].join('|');
}

/**
 * AIP — Appointment Information Personnel
 * LEARNING: AIP identifies the provider for the appointment.
 * In Epic, this links to the provider's NPI and schedule template.
 */
function buildAIP(provider) {
  return [
    'AIP', '1', '',
    `${safe(provider?.id)}^${safe(provider?.last_name)}^${safe(provider?.first_name)}^^^${safe(provider?.npi)}^NPI`,
    'ATTENDING', '',
    '', '', '', 'ACCEPT'
  ].join('|');
}

/**
 * AIL — Appointment Information Location
 */
function buildAIL(appt) {
  return [
    'AIL', '1', '',
    safe(appt.department || appt.location_name || 'OUTPATIENT'),
    '', '', '', '', 'ACCEPT'
  ].join('|');
}

// ── Public builders ───────────────────────────────────────────

/** SIU^S12 — New appointment booked */
function buildS12(appt, patient, provider, visitType) {
  return [
    buildMSH('S12', `S12${Date.now()}`),
    buildSCH(appt, visitType),
    buildPID(patient),
    buildAIL(appt),
    buildAIP(provider),
  ].join('\r') + '\r';
}

/** SIU^S14 — Appointment modified */
function buildS14(appt, patient, provider, visitType) {
  return [
    buildMSH('S14', `S14${Date.now()}`),
    buildSCH(appt, visitType),
    buildPID(patient),
    buildAIL(appt),
    buildAIP(provider),
  ].join('\r') + '\r';
}

/** SIU^S15 — Appointment cancelled */
function buildS15(appt, patient, provider, visitType) {
  return [
    buildMSH('S15', `S15${Date.now()}`),
    buildSCH({ ...appt, status: 'CANCELLED' }, visitType),
    buildPID(patient),
    buildAIL(appt),
    buildAIP(provider),
  ].join('\r') + '\r';
}

/** SIU^S26 — No-show */
function buildS26(appt, patient, provider, visitType) {
  return [
    buildMSH('S26', `S26${Date.now()}`),
    buildSCH({ ...appt, status: 'NO_SHOW' }, visitType),
    buildPID(patient),
    buildAIL(appt),
    buildAIP(provider),
  ].join('\r') + '\r';
}

module.exports = { buildS12, buildS14, buildS15, buildS26 };
