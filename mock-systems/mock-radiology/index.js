/**
 * MedCore Mock Radiology (RIS/PACS)
 *
 * LEARNING: Radiology integration is one of the most complex
 * in healthcare IT. The flow:
 *   ORM^O01 → RIS adds to modality worklist → tech performs study
 *   → radiologist reads → MDM^T02 report fires back to EHR
 *
 * This mock:
 * 1. Listens on port 6664 for ORM^O01 imaging orders
 * 2. Simulates tech performing the study (10-30 second delay)
 * 3. Simulates radiologist dictating and signing the report
 * 4. Sends MDM^T02 with the narrative report back via Mirth
 */

const net  = require('net');
const http = require('http');

const LISTEN_PORT = 6664;
const MIRTH_HOST  = process.env.MIRTH_HOST || 'mirth-connect';
const MIRTH_PORT  = 6661;

const completedStudies = [];

const REPORT_TEMPLATES = {
  '71046': [ // Chest X-Ray
    { impression: 'No acute cardiopulmonary process. Heart size is within normal limits. The lungs are clear bilaterally. No pleural effusion or pneumothorax identified.', findings: 'The cardiac silhouette is normal in size. The mediastinum is within normal limits. The lungs are clear without focal airspace consolidation, pleural effusion, or pneumothorax.' },
    { impression: 'Mild cardiomegaly. No acute pulmonary process.', findings: 'The cardiac silhouette is mildly enlarged. The mediastinum is within normal limits. The lungs are clear. No pleural effusion. No pneumothorax.' },
    { impression: 'Bilateral lower lobe infiltrates, consistent with pneumonia. Clinical correlation recommended.', findings: 'There are bilateral lower lobe opacities consistent with airspace disease. No pneumothorax. No large pleural effusion.' },
  ],
  '70450': [ // CT Head
    { impression: 'No acute intracranial abnormality. No hemorrhage, mass, or midline shift.', findings: 'The brain parenchyma demonstrates normal attenuation without evidence of acute hemorrhage, infarction, or mass lesion. The ventricles are normal in size. Midline structures are not shifted.' },
    { impression: 'Age-appropriate cerebral atrophy. No acute intracranial process.', findings: 'Mild diffuse cerebral atrophy is noted, age-appropriate. No acute hemorrhage or infarction. No mass effect.' },
  ],
  '93306': [ // Echo
    { impression: 'Normal left ventricular systolic function. EF 60-65%. No significant valvular abnormality.', findings: 'Left ventricular size and systolic function are normal. Estimated ejection fraction 60-65%. No regional wall motion abnormalities. Mild mitral valve regurgitation. No pericardial effusion.' },
    { impression: 'Reduced left ventricular systolic function. EF 35-40%. Recommend cardiology follow-up.', findings: 'Left ventricular size is mildly dilated with globally reduced systolic function. Estimated ejection fraction 35-40%. No pericardial effusion.' },
  ],
  'DEFAULT': [
    { impression: 'Study complete. No acute abnormality identified. Clinical correlation recommended.', findings: 'The study was performed and interpreted by the radiologist. No acute findings to report.' },
  ],
};

function parseORM(message) {
  const segments = message.split('\r').filter(s => s.trim());
  const result = {};
  for (const seg of segments) {
    const fields = seg.split('|');
    if (fields[0] === 'PID') {
      result.mrn = (fields[3] || '').split('^')[0];
      const name = (fields[5] || '').split('^');
      result.lastName = name[0]; result.firstName = name[1];
    }
    if (fields[0] === 'ORC') {
      result.placerOrderNum = fields[2];
      result.orderControl   = fields[1];
    }
    if (fields[0] === 'OBR') {
      result.placerOrderNum = result.placerOrderNum || fields[2];
      const testId = (fields[4] || '').split('^');
      result.testCode = testId[0];
      result.testName = testId[1];
      result.priority = fields[5] || 'ROUTINE';
      result.clinicalInfo = fields[13] || '';
    }
  }
  return result;
}

function buildMDM(order, fillerNum, reportTemplate) {
  const now = new Date().toISOString().replace(/[-:T]/g,'').substring(0,14);
  const docId = `RAD${Date.now()}`;

  const reportText = `RADIOLOGY REPORT

EXAM: ${order.testName}
ACCESSION: ${fillerNum}
ORDER: ${order.placerOrderNum}
CLINICAL INDICATION: ${order.clinicalInfo || 'See order'}

TECHNIQUE:
Standard protocol was performed.

FINDINGS:
${reportTemplate.findings}

IMPRESSION:
${reportTemplate.impression}

Electronically signed by: Dr. A. Radiologist, MD
Signed: ${new Date().toLocaleString()}`;

  return [
    `MSH|^~\\&|MOCK_RADIOLOGY|PACS_SYSTEM|MEDCORE_EHR|MEDCORE_MEDICAL_CENTER|${now}||MDM^T02^MDM_T02|MDM${Date.now()}|P|2.5.1`,
    `EVN|T02|${now}`,
    `PID|1||${order.mrn}^^^MEDCORE^MR||${order.lastName}^${order.firstName}`,
    `PV1|1|O`,
    `TXA|1|RAD|TX|${now}|1^Radiologist^A|||${docId}|||||||${docId}||||AU|||1^Radiologist^A`,
    `OBX|1|TX|RAD_REPORT^Radiology Report^L||${reportText}|||N|||F|||${now}`,
  ].join('\r') + '\r';
}

async function sendToMirth(message) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.setTimeout(8000);
    client.connect(MIRTH_PORT, MIRTH_HOST, () => {
      client.write(Buffer.concat([Buffer.from([0x0B]), Buffer.from(message,'utf8'), Buffer.from([0x1C,0x0D])]));
    });
    client.on('data', () => { client.destroy(); resolve({ sent: true }); });
    client.on('timeout', () => { client.destroy(); resolve({ sent: false }); });
    client.on('error', (e) => { resolve({ sent: false, reason: e.message }); });
  });
}

async function processOrder(rawMessage) {
  const order = parseORM(rawMessage);
  if (!order.placerOrderNum) return;
  if (order.orderControl === 'CA') {
    console.log(`[RADIOLOGY] Order ${order.placerOrderNum} CANCELLED — removed from worklist`);
    return;
  }

  console.log(`[RADIOLOGY] Study ordered: ${order.testName} for ${order.mrn}`);
  const techDelay = order.priority === 'STAT' ? 8000 : Math.random() * 20000 + 10000;
  await new Promise(r => setTimeout(r, techDelay));
  console.log(`[RADIOLOGY] Study performed. Radiologist reading...`);

  const readDelay = Math.random() * 10000 + 5000;
  await new Promise(r => setTimeout(r, readDelay));

  const templates = REPORT_TEMPLATES[order.testCode] || REPORT_TEMPLATES['DEFAULT'];
  const template  = templates[Math.floor(Math.random() * templates.length)];
  const fillerNum = `ACC${Date.now()}`;
  const mdmMessage = buildMDM(order, fillerNum, template);

  console.log(`[RADIOLOGY] Report signed — sending MDM^T02 for ${order.placerOrderNum}`);
  const result = await sendToMirth(mdmMessage);
  console.log(`[RADIOLOGY] Send:`, result.sent ? 'SUCCESS' : result.reason);
  completedStudies.push({ ...order, fillerNum, impression: template.impression, completedAt: new Date().toISOString() });
}

const server = net.createServer((socket) => {
  let buffer = Buffer.alloc(0);
  socket.on('data', async (data) => {
    buffer = Buffer.concat([buffer, data]);
    const endIdx = buffer.indexOf(Buffer.from([0x1C, 0x0D]));
    if (endIdx === -1) return;
    const startIdx = buffer.indexOf(0x0B);
    if (startIdx === -1) return;
    const message = buffer.slice(startIdx+1, endIdx).toString('utf8');
    buffer = Buffer.alloc(0);
    const ack = `MSH|^~\\&|MOCK_RADIOLOGY|RIS|MEDCORE|MC|${new Date().toISOString().replace(/[-:T]/g,'').substring(0,14)}||ACK|ACK${Date.now()}|P|2.5.1\rMSA|AA|OK\r`;
    socket.write(Buffer.concat([Buffer.from([0x0B]), Buffer.from(ack), Buffer.from([0x1C, 0x0D])]));
    processOrder(message).catch(e => console.error('[RADIOLOGY]', e.message));
  });
  socket.on('error', e => console.error('[RADIOLOGY] Socket:', e.message));
});

const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status:'ok', service:'mock-radiology', studies: completedStudies.slice(-10) }));
});

server.listen(LISTEN_PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   MedCore Mock Radiology (RIS/PACS)  ║
  ║   MLLP listening on port ${LISTEN_PORT}       ║
  ║   Receives: ORM^O01 (imaging)        ║
  ║   Returns:  MDM^T02 (report)         ║
  ╚══════════════════════════════════════╝`);
});
httpServer.listen(7003, () => console.log('[RADIOLOGY] HTTP status on :7003'));
