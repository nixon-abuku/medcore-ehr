const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const net      = require('net');
const { Pool } = require('pg');
const { buildS12, buildS14, buildS15, buildS26 } = require('./hl7/builder');

const app  = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost', port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'medcore', user: process.env.DB_USER || 'medcore',
  password: process.env.DB_PASSWORD || 'medcore',
});

// ── MLLP sender ───────────────────────────────────────────────
function sendHL7(message, patientMrn, messageType) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.setTimeout(5000);
    client.connect(parseInt(process.env.MIRTH_PORT) || 6661, process.env.MIRTH_HOST || 'mirth-connect', () => {
      client.write(Buffer.concat([Buffer.from([0x0B]), Buffer.from(message, 'utf8'), Buffer.from([0x1C, 0x0D])]));
    });
    client.on('data', async () => {
      client.destroy();
      try {
        await pool.query(`INSERT INTO integration.message_log (message_type,direction,channel_name,patient_mrn,raw_message,status) VALUES($1,'OUTBOUND','SIU_Channel',$2,$3,'SENT')`,
          [messageType, patientMrn, message]);
      } catch(e) {}
      resolve({ sent: true });
    });
    client.on('timeout', () => { client.destroy(); resolve({ sent: false, reason: 'timeout' }); });
    client.on('error', async (err) => {
      try {
        await pool.query(`INSERT INTO integration.message_log (message_type,direction,channel_name,patient_mrn,raw_message,status,error_detail) VALUES($1,'OUTBOUND','SIU_Channel',$2,$3,'FAILED',$4)`,
          [messageType, patientMrn, message, err.message]);
      } catch(e) {}
      resolve({ sent: false, reason: err.message });
    });
  });
}

// ── Helper: get full appointment context ──────────────────────
async function getApptContext(apptId) {
  const { rows } = await pool.query(`
    SELECT a.*, p.mrn as patient_mrn, p.first_name, p.last_name, p.date_of_birth, p.sex,
           pr.first_name as prov_first, pr.last_name as prov_last, pr.npi, pr.specialty,
           vt.name as vt_name, vt.code as vt_code, vt.duration_min
    FROM scheduling.appointments a
    JOIN adt.patients p ON a.patient_id = p.id
    JOIN adt.providers pr ON a.provider_id = pr.id
    LEFT JOIN scheduling.visit_types vt ON a.visit_type_id = vt.id
    WHERE a.id = $1`, [apptId]);
  return rows[0];
}

// ── Routes ────────────────────────────────────────────────────

// GET /visit-types
app.get('/visit-types', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM scheduling.visit_types WHERE active=true ORDER BY name');
    res.json({ visit_types: rows });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /providers — reuse from adt schema
app.get('/providers', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM adt.providers WHERE active=true ORDER BY last_name');
    res.json({ providers: rows });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /schedules?provider_id=&date=
app.get('/schedules', async (req, res) => {
  try {
    const { provider_id, date } = req.query;
    let q = `SELECT s.*, p.first_name as prov_first, p.last_name as prov_last, p.specialty
             FROM scheduling.provider_schedules s
             JOIN adt.providers p ON s.provider_id = p.id WHERE s.active=true`;
    const params = [];
    if (provider_id) { params.push(provider_id); q += ` AND s.provider_id=$${params.length}`; }
    if (date) { params.push(date); q += ` AND s.schedule_date=$${params.length}`; }
    q += ' ORDER BY s.schedule_date, s.start_time';
    const { rows } = await pool.query(q, params);
    res.json({ schedules: rows });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// POST /schedules — create a provider schedule for a date
app.post('/schedules', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { provider_id, schedule_date, start_time, end_time, department, location_name, slot_duration = 30 } = req.body;

    const { rows } = await client.query(`
      INSERT INTO scheduling.provider_schedules (provider_id,schedule_date,start_time,end_time,department,location_name)
      VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (provider_id,schedule_date)
      DO UPDATE SET start_time=$3,end_time=$4,department=$5,location_name=$6,active=true RETURNING *`,
      [provider_id, schedule_date, start_time, end_time, department, location_name]);
    const schedule = rows[0];

    // Delete existing slots and regenerate
    await client.query('DELETE FROM scheduling.slots WHERE schedule_id=$1', [schedule.id]);

    // Generate slots
    const slots = [];
    let cur = new Date(`${schedule_date}T${start_time}`);
    const end = new Date(`${schedule_date}T${end_time}`);
    while (cur < end) {
      const slotEnd = new Date(cur.getTime() + slot_duration * 60000);
      if (slotEnd > end) break;
      const st = cur.toTimeString().substring(0,5);
      const et = slotEnd.toTimeString().substring(0,5);
      await client.query(`INSERT INTO scheduling.slots (schedule_id,provider_id,slot_date,start_time,end_time) VALUES($1,$2,$3,$4,$5)`,
        [schedule.id, provider_id, schedule_date, st, et]);
      slots.push({ start: st, end: et });
      cur = slotEnd;
    }

    await client.query('COMMIT');
    res.status(201).json({ schedule, slots_created: slots.length });
  } catch(err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

// GET /slots?provider_id=&date=&status=
app.get('/slots', async (req, res) => {
  try {
    const { provider_id, date, status } = req.query;
    let q = `SELECT sl.*, ps.department, ps.location_name, p.first_name as prov_first, p.last_name as prov_last
             FROM scheduling.slots sl
             JOIN scheduling.provider_schedules ps ON sl.schedule_id=ps.id
             JOIN adt.providers p ON sl.provider_id=p.id WHERE 1=1`;
    const params = [];
    if (provider_id) { params.push(provider_id); q += ` AND sl.provider_id=$${params.length}`; }
    if (date) { params.push(date); q += ` AND sl.slot_date=$${params.length}`; }
    if (status) { params.push(status); q += ` AND sl.status=$${params.length}`; }
    q += ' ORDER BY sl.slot_date, sl.start_time';
    const { rows } = await pool.query(q, params);
    res.json({ slots: rows });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /appointments
app.get('/appointments', async (req, res) => {
  try {
    const { provider_id, date, patient_mrn, status, limit = 50 } = req.query;
    let q = `SELECT a.*, p.first_name, p.last_name, p.date_of_birth, p.sex,
             pr.first_name as prov_first, pr.last_name as prov_last, pr.specialty,
             vt.name as vt_name, vt.color as vt_color, vt.duration_min
             FROM scheduling.appointments a
             JOIN adt.patients p ON a.patient_id=p.id
             JOIN adt.providers pr ON a.provider_id=pr.id
             LEFT JOIN scheduling.visit_types vt ON a.visit_type_id=vt.id WHERE 1=1`;
    const params = [];
    if (provider_id) { params.push(provider_id); q += ` AND a.provider_id=$${params.length}`; }
    if (date) { params.push(date); q += ` AND a.appt_date=$${params.length}`; }
    if (patient_mrn) { params.push(patient_mrn); q += ` AND a.patient_mrn=$${params.length}`; }
    if (status) { params.push(status); q += ` AND a.status=$${params.length}`; }
    params.push(Number(limit));
    q += ` ORDER BY a.appt_date, a.start_time LIMIT $${params.length}`;
    const { rows } = await pool.query(q, params);
    res.json({ appointments: rows });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// POST /appointments — book appointment, fires SIU^S12
app.post('/appointments', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { patient_mrn, provider_id, visit_type_id, appt_date, start_time, chief_complaint, department, location_name, slot_id } = req.body;

    const pat = (await client.query('SELECT * FROM adt.patients WHERE mrn=$1', [patient_mrn])).rows[0];
    if (!pat) return res.status(404).json({ error: 'Patient not found' });

    const vt = visit_type_id ? (await client.query('SELECT * FROM scheduling.visit_types WHERE id=$1', [visit_type_id])).rows[0] : null;
    const duration = vt?.duration_min || 30;
    const [h, m] = start_time.split(':').map(Number);
    const endDate = new Date(2000, 0, 1, h, m + duration);
    const end_time = `${String(endDate.getHours()).padStart(2,'0')}:${String(endDate.getMinutes()).padStart(2,'0')}`;

    // Mark slot booked if provided
    if (slot_id) {
      await client.query("UPDATE scheduling.slots SET status='BOOKED' WHERE id=$1", [slot_id]);
    }

    const { rows } = await client.query(`
      INSERT INTO scheduling.appointments
        (patient_id, patient_mrn, slot_id, provider_id, visit_type_id, appt_date, start_time, end_time, chief_complaint, department, location_name)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [pat.id, patient_mrn, slot_id||null, provider_id, visit_type_id||null, appt_date, start_time, end_time, chief_complaint, department||'OUTPATIENT', location_name||'CLINIC']);
    const appt = rows[0];

    const prov = (await client.query('SELECT * FROM adt.providers WHERE id=$1', [provider_id])).rows[0];

    // Build and send SIU^S12
    const patient = { mrn: pat.mrn, first_name: pat.first_name, last_name: pat.last_name, date_of_birth: pat.date_of_birth, sex: pat.sex, phone_home: pat.phone_home, phone_mobile: pat.phone_mobile };
    const msg = buildS12(appt, patient, prov, vt);
    await sendHL7(msg, patient_mrn, 'SIU^S12');

    await client.query(`INSERT INTO scheduling.siu_events (appointment_id,event_type,event_desc,hl7_message) VALUES($1,'S12','Appointment booked',$2)`,
      [appt.id, msg]);

    await client.query('COMMIT');
    res.status(201).json({ appointment: appt, hl7_message: msg });
  } catch(err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

// POST /appointments/:id/cancel — SIU^S15
app.post('/appointments/:id/cancel', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { reason } = req.body;
    const { rows } = await client.query(`UPDATE scheduling.appointments SET status='CANCELLED', cancelled_reason=$1, cancelled_at=NOW(), updated_at=NOW() WHERE id=$2 RETURNING *`, [reason||'Patient request', req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const appt = rows[0];
    if (appt.slot_id) await client.query("UPDATE scheduling.slots SET status='AVAILABLE' WHERE id=$1", [appt.slot_id]);
    const ctx = await getApptContext(appt.id);
    const patient = { mrn: ctx.patient_mrn, first_name: ctx.first_name, last_name: ctx.last_name, date_of_birth: ctx.date_of_birth, sex: ctx.sex };
    const prov = { id: ctx.provider_id, first_name: ctx.prov_first, last_name: ctx.prov_last, npi: ctx.npi };
    const vt = { name: ctx.vt_name, code: ctx.vt_code, duration_min: ctx.duration_min };
    const msg = buildS15(appt, patient, prov, vt);
    await sendHL7(msg, ctx.patient_mrn, 'SIU^S15');
    await client.query(`INSERT INTO scheduling.siu_events (appointment_id,event_type,event_desc,hl7_message) VALUES($1,'S15','Appointment cancelled',$2)`, [appt.id, msg]);
    await client.query('COMMIT');
    res.json({ appointment: appt, hl7_message: msg });
  } catch(err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

// POST /appointments/:id/noshow — SIU^S26
app.post('/appointments/:id/noshow', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`UPDATE scheduling.appointments SET status='NO_SHOW', updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const appt = rows[0];
    const ctx = await getApptContext(appt.id);
    const patient = { mrn: ctx.patient_mrn, first_name: ctx.first_name, last_name: ctx.last_name, date_of_birth: ctx.date_of_birth, sex: ctx.sex };
    const prov = { id: ctx.provider_id, first_name: ctx.prov_first, last_name: ctx.prov_last, npi: ctx.npi };
    const vt = { name: ctx.vt_name, code: ctx.vt_code, duration_min: ctx.duration_min };
    const msg = buildS26(appt, patient, prov, vt);
    await sendHL7(msg, ctx.patient_mrn, 'SIU^S26');
    await client.query(`INSERT INTO scheduling.siu_events (appointment_id,event_type,event_desc,hl7_message) VALUES($1,'S26','No show',$2)`, [appt.id, msg]);
    await client.query('COMMIT');
    res.json({ appointment: appt, hl7_message: msg });
  } catch(err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

// GET /appointments/:id/hl7
app.get('/appointments/:id/hl7', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM scheduling.siu_events WHERE appointment_id=$1 ORDER BY sent_at DESC', [req.params.id]);
    res.json({ siu_events: rows });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /health
app.get('/health', async (req, res) => {
  let db = 'ok'; try { await pool.query('SELECT 1'); } catch { db = 'unavailable'; }
  res.json({ status: 'ok', service: 'medcore-scheduling', version: '1.0.0', db });
});

app.listen(PORT, () => console.log(`
  ╔══════════════════════════════════════╗
  ║   MedCore Scheduling — Module 2      ║
  ║   Port: ${PORT}                          ║
  ║   SIU messages via MLLP :6661        ║
  ╚══════════════════════════════════════╝`));
