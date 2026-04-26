/**
 * MedCore Billing Message Builder
 * DFT^P03, BAR^P01, X12 270/271, X12 837, X12 835
 *
 * LEARNING: Billing messages are the most financially critical
 * in all of healthcare IT. A bug in a billing interface can mean
 * millions of dollars in lost revenue or improper payments.
 *
 * TWO worlds of messaging in billing:
 *
 * 1. HL7 v2 (internal):
 *    DFT^P03 — Detailed Financial Transaction (charge drops)
 *    BAR^P01 — Add/update patient account
 *    These go from the EHR to the billing system internally.
 *
 * 2. X12 EDI (external — payer-facing):
 *    270/271 — Eligibility inquiry/response
 *    837P/837I — Claim submission to insurance
 *    835 — Electronic Remittance Advice (payment back)
 *    These go from the billing system to insurance companies.
 *
 * X12 uses a completely different format from HL7:
 *   - Segments end with ~ (tilde)
 *   - Fields separated by * (asterisk)
 *   - Sub-fields by : (colon)
 *   - ISA/GS/ST envelope wraps everything
 */

function now() { return new Date().toISOString().replace(/[-:T]/g,'').substring(0,14); }
function today() { return new Date().toISOString().substring(0,10).replace(/-/g,''); }
function safe(v) { if(v===null||v===undefined)return''; return String(v).replace(/\|/g,'\\F\\').replace(/\^/g,'\\S\\'); }

// ── HL7 DFT^P03 ───────────────────────────────────────────────

/**
 * DFT^P03 — Detailed Financial Transaction
 * LEARNING: This fires every time a charge drops.
 * Place a lab order → ORM^O01 fires to lab AND DFT^P03 fires to billing.
 * Patient in ICU overnight → DFT^P03 fires at midnight for room charge.
 *
 * FT1 segment = Financial Transaction (the charge detail):
 *   FT1-4:  Transaction date
 *   FT1-6:  Transaction type (CG=charge, CR=credit, CD=cancel)
 *   FT1-7:  Transaction quantity
 *   FT1-10: Transaction amount (gross charge)
 *   FT1-12: CPT code ^ description ^ code system
 *   FT1-19: Diagnosis code (ICD-10)
 *   FT1-20: Performed by provider
 */
function buildDFT_P03(charge, patient, account) {
  const controlId = `DFT${Date.now()}`;
  const msh = ['MSH','^~\\&','MEDCORE_BILLING','MEDCORE_MEDICAL_CENTER',
    'BILLING_SYSTEM','BILLING_FACILITY',now(),'',
    'DFT^P03^DFT_P03',controlId,'P','2.5.1'].join('|');

  const evn = `EVN|P03|${now()}`;

  const pid = ['PID','1','',
    `${safe(patient.mrn)}^^^MEDCORE^MR`,'',
    `${safe(patient.last_name)}^${safe(patient.first_name)}`
  ].join('|');

  const pv1 = ['PV1','1',
    account?.financial_class==='INPATIENT'?'I':'O',
    '','','','','',
    safe(charge.ordering_provider||''),
  ].join('|');

  // FT1 — Financial Transaction (the heart of DFT)
  const ft1 = [
    'FT1',
    '1',                                              // FT1-1: Set ID
    safe(charge.charge_num),                          // FT1-2: Transaction ID
    '',                                               // FT1-3: Transaction batch ID
    today(),                                          // FT1-4: Transaction date
    today(),                                          // FT1-5: Transaction posting date
    'CG',                                             // FT1-6: Transaction type CG=Charge
    charge.quantity?.toString() || '1',               // FT1-7: Transaction quantity
    '',                                               // FT1-8: Transaction amount - extended
    '',                                               // FT1-9: Transaction amount - non-covered
    safe(charge.charge_amount?.toString() || '0'),    // FT1-10: Transaction amount (GROSS)
    safe(charge.department || ''),                    // FT1-11: Department code
    `${safe(charge.cpt_code)}^${safe(charge.cpt_description)}^CPT`, // FT1-12: CPT code
    '',                                               // FT1-13: Insurance plan ID
    '',                                               // FT1-14: Insurance amount
    safe(account?.account_num || ''),                 // FT1-15: Patient account number
    '',                                               // FT1-16: Diagnosis code (old field)
    '',                                               // FT1-17: Performed by code
    '',                                               // FT1-18: Ordered by code
    safe(charge.icd10_primary || ''),                 // FT1-19: Diagnosis code ICD-10
    safe(charge.performing_provider || ''),           // FT1-20: Performed by
    safe(charge.ordering_provider || ''),             // FT1-21: Ordered by
    '',                                               // FT1-22: Unit cost
    safe(charge.encounter_csn || ''),                 // FT1-23: Filler order number (encounter)
    '',                                               // FT1-24: Entered by code
    `${safe(charge.icd10_primary||'')}^${safe(charge.icd10_desc||'')}^ICD10`, // FT1-25: Procedure code modifier
  ].join('|');

  return [msh, evn, pid, pv1, ft1].join('\r') + '\r';
}

/**
 * BAR^P01 — Add/update patient billing account
 * Fires when a patient is admitted — opens the billing account
 */
function buildBAR_P01(account, patient) {
  const controlId = `BAR${Date.now()}`;
  const msh = ['MSH','^~\\&','MEDCORE_BILLING','MEDCORE_MEDICAL_CENTER',
    'BILLING_SYSTEM','BILLING_FACILITY',now(),'',
    'BAR^P01^BAR_P01',controlId,'P','2.5.1'].join('|');

  const evn = `EVN|P01|${now()}`;

  const pid = ['PID','1','',
    `${safe(patient.mrn)}^^^MEDCORE^MR`,'',
    `${safe(patient.last_name)}^${safe(patient.first_name)}`
  ].join('|');

  const pv1 = ['PV1','1','I','','','','','','','','','','','','','',
    safe(account.financial_class||'COMMERCIAL'),
    '','','','',safe(account.account_num||'')
  ].join('|');

  return [msh, evn, pid, pv1].join('\r') + '\r';
}

// ── X12 EDI Messages ─────────────────────────────────────────

/**
 * Build X12 ISA/GS/ST envelope
 * LEARNING: Every X12 transaction is wrapped in three envelope layers:
 *   ISA = Interchange Control (outermost — identifies sender/receiver)
 *   GS  = Functional Group (groups related transactions)
 *   ST  = Transaction Set (the actual transaction)
 * Each has a matching closing segment: IEA, GE, SE
 */
function buildX12Envelope(senderId, receiverId, transactionType, transactionSetId, content) {
  const ctlNum = String(Date.now()).substring(5);
  const date = today().substring(0,6);
  const time = now().substring(8,12);

  const isa = `ISA*00*          *00*          *ZZ*${senderId.padEnd(15)}*ZZ*${receiverId.padEnd(15)}*${date}*${time}*^*00501*${ctlNum.padStart(9,'0')}*0*P*:~`;
  const gs  = `GS*${transactionType}*${senderId}*${receiverId}*${today()}*${time}*1*X*005010X279A1~`;
  const st  = `ST*${transactionSetId}*0001~`;
  const se  = `SE*${content.split('~').length + 2}*0001~`;
  const ge  = `GE*1*1~`;
  const iea = `IEA*1*${ctlNum.padStart(9,'0')}~`;

  return [isa, gs, st, content, se, ge, iea].join('\n');
}

/**
 * X12 270 — Eligibility Inquiry
 * LEARNING: Before billing, verify the patient is covered.
 * 270 goes to the payer, 271 comes back with coverage details.
 * In Epic this happens automatically at check-in (real-time eligibility).
 */
function buildX12_270(patient, payer, memberId) {
  const content = [
    `BHT*0022*13*${Date.now()}*${today()}*1400~`,
    `HL*1**20*1~`,
    `NM1*PR*2*${safe(payer.name)}*****PI*${safe(payer.payer_id)}~`,
    `HL*2*1*21*1~`,
    `NM1*1P*2*MEDCORE MEDICAL CENTER*****XX*1234567890~`,
    `HL*3*2*22*0~`,
    `TRN*1*${Date.now()}*9MEDCORE~`,
    `NM1*IL*1*${safe(patient.last_name)}*${safe(patient.first_name)}****MI*${safe(memberId)}~`,
    `DMG*D8*${patient.date_of_birth?.replace(/-/g,'')||''}*${patient.sex?.[0]||'U'}~`,
    `DTP*291*D8*${today()}~`,
    `EQ*30~`,
  ].join('\n');
  return buildX12Envelope('MEDCORE', payer.payer_id||'PAYER', 'HS', '270', content);
}

/**
 * X12 837P — Professional Claim
 * LEARNING: This is the actual insurance claim.
 * 837P = Professional (physician services)
 * 837I = Institutional (hospital inpatient)
 * Contains: patient info, provider info, diagnosis codes, procedure codes, amounts
 */
function buildX12_837(claim, patient, payer, charges) {
  const claimId = claim.claim_num;
  const totalAmt = charges.reduce((s,c)=>s+parseFloat(c.charge_amount||0),0).toFixed(2);
  const icd10s = [...new Set(charges.map(c=>c.icd10_primary).filter(Boolean))];

  const lines = [
    `BPR*I*${totalAmt}*C*ACH~`,
    `TRN*1*${claimId}*9MEDCORE~`,
    `BHT*0019*00*${claimId}*${today()}*1400*CH~`,
    `NM1*41*2*MEDCORE MEDICAL CENTER*****46*123456789~`,
    `PER*IC*BILLING DEPT*TE*5555551234~`,
    `NM1*40*2*${safe(payer.name)}*****PI*${safe(payer.payer_id)}~`,
    `HL*1**20*1~`,
    `PRV*BI*PXC*207Q00000X~`,
    `NM1*85*2*MEDCORE MEDICAL CENTER*****XX*1234567890~`,
    `N3*524 NORWOOD STREET~`,
    `N4*EAST ORANGE*NJ*07018~`,
    `HL*2*1*22*0~`,
    `SBR*P*18*${safe(payer.payer_id)}****CI~`,
    `NM1*IL*1*${safe(patient.last_name)}*${safe(patient.first_name)}****MI*${safe(patient.member_id||'MEM123456')}~`,
    `CLM*${claimId}*${totalAmt}***11:B:1*Y*A*Y*I~`,
    ...icd10s.map((dx,i)=>`HI*${i===0?'ABK':'ABF'}:${safe(dx)}~`),
    ...charges.map((c,i)=>[
      `LX*${i+1}~`,
      `SV1*HC:${safe(c.cpt_code)}*${parseFloat(c.charge_amount||0).toFixed(2)}*UN*${c.quantity||1}***${icd10s.map((_,j)=>j+1).join(':')}~`,
      `DTP*472*D8*${today()}~`,
    ].join('\n')),
  ].join('\n');

  return buildX12Envelope('MEDCORE', payer.payer_id||'PAYER', 'HC', '837', lines);
}

/**
 * X12 835 — Electronic Remittance Advice (ERA)
 * LEARNING: This comes BACK from the payer after they process the claim.
 * It tells you: how much they paid, how much they denied, and WHY.
 * Integration engineers spend a lot of time building 835 parsers
 * because every payer formats them slightly differently.
 */
function buildX12_835(claim, payer, paymentAmt, denialAmt, denialReason) {
  const content = [
    `BPR*I*${parseFloat(paymentAmt).toFixed(2)}*C*ACH~`,
    `TRN*1*${claim.claim_num}*${safe(payer.payer_id)}~`,
    `DTM*405*${today()}~`,
    `N1*PR*${safe(payer.name)}*XV*${safe(payer.payer_id)}~`,
    `N1*PE*MEDCORE MEDICAL CENTER*XX*1234567890~`,
    `CLP*${claim.claim_num}*1*${parseFloat(claim.total_billed||0).toFixed(2)}*${parseFloat(paymentAmt).toFixed(2)}*0*MC~`,
    `NM1*QC*1*${safe(claim.patient_last||'')}*${safe(claim.patient_first||'')}~`,
    denialAmt > 0 ? `CAS*CO*${denialReason||'45'}*${parseFloat(denialAmt).toFixed(2)}~` : '',
    `SVC*HC:99220*${parseFloat(paymentAmt).toFixed(2)}*${parseFloat(paymentAmt).toFixed(2)}~`,
    `DTM*150*${today()}~`,
    `PLB*1234567890*${today()}*CV:${claim.claim_num}*${parseFloat(paymentAmt).toFixed(2)}~`,
  ].filter(Boolean).join('\n');
  return buildX12Envelope(payer.payer_id||'PAYER', 'MEDCORE', 'HP', '835', content);
}

module.exports = { buildDFT_P03, buildBAR_P01, buildX12_270, buildX12_837, buildX12_835 };
