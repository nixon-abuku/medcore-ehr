const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const { Pool } = require('pg');
const { generateORU, parseORU } = require('./hl7/builder');

const app  = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST||'localhost', port: parseInt(process.env.DB_PORT)||5432,
  database: process.env.DB_NAME||'medcore', user: process.env.DB_USER||'medcore',
  password: process.env.DB_PASSWORD||'medcore',
});

// ── Simulate a result coming back from the lab ────────────────
// In real life this would come through Mirth from the LIS.
// Here we generate it on demand so you can practice.
app.post('/simulate', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { order_id } = req.body;

    // Get the order
    const { rows: orderRows } = await client.query(
      'SELECT o.*, p.mrn, p.first_name, p.last_name, p.date_of_birth, p.sex FROM orders.orders o JOIN adt.patients p ON o.patient_id=p.id WHERE o.id=$1',
      [order_id]
    );
    if (!orderRows.length) return res.status(404).json({ error: 'Order not found' });
    const order = orderRows[0];
    const patient = { mrn: order.mrn, first_name: order.first_name, last_name: order.last_name };

    // Generate ORU^R01
    const { message, fillerOrderNum, observations, panelName } = generateORU(order, patient);

    // Parse the generated message
    const parsed = parseORU(message);

    // Store the result report
    const { rows: rptRows } = await client.query(`
      INSERT INTO results.result_reports
        (placer_order_num, filler_order_num, patient_mrn, encounter_csn, order_id,
         test_name, test_code, test_code_system, report_status, result_source, raw_hl7, collection_time)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'LOINC','FINAL','LAB',$8,NOW())
      RETURNING *`,
      [order.placer_order_num, fillerOrderNum, order.patient_mrn, order.encounter_csn,
       order_id, panelName, order.order_code, message]
    );
    const report = rptRows[0];

    // Store each OBX as an observation
    let hasCritical = false;
    for (const obs of observations) {
      await client.query(`
        INSERT INTO results.observations
          (report_id, set_id, observation_code, observation_name, code_system,
           value_type, value_numeric, value_text, value_display, units, reference_range, abnormal_flag, result_status)
        VALUES ($1,$2,$3,$4,'LOINC',$5,$6,$7,$8,$9,$10,$11,'F')`,
        [report.id, obs.loinc ? observations.indexOf(obs)+1 : 1,
         obs.loinc, obs.name, obs.vType,
         obs.vType === 'NM' ? parseFloat(obs.value) : null,
         obs.vType !== 'NM' ? String(obs.value) : null,
         String(obs.value),
         obs.units, obs.range, obs.flag || 'N']
      );
      if (obs.flag === 'HH' || obs.flag === 'LL') hasCritical = true;
    }

    // Update order status to completed
    await client.query("UPDATE orders.orders SET status='COMPLETED', completed_at=NOW(), filler_order_num=$1 WHERE id=$2",
      [fillerOrderNum, order_id]);

    // Log to integration message log
    await client.query(`INSERT INTO integration.message_log
      (message_type,direction,channel_name,patient_mrn,raw_message,status)
      VALUES ('ORU^R01','INBOUND','ORU_From_Lab',$1,$2,'RECEIVED')`,
      [order.patient_mrn, message]);

    await client.query('COMMIT');
    res.status(201).json({ report, observations, hl7_message: message, has_critical: hasCritical, filler_order_num: fillerOrderNum });
  } catch(err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

// GET /reports — results inbox
app.get('/reports', async (req, res) => {
  try {
    const { patient_mrn, unread, limit=50 } = req.query;
    let q = `SELECT r.*, COUNT(o.id) as obs_count,
             SUM(CASE WHEN o.abnormal_flag IN ('H','L','HH','LL','A') THEN 1 ELSE 0 END) as abnormal_count,
             SUM(CASE WHEN o.abnormal_flag IN ('HH','LL') THEN 1 ELSE 0 END) as critical_count
             FROM results.result_reports r
             LEFT JOIN results.observations o ON r.id=o.report_id
             WHERE 1=1`;
    const params = [];
    if (patient_mrn) { params.push(patient_mrn); q += ` AND r.patient_mrn=$${params.length}`; }
    if (unread === 'true') { q += ` AND r.acknowledged_at IS NULL`; }
    q += ` GROUP BY r.id ORDER BY r.received_time DESC`;
    params.push(Number(limit));
    q += ` LIMIT $${params.length}`;
    const { rows } = await pool.query(q, params);
    res.json({ reports: rows });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /reports/:id — full report with observations
app.get('/reports/:id', async (req, res) => {
  try {
    const { rows: rpt } = await pool.query('SELECT * FROM results.result_reports WHERE id=$1', [req.params.id]);
    if (!rpt.length) return res.status(404).json({ error: 'Not found' });
    const { rows: obs } = await pool.query('SELECT * FROM results.observations WHERE report_id=$1 ORDER BY set_id', [req.params.id]);
    res.json({ report: rpt[0], observations: obs });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// POST /reports/:id/acknowledge
app.post('/reports/:id/acknowledge', async (req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE results.result_reports SET acknowledged_by='MEDCORE_USER', acknowledged_at=NOW() WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    res.json({ report: rows[0] });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /orders/pending — lab orders awaiting results
app.get('/orders/pending', async (req, res) => {
  try {
    const { patient_mrn } = req.query;
    let q = `SELECT o.*, p.first_name, p.last_name FROM orders.orders o
             JOIN adt.patients p ON o.patient_id=p.id
             WHERE o.order_type IN ('LAB','IMAGING') AND o.status='SENT'`;
    const params = [];
    if (patient_mrn) { params.push(patient_mrn); q += ` AND o.patient_mrn=$${params.length}`; }
    q += ' ORDER BY o.ordered_at DESC';
    const { rows } = await pool.query(q, params);
    res.json({ orders: rows });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /health
app.get('/health', async (req, res) => {
  let db='ok'; try{await pool.query('SELECT 1');}catch{db='unavailable';}
  res.json({ status:'ok', service:'medcore-results', version:'1.0.0', db });
});

app.listen(PORT, () => console.log(`
  ╔══════════════════════════════════════╗
  ║   MedCore Results — Module 4         ║
  ║   Port: ${PORT}                          ║
  ║   Receives ORU^R01 results           ║
  ╚══════════════════════════════════════╝`));

app.post('/inbound', async (req, res) => {
  try {
    const { hl7_message } = req.body;
    const parsed = parseORU(hl7_message);
    if (!parsed.placerOrderNum) return res.status(400).json({ error: 'No placer num' });
    const orderRes = await pool.query('SELECT * FROM orders.orders WHERE placer_order_num=$1', [parsed.placerOrderNum]);
    if (!orderRes.rows.length) return res.status(404).json({ error: 'Order not found' });
    const r = await fetch('http://results:3005/simulate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ order_id: orderRes.rows[0].id }) });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
