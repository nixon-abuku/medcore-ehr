const express = require('express');
const router  = express.Router();
const { buildA01, buildA03, buildA04, buildA11 } = require('../hl7/builder');
const { syncEncounter } = require('../fhir/sync');

module.exports = (pool, sendHL7) => {

  // ── GET /encounters — list encounters ──────────────────────
  router.get('/', async (req, res) => {
    try {
      const { status, type, limit = 25 } = req.query;
      let query = `
        SELECT e.*, p.mrn, p.first_name, p.last_name, p.date_of_birth, p.sex,
               l.unit, l.room, l.bed,
               prov.first_name as prov_first, prov.last_name as prov_last, prov.specialty
        FROM adt.encounters e
        JOIN adt.patients p ON e.patient_id = p.id
        LEFT JOIN adt.locations l ON e.location_id = l.id
        LEFT JOIN adt.providers prov ON e.attending_id = prov.id
        WHERE 1=1`;
      const params = [];

      if (status) { params.push(status); query += ` AND e.encounter_status = $${params.length}`; }
      if (type)   { params.push(type);   query += ` AND e.encounter_type = $${params.length}`; }

      params.push(Number(limit));
      query += ` ORDER BY e.created_at DESC LIMIT $${params.length}`;

      const { rows } = await pool.query(query, params);
      res.json({ encounters: rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /encounters/census — inpatient census ──────────────
  router.get('/census', async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT e.*, p.mrn, p.first_name, p.last_name, p.date_of_birth, p.sex,
               l.unit, l.room, l.bed,
               prov.first_name as prov_first, prov.last_name as prov_last
        FROM adt.encounters e
        JOIN adt.patients p ON e.patient_id = p.id
        LEFT JOIN adt.locations l ON e.location_id = l.id
        LEFT JOIN adt.providers prov ON e.attending_id = prov.id
        WHERE e.encounter_status = 'ADMITTED'
        ORDER BY l.unit, l.room, l.bed`
      );
      res.json({ census: rows, count: rows.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /encounters/admit — ADT^A01 ───────────────────────
  router.post('/admit', async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { mrn, encounter_type = 'INPATIENT', location_id, attending_id,
              admit_source, financial_class, chief_complaint, admitting_dx } = req.body;

      const pat = await client.query('SELECT * FROM adt.patients WHERE mrn = $1', [mrn]);
      if (!pat.rows.length) return res.status(404).json({ error: 'Patient not found' });
      const patient = pat.rows[0];

      // Mark bed occupied
      if (location_id) {
        await client.query(
          "UPDATE adt.locations SET bed_status = 'OCCUPIED' WHERE id = $1", [location_id]
        );
      }

      // Create encounter
      const encResult = await client.query(`
        INSERT INTO adt.encounters
          (patient_id, encounter_type, encounter_status, admit_datetime,
           location_id, attending_id, admit_source, financial_class,
           chief_complaint, admitting_dx, account_number)
        VALUES ($1,$2,'ADMITTED',NOW(),$3,$4,$5,$6,$7,$8,'ACC'||nextval('adt.csn_seq'))
        RETURNING *`,
        [patient.id, encounter_type, location_id, attending_id,
         admit_source, financial_class, chief_complaint, admitting_dx]
      );
      const encounter = encResult.rows[0];

      // Get location + provider details for HL7
      const loc  = location_id ? (await client.query('SELECT * FROM adt.locations WHERE id = $1', [location_id])).rows[0] : null;
      const prov = attending_id ? (await client.query('SELECT * FROM adt.providers WHERE id = $1', [attending_id])).rows[0] : null;

      // Build and send ADT^A01
      const hl7Msg = buildA01(patient, encounter, loc, prov);
      await sendHL7(hl7Msg, patient.mrn, 'ADT^A01');

      // Log ADT event
      await client.query(`
        INSERT INTO adt.adt_events (encounter_id, patient_id, event_type, event_desc, to_location, hl7_message)
        VALUES ($1,$2,'A01','Patient admitted',$3,$4)`,
        [encounter.id, patient.id, location_id, hl7Msg]
      );

      // Sync to FHIR
      try {
        const fhirEncId = await syncEncounter(encounter, patient, prov, loc);
        await client.query('UPDATE adt.encounters SET fhir_encounter_id = $1 WHERE id = $2', [fhirEncId, encounter.id]);
      } catch (e) { console.warn('FHIR Encounter sync failed:', e.message); }

      await client.query('COMMIT');
      res.status(201).json({ encounter, hl7_message: hl7Msg });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // ── POST /encounters/register — ADT^A04 (outpatient) ───────
  router.post('/register', async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { mrn, encounter_type = 'OUTPATIENT', location_id, attending_id,
              financial_class, chief_complaint, visit_reason } = req.body;

      const pat = await client.query('SELECT * FROM adt.patients WHERE mrn = $1', [mrn]);
      if (!pat.rows.length) return res.status(404).json({ error: 'Patient not found' });
      const patient = pat.rows[0];

      const encResult = await client.query(`
        INSERT INTO adt.encounters
          (patient_id, encounter_type, encounter_status, admit_datetime,
           location_id, attending_id, financial_class, chief_complaint, visit_reason)
        VALUES ($1,$2,'REGISTERED',NOW(),$3,$4,$5,$6,$7)
        RETURNING *`,
        [patient.id, encounter_type, location_id, attending_id, financial_class, chief_complaint, visit_reason]
      );
      const encounter = encResult.rows[0];

      const loc  = location_id  ? (await client.query('SELECT * FROM adt.locations WHERE id = $1', [location_id])).rows[0]  : null;
      const prov = attending_id ? (await client.query('SELECT * FROM adt.providers WHERE id = $1', [attending_id])).rows[0] : null;

      const hl7Msg = buildA04(patient, encounter, loc, prov);
      await sendHL7(hl7Msg, patient.mrn, 'ADT^A04');

      await client.query(`
        INSERT INTO adt.adt_events (encounter_id, patient_id, event_type, event_desc, hl7_message)
        VALUES ($1,$2,'A04','Outpatient registered',$3)`,
        [encounter.id, patient.id, hl7Msg]
      );

      try {
        const fhirEncId = await syncEncounter(encounter, patient, prov, loc);
        await client.query('UPDATE adt.encounters SET fhir_encounter_id = $1 WHERE id = $2', [fhirEncId, encounter.id]);
      } catch (e) { console.warn('FHIR sync failed:', e.message); }

      await client.query('COMMIT');
      res.status(201).json({ encounter, hl7_message: hl7Msg });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // ── POST /encounters/:csn/discharge — ADT^A03 ──────────────
  router.post('/:csn/discharge', async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { discharge_disp = 'HOME' } = req.body;

      const encResult = await client.query(
        'SELECT * FROM adt.encounters WHERE csn = $1', [req.params.csn]
      );
      if (!encResult.rows.length) return res.status(404).json({ error: 'Encounter not found' });
      let encounter = encResult.rows[0];

      await client.query(`
        UPDATE adt.encounters
        SET encounter_status = 'DISCHARGED', discharge_datetime = NOW(), discharge_disp = $1, updated_at = NOW()
        WHERE csn = $2`,
        [discharge_disp, req.params.csn]
      );

      // Free the bed
      if (encounter.location_id) {
        await client.query(
          "UPDATE adt.locations SET bed_status = 'CLEANING' WHERE id = $1", [encounter.location_id]
        );
      }

      encounter = { ...encounter, encounter_status: 'DISCHARGED', discharge_datetime: new Date(), discharge_disp };

      const pat  = (await client.query('SELECT * FROM adt.patients WHERE id = $1', [encounter.patient_id])).rows[0];
      const loc  = encounter.location_id ? (await client.query('SELECT * FROM adt.locations WHERE id = $1', [encounter.location_id])).rows[0] : null;
      const prov = encounter.attending_id ? (await client.query('SELECT * FROM adt.providers WHERE id = $1', [encounter.attending_id])).rows[0] : null;

      const hl7Msg = buildA03(pat, encounter, loc, prov);
      await sendHL7(hl7Msg, pat.mrn, 'ADT^A03');

      await client.query(`
        INSERT INTO adt.adt_events (encounter_id, patient_id, event_type, event_desc, from_location, hl7_message)
        VALUES ($1,$2,'A03','Patient discharged',$3,$4)`,
        [encounter.id, pat.id, encounter.location_id, hl7Msg]
      );

      try { await syncEncounter(encounter, pat, prov, loc); } catch (e) {}

      await client.query('COMMIT');
      res.json({ encounter, hl7_message: hl7Msg });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // ── POST /encounters/:csn/cancel — ADT^A11 ─────────────────
  router.post('/:csn/cancel', async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const encResult = await client.query('SELECT * FROM adt.encounters WHERE csn = $1', [req.params.csn]);
      if (!encResult.rows.length) return res.status(404).json({ error: 'Encounter not found' });
      const encounter = encResult.rows[0];

      await client.query(
        "UPDATE adt.encounters SET encounter_status = 'CANCELLED', updated_at = NOW() WHERE csn = $1",
        [req.params.csn]
      );

      if (encounter.location_id) {
        await client.query("UPDATE adt.locations SET bed_status = 'AVAILABLE' WHERE id = $1", [encounter.location_id]);
      }

      const pat  = (await client.query('SELECT * FROM adt.patients WHERE id = $1', [encounter.patient_id])).rows[0];
      const loc  = encounter.location_id ? (await client.query('SELECT * FROM adt.locations WHERE id = $1', [encounter.location_id])).rows[0] : null;
      const prov = encounter.attending_id ? (await client.query('SELECT * FROM adt.providers WHERE id = $1', [encounter.attending_id])).rows[0] : null;

      const hl7Msg = buildA11(pat, encounter, loc, prov);
      await sendHL7(hl7Msg, pat.mrn, 'ADT^A11');

      await client.query(`
        INSERT INTO adt.adt_events (encounter_id, patient_id, event_type, event_desc, hl7_message)
        VALUES ($1,$2,'A11','Admit cancelled',$3)`,
        [encounter.id, pat.id, hl7Msg]
      );

      await client.query('COMMIT');
      res.json({ message: 'Encounter cancelled', hl7_message: hl7Msg });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // ── GET /encounters/:csn/hl7 — view raw HL7 message ────────
  router.get('/:csn/hl7', async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT hl7_message, event_type, sent_at FROM adt.adt_events WHERE encounter_id = (SELECT id FROM adt.encounters WHERE csn = $1) ORDER BY sent_at DESC',
        [req.params.csn]
      );
      res.json({ hl7_events: rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /encounters/locations — available beds ──────────────
  router.get('/locations/available', async (req, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM adt.locations WHERE bed_status = 'AVAILABLE' ORDER BY unit, room, bed"
      );
      res.json({ locations: rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /encounters/providers ───────────────────────────────
  router.get('/providers/list', async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM adt.providers WHERE active = true ORDER BY last_name');
      res.json({ providers: rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
