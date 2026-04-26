const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const net      = require('net');
const { Pool } = require('pg');
const { buildORM_NW, buildORM_CA, buildRDE_O11, buildRDE_CA } = require('./hl7/builder');

const app  = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST||'localhost', port: parseInt(process.env.DB_PORT)||5432,
  database: process.env.DB_NAME||'medcore', user: process.env.DB_USER||'medcore',
  password: process.env.DB_PASSWORD||'medcore',
});

// ── MLLP sender ───────────────────────────────────────────────
function sendHL7(message, patientMrn, messageType, destination) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.setTimeout(5000);
    client.connect(parseInt(process.env.MIRTH_PORT)||6661, process.env.MIRTH_HOST||'mirth-connect', () => {
      client.write(Buffer.concat([Buffer.from([0x0B]), Buffer.from(message,'utf8'), Buffer.from([0x1C,0x0D])]));
    });
    client.on('data', async () => {
      client.destroy();
      try {
        await pool.query(`INSERT INTO integration.message_log (message_type,direction,channel_name,patient_mrn,raw_message,status) VALUES($1,'OUTBOUND',$2,$3,$4,'SENT')`,
          [messageType, `ORDERS_${destination||'OUT'}`, patientMrn, message]);
      } catch(e) {}
      resolve({ sent: true });
    });
    client.on('timeout', () => { client.destroy(); resolve({ sent: false, reason:'timeout' }); });
    client.on('error', async (err) => {
      try {
        await pool.query(`INSERT INTO integration.message_log (message_type,direction,channel_name,patient_mrn,raw_message,status,error_detail) VALUES($1,'OUTBOUND',$2,$3,$4,'FAILED',$5)`,
          [messageType, `ORDERS_${destination||'OUT'}`, patientMrn, message, err.message]);
      } catch(e) {}
      resolve({ sent: false, reason: err.message });
    });
  });
}

// ── Helper: get patient + encounter context ───────────────────
async function getPatientContext(mrn) {
  const { rows } = await pool.query('SELECT * FROM adt.patients WHERE mrn=$1', [mrn]);
  return rows[0];
}

async function getProviderContext(providerId) {
  if (!providerId) return null;
  const { rows } = await pool.query('SELECT * FROM adt.providers WHERE id=$1', [providerId]);
  return rows[0];
}

// ── Routes ────────────────────────────────────────────────────

// GET /catalog — orderable items
app.get('/catalog', async (req, res) => {
  try {
    const { type } = req.query;
    let q = 'SELECT * FROM orders.order_catalog WHERE active=true';
    const params = [];
    if (type) { params.push(type.toUpperCase()); q += ` AND order_type=$${params.length}`; }
    q += ' ORDER BY order_type, name';
    const { rows } = await pool.query(q, params);
    res.json({ catalog: rows });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /order-sets
app.get('/order-sets', async (req, res) => {
  try {
    const { rows: sets } = await pool.query('SELECT * FROM orders.order_sets WHERE active=true ORDER BY name');
    for (const set of sets) {
      const { rows: items } = await pool.query(`
        SELECT osi.*, oc.name, oc.order_type, oc.code, oc.code_system, oc.specimen_type
        FROM orders.order_set_items osi
        JOIN orders.order_catalog oc ON osi.catalog_id=oc.id
        WHERE osi.order_set_id=$1 ORDER BY osi.display_order`, [set.id]);
      set.items = items;
    }
    res.json({ order_sets: sets });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /orders — list orders
app.get('/orders', async (req, res) => {
  try {
    const { patient_mrn, encounter_csn, status, type, limit=50 } = req.query;
    let q = `SELECT o.*, p.first_name, p.last_name, pr.first_name as prov_first, pr.last_name as prov_last
             FROM orders.orders o
             JOIN adt.patients p ON o.patient_id=p.id
             LEFT JOIN adt.providers pr ON o.ordering_provider_id=pr.id
             WHERE 1=1`;
    const params = [];
    if (patient_mrn) { params.push(patient_mrn); q += ` AND o.patient_mrn=$${params.length}`; }
    if (encounter_csn) { params.push(encounter_csn); q += ` AND o.encounter_csn=$${params.length}`; }
    if (status) { params.push(status); q += ` AND o.status=$${params.length}`; }
    if (type) { params.push(type.toUpperCase()); q += ` AND o.order_type=$${params.length}`; }
    params.push(Number(limit));
    q += ` ORDER BY o.ordered_at DESC LIMIT $${params.length}`;
    const { rows } = await pool.query(q, params);
    res.json({ orders: rows });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// POST /orders — place a new order, fires ORM^O01 or RDE^O11
app.post('/orders', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      patient_mrn, encounter_csn, catalog_id, order_type, order_name,
      order_code, order_code_system, priority='ROUTINE', ordering_provider_id,
      clinical_indication, special_instructions, specimen_type,
      dose, dose_unit, route, frequency, duration, dispense_quantity,
      body_part, laterality
    } = req.body;

    const patient = await getPatientContext(patient_mrn);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const { rows } = await client.query(`
      INSERT INTO orders.orders
        (patient_id, patient_mrn, encounter_csn, catalog_id, order_type, order_name,
         order_code, order_code_system, priority, status, ordering_provider_id,
         clinical_indication, special_instructions, specimen_type,
         dose, dose_unit, route, frequency, duration, dispense_quantity,
         body_part, laterality)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING',$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING *`,
      [patient.id, patient_mrn, encounter_csn||null, catalog_id||null, order_type, order_name,
       order_code||null, order_code_system||null, priority, ordering_provider_id||null,
       clinical_indication||null, special_instructions||null, specimen_type||null,
       dose||null, dose_unit||null, route||null, frequency||null, duration||null, dispense_quantity||null,
       body_part||null, laterality||null]
    );
    const order = rows[0];
    const provider = await getProviderContext(ordering_provider_id);

    // Get encounter context for PV1
    let encounter = null;
    if (encounter_csn) {
      const enc = await client.query('SELECT * FROM adt.encounters WHERE csn=$1', [encounter_csn]);
      encounter = enc.rows[0];
    }

    // Build HL7 message based on order type
    let hl7Msg, destination, messageType;

    if (order_type === 'MED') {
      hl7Msg = buildRDE_O11(order, patient, encounter, provider);
      destination = 'PHARMACY';
      messageType = 'RDE^O11';
    } else if (order_type === 'IMAGING') {
      hl7Msg = buildORM_NW(order, patient, encounter, provider);
      destination = 'RADIOLOGY';
      messageType = 'ORM^O01';
    } else {
      hl7Msg = buildORM_NW(order, patient, encounter, provider);
      destination = 'LAB';
      messageType = 'ORM^O01';
    }

    // Send via Mirth
    await sendHL7(hl7Msg, patient_mrn, messageType, destination);

    // Update status to SENT and log
    await client.query("UPDATE orders.orders SET status='SENT', hl7_sent_at=NOW() WHERE id=$1", [order.id]);
    await client.query(`INSERT INTO orders.orm_events (order_id,event_type,direction,destination,hl7_message) VALUES($1,$2,'OUTBOUND',$3,$4)`,
      [order.id, messageType.replace('^','_'), destination, hl7Msg]);

    await client.query('COMMIT');
    order.status = 'SENT';
    res.status(201).json({ order, hl7_message: hl7Msg, destination });
  } catch(err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

// POST /orders/order-set — place all orders in a set
app.post('/orders/order-set', async (req, res) => {
  try {
    const { patient_mrn, encounter_csn, order_set_id, ordering_provider_id } = req.body;
    const { rows: items } = await pool.query(`
      SELECT osi.*, oc.* FROM orders.order_set_items osi
      JOIN orders.order_catalog oc ON osi.catalog_id=oc.id
      WHERE osi.order_set_id=$1 ORDER BY osi.display_order`, [order_set_id]);

    const results = [];
    for (const item of items) {
      const r = await fetch(`http://localhost:${PORT}/orders`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          patient_mrn, encounter_csn, catalog_id: item.catalog_id,
          order_type: item.order_type, order_name: item.name,
          order_code: item.code, order_code_system: item.code_system,
          priority: item.default_priority, ordering_provider_id,
          specimen_type: item.specimen_type,
          special_instructions: item.default_instructions
        })
      });
      const data = await r.json();
      results.push(data.order);
    }
    res.status(201).json({ orders_placed: results.length, orders: results });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// POST /orders/:id/cancel — fires ORM CA or RDE CA
app.post('/orders/:id/cancel', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { reason } = req.body;
    const { rows } = await client.query(`UPDATE orders.orders SET status='CANCELLED', cancelled_at=NOW(), cancelled_reason=$1 WHERE id=$2 RETURNING *`, [reason||'Clinician cancelled', req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Order not found' });
    const order = rows[0];

    const patient = await getPatientContext(order.patient_mrn);
    const provider = await getProviderContext(order.ordering_provider_id);

    let hl7Msg, destination, messageType;
    if (order.order_type === 'MED') {
      hl7Msg = buildRDE_CA(order, patient, null, provider);
      destination = 'PHARMACY'; messageType = 'RDE^O11_CA';
    } else {
      hl7Msg = buildORM_CA(order, patient, null, provider);
      destination = order.order_type === 'IMAGING' ? 'RADIOLOGY' : 'LAB';
      messageType = 'ORM^O01_CA';
    }

    await sendHL7(hl7Msg, order.patient_mrn, messageType, destination);
    await client.query(`INSERT INTO orders.orm_events (order_id,event_type,direction,destination,hl7_message) VALUES($1,$2,'OUTBOUND',$3,$4)`,
      [order.id, messageType, destination, hl7Msg]);

    await client.query('COMMIT');
    res.json({ order, hl7_message: hl7Msg });
  } catch(err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

// GET /orders/:id/hl7
app.get('/orders/:id/hl7', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM orders.orm_events WHERE order_id=$1 ORDER BY sent_at DESC', [req.params.id]);
    res.json({ orm_events: rows });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /providers
app.get('/providers', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM adt.providers WHERE active=true ORDER BY last_name');
    res.json({ providers: rows });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /health
app.get('/health', async (req, res) => {
  let db='ok'; try{await pool.query('SELECT 1');}catch{db='unavailable';}
  res.json({ status:'ok', service:'medcore-orders', version:'1.0.0', db });
});

app.listen(PORT, () => console.log(`
  ╔══════════════════════════════════════╗
  ║   MedCore Orders — Module 3          ║
  ║   Port: ${PORT}                          ║
  ║   ORM^O01 / RDE^O11 via MLLP :6661  ║
  ╚══════════════════════════════════════╝`));
