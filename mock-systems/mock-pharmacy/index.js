/**
 * MedCore Mock Pharmacy System
 *
 * LEARNING: In a real hospital, the pharmacy system (Omnicell,
 * Pyxis, Epic Willow) receives medication orders from the EHR,
 * the pharmacist verifies them, and dispenses to the floor.
 *
 * This mock pharmacy:
 * 1. Listens on port 6663 for MLLP RDE^O11 messages
 * 2. Simulates pharmacist verification (3-10 second delay)
 * 3. Sends back RDS^O13 (dispense) or RRE^O12 (reject)
 * 4. Logs all activity to HTTP endpoint
 */

const net  = require('net');
const http = require('http');

const LISTEN_PORT = 6663;
const MIRTH_HOST  = process.env.MIRTH_HOST || 'mirth-connect';
const MIRTH_PORT  = 6661;

const dispensedOrders = [];

function parseRDE(message) {
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
    if (fields[0] === 'RXO') {
      const drug = (fields[1] || '').split('^');
      result.drugCode = drug[0];
      result.drugName = drug[1];
      result.dose     = fields[2];
      result.doseUnit = fields[4];
      result.route    = fields[5];
      result.frequency = fields[7];
    }
  }
  return result;
}

function buildRDS(order, fillerNum) {
  const now = new Date().toISOString().replace(/[-:T]/g,'').substring(0,14);
  return [
    `MSH|^~\\&|MOCK_PHARMACY|PHARMACY_SYSTEM|MEDCORE_EHR|MEDCORE_MEDICAL_CENTER|${now}||RDS^O13^RDS_O13|RDS${Date.now()}|P|2.5.1`,
    `PID|1||${order.mrn}^^^MEDCORE^MR||${order.lastName}^${order.firstName}`,
    `ORC|OK|${order.placerOrderNum}|${fillerNum}||CM|||${now}`,
    `RXO|${order.drugCode}^${order.drugName}^NDC|${order.dose}||${order.doseUnit}|${order.route}||${order.frequency}`,
    `RXD|1|${order.drugCode}^${order.drugName}^NDC|${now}|${order.dose}|${order.doseUnit}|${fillerNum}|1|${order.route}`,
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
  const order = parseRDE(rawMessage);
  if (!order.placerOrderNum) return;

  if (order.orderControl === 'CA') {
    console.log(`[PHARMACY] Order ${order.placerOrderNum} CANCELLED`);
    return;
  }

  console.log(`[PHARMACY] Received: ${order.drugName} for ${order.mrn} — verifying...`);
  const delay = Math.random() * 7000 + 3000;
  await new Promise(r => setTimeout(r, delay));

  // 95% dispense, 5% reject (drug interaction, allergy, etc.)
  const dispense = Math.random() > 0.05;

  if (dispense) {
    const fillerNum = `RX${Date.now()}`;
    const rdsMessage = buildRDS(order, fillerNum);
    console.log(`[PHARMACY] Dispensing ${order.drugName} — sending RDS^O13`);
    await sendToMirth(rdsMessage);
    dispensedOrders.push({ ...order, fillerNum, dispensedAt: new Date().toISOString(), status: 'DISPENSED' });
  } else {
    console.log(`[PHARMACY] REJECTED: ${order.drugName} — potential interaction`);
    dispensedOrders.push({ ...order, dispensedAt: new Date().toISOString(), status: 'REJECTED', reason: 'Drug interaction review required' });
  }
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
    const ack = `MSH|^~\\&|MOCK_PHARMACY|PH|MEDCORE|MC|${new Date().toISOString().replace(/[-:T]/g,'').substring(0,14)}||ACK|ACK${Date.now()}|P|2.5.1\rMSA|AA|OK\r`;
    socket.write(Buffer.concat([Buffer.from([0x0B]), Buffer.from(ack), Buffer.from([0x1C, 0x0D])]));
    processOrder(message).catch(e => console.error('[PHARMACY]', e.message));
  });
  socket.on('error', e => console.error('[PHARMACY] Socket:', e.message));
});

const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status:'ok', service:'mock-pharmacy', dispensed: dispensedOrders.slice(-20) }));
});

server.listen(LISTEN_PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   MedCore Mock Pharmacy              ║
  ║   MLLP listening on port ${LISTEN_PORT}       ║
  ║   Receives: RDE^O11                  ║
  ║   Returns:  RDS^O13 (dispense)       ║
  ╚══════════════════════════════════════╝`);
});
httpServer.listen(7002, () => console.log('[PHARMACY] HTTP status on :7002'));
