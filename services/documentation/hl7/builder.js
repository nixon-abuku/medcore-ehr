/**
 * MedCore HL7 v2.5.1 MDM Message Builder
 *
 * LEARNING: MDM = Medical Document Management
 * These messages carry clinical documents (notes, reports)
 * between systems.
 *
 * Event codes:
 *   T02 — Original document (new note signed)
 *   T08 — Document edit (amendment)
 *   T11 — Document cancellation
 *
 * MDM structure:
 *   MSH — header
 *   EVN — event
 *   PID — patient
 *   PV1 — visit
 *   TXA — Transcription Document Header (document metadata)
 *   OBX — document content (the actual text)
 *
 * TXA is unique to MDM messages — it describes the document:
 *   TXA-2:  Document Type (PROG=Progress Note, HNP=H&P, etc.)
 *   TXA-4:  Activity Date/Time
 *   TXA-5:  Primary Activity Provider (who wrote it)
 *   TXA-8:  Unique Document Number
 *   TXA-17: Document Completion Status (AU=Authenticated/Signed)
 *   TXA-22: Authentication Person (who signed)
 */

function now() { return new Date().toISOString().replace(/[-:T]/g,'').substring(0,14); }
function safe(v) { if(v===null||v===undefined)return''; return String(v).replace(/\|/g,'\\F\\').replace(/\^/g,'\\S\\'); }

function buildMSH(eventCode, controlId) {
  return ['MSH','^~\\&','MEDCORE_CLINDOC','MEDCORE_MEDICAL_CENTER',
    'RECEIVING_SYSTEM','RECEIVING_FACILITY',now(),'',
    `MDM^${eventCode}^MDM_${eventCode}`,
    controlId||`MDM${Date.now()}`,'P','2.5.1'].join('|');
}

function buildEVN(eventCode) {
  return `EVN|${eventCode}|${now()}`;
}

function buildPID(patient) {
  return ['PID','1','',
    `${safe(patient.mrn)}^^^MEDCORE^MR`,'',
    `${safe(patient.last_name)}^${safe(patient.first_name)}`
  ].join('|');
}

function buildPV1(encounter) {
  return ['PV1','1',
    encounter?.encounter_type?.[0]||'O',
    safe(encounter?.location||'')
  ].join('|');
}

/**
 * TXA — Transcription Document Header
 * LEARNING: TXA is the key segment in MDM messages.
 * It identifies the document type, author, and status.
 * Downstream systems (transcription, HIM, external portals)
 * use TXA to know what kind of document they're receiving.
 */
function buildTXA(note, provider) {
  return [
    'TXA',
    '1',
    safe(note.note_type_code || 'PROG'),       // TXA-2: Document type
    'TX',                                       // TXA-3: Document content presentation (TX=text)
    now(),                                      // TXA-4: Activity date/time
    provider ? `${safe(provider.id)}^${safe(provider.last_name)}^${safe(provider.first_name)}` : '', // TXA-5: Author
    '',                                         // TXA-6: Origination date
    '',                                         // TXA-7: Transcription date
    safe(note.doc_id),                          // TXA-8: Unique document number
    '',                                         // TXA-9: Originator reference ID
    '',                                         // TXA-10: Assigned doc authenticator
    '',                                         // TXA-11: Transcriptionist
    safe(note.doc_id),                          // TXA-12: Unique document file name
    '',                                         // TXA-13: Parent doc
    '',                                         // TXA-14: Placer order #
    '',                                         // TXA-15: Filler order #
    '',                                         // TXA-16: Unique doc date/time
    note.status === 'SIGNED' ? 'AU' : 'IP',    // TXA-17: AU=Authenticated, IP=In Progress
    '',                                         // TXA-18: Document availability status
    '',                                         // TXA-19: Expected document storage location
    '',                                         // TXA-20: Storage handling code
    '',                                         // TXA-21: Authentication person timestamp
    provider ? `${safe(provider.id)}^${safe(provider.last_name)}^${safe(provider.first_name)}` : '', // TXA-22: Signer
  ].join('|');
}

/**
 * OBX for document content
 * The actual text of the note goes in OBX-5
 * Value type TX = Text
 */
function buildOBX(content, setId=1) {
  return [
    'OBX',
    setId.toString(),
    'TX',                          // OBX-2: Value type TX=Text
    'NOTE^Clinical Note^L',        // OBX-3: observation ID
    '',                            // OBX-4: sub-ID
    safe(content),                 // OBX-5: THE NOTE CONTENT
    '',                            // OBX-6: units
    '',                            // OBX-7: reference range
    '',                            // OBX-8: abnormal flag
    '',                            // OBX-9
    '',                            // OBX-10
    'F',                           // OBX-11: F=Final
  ].join('|');
}

// ── Public builders ───────────────────────────────────────────

/** MDM^T02 — New document (note signed) */
function buildT02(note, patient, encounter, provider) {
  return [
    buildMSH('T02', `T02${Date.now()}`),
    buildEVN('T02'),
    buildPID(patient),
    buildPV1(encounter),
    buildTXA(note, provider),
    buildOBX(note.content, 1),
  ].join('\r') + '\r';
}

/** MDM^T08 — Document edit (amendment) */
function buildT08(note, patient, encounter, provider) {
  return [
    buildMSH('T08', `T08${Date.now()}`),
    buildEVN('T08'),
    buildPID(patient),
    buildPV1(encounter),
    buildTXA(note, provider),
    buildOBX(note.content, 1),
  ].join('\r') + '\r';
}

/** MDM^T11 — Document cancellation */
function buildT11(note, patient, encounter, provider) {
  return [
    buildMSH('T11', `T11${Date.now()}`),
    buildEVN('T11'),
    buildPID(patient),
    buildPV1(encounter),
    buildTXA({ ...note, status: 'CANCELLED' }, provider),
  ].join('\r') + '\r';
}

module.exports = { buildT02, buildT08, buildT11 };
