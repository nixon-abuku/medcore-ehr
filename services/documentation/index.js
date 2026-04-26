const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const net      = require('net');
const { Pool } = require('pg');
const { buildT02, buildT08, buildT11 } = require('./hl7/builder');

const app  = express();
const PORT = process.env.PORT || 3006;
app.use(cors()); app.use(morgan('dev')); app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST||'localhost', port: parseInt(process.env.DB_PORT)||5432,
  database: process.env.DB_NAME||'medcore', user: process.env.DB_USER||'medcore',
  password: process.env.DB_PASSWORD||'medcore',
});

function sendHL7(message, patientMrn, messageType) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.setTimeout(5000);
    client.connect(parseInt(process.env.MIRTH_PORT)||6661, process.env.MIRTH_HOST||'mirth-connect', () => {
      client.write(Buffer.concat([Buffer.from([0x0B]), Buffer.from(message,'utf8'), Buffer.from([0x1C,0x0D])]));
    });
    client.on('data', async () => {
      client.destroy();
      try { await pool.query(`INSERT INTO integration.message_log (message_type,direction,channel_name,patient_mrn,raw_message,status) VALUES($1,'OUTBOUND','MDM_Channel',$2,$3,'SENT')`, [messageType, patientMrn, message]); } catch(e) {}
      resolve({ sent: true });
    });
    client.on('timeout', () => { client.destroy(); resolve({ sent: false }); });
    client.on('error', (err) => { resolve({ sent: false, reason: err.message }); });
  });
}

async function getPatient(mrn) {
  const { rows } = await pool.query('SELECT * FROM adt.patients WHERE mrn=$1', [mrn]);
  return rows[0];
}
async function getProvider(id) {
  if (!id) return null;
  const { rows } = await pool.query('SELECT * FROM adt.providers WHERE id=$1', [id]);
  return rows[0];
}

// ── Note Types & Templates ────────────────────────────────────
app.get('/note-types', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM documentation.note_types WHERE active=true ORDER BY name');
    res.json({ note_types: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/templates', async (req, res) => {
  try {
    const { note_type_id } = req.query;
    let q = 'SELECT t.*, nt.code as note_type_code FROM documentation.note_templates t JOIN documentation.note_types nt ON t.note_type_id=nt.id WHERE t.active=true';
    const params = [];
    if (note_type_id) { params.push(note_type_id); q += ` AND t.note_type_id=$${params.length}`; }
    const { rows } = await pool.query(q, params);
    res.json({ templates: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Clinical Notes ────────────────────────────────────────────
app.get('/notes', async (req, res) => {
  try {
    const { patient_mrn, encounter_csn, status, limit=50 } = req.query;
    let q = `SELECT n.*, nt.name as type_name FROM documentation.clinical_notes n
             LEFT JOIN documentation.note_types nt ON n.note_type_id=nt.id WHERE 1=1`;
    const params = [];
    if (patient_mrn) { params.push(patient_mrn); q += ` AND n.patient_mrn=$${params.length}`; }
    if (encounter_csn) { params.push(encounter_csn); q += ` AND n.encounter_csn=$${params.length}`; }
    if (status) { params.push(status); q += ` AND n.status=$${params.length}`; }
    params.push(Number(limit));
    q += ` ORDER BY n.authored_at DESC LIMIT $${params.length}`;
    const { rows } = await pool.query(q, params);
    res.json({ notes: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/notes', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { patient_mrn, encounter_csn, note_type_id, title, content, author_id } = req.body;
    const patient = await getPatient(patient_mrn);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    const noteType = note_type_id ? (await client.query('SELECT * FROM documentation.note_types WHERE id=$1', [note_type_id])).rows[0] : null;
    const provider = await getProvider(author_id);
    const { rows } = await client.query(`
      INSERT INTO documentation.clinical_notes
        (patient_id, patient_mrn, encounter_csn, note_type_id, note_type_name, title, content, status, author_id, author_name)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'DRAFT',$8,$9) RETURNING *`,
      [patient.id, patient_mrn, encounter_csn||null, note_type_id||null,
       noteType?.name||null, title||null, content,
       author_id||null, provider ? `Dr. ${provider.first_name} ${provider.last_name}` : null]
    );
    await client.query('COMMIT');
    res.status(201).json({ note: rows[0] });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

app.post('/notes/:id/sign', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      "UPDATE documentation.clinical_notes SET status='SIGNED', signed_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Note not found' });
    const note = rows[0];
    const patient = await getPatient(note.patient_mrn);
    const provider = await getProvider(note.author_id);
    const noteType = note.note_type_id ? (await client.query('SELECT * FROM documentation.note_types WHERE id=$1', [note.note_type_id])).rows[0] : null;
    const noteForHL7 = { ...note, note_type_code: noteType?.code || 'PROG' };
    const hl7Msg = buildT02(noteForHL7, patient, null, provider);
    await sendHL7(hl7Msg, note.patient_mrn, 'MDM^T02');
    await client.query(`INSERT INTO documentation.mdm_events (note_id,event_type,hl7_message) VALUES($1,'T02',$2)`, [note.id, hl7Msg]);
    await client.query("UPDATE documentation.clinical_notes SET hl7_message=$1 WHERE id=$2", [hl7Msg, note.id]);
    await client.query('COMMIT');
    res.json({ note, hl7_message: hl7Msg });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

app.get('/notes/:id/hl7', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM documentation.mdm_events WHERE note_id=$1 ORDER BY sent_at DESC', [req.params.id]);
    res.json({ mdm_events: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Vitals ────────────────────────────────────────────────────
app.get('/vitals/:mrn', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM documentation.vitals WHERE patient_mrn=$1 ORDER BY recorded_at DESC LIMIT 20',
      [req.params.mrn]
    );
    res.json({ vitals: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/vitals', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { patient_mrn, encounter_csn, temperature, temperature_route='Oral',
            heart_rate, respiratory_rate, bp_systolic, bp_diastolic, bp_position='Sitting',
            oxygen_sat, oxygen_delivery='Room air', weight_kg, height_cm, pain_score, recorded_by } = req.body;
    const patient = await getPatient(patient_mrn);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    let bmi = null;
    if (weight_kg && height_cm) bmi = parseFloat((weight_kg / ((height_cm/100)**2)).toFixed(1));
    const { rows } = await client.query(`
      INSERT INTO documentation.vitals
        (patient_id, patient_mrn, encounter_csn, temperature, temperature_route,
         heart_rate, respiratory_rate, bp_systolic, bp_diastolic, bp_position,
         oxygen_sat, oxygen_delivery, weight_kg, height_cm, pain_score, bmi, recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [patient.id, patient_mrn, encounter_csn||null, temperature, temperature_route,
       heart_rate, respiratory_rate, bp_systolic, bp_diastolic, bp_position,
       oxygen_sat, oxygen_delivery, weight_kg, height_cm, pain_score, bmi,
       recorded_by||'MEDCORE_NURSE']
    );
    await client.query('COMMIT');
    res.status(201).json({ vitals: rows[0] });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

// ── Problems ──────────────────────────────────────────────────
app.get('/problems/:mrn', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM documentation.problems WHERE patient_mrn=$1 ORDER BY status, noted_at DESC", [req.params.mrn]);
    res.json({ problems: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/problems', async (req, res) => {
  try {
    const { patient_mrn, description, icd10_code, icd10_display, onset_date, noted_by } = req.body;
    const patient = await getPatient(patient_mrn);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    const { rows } = await pool.query(`
      INSERT INTO documentation.problems (patient_id, patient_mrn, description, icd10_code, icd10_display, onset_date, noted_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [patient.id, patient_mrn, description, icd10_code||null, icd10_display||null, onset_date||null, noted_by||null]
    );
    res.status(201).json({ problem: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.patch('/problems/:id/resolve', async (req, res) => {
  try {
    const { rows } = await pool.query("UPDATE documentation.problems SET status='RESOLVED', resolved_at=NOW() WHERE id=$1 RETURNING *", [req.params.id]);
    res.json({ problem: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Allergies ─────────────────────────────────────────────────
app.get('/allergies/:mrn', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM documentation.allergies WHERE patient_mrn=$1 AND status='ACTIVE' ORDER BY severity DESC, noted_at", [req.params.mrn]);
    res.json({ allergies: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/allergies', async (req, res) => {
  try {
    const { patient_mrn, allergen, allergen_type='DRUG', reaction, severity='MODERATE', noted_by } = req.body;
    const patient = await getPatient(patient_mrn);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    const { rows } = await pool.query(`
      INSERT INTO documentation.allergies (patient_id, patient_mrn, allergen, allergen_type, reaction, severity, noted_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [patient.id, patient_mrn, allergen, allergen_type, reaction||null, severity, noted_by||null]
    );
    res.status(201).json({ allergy: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /providers
app.get('/providers', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM adt.providers WHERE active=true ORDER BY last_name');
    res.json({ providers: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/health', async (req, res) => {
  let db='ok'; try{await pool.query('SELECT 1');}catch{db='unavailable';}
  res.json({ status:'ok', service:'medcore-documentation', version:'1.0.0', db });
});

app.listen(PORT, () => console.log(`
  ╔══════════════════════════════════════╗
  ║   MedCore Documentation — Module 5   ║
  ║   Port: ${PORT}                          ║
  ║   MDM^T02/T08/T11 via MLLP :6661    ║
  ╚══════════════════════════════════════╝`));
