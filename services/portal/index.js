/**
 * MedCore Patient Portal Service — Module 8
 *
 * LEARNING: This is the MyChart equivalent.
 * In Epic, MyChart is powered by SMART on FHIR:
 *
 * SMART on FHIR flow:
 * 1. Patient clicks "Open MyChart"
 * 2. App redirects to Epic's authorization server (Keycloak here)
 * 3. Patient logs in with their credentials
 * 4. Authorization server issues an access token
 * 5. App uses token to call FHIR API for patient data
 * 6. Patient sees their records in the portal
 *
 * FHIR R4 resources used:
 *   Patient          — demographics
 *   Observation      — lab results, vitals
 *   Condition        — problem list
 *   AllergyIntolerance — allergies
 *   MedicationRequest  — medications
 *   Appointment      — scheduled visits
 *
 * This service:
 * - Acts as the SMART app backend
 * - Handles OAuth2 token exchange with Keycloak
 * - Proxies FHIR calls to HAPI FHIR
 * - Provides patient-facing data APIs
 */

const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const http    = require('http');
const https   = require('https');
const { Pool } = require('pg');

const app  = express();
const PORT = process.env.PORT || 3009;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

const FHIR_BASE = process.env.FHIR_BASE_URL || 'http://hapi-fhir:8080/fhir';
const KEYCLOAK  = process.env.KEYCLOAK_URL   || 'http://keycloak:8080';
const CLIENT_ID = process.env.SMART_CLIENT_ID || 'medcore-portal';

const pool = new Pool({
  host: process.env.DB_HOST||'localhost', port: parseInt(process.env.DB_PORT)||5432,
  database: process.env.DB_NAME||'medcore', user: process.env.DB_USER||'medcore',
  password: process.env.DB_PASSWORD||'medcore',
});

// ── Helper: fetch from FHIR server ───────────────────────────
function fhirFetch(path) {
  return new Promise((resolve, reject) => {
    const url = `${FHIR_BASE}${path}`;
    const isHttps = url.startsWith('https');
    const mod = isHttps ? https : http;
    const req = mod.get(url, {
      headers: { 'Accept': 'application/fhir+json', 'Content-Type': 'application/fhir+json' }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve({ error: 'Invalid FHIR response', raw: data.substring(0,200) }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('FHIR timeout')); });
  });
}

// ── Helper: sync patient to FHIR ─────────────────────────────
async function syncPatientToFHIR(patient) {
  const fhirPatient = {
    resourceType: 'Patient',
    id: `medcore-${patient.mrn}`,
    identifier: [{
      system: 'http://medcore.example.org/mrn',
      value: patient.mrn,
    }],
    name: [{
      family: patient.last_name,
      given: [patient.first_name],
      use: 'official',
    }],
    gender: patient.sex?.toLowerCase() === 'm' ? 'male' :
            patient.sex?.toLowerCase() === 'f' ? 'female' : 'unknown',
    birthDate: patient.date_of_birth?.toISOString?.()?.substring(0,10) ||
               String(patient.date_of_birth).substring(0,10),
    telecom: patient.phone ? [{ system:'phone', value: patient.phone }] : [],
    address: patient.address ? [{
      text: patient.address,
      city: patient.city,
      state: patient.state,
      postalCode: patient.zip,
    }] : [],
  };

  return new Promise((resolve, reject) => {
    const body = JSON.stringify(fhirPatient);
    const url  = new URL(`${FHIR_BASE}/Patient/medcore-${patient.mrn}`);
    const options = {
      hostname: url.hostname,
      port: url.port || 8080,
      path: url.pathname,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ status: res.statusCode }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── SMART on FHIR metadata ────────────────────────────────────
app.get('/smart/metadata', (req, res) => {
  res.json({
    resourceType: 'CapabilityStatement',
    status: 'active',
    kind: 'capability',
    software: { name: 'MedCore Portal', version: '1.0.0' },
    implementation: { description: 'MedCore Patient Portal — MyChart equivalent' },
    rest: [{
      mode: 'server',
      security: {
        extension: [{
          url: 'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris',
          extension: [
            { url: 'authorize', valueUri: `${KEYCLOAK}/realms/medcore/protocol/openid-connect/auth` },
            { url: 'token',     valueUri: `${KEYCLOAK}/realms/medcore/protocol/openid-connect/token` },
          ],
        }],
        service: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/restful-security-service', code: 'SMART-on-FHIR' }] }],
      },
    }],
  });
});

// ── Patient lookup by MRN ─────────────────────────────────────
app.get('/patient/:mrn', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM adt.patients WHERE mrn=$1', [req.params.mrn]);
    if (!rows.length) return res.status(404).json({ error: 'Patient not found' });
    const patient = rows[0];

    // Sync to FHIR
    try { await syncPatientToFHIR(patient); } catch(e) { /* non-fatal */ }

    res.json({ patient });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Lab Results via FHIR ──────────────────────────────────────
app.get('/results/:mrn', async (req, res) => {
  try {
    // Get from our results service directly (more reliable than FHIR for now)
    const { rows: reports } = await pool.query(`
      SELECT r.*, array_agg(json_build_object(
        'name', o.observation_name, 'value', o.value_display,
        'units', o.units, 'flag', o.abnormal_flag, 'range', o.reference_range
      ) ORDER BY o.set_id) as observations
      FROM results.result_reports r
      LEFT JOIN results.observations o ON r.id=o.report_id
      WHERE r.patient_mrn=$1
      GROUP BY r.id
      ORDER BY r.received_time DESC LIMIT 20`, [req.params.mrn]);
    res.json({ results: reports });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Active Medications via FHIR ───────────────────────────────
app.get('/medications/:mrn', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM orders.orders
      WHERE patient_mrn=$1 AND order_type='MED' AND status NOT IN ('CANCELLED')
      ORDER BY ordered_at DESC`, [req.params.mrn]);
    res.json({ medications: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Problem List ──────────────────────────────────────────────
app.get('/problems/:mrn', async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM documentation.problems WHERE patient_mrn=$1 AND status='ACTIVE' ORDER BY noted_at DESC",
      [req.params.mrn]);
    res.json({ problems: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Allergies ─────────────────────────────────────────────────
app.get('/allergies/:mrn', async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM documentation.allergies WHERE patient_mrn=$1 AND status='ACTIVE' ORDER BY severity DESC",
      [req.params.mrn]);
    res.json({ allergies: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Upcoming Appointments ─────────────────────────────────────
app.get('/appointments/:mrn', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, p.first_name as prov_first, p.last_name as prov_last, p.specialty
      FROM scheduling.appointments a
      LEFT JOIN adt.providers p ON a.provider_id=p.id
      WHERE a.patient_mrn=$1 AND a.status NOT IN ('CANCELLED','NO_SHOW')
      ORDER BY a.start_time DESC LIMIT 10`, [req.params.mrn]);
    res.json({ appointments: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Vitals ────────────────────────────────────────────────────
app.get('/vitals/:mrn', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM documentation.vitals WHERE patient_mrn=$1 ORDER BY recorded_at DESC LIMIT 10',
      [req.params.mrn]);
    res.json({ vitals: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Clinical Notes (patient-visible) ─────────────────────────
app.get('/notes/:mrn', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, doc_id, note_type_name, title, content, author_name, signed_at
      FROM documentation.clinical_notes
      WHERE patient_mrn=$1 AND status='SIGNED'
      ORDER BY signed_at DESC LIMIT 10`, [req.params.mrn]);
    res.json({ notes: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── FHIR Patient resource ─────────────────────────────────────
app.get('/fhir/Patient/:mrn', async (req, res) => {
  try {
    const fhirData = await fhirFetch(`/Patient/medcore-${req.params.mrn}`);
    res.json(fhirData);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Summary (all data in one call) ───────────────────────────
app.get('/summary/:mrn', async (req, res) => {
  try {
    const mrn = req.params.mrn;
    const [patient, results, medications, problems, allergies, appointments, vitals] = await Promise.all([
      pool.query('SELECT * FROM adt.patients WHERE mrn=$1', [mrn]).then(r => r.rows[0]),
      pool.query(`SELECT r.*, COUNT(o.id) as obs_count,
        SUM(CASE WHEN o.abnormal_flag IN ('H','L','HH','LL') THEN 1 ELSE 0 END) as abnormal_count
        FROM results.result_reports r LEFT JOIN results.observations o ON r.id=o.report_id
        WHERE r.patient_mrn=$1 GROUP BY r.id ORDER BY r.received_time DESC LIMIT 5`, [mrn]).then(r => r.rows),
      pool.query("SELECT * FROM orders.orders WHERE patient_mrn=$1 AND order_type='MED' AND status NOT IN ('CANCELLED') ORDER BY ordered_at DESC LIMIT 5", [mrn]).then(r => r.rows),
      pool.query("SELECT * FROM documentation.problems WHERE patient_mrn=$1 AND status='ACTIVE'", [mrn]).then(r => r.rows),
      pool.query("SELECT * FROM documentation.allergies WHERE patient_mrn=$1 AND status='ACTIVE'", [mrn]).then(r => r.rows),
      pool.query(`SELECT a.*, p.first_name as prov_first, p.last_name as prov_last FROM scheduling.appointments a LEFT JOIN adt.providers p ON a.provider_id=p.id WHERE a.patient_mrn=$1 AND a.status NOT IN ('CANCELLED') ORDER BY a.start_time DESC LIMIT 3`, [mrn]).then(r => r.rows),
      pool.query('SELECT * FROM documentation.vitals WHERE patient_mrn=$1 ORDER BY recorded_at DESC LIMIT 1', [mrn]).then(r => r.rows[0]),
    ]);
    res.json({ patient, results, medications, problems, allergies, appointments, vitals });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/health', async (req, res) => {
  let db='ok'; try{await pool.query('SELECT 1');}catch{db='unavailable';}
  res.json({ status:'ok', service:'medcore-portal', version:'1.0.0', db });
});

app.listen(PORT, () => console.log(`
  ╔══════════════════════════════════════╗
  ║   MedCore Patient Portal — Module 8  ║
  ║   Port: ${PORT}                          ║
  ║   SMART on FHIR / MyChart equiv.     ║
  ╚══════════════════════════════════════╝`));
