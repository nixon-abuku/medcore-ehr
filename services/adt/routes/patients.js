const express = require('express');
const router  = express.Router();
const { buildA08 } = require('../hl7/builder');
const { syncPatient } = require('../fhir/sync');

module.exports = (pool, sendHL7) => {

  // ── GET /patients — search / list ──────────────────────────
  router.get('/', async (req, res) => {
    try {
      const { q, mrn, dob, limit = 20, offset = 0 } = req.query;
      let query = 'SELECT * FROM adt.patients WHERE is_active = true';
      const params = [];

      if (mrn) {
        params.push(mrn);
        query += ` AND mrn = $${params.length}`;
      } else if (q) {
        params.push(`%${q}%`);
        query += ` AND (LOWER(first_name || ' ' || last_name) LIKE LOWER($${params.length}) OR mrn LIKE $${params.length})`;
      }
      if (dob) {
        params.push(dob);
        query += ` AND date_of_birth = $${params.length}`;
      }

      params.push(Number(limit), Number(offset));
      query += ` ORDER BY last_name, first_name LIMIT $${params.length - 1} OFFSET $${params.length}`;

      const result = await pool.query(query, params);
      res.json({ patients: result.rows, total: result.rowCount });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /patients/:mrn ─────────────────────────────────────
  router.get('/:mrn', async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM adt.patients WHERE mrn = $1', [req.params.mrn]
      );
      if (!rows.length) return res.status(404).json({ error: 'Patient not found' });

      // Also get encounters
      const enc = await pool.query(
        `SELECT e.*, l.unit, l.room, l.bed, p.first_name as prov_first, p.last_name as prov_last
         FROM adt.encounters e
         LEFT JOIN adt.locations l ON e.location_id = l.id
         LEFT JOIN adt.providers p ON e.attending_id = p.id
         WHERE e.patient_id = $1
         ORDER BY e.created_at DESC LIMIT 10`,
        [rows[0].id]
      );

      // Also get coverages
      const cov = await pool.query(
        'SELECT * FROM adt.coverages WHERE patient_id = $1 ORDER BY priority',
        [rows[0].id]
      );

      res.json({ patient: rows[0], encounters: enc.rows, coverages: cov.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /patients — register new patient ──────────────────
  router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const {
        first_name, middle_name, last_name, date_of_birth, sex,
        race, ethnicity, marital_status, preferred_lang,
        address_line1, address_line2, city, state, zip,
        phone_home, phone_mobile, phone_work, email,
        ssn_last4, coverages = []
      } = req.body;

      // Insert patient
      const { rows } = await client.query(`
        INSERT INTO adt.patients
          (first_name, middle_name, last_name, date_of_birth, sex,
           race, ethnicity, marital_status, preferred_lang,
           address_line1, address_line2, city, state, zip,
           phone_home, phone_mobile, phone_work, email, ssn_last4)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        RETURNING *`,
        [first_name, middle_name, last_name, date_of_birth, sex,
         race, ethnicity, marital_status, preferred_lang || 'English',
         address_line1, address_line2, city, state, zip,
         phone_home, phone_mobile, phone_work, email, ssn_last4]
      );

      const patient = rows[0];

      // Insert coverages
      for (const cov of coverages) {
        await client.query(`
          INSERT INTO adt.coverages (patient_id, payer_name, plan_name, member_id, group_number, priority, subscriber_name)
          VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [patient.id, cov.payer_name, cov.plan_name, cov.member_id, cov.group_number, cov.priority || 1, cov.subscriber_name]
        );
      }

      // Sync to FHIR
      try {
        const fhirId = await syncPatient(patient);
        await client.query('UPDATE adt.patients SET fhir_id = $1 WHERE id = $2', [fhirId, patient.id]);
        patient.fhir_id = fhirId;
      } catch (fhirErr) {
        console.warn('FHIR sync failed (non-fatal):', fhirErr.message);
      }

      await client.query('COMMIT');

      // Log the registration
      await pool.query(`
        INSERT INTO integration.message_log (message_type, direction, channel_name, patient_mrn, status)
        VALUES ('PATIENT_REGISTRATION', 'OUTBOUND', 'ADT_Module', $1, 'SENT')`,
        [patient.mrn]
      );

      res.status(201).json({ patient });
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') return res.status(409).json({ error: 'Patient already exists' });
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // ── PUT /patients/:mrn — update demographics ────────────────
  router.put('/:mrn', async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const fields = ['phone_home','phone_mobile','phone_work','email',
                      'address_line1','address_line2','city','state','zip',
                      'preferred_lang','marital_status'];
      const updates = [];
      const values  = [];

      for (const f of fields) {
        if (req.body[f] !== undefined) {
          values.push(req.body[f]);
          updates.push(`${f} = $${values.length}`);
        }
      }

      if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

      values.push(req.params.mrn);
      updates.push(`updated_at = NOW()`);

      const { rows } = await client.query(
        `UPDATE adt.patients SET ${updates.join(', ')} WHERE mrn = $${values.length} RETURNING *`,
        values
      );

      if (!rows.length) return res.status(404).json({ error: 'Patient not found' });

      const patient = rows[0];

      // Get active encounter for A08
      const enc = await client.query(
        `SELECT e.*, l.*, prov.* FROM adt.encounters e
         LEFT JOIN adt.locations l ON e.location_id = l.id
         LEFT JOIN adt.providers prov ON e.attending_id = prov.id
         WHERE e.patient_id = $1 AND e.encounter_status IN ('REGISTERED','ADMITTED')
         ORDER BY e.created_at DESC LIMIT 1`,
        [patient.id]
      );

      // Fire ADT^A08 — update patient info
      if (enc.rows.length) {
        const msg = buildA08(patient, enc.rows[0], enc.rows[0], enc.rows[0]);
        await sendHL7(msg, patient.mrn, 'ADT^A08');
      }

      // Sync to FHIR
      try { await syncPatient(patient); } catch (e) { console.warn('FHIR A08 sync failed:', e.message); }

      await client.query('COMMIT');
      res.json({ patient });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  return router;
};
