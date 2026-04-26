/**
 * MedCore HL7 v2.5.1 Order Message Builder
 *
 * LEARNING: Order messages are the most complex in HL7 v2.
 * There are two main message types:
 *
 * ORM^O01 — General Order Message
 *   Used for: lab orders, imaging orders, procedure orders
 *   Structure: MSH + PID + PV1 + ORC + OBR
 *
 * RDE^O11 — Pharmacy/Treatment Encoded Order
 *   Used for: medication orders
 *   Structure: MSH + PID + PV1 + ORC + RXO + RXR + RXC
 *
 * KEY CONCEPT — ORC Order Control Codes:
 *   NW  = New order
 *   CA  = Cancel order
 *   DC  = Discontinue order
 *   XO  = Change order
 *   OK  = Order accepted (acknowledgment from filler)
 *
 * KEY CONCEPT — Placer vs Filler:
 *   Placer = The system that placed the order (Epic / MedCore)
 *   Filler = The system that fulfills it (lab, pharmacy, radiology)
 *   Each has their own order number. This is critical.
 *   If the filler number is missing, you can't match results back.
 */

function now() { return new Date().toISOString().replace(/[-:T]/g,'').substring(0,14); }
function safe(v) { if(v===null||v===undefined)return''; return String(v).replace(/\|/g,'\\F\\').replace(/\^/g,'\\S\\'); }
function hl7Date(d) { if(!d)return''; return String(d).replace(/-/g,'').substring(0,8); }

function buildMSH(messageType, eventCode, controlId) {
  return ['MSH','^~\\&','MEDCORE_ORDERS','MEDCORE_MEDICAL_CENTER',
    'RECEIVING_SYSTEM','RECEIVING_FACILITY',now(),'',
    `${messageType}^${eventCode}^${messageType}_${eventCode}`,
    controlId||`ORD${Date.now()}`,'P','2.5.1'].join('|');
}

function buildPID(patient) {
  return ['PID','1','',
    `${safe(patient.mrn)}^^^MEDCORE^MR`,'',
    `${safe(patient.last_name)}^${safe(patient.first_name)}`,'',
    hl7Date(patient.date_of_birth),
    safe(patient.sex?.[0]?.toUpperCase()||'U'),
  ].join('|');
}

function buildPV1(encounter) {
  return ['PV1','1',
    encounter?.encounter_type?.[0]||'O',
    safe(encounter?.location||''),
    '','','',
    safe(encounter?.attending||''),
  ].join('|');
}

/**
 * ORC — Common Order Segment
 * LEARNING: ORC appears in EVERY order message type.
 * It carries the order control code, placer/filler numbers, and status.
 *
 * ORC-1: Order Control (NW=new, CA=cancel, DC=discontinue)
 * ORC-2: Placer Order Number — YOUR system's order ID
 * ORC-3: Filler Order Number — the fulfilling system's order ID
 * ORC-5: Order Status (IP=in process, CM=complete, CA=cancelled)
 * ORC-9: Date/Time of Transaction
 * ORC-12: Ordering Provider
 * ORC-13: Enterer's Location
 */
function buildORC(order, orderControl, provider) {
  const statusMap = {
    'PENDING':     'SC',  // Scheduled
    'SENT':        'IP',  // In Process
    'IN_PROGRESS': 'IP',
    'COMPLETED':   'CM',  // Complete
    'CANCELLED':   'CA',  // Cancelled
  };
  return [
    'ORC',
    orderControl || 'NW',
    safe(order.placer_order_num),
    safe(order.filler_order_num || ''),
    '',
    statusMap[order.status] || 'SC',
    '',
    '',
    '',
    now(),
    '',
    '',
    provider ? `${safe(provider.id)}^${safe(provider.last_name)}^${safe(provider.first_name)}^^^${safe(provider.npi||'')}^NPI` : '',
  ].join('|');
}

/**
 * OBR — Observation Request Segment
 * LEARNING: OBR carries the details of WHAT is being ordered.
 * For lab: the test name, LOINC code, specimen type, priority
 * For imaging: the procedure, modality, body part
 *
 * OBR-2: Placer Order Number (repeated from ORC-2)
 * OBR-3: Filler Order Number (repeated from ORC-3)
 * OBR-4: Universal Service Identifier (LOINC code ^ name ^ system)
 * OBR-5: Priority (STAT, ROUTINE, ASAP)
 * OBR-7: Observation Date/Time
 * OBR-13: Relevant Clinical Info (indication)
 * OBR-15: Specimen Source
 * OBR-25: Result Status
 */
function buildOBR(order, setId = 1) {
  return [
    'OBR',
    setId.toString(),
    safe(order.placer_order_num),
    safe(order.filler_order_num || ''),
    `${safe(order.order_code||'')}^${safe(order.order_name)}^${safe(order.order_code_system||'L')}`,
    safe(order.priority || 'ROUTINE'),
    '',
    now(),
    '',
    '',
    '',
    '',
    '',
    safe(order.clinical_indication || ''),
    '',
    order.specimen_type ? `${safe(order.specimen_type)}^^^^` : '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    safe(order.status === 'COMPLETED' ? 'F' : 'O'),  // Result status: F=Final, O=Order
  ].join('|');
}

/**
 * RXO — Pharmacy/Treatment Order Segment
 * LEARNING: RXO is used instead of OBR for medication orders.
 * It carries the drug, dose, route, frequency.
 *
 * RXO-1: Requested Give Code (drug name/NDC)
 * RXO-2: Requested Give Amount - Minimum (dose)
 * RXO-4: Requested Give Units
 * RXO-5: Requested Dosage Form (tablet, capsule, IV)
 * RXO-6: Provider's Pharmacy/Treatment Instructions
 * RXO-7: Provider's Administration Instructions (frequency)
 */
function buildRXO(order) {
  return [
    'RXO',
    `${safe(order.order_code||'')}^${safe(order.order_name)}^NDC`,
    safe(order.dose || ''),
    '',
    safe(order.dose_unit || ''),
    safe(order.route || ''),
    safe(order.special_instructions || ''),
    safe(order.frequency || ''),
    '',
    '',
    safe(order.dispense_quantity || ''),
  ].join('|');
}

/**
 * RXR — Pharmacy/Treatment Route Segment
 * Defines the route of administration
 */
function buildRXR(order) {
  const routeCodes = {
    'PO': 'PO^Oral^HL70162',
    'IV': 'IV^Intravenous^HL70162',
    'SQ': 'SQ^Subcutaneous^HL70162',
    'IM': 'IM^Intramuscular^HL70162',
    'SL': 'SL^Sublingual^HL70162',
    'TOP': 'TOP^Topical^HL70162',
  };
  const route = order.route?.toUpperCase() || 'PO';
  return `RXR|${routeCodes[route] || route}`;
}

// ── Public message builders ───────────────────────────────────

/**
 * ORM^O01 with NW (New Order)
 * Fires when a lab or imaging order is placed
 * Sent to: mock-lab or mock-radiology via Mirth
 */
function buildORM_NW(order, patient, encounter, provider) {
  return [
    buildMSH('ORM','O01',`ORM${Date.now()}`),
    buildPID(patient),
    buildPV1(encounter),
    buildORC(order, 'NW', provider),
    buildOBR(order, 1),
  ].join('\r') + '\r';
}

/**
 * ORM^O01 with CA (Cancel Order)
 * Fires when a lab or imaging order is cancelled
 */
function buildORM_CA(order, patient, encounter, provider) {
  return [
    buildMSH('ORM','O01',`ORM${Date.now()}`),
    buildPID(patient),
    buildPV1(encounter),
    buildORC({ ...order, status: 'CANCELLED' }, 'CA', provider),
    buildOBR({ ...order, status: 'CANCELLED' }, 1),
  ].join('\r') + '\r';
}

/**
 * RDE^O11 — New Medication Order
 * Fires when a medication order is placed
 * Sent to: mock-pharmacy via Mirth
 */
function buildRDE_O11(order, patient, encounter, provider) {
  return [
    buildMSH('RDE','O11',`RDE${Date.now()}`),
    buildPID(patient),
    buildPV1(encounter),
    buildORC(order, 'NW', provider),
    buildRXO(order),
    buildRXR(order),
  ].join('\r') + '\r';
}

/**
 * RDE^O11 with CA — Cancel Medication Order
 */
function buildRDE_CA(order, patient, encounter, provider) {
  return [
    buildMSH('RDE','O11',`RDE${Date.now()}`),
    buildPID(patient),
    buildPV1(encounter),
    buildORC({ ...order, status: 'CANCELLED' }, 'CA', provider),
    buildRXO(order),
    buildRXR(order),
  ].join('\r') + '\r';
}

module.exports = { buildORM_NW, buildORM_CA, buildRDE_O11, buildRDE_CA };
