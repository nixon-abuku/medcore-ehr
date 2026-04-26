/**
 * MedCore HL7 v2.5.1 ORU^R01 Parser & Mock Result Generator
 *
 * LEARNING: ORU^R01 is the most common message type by volume
 * in any hospital. Every completed lab test generates one.
 * A busy hospital might process 10,000+ ORU messages per day.
 *
 * ORU^R01 structure:
 *   MSH — header
 *   PID — patient identity
 *   PV1 — visit context (optional)
 *   ORC — links back to the original order
 *   OBR — what was tested (mirrors the OBR in the ORM)
 *   OBX — the actual result (one per component)
 *   NTE — notes (optional, attached to OBX or OBR)
 *
 * The OBX segment is everything:
 *   OBX-1: Set ID (sequential number)
 *   OBX-2: Value Type (NM=numeric, ST=string, TX=text)
 *   OBX-3: Observation Identifier (LOINC code ^ name ^ system)
 *   OBX-4: Observation Sub-ID
 *   OBX-5: Observation Value (the actual result)
 *   OBX-6: Units
 *   OBX-7: Reference Range
 *   OBX-8: Abnormal Flag (H, L, HH, LL, A, N)
 *   OBX-9: Probability
 *   OBX-10: Nature of Abnormal Test
 *   OBX-11: Observation Result Status (F=Final, P=Preliminary)
 *   OBX-14: Date/Time of Observation
 */

function now() { return new Date().toISOString().replace(/[-:T]/g,'').substring(0,14); }
function safe(v) { if(v===null||v===undefined)return''; return String(v).replace(/\|/g,'\\F\\').replace(/\^/g,'\\S\\'); }

// ── Mock result data by LOINC code ────────────────────────────
// Returns realistic values with some abnormals for learning
const MOCK_RESULTS = {
  // CBC components
  '6690-2':  { name:'WBC',        unit:'K/uL',  range:'4.5-11.0', gen:()=>rnd(3.8,14.0,1),  critL:2.0,  critH:30.0, normL:4.5, normH:11.0 },
  '789-8':   { name:'RBC',        unit:'M/uL',  range:'4.0-5.9',  gen:()=>rnd(3.5,6.0,2),   critL:2.0,  critH:8.0,  normL:4.0, normH:5.9  },
  '718-7':   { name:'Hemoglobin', unit:'g/dL',  range:'12.0-17.5',gen:()=>rnd(10.0,18.0,1), critL:7.0,  critH:20.0, normL:12.0,normH:17.5 },
  '4544-3':  { name:'Hematocrit', unit:'%',     range:'36-53',    gen:()=>rnd(30.0,55.0,1), critL:20.0, critH:60.0, normL:36.0,normH:53.0 },
  '777-3':   { name:'Platelets',  unit:'K/uL',  range:'150-400',  gen:()=>rnd(80,500,0),    critL:50,   critH:1000, normL:150, normH:400  },
  // BMP components
  '2951-2':  { name:'Sodium',     unit:'mEq/L', range:'136-145',  gen:()=>rnd(130,150,0),   critL:120,  critH:160,  normL:136, normH:145  },
  '2823-3':  { name:'Potassium',  unit:'mEq/L', range:'3.5-5.0',  gen:()=>rnd(3.0,5.5,1),  critL:2.5,  critH:6.5,  normL:3.5, normH:5.0  },
  '2075-0':  { name:'Chloride',   unit:'mEq/L', range:'98-107',   gen:()=>rnd(95,112,0),    critL:80,   critH:120,  normL:98,  normH:107  },
  '1963-8':  { name:'CO2/Bicarb', unit:'mEq/L', range:'22-29',    gen:()=>rnd(18,32,0),     critL:10,   critH:40,   normL:22,  normH:29   },
  '3094-0':  { name:'BUN',        unit:'mg/dL', range:'7-20',     gen:()=>rnd(5,35,0),      critL:2,    critH:100,  normL:7,   normH:20   },
  '2160-0':  { name:'Creatinine', unit:'mg/dL', range:'0.6-1.2',  gen:()=>rnd(0.5,2.5,2),  critL:0.2,  critH:10.0, normL:0.6, normH:1.2  },
  '2345-7':  { name:'Glucose',    unit:'mg/dL', range:'70-100',   gen:()=>rnd(50,250,0),    critL:40,   critH:500,  normL:70,  normH:100  },
  // Cardiac
  '42757-5': { name:'Troponin I', unit:'ng/mL', range:'< 0.04',   gen:()=>rnd(0.0,0.15,3), critL:0,    critH:50,   normL:0,   normH:0.04 },
  '30934-4': { name:'BNP',        unit:'pg/mL', range:'< 100',    gen:()=>rnd(20,800,0),    critL:0,    critH:5000, normL:0,   normH:100  },
  // UA
  '5767-9':  { name:'UA Color',   unit:'',      range:'Yellow',   gen:()=>'Yellow', text:true },
  '5811-5':  { name:'UA Clarity', unit:'',      range:'Clear',    gen:()=>'Clear',  text:true },
  '2756-5':  { name:'UA pH',      unit:'',      range:'5.0-8.0',  gen:()=>rnd(5.0,8.5,1),  normL:5.0,  normH:8.0  },
};

// ── Panel definitions ─────────────────────────────────────────
const PANELS = {
  '58410-2': { name:'CBC', components:['6690-2','789-8','718-7','4544-3','777-3'] },
  '51990-0': { name:'BMP', components:['2951-2','2823-3','2075-0','1963-8','3094-0','2160-0','2345-7'] },
  '24323-8': { name:'CMP', components:['2951-2','2823-3','2075-0','1963-8','3094-0','2160-0','2345-7'] },
  '42757-5': { name:'Troponin I', components:['42757-5'] },
  '30934-4': { name:'BNP', components:['30934-4'] },
  '5767-9':  { name:'Urinalysis', components:['5767-9','5811-5','2756-5'] },
};

function rnd(min, max, decimals) {
  const val = Math.random() * (max - min) + min;
  return parseFloat(val.toFixed(decimals));
}

function getFlag(value, ref) {
  if (!ref || ref.text) return 'N';
  const v = parseFloat(value);
  if (isNaN(v)) return '';
  if (ref.critL !== undefined && v <= ref.critL) return 'LL';
  if (ref.critH !== undefined && v >= ref.critH) return 'HH';
  if (ref.normL !== undefined && v < ref.normL) return 'L';
  if (ref.normH !== undefined && v > ref.normH) return 'H';
  return 'N';
}

/**
 * Build OBX segment
 * LEARNING: This is the core of results work.
 * Every OBX = one test component with its value, units, range, and flag.
 */
function buildOBX(setId, loinc, name, value, units, range, flag, valueType='NM') {
  return [
    'OBX',
    setId.toString(),
    valueType,                                    // OBX-2: value type
    `${safe(loinc)}^${safe(name)}^LN`,           // OBX-3: LOINC^name^system
    '',                                           // OBX-4: sub-ID
    safe(String(value)),                          // OBX-5: the value
    safe(units||''),                              // OBX-6: units
    safe(range||''),                              // OBX-7: reference range
    safe(flag||'N'),                              // OBX-8: abnormal flag ← CRITICAL
    '',                                           // OBX-9
    '',                                           // OBX-10
    'F',                                          // OBX-11: F=Final result
    '',                                           // OBX-12
    '',                                           // OBX-13
    now(),                                        // OBX-14: observation time
  ].join('|');
}

/**
 * Generate a complete ORU^R01 for a given order
 * Creates realistic mock values for each component of the panel
 */
function generateORU(order, patient) {
  const controlId = `ORU${Date.now()}`;
  const fillerOrderNum = `FIL${Date.now()}`;

  const msh = ['MSH','^~\\&','MEDCORE_LAB','MEDCORE_REFERENCE_LAB',
    'MEDCORE_EHR','MEDCORE_MEDICAL_CENTER',now(),'',
    'ORU^R01^ORU_R01',controlId,'P','2.5.1'].join('|');

  const pid = ['PID','1','',
    `${safe(patient.mrn)}^^^MEDCORE^MR`,'',
    `${safe(patient.last_name)}^${safe(patient.first_name)}`,'',
    '','',
  ].join('|');

  const orc = ['ORC','RE',
    safe(order.placer_order_num),
    fillerOrderNum,
    '','CM',
  ].join('|');

  const obr = ['OBR','1',
    safe(order.placer_order_num),
    fillerOrderNum,
    `${safe(order.order_code)}^${safe(order.order_name)}^LN`,
    safe(order.priority||'ROUTINE'),
    '',
    now(),
    '','','','','',
    safe(order.clinical_indication||''),
    '',
    order.specimen_type ? `${safe(order.specimen_type)}^^^^` : '',
    '','','','','','','','','','F',
  ].join('|');

  // Generate OBX segments
  const obxSegments = [];
  const panel = PANELS[order.order_code];
  const observations = [];

  if (panel) {
    panel.components.forEach((loinc, idx) => {
      const ref = MOCK_RESULTS[loinc];
      if (!ref) return;
      const value = ref.gen();
      const flag = getFlag(value, ref);
      const vType = ref.text ? 'ST' : 'NM';
      obxSegments.push(buildOBX(idx+1, loinc, ref.name, value, ref.unit||'', ref.range||'', flag, vType));
      observations.push({ loinc, name: ref.name, value, units: ref.unit||'', range: ref.range||'', flag, vType });
    });
  } else {
    // Single test
    const ref = MOCK_RESULTS[order.order_code] || { name: order.order_name, gen:()=>'See report', text:true };
    const value = ref.gen();
    const flag = getFlag(value, ref);
    const vType = ref.text ? 'ST' : 'NM';
    obxSegments.push(buildOBX(1, order.order_code, ref.name||order.order_name, value, ref.unit||'', ref.range||'', flag, vType));
    observations.push({ loinc: order.order_code, name: ref.name||order.order_name, value, units: ref.unit||'', range: ref.range||'', flag, vType });
  }

  const message = [msh, pid, orc, obr, ...obxSegments].join('\r') + '\r';
  return { message, fillerOrderNum, observations, panelName: panel?.name || order.order_name };
}

/**
 * Parse an incoming ORU^R01 message into structured data
 * LEARNING: This is what Mirth's transformer does in production.
 * It parses each segment and extracts the fields we care about.
 */
function parseORU(hl7Message) {
  const segments = hl7Message.split(/\r|\n/).filter(s => s.trim());
  const result = { observations: [], raw: hl7Message };

  for (const seg of segments) {
    const fields = seg.split('|');
    const segType = fields[0];

    if (segType === 'MSH') {
      result.controlId = fields[10];
      result.messageType = fields[9];
    }
    if (segType === 'PID') {
      const idField = fields[3] || '';
      result.patientMrn = idField.split('^')[0];
      const nameField = fields[5] || '';
      const nameParts = nameField.split('^');
      result.patientName = `${nameParts[1]||''} ${nameParts[0]||''}`.trim();
    }
    if (segType === 'ORC') {
      result.placerOrderNum = fields[2];
      result.fillerOrderNum = fields[3];
    }
    if (segType === 'OBR') {
      result.placerOrderNum = result.placerOrderNum || fields[2];
      result.fillerOrderNum = result.fillerOrderNum || fields[3];
      const testId = fields[4] || '';
      const testParts = testId.split('^');
      result.testCode = testParts[0];
      result.testName = testParts[1] || '';
      result.priority = fields[5];
      result.collectionTime = fields[7];
      result.clinicalInfo = fields[13];
      result.specimenSource = fields[15]?.split('^')[0] || '';
      result.reportStatus = fields[25] || 'F';
    }
    if (segType === 'OBX') {
      const obsId = fields[3] || '';
      const obsParts = obsId.split('^');
      result.observations.push({
        setId:      parseInt(fields[1]) || 1,
        valueType:  fields[2],
        loinc:      obsParts[0],
        name:       obsParts[1] || '',
        value:      fields[5],
        units:      fields[6],
        range:      fields[7],
        flag:       fields[8],      // ← THE MOST IMPORTANT FIELD
        status:     fields[11] || 'F',
        obsTime:    fields[14],
      });
    }
  }
  return result;
}

module.exports = { generateORU, parseORU, MOCK_RESULTS, PANELS };
