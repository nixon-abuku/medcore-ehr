const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const net      = require('net');
const { Pool } = require('pg');
const { buildDFT_P03, buildBAR_P01, buildX12_270, buildX12_837, buildX12_835 } = require('./hl7/builder');

const app  = express();
const PORT = process.env.PORT || 3007;
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
      try { await pool.query(`INSERT INTO integration.message_log (message_type,direction,channel_name,patient_mrn,raw_message,status) VALUES($1,'OUTBOUND','BILLING_Channel',$2,$3,'SENT')`, [messageType, patientMrn, message]); } catch(e) {}
      resolve({ sent: true });
    });
    client.on('timeout', () => { client.destroy(); resolve({ sent: false }); });
    client.on('error', (err) => { resolve({ sent: false, reason: err.message }); });
  });
}

// ── Charge Master ─────────────────────────────────────────────
app.get('/charge-master', async (req, res) => {
  try {
    const { dept } = req.query;
    let q = 'SELECT * FROM billing.charge_master WHERE active=true';
    const params = [];
    if (dept) { params.push(dept); q += ` AND department=$${params.length}`; }
    q += ' ORDER BY department, description';
    const { rows } = await pool.query(q, params);
    res.json({ charge_master: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Payers ────────────────────────────────────────────────────
app.get('/payers', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM billing.payers WHERE active=true ORDER BY payer_type, name');
    res.json({ payers: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Accounts ──────────────────────────────────────────────────
app.get('/accounts', async (req, res) => {
  try {
    const { patient_mrn, status } = req.query;
    let q = `SELECT a.*, p.name as payer_name FROM billing.accounts a LEFT JOIN billing.payers p ON a.payer_id=p.id WHERE 1=1`;
    const params = [];
    if (patient_mrn) { params.push(patient_mrn); q += ` AND a.patient_mrn=$${params.length}`; }
    if (status) { params.push(status); q += ` AND a.status=$${params.length}`; }
    q += ' ORDER BY a.created_at DESC';
    const { rows } = await pool.query(q, params);
    res.json({ accounts: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/accounts', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { patient_mrn, encounter_csn, financial_class='COMMERCIAL', payer_id, member_id, group_number, admit_date } = req.body;
    const pat = (await client.query('SELECT * FROM adt.patients WHERE mrn=$1', [patient_mrn])).rows[0];
    if (!pat) return res.status(404).json({ error: 'Patient not found' });
    const { rows } = await client.query(`
      INSERT INTO billing.accounts (patient_mrn, encounter_csn, financial_class, payer_id, member_id, group_number, admit_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [patient_mrn, encounter_csn||null, financial_class, payer_id||null, member_id||null, group_number||null, admit_date||null]
    );
    const account = rows[0];
    const payer = payer_id ? (await client.query('SELECT * FROM billing.payers WHERE id=$1', [payer_id])).rows[0] : null;
    const barMsg = buildBAR_P01(account, pat);
    await sendHL7(barMsg, patient_mrn, 'BAR^P01');
    await client.query(`INSERT INTO billing.hl7_events (account_id,event_type,hl7_message) VALUES($1,'BAR_P01',$2)`, [account.id, barMsg]);
    await client.query('COMMIT');
    res.status(201).json({ account, hl7_message: barMsg });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

// ── Charges ───────────────────────────────────────────────────
app.get('/charges', async (req, res) => {
  try {
    const { patient_mrn, account_id, status } = req.query;
    let q = 'SELECT * FROM billing.charges WHERE 1=1';
    const params = [];
    if (patient_mrn) { params.push(patient_mrn); q += ` AND patient_mrn=$${params.length}`; }
    if (account_id)  { params.push(account_id);  q += ` AND account_id=$${params.length}`; }
    if (status)      { params.push(status);       q += ` AND status=$${params.length}`; }
    q += ' ORDER BY posted_at DESC';
    const { rows } = await pool.query(q, params);
    res.json({ charges: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/charges', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { patient_mrn, encounter_csn, account_id, cdm_code, cpt_code, cpt_description,
            charge_amount, quantity=1, icd10_primary, icd10_desc, charge_source='MANUAL',
            source_id, department, ordering_provider, performing_provider, service_date } = req.body;

    const pat = (await client.query('SELECT * FROM adt.patients WHERE mrn=$1', [patient_mrn])).rows[0];
    if (!pat) return res.status(404).json({ error: 'Patient not found' });

    // Look up CDM if code provided
    let cptFinal = cpt_code, descFinal = cpt_description, amtFinal = charge_amount, deptFinal = department;
    if (cdm_code) {
      const cdm = (await client.query('SELECT * FROM billing.charge_master WHERE cdm_code=$1', [cdm_code])).rows[0];
      if (cdm) { cptFinal = cdm.cpt_code; descFinal = cdm.description; amtFinal = cdm.charge_amount; deptFinal = cdm.department; }
    }

    const { rows } = await client.query(`
      INSERT INTO billing.charges
        (account_id, patient_mrn, encounter_csn, cdm_code, cpt_code, cpt_description,
         charge_amount, quantity, icd10_primary, icd10_desc, charge_source, source_id,
         department, ordering_provider, performing_provider, service_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [account_id||null, patient_mrn, encounter_csn||null, cdm_code||null, cptFinal, descFinal,
       amtFinal, quantity, icd10_primary||null, icd10_desc||null, charge_source, source_id||null,
       deptFinal, ordering_provider||null, performing_provider||null, service_date||null]
    );
    const charge = rows[0];

    // Get account for DFT
    const account = account_id ? (await client.query('SELECT * FROM billing.accounts WHERE id=$1', [account_id])).rows[0] : null;

    // Build and send DFT^P03
    const dftMsg = buildDFT_P03(charge, pat, account);
    await sendHL7(dftMsg, patient_mrn, 'DFT^P03');
    await client.query(`INSERT INTO billing.hl7_events (charge_id,event_type,hl7_message) VALUES($1,'DFT_P03',$2)`, [charge.id, dftMsg]);
    await client.query("UPDATE billing.charges SET hl7_message=$1 WHERE id=$2", [dftMsg, charge.id]);

    // Update account totals
    if (account_id) {
      await client.query(`UPDATE billing.accounts SET total_charges=total_charges+$1, balance=balance+$1, updated_at=NOW() WHERE id=$2`, [amtFinal*quantity, account_id]);
    }

    await client.query('COMMIT');
    res.status(201).json({ charge, hl7_message: dftMsg });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

app.post('/charges/:id/void', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { reason } = req.body;
    const { rows } = await client.query("UPDATE billing.charges SET status='VOIDED', voided_at=NOW(), void_reason=$1 WHERE id=$2 RETURNING *", [reason||'Voided', req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const charge = rows[0];
    if (charge.account_id) {
      await client.query(`UPDATE billing.accounts SET total_charges=total_charges-$1, balance=balance-$1 WHERE id=$2`, [charge.charge_amount*charge.quantity, charge.account_id]);
    }
    await client.query('COMMIT');
    res.json({ charge });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

// ── Eligibility Check (X12 270) ───────────────────────────────
app.post('/eligibility', async (req, res) => {
  try {
    const { patient_mrn, payer_id, member_id } = req.body;
    const pat = (await pool.query('SELECT * FROM adt.patients WHERE mrn=$1', [patient_mrn])).rows[0];
    if (!pat) return res.status(404).json({ error: 'Patient not found' });
    const payer = (await pool.query('SELECT * FROM billing.payers WHERE id=$1', [payer_id])).rows[0];
    if (!payer) return res.status(404).json({ error: 'Payer not found' });

    const x12_270 = buildX12_270(pat, payer, member_id);

    // Simulate 271 response
    const covered = Math.random() > 0.1; // 90% chance covered
    const x12_271 = covered
      ? `ISA*00*          *00*          *ZZ*${payer.payer_id.padEnd(15)}*ZZ*MEDCORE         *${today().substring(0,6)}*1400*^*00501*000000001*0*P*:~\nGS*HB*${payer.payer_id}*MEDCORE*${today()}*1400*1*X*005010X279A1~\nST*271*0001~\nBHT*0022*11*1*${today()}*1400~\nHL*1**20*1~\nNM1*PR*2*${payer.name}*****PI*${payer.payer_id}~\nHL*2*1*21*1~\nNM1*1P*2*MEDCORE MEDICAL CENTER*****XX*1234567890~\nHL*3*2*22*0~\nNM1*IL*1*${pat.last_name}*${pat.first_name}****MI*${member_id}~\nINS*Y*18~\nDTP*307*D8*${today()}~\nEB*1*IND*30*MC~\nEB*C*IND*30~\nSE*15*0001~\nGE*1*1~\nIEA*1*000000001~`
      : `ISA*... ELIGIBILITY NOT FOUND ...~`;

    await pool.query(`INSERT INTO billing.hl7_events (event_type,direction,hl7_message) VALUES('X12_270','OUTBOUND',$1)`, [x12_270]);
    res.json({ covered, x12_270, x12_271, payer: payer.name, patient: `${pat.first_name} ${pat.last_name}` });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Claims ────────────────────────────────────────────────────
app.get('/claims', async (req, res) => {
  try {
    const { patient_mrn, status } = req.query;
    let q = `SELECT c.*, p.name as payer_name FROM billing.claims c LEFT JOIN billing.payers p ON c.payer_id=p.id WHERE 1=1`;
    const params = [];
    if (patient_mrn) { params.push(patient_mrn); q += ` AND c.patient_mrn=$${params.length}`; }
    if (status) { params.push(status); q += ` AND c.status=$${params.length}`; }
    q += ' ORDER BY c.created_at DESC';
    const { rows } = await pool.query(q, params);
    res.json({ claims: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/claims', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { account_id, payer_id, claim_type='837P' } = req.body;
    const account = (await client.query('SELECT * FROM billing.accounts WHERE id=$1', [account_id])).rows[0];
    if (!account) return res.status(404).json({ error: 'Account not found' });
    const charges = (await client.query("SELECT * FROM billing.charges WHERE account_id=$1 AND status='PENDING'", [account_id])).rows;
    if (!charges.length) return res.status(400).json({ error: 'No pending charges to claim' });
    const payer = (await client.query('SELECT * FROM billing.payers WHERE id=$1', [payer_id])).rows[0];
    if (!payer) return res.status(404).json({ error: 'Payer not found' });
    const pat = (await client.query('SELECT * FROM adt.patients WHERE mrn=$1', [account.patient_mrn])).rows[0];
    const total = charges.reduce((s,c)=>s+parseFloat(c.charge_amount)*c.quantity,0);

    const { rows } = await client.query(`
      INSERT INTO billing.claims (account_id, patient_mrn, payer_id, claim_type, status, total_billed, submitted_at)
      VALUES ($1,$2,$3,$4,'SUBMITTED',$5,NOW()) RETURNING *`,
      [account_id, account.patient_mrn, payer_id, claim_type, total]
    );
    const claim = rows[0];

    // Build 837
    const x12_837 = buildX12_837(claim, { ...pat, member_id: account.member_id }, payer, charges);
    await client.query("UPDATE billing.claims SET x12_837=$1 WHERE id=$2", [x12_837, claim.id]);
    await client.query(`INSERT INTO billing.hl7_events (event_type,direction,hl7_message) VALUES('X12_837','OUTBOUND',$1)`, [x12_837]);

    // Mark charges as billed
    for (const c of charges) {
      await client.query("UPDATE billing.charges SET status='BILLED' WHERE id=$1", [c.id]);
      await client.query(`INSERT INTO billing.claim_lines (claim_id,charge_id,line_num,cpt_code,cpt_desc,icd10_codes,quantity,billed_amt) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [claim.id, c.id, charges.indexOf(c)+1, c.cpt_code, c.cpt_description, c.icd10_primary||'', c.quantity, c.charge_amount*c.quantity]);
    }
    await client.query("UPDATE billing.accounts SET status='BILLED', updated_at=NOW() WHERE id=$1", [account_id]);
    await client.query('COMMIT');
    res.status(201).json({ claim, x12_837, charges_billed: charges.length });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

// POST /claims/:id/remittance — simulate X12 835 payment
app.post('/claims/:id/remittance', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { payment_pct = 80 } = req.body; // Default: payer pays 80%
    const claim = (await client.query('SELECT c.*, p.name as payer_name, p.payer_id FROM billing.claims c JOIN billing.payers p ON c.payer_id=p.id WHERE c.id=$1', [req.params.id])).rows[0];
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    const pat = (await client.query('SELECT * FROM adt.patients WHERE mrn=$1', [claim.patient_mrn])).rows[0];
    const payAmt  = (parseFloat(claim.total_billed) * payment_pct / 100).toFixed(2);
    const denyAmt = (parseFloat(claim.total_billed) - parseFloat(payAmt)).toFixed(2);
    const x12_835 = buildX12_835(
      { ...claim, patient_last: pat?.last_name, patient_first: pat?.first_name },
      { name: claim.payer_name, payer_id: claim.payer_id },
      payAmt, denyAmt, payment_pct < 100 ? '45' : null
    );
    await client.query(`UPDATE billing.claims SET status='PAID', total_paid=$1, total_denied=$2, paid_at=NOW(), x12_835=$3, denial_reason=$4 WHERE id=$5`,
      [payAmt, denyAmt, x12_835, denyAmt > 0 ? 'CO-45: Charge exceeds fee schedule' : null, claim.id]);
    await client.query(`UPDATE billing.accounts SET total_payments=$1, balance=total_charges-$1, status='PAID', updated_at=NOW() WHERE id=$2`,
      [payAmt, claim.account_id]);
    await client.query(`INSERT INTO billing.hl7_events (event_type,direction,hl7_message) VALUES('X12_835','INBOUND',$1)`, [x12_835]);
    await client.query('COMMIT');
    res.json({ claim_num: claim.claim_num, paid: payAmt, denied: denyAmt, x12_835, payment_pct });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

app.get('/health', async (req, res) => {
  let db='ok'; try{await pool.query('SELECT 1');}catch{db='unavailable';}
  res.json({ status:'ok', service:'medcore-billing', version:'1.0.0', db });
});

app.listen(PORT, () => console.log(`
  ╔══════════════════════════════════════╗
  ║   MedCore Billing — Module 6         ║
  ║   Port: ${PORT}                          ║
  ║   DFT^P03 BAR^P01 X12 837/835/270   ║
  ╚══════════════════════════════════════╝`));
