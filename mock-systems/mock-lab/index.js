/**
 * MedCore Mock Lab (LIS — Laboratory Information System)
 *
 * LEARNING: In a real hospital, the LIS is a separate system
 * (Sunquest, Cerner Lab, Epic Beaker) that receives orders from
 * the EHR, drives the analyzers, and sends results back.
 *
 * This mock LIS:
 * 1. Listens on port 6662 for MLLP messages from Mirth
 * 2. Receives ORM^O01 lab orders
 * 3. Simulates processing (random delay 5-30 seconds)
 * 4. Generates realistic ORU^R01 results with OBX segments
 * 5. Sends the ORU back to Mirth on port 6661
 * 6. Mirth routes the result back to MedCore Results service
 *
 * This is EXACTLY how Quest Diagnostics, LabCorp, and hospital
 * labs integrate with Epic in production.
 */

const net  = require('net');
const http = require('http');

const LISTEN_PORT  = 6662;           // We listen here for orders from Mirth
const MIRTH_HOST   = process.env.MIRTH_HOST || 'mirth-connect';
const MIRTH_PORT   = 6661;           // We send results back through Mirth
const RESULTS_URL  = process.env.RESULTS_SERVICE_URL || 'http://results:3005';

// ── Mock result data by LOINC ─────────────────────────────────
const MOCK_VALUES = {
  '85025': [ // CBC
    { loinc:'6690-2',  name:'WBC',        unit:'K/uL',  low:4.5,  high:11.0, critL:2.0,  critH:30.0 },
    { loinc:'789-8',   name:'RBC',        unit:'M/uL',  low:4.0,  high:5.9,  critL:2.0,  critH:8.0  },
    { loinc:'718-7',   name:'Hemoglobin', unit:'g/dL',  low:12.0, high:17.5, critL:7.0,  critH:20.0 },
    { loinc:'4544-3',  name:'Hematocrit', unit:'%',     low:36.0, high:53.0, critL:20.0, critH:60.0 },
    { loinc:'777-3',   name:'Platelets',  unit:'K/uL',  low:150,  high:400,  critL:50,   critH:1000 },
  ],
  '80048': [ // BMP
    { loinc:'2951-2',  name:'Sodium',     unit:'mEq/L', low:136, high:145, critL:120, critH:160 },
    { loinc:'2823-3',  name:'Potassium',  unit:'mEq/L', low:3.5, high:5.0, critL:2.5, critH:6.5 },
    { loinc:'2075-0',  name:'Chloride',   unit:'mEq/L', low:98,  high:107, critL:80,  critH:120 },
    { loinc:'1963-8',  name:'CO2',        unit:'mEq/L', low:22,  high:29,  critL:10,  critH:40  },
    { loinc:'3094-0',  name:'BUN',        unit:'mg/dL', low:7,   high:20,  critL:2,   critH:100 },
    { loinc:'2160-0',  name:'Creatinine', unit:'mg/dL', low:0.6, high:1.2, critL:0.2, critH:10  },
    { loinc:'2345-7',  name:'Glucose',    unit:'mg/dL', low:70,  high:100, critL:40,  critH:500 },
  ],
  '84484': [ // Troponin
    { loinc:'42757-5', name:'Troponin I', unit:'ng/mL', low:0, high:0.04, critL:0, critH:50 },
  ],
  '83880': [ // BNP
    { loinc:'30934-4', name:'BNP',        unit:'pg/mL', low:0, high:100, critL:0, critH:5000 },
  ],
  '71046': [ // Chest X-Ray — returns text
    { loinc:'36643-5', name:'Chest X-Ray Impression', unit:'', text:true },
  ],
};

function rnd(min, max, dec=1) {
  return parseFloat((Math.random()*(max-min)+min).toFixed(dec));
}

function getFlag(val, ref) {
  if (ref.text) return 'N';
  const v = parseFloat(val);
  if (isNaN(v)) return '';
  if (ref.critL !== undefined && v <= ref.critL) return 'LL';
  if (ref.critH !== undefined && v >= ref.critH) return 'HH';
  if (v < ref.low)  return 'L';
  if (v > ref.high) return 'H';
  return 'N';
}

// ── Parse incoming ORM^O01 ────────────────────────────────────
function parseORM(message) {
  const segments = message.split('\r').filter(s => s.trim());
  const result = {};
  for (const seg of segments) {
    const fields = seg.split('|');
    if (fields[0] === 'PID') {
      result.mrn = (fields[3] || '').split('^')[0];
      const nameParts = (fields[5] || '').split('^');
      result.lastName  = nameParts[0];
      result.firstName = nameParts[1];
    }
    if (fields[0] === 'ORC') {
      result.placerOrderNum = fields[2];
      result.orderControl   = fields[1]; // NW=new, CA=cancel
    }
    if (fields[0] === 'OBR') {
      result.placerOrderNum = result.placerOrderNum || fields[2];
      const testId = (fields[4] || '').split('^');
      result.testCode = testId[0];
      result.testName = testId[1];
      result.priority = fields[5] || 'ROUTINE';
      result.specimenType = (fields[15] || '').split('^')[0];
      result.clinicalInfo = fields[13] || '';
    }
  }
  return result;
}

// ── Build ORU^R01 result ──────────────────────────────────────
function buildORU(order, fillerNum) {
  const now = new Date().toISOString().replace(/[-:T]/g,'').substring(0,14);
  const today = now.substring(0,8);

  const components = MOCK_VALUES[order.testCode] || [];
  const obxSegments = [];

  if (components.length === 0) {
    // Unknown test — return generic result
    obxSegments.push(`OBX|1|ST|${order.testCode}^${order.testName}^L||See report||||||F|||${now}`);
  } else {
    components.forEach((comp, i) => {
      let value, flag;
      if (comp.text) {
        // Radiology-style text result
        const findings = [
          'No acute cardiopulmonary process. Heart size normal. Lungs clear bilaterally.',
          'Mild cardiomegaly. No pleural effusion. No pneumothorax.',
          'Bilateral lower lobe infiltrates consistent with pneumonia.',
          'Normal chest radiograph.',
        ];
        value = findings[Math.floor(Math.random() * findings.length)];
        flag = 'N';
      } else {
        // Generate a value — occasionally outside normal range for realism
        const range = comp.high - comp.low;
        const extend = range * 0.3;
        value = rnd(comp.low - extend, comp.high + extend, 1);
        flag = getFlag(value, comp);
      }

      const range = comp.text ? '' : `${comp.low}-${comp.high}`;
      const vtype = comp.text ? 'ST' : 'NM';
      obxSegments.push(
        `OBX|${i+1}|${vtype}|${comp.loinc}^${comp.name}^LN||${value}|${comp.unit}|${range}|${flag}|||F|||${now}`
      );
    });
  }

  const segments = [
    `MSH|^~\\&|MOCK_LAB|MEDCORE_REFERENCE_LAB|MEDCORE_EHR|MEDCORE_MEDICAL_CENTER|${now}||ORU^R01^ORU_R01|ORU${Date.now()}|P|2.5.1`,
    `PID|1||${order.mrn}^^^MEDCORE^MR||${order.lastName}^${order.firstName}`,
    `ORC|RE|${order.placerOrderNum}|${fillerNum}||CM`,
    `OBR|1|${order.placerOrderNum}|${fillerNum}|${order.testCode}^${order.testName}^LN|${order.priority}||${now}||||||||${order.clinicalInfo}||${order.specimenType ? order.specimenType+'^^^^' : ''}|||||||F`,
    ...obxSegments,
  ];

  return segments.join('\r') + '\r';
}

// ── Send HL7 via MLLP to Mirth ────────────────────────────────
function sendToMirth(message) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.setTimeout(10000);

    client.connect(MIRTH_PORT, MIRTH_HOST, () => {
      const payload = Buffer.concat([
        Buffer.from([0x0B]),
        Buffer.from(message, 'utf8'),
        Buffer.from([0x1C, 0x0D]),
      ]);
      client.write(payload);
      console.log(`[LAB] Sent ORU^R01 to Mirth`);
    });

    client.on('data', (data) => {
      client.destroy();
      resolve({ sent: true, ack: data.toString() });
    });

    client.on('timeout', () => { client.destroy(); resolve({ sent: false, reason: 'timeout' }); });
    client.on('error', (err) => { resolve({ sent: false, reason: err.message }); });
  });
}

// ── Process incoming order ────────────────────────────────────
async function processOrder(rawMessage) {
  const order = parseORM(rawMessage);

  if (!order.placerOrderNum) {
    console.log('[LAB] Could not parse order — missing placer order number');
    return;
  }

  if (order.orderControl === 'CA') {
    console.log(`[LAB] Order ${order.placerOrderNum} CANCELLED — removing from queue`);
    return;
  }

  // Simulate lab processing time
  const delay = order.priority === 'STAT' ? 5000 : Math.random() * 25000 + 5000;
  console.log(`[LAB] Order ${order.placerOrderNum} received (${order.testCode} - ${order.testName}) Priority: ${order.priority}`);
  console.log(`[LAB] Processing... will result in ${Math.round(delay/1000)}s`);

  await new Promise(r => setTimeout(r, delay));

  const fillerNum = `LIS${Date.now()}`;
  const oruMessage = buildORU(order, fillerNum);

  console.log(`[LAB] Sending ORU^R01 for ${order.placerOrderNum} (filler: ${fillerNum})`);
  const result = await sendToMirth(oruMessage);
  console.log(`[LAB] Send result:`, result.sent ? 'SUCCESS' : result.reason);

  // Also notify MedCore results service directly
  try {
    await fetch(`${RESULTS_URL}/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hl7_message: oruMessage, source: 'MOCK_LAB' }),
    });
  } catch(e) {
    // Results service may not have inbound endpoint yet — that's ok
  }
}

// ── MLLP Server ───────────────────────────────────────────────
const server = net.createServer((socket) => {
  console.log(`[LAB] Connection from ${socket.remoteAddress}`);
  let buffer = Buffer.alloc(0);

  socket.on('data', async (data) => {
    buffer = Buffer.concat([buffer, data]);

    // Check for MLLP end frame
    const endIdx = buffer.indexOf(Buffer.from([0x1C, 0x0D]));
    if (endIdx === -1) return;

    // Extract message between MLLP start (0x0B) and end (0x1C 0x0D)
    const startIdx = buffer.indexOf(0x0B);
    if (startIdx === -1) return;

    const message = buffer.slice(startIdx + 1, endIdx).toString('utf8');
    buffer = Buffer.alloc(0);

    // Send ACK
    const ack = `MSH|^~\\&|MOCK_LAB|LIS|MEDCORE_EHR|MEDCORE|${new Date().toISOString().replace(/[-:T]/g,'').substring(0,14)}||ACK|ACK${Date.now()}|P|2.5.1\rMSA|AA|ACK_OK\r`;
    socket.write(Buffer.concat([Buffer.from([0x0B]), Buffer.from(ack), Buffer.from([0x1C, 0x0D])]));

    // Process the order asynchronously
    processOrder(message).catch(e => console.error('[LAB] Error:', e.message));
  });

  socket.on('error', (err) => console.error('[LAB] Socket error:', err.message));
});

// ── HTTP status endpoint ──────────────────────────────────────
const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'mock-lab', port: LISTEN_PORT, description: 'Receives ORM^O01, returns ORU^R01' }));
});

server.listen(LISTEN_PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   MedCore Mock Lab (LIS)             ║
  ║   MLLP listening on port ${LISTEN_PORT}       ║
  ║   Receives: ORM^O01                  ║
  ║   Returns:  ORU^R01 via Mirth        ║
  ╚══════════════════════════════════════╝`);
});

httpServer.listen(7001, () => console.log('[LAB] HTTP status on :7001'));
