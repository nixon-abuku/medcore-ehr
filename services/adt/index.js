const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const net     = require('net');
const { Pool } = require('pg');

const app  = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// ── Database ─────────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'medcore',
  user:     process.env.DB_USER     || 'medcore',
  password: process.env.DB_PASSWORD || 'medcore',
});

// ── HL7 Sender (MLLP over TCP to Mirth Connect) ──────────────
/**
 * LEARNING: MLLP = Minimal Lower Layer Protocol
 * It's how HL7 v2 messages are sent over TCP.
 * Every message is wrapped in:
 *   \x0B  (VT  — start block)
 *   [HL7 message body]
 *   \x1C  (FS  — end block)
 *   \x0D  (CR  — carriage return)
 *
 * Mirth Connect listens on port 6661 for exactly this format.
 * Epic Bridges also uses MLLP for inbound HL7.
 */
function sendHL7viaMirth(message, patientMrn, messageType) {
  return new Promise((resolve) => {
    const MIRTH_HOST = process.env.MIRTH_HOST || 'mirth-connect';
    const MIRTH_PORT = parseInt(process.env.MIRTH_PORT) || 6661;

    const MLLP_START = Buffer.from([0x0B]);
    const MLLP_END   = Buffer.from([0x1C, 0x0D]);

    const client = new net.Socket();
    let responded = false;

    client.setTimeout(5000);

    client.connect(MIRTH_PORT, MIRTH_HOST, () => {
      const payload = Buffer.concat([MLLP_START, Buffer.from(message, 'utf8'), MLLP_END]);
      client.write(payload);
    });

    client.on('data', async (data) => {
      responded = true;
      client.destroy();
      // Log to integration message log
      try {
        await pool.query(`
          INSERT INTO integration.message_log
            (message_type, direction, channel_name, patient_mrn, raw_message, status)
          VALUES ($1, 'OUTBOUND', 'ADT_Channel', $2, $3, 'SENT')`,
          [messageType, patientMrn, message]
        );
      } catch (e) {}
      resolve({ sent: true, ack: data.toString() });
    });

    client.on('timeout', () => {
      client.destroy();
      console.warn(`MLLP timeout sending ${messageType} — Mirth may not be ready yet`);
      resolve({ sent: false, reason: 'timeout' });
    });

    client.on('error', async (err) => {
      if (!responded) {
        // Log as failed
        try {
          await pool.query(`
            INSERT INTO integration.message_log
              (message_type, direction, channel_name, patient_mrn, raw_message, status, error_detail)
            VALUES ($1, 'OUTBOUND', 'ADT_Channel', $2, $3, 'FAILED', $4)`,
            [messageType, patientMrn, message, err.message]
          );
        } catch (e) {}
        console.warn(`MLLP send failed: ${err.message} (Mirth not yet configured for this channel)`);
        resolve({ sent: false, reason: err.message });
      }
    });
  });
}

// ── Routes ───────────────────────────────────────────────────
app.use('/patients',   require('./routes/patients')(pool, sendHL7viaMirth));
app.use('/encounters', require('./routes/encounters')(pool, sendHL7viaMirth));

// ── Message log ───────────────────────────────────────────────
app.get('/messages', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const { rows } = await pool.query(
      'SELECT * FROM integration.message_log ORDER BY created_at DESC LIMIT $1',
      [Number(limit)]
    );
    res.json({ messages: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Health ───────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  let db = 'ok';
  try { await pool.query('SELECT 1'); } catch { db = 'unavailable'; }
  res.json({ status: 'ok', service: 'medcore-adt', version: '1.0.0', db });
});

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   MedCore ADT Service — Module 1     ║
  ║   Port: ${PORT}                          ║
  ║   HL7 → Mirth on port 6661 (MLLP)   ║
  ╚══════════════════════════════════════╝
  `);
});
