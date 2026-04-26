/**
 * MedCore FHIR R4 Sync
 *
 * LEARNING: In Epic, the "Interconnect" layer exposes FHIR APIs.
 * Here we sync our ADT data to HAPI FHIR so the patient portal
 * and any SMART on FHIR apps can read it.
 *
 * FHIR resources used:
 *   Patient    — demographics (maps to PID segment)
 *   Encounter  — visit info   (maps to PV1 segment)
 *   Coverage   — insurance    (maps to IN1 segment)
 */

const FHIR_BASE = process.env.FHIR_BASE_URL || 'http://hapi-fhir:8080/fhir';

async function fhirRequest(method, path, body) {
  const res = await fetch(`${FHIR_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/fhir+json', 'Accept': 'application/fhir+json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FHIR ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Map our patient record to a FHIR R4 Patient resource
 * LEARNING: This mapping (HL7 v2 PID ↔ FHIR Patient) is something
 * Epic's Bridges/Interconnect does internally. We're doing it manually
 * so you can see exactly how the fields correspond.
 */
function toFHIRPatient(patient) {
  const resource = {
    resourceType: 'Patient',
    id: patient.fhir_id || undefined,
    identifier: [
      {
        use: 'usual',
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR' }] },
        system: 'http://medcore.example.org/mrn',
        value: patient.mrn,
      }
    ],
    active: patient.is_active !== false,
    name: [{
      use: 'official',
      family: patient.last_name,
      given: [patient.first_name, patient.middle_name].filter(Boolean),
    }],
    telecom: [],
    gender: { 'M': 'male', 'F': 'female', 'O': 'other', 'U': 'unknown' }[patient.sex] || 'unknown',
    birthDate: patient.date_of_birth?.toISOString?.()?.substring(0, 10) || patient.date_of_birth,
    address: [],
    communication: patient.preferred_lang ? [{
      language: { coding: [{ display: patient.preferred_lang }] },
      preferred: true,
    }] : [],
  };

  if (patient.phone_mobile) resource.telecom.push({ system: 'phone', value: patient.phone_mobile, use: 'mobile' });
  if (patient.phone_home)   resource.telecom.push({ system: 'phone', value: patient.phone_home, use: 'home' });
  if (patient.email)        resource.telecom.push({ system: 'email', value: patient.email });

  if (patient.address_line1) {
    resource.address.push({
      use: 'home',
      line: [patient.address_line1, patient.address_line2].filter(Boolean),
      city: patient.city,
      state: patient.state,
      postalCode: patient.zip,
      country: patient.country || 'USA',
    });
  }

  if (patient.is_deceased) {
    resource.deceasedBoolean = true;
    if (patient.deceased_date) resource.deceasedDateTime = patient.deceased_date;
  }

  return resource;
}

/**
 * Map our encounter record to a FHIR R4 Encounter resource
 */
function toFHIREncounter(encounter, patient, provider, location) {
  const statusMap = {
    'REGISTERED':  'arrived',
    'ADMITTED':    'in-progress',
    'DISCHARGED':  'finished',
    'CANCELLED':   'cancelled',
  };

  const classMap = {
    'INPATIENT':   { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'IMP', display: 'inpatient encounter' },
    'OUTPATIENT':  { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
    'EMERGENCY':   { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'EMER', display: 'emergency' },
    'OBSERVATION': { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'OBSENC', display: 'observation encounter' },
  };

  const resource = {
    resourceType: 'Encounter',
    id: encounter.fhir_encounter_id || undefined,
    identifier: [{
      system: 'http://medcore.example.org/csn',
      value: encounter.csn,
    }],
    status: statusMap[encounter.encounter_status] || 'arrived',
    class: classMap[encounter.encounter_type] || classMap['OUTPATIENT'],
    subject: { reference: `Patient/${patient.fhir_id}`, display: `${patient.first_name} ${patient.last_name}` },
    period: {},
    reasonCode: [],
  };

  if (encounter.admit_datetime)     resource.period.start = new Date(encounter.admit_datetime).toISOString();
  if (encounter.discharge_datetime) resource.period.end   = new Date(encounter.discharge_datetime).toISOString();
  if (encounter.chief_complaint)    resource.reasonCode.push({ text: encounter.chief_complaint });
  if (provider?.fhir_id) resource.participant = [{ individual: { reference: `Practitioner/${provider.fhir_id}` } }];

  return resource;
}

// ── Public sync functions ─────────────────────────────────────

async function syncPatient(patient) {
  const resource = toFHIRPatient(patient);
  if (patient.fhir_id) {
    resource.id = patient.fhir_id;
    const result = await fhirRequest('PUT', `/Patient/${patient.fhir_id}`, resource);
    return result.id;
  } else {
    const result = await fhirRequest('POST', '/Patient', resource);
    return result.id;
  }
}

async function syncEncounter(encounter, patient, provider, location) {
  const resource = toFHIREncounter(encounter, patient, provider, location);
  if (encounter.fhir_encounter_id) {
    resource.id = encounter.fhir_encounter_id;
    const result = await fhirRequest('PUT', `/Encounter/${encounter.fhir_encounter_id}`, resource);
    return result.id;
  } else {
    const result = await fhirRequest('POST', '/Encounter', resource);
    return result.id;
  }
}

module.exports = { syncPatient, syncEncounter, toFHIRPatient, toFHIREncounter };
