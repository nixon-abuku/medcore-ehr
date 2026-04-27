import { useState, useEffect, useCallback } from 'react';

const API = '/api/adt';

// ── Helpers ──────────────────────────────────────────────────
function age(dob) {
  if (!dob) return '?';
  const d = new Date(dob);
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}
function fmt(dtStr) {
  if (!dtStr) return '—';
  return new Date(dtStr).toLocaleString();
}
function StatusBadge({ status }) {
  const map = {
    ADMITTED:    'bg-green-100 text-green-800',
    REGISTERED:  'bg-blue-100 text-blue-800',
    DISCHARGED:  'bg-gray-100 text-gray-600',
    CANCELLED:   'bg-red-100 text-red-700',
  };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>;
}

// ── Field Component (defined OUTSIDE RegisterForm — this prevents the focus bug) ──
function Field({ label, k, type='text', opts, required, form, set }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {opts
        ? <select value={form[k]} onChange={e => set(k, e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
            <option value="">Select…</option>
            {opts.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
          </select>
        : <input type={type} value={form[k]} onChange={e => set(k, e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
      }
    </div>
  );
}

// ── Register Patient Form ─────────────────────────────────────
function RegisterForm({ onSuccess, onCancel }) {
  const [form, setForm] = useState({
    first_name:'', middle_name:'', last_name:'', date_of_birth:'', sex:'',
    race:'', ethnicity:'', preferred_lang:'English', marital_status:'',
    address_line1:'', city:'', state:'', zip:'',
    phone_home:'', phone_mobile:'', email:'',
    payer_name:'', plan_name:'', member_id:'', group_number:'',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.first_name || !form.last_name || !form.date_of_birth || !form.sex) {
      setError('First name, last name, date of birth, and sex are required.'); return;
    }
    setLoading(true); setError('');
    try {
      const body = { ...form };
      if (form.payer_name && form.member_id) {
        body.coverages = [{ payer_name: form.payer_name, plan_name: form.plan_name, member_id: form.member_id, group_number: form.group_number, priority: 1 }];
      }
      const r = await fetch(`${API}/patients`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Registration failed');
      onSuccess(data.patient);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Register New Patient</h2>
          <p className="text-xs text-gray-400 mt-0.5">Creates a patient record and syncs to FHIR. In Epic this is done in Prelude.</p>
        </div>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-sm">✕ Cancel</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}

      {/* Demographics */}
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Demographics</h3>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Field label="First Name" k="first_name" required form={form} set={set} />
        <Field label="Middle Name" k="middle_name" form={form} set={set} />
        <Field label="Last Name" k="last_name" required form={form} set={set} />
        <Field label="Date of Birth" k="date_of_birth" type="date" required form={form} set={set} />
        <Field label="Sex" k="sex" required opts={[{value:'M',label:'Male'},{value:'F',label:'Female'},{value:'O',label:'Other'},{value:'U',label:'Unknown'}]} form={form} set={set} />
        <Field label="Marital Status" k="marital_status" opts={['Single','Married','Divorced','Widowed','Separated']} form={form} set={set} />
        <Field label="Race" k="race" opts={['White','Black or African American','Asian','American Indian or Alaska Native','Native Hawaiian or Pacific Islander','Other','Unknown']} form={form} set={set} />
        <Field label="Ethnicity" k="ethnicity" opts={['Not Hispanic or Latino','Hispanic or Latino','Unknown']} form={form} set={set} />
        <Field label="Preferred Language" k="preferred_lang" opts={['English','Spanish','French','Mandarin','Arabic','Portuguese','Other']} form={form} set={set} />
      </div>

      {/* Contact */}
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Address & Contact</h3>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="col-span-3"><Field label="Address Line 1" k="address_line1" form={form} set={set} /></div>
        <Field label="City" k="city" form={form} set={set} />
        <Field label="State" k="state" form={form} set={set} />
        <Field label="ZIP" k="zip" form={form} set={set} />
        <Field label="Phone (Home)" k="phone_home" form={form} set={set} />
        <Field label="Phone (Mobile)" k="phone_mobile" form={form} set={set} />
        <Field label="Email" k="email" type="email" form={form} set={set} />
      </div>

      {/* Insurance */}
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Primary Insurance</h3>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Field label="Payer Name" k="payer_name" form={form} set={set} />
        <Field label="Plan Name" k="plan_name" form={form} set={set} />
        <Field label="Member ID" k="member_id" form={form} set={set} />
        <Field label="Group Number" k="group_number" form={form} set={set} />
      </div>

      <div className="flex gap-3 pt-4 border-t border-gray-100">
        <button onClick={submit} disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
          {loading ? 'Registering…' : 'Register Patient'}
        </button>
        <button onClick={onCancel} className="px-6 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
      </div>
    </div>
  );
}

// ── Patient Search ────────────────────────────────────────────
function PatientSearch({ onSelect }) {
  const [q, setQ]           = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (val) => {
    if (!val || val.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/patients?q=${encodeURIComponent(val)}&limit=10`);
      const d = await r.json();
      setResults(d.patients || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(q), 300);
    return () => clearTimeout(t);
  }, [q, search]);

  return (
    <div className="relative">
      <input
        value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or MRN…"
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
      />
      {loading && <div className="absolute right-3 top-2.5 text-gray-400 text-xs">Searching…</div>}
      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
          {results.map(p => (
            <button key={p.id} onClick={() => { onSelect(p); setQ(''); setResults([]); }}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors">
              <div className="font-medium text-sm text-gray-900">{p.last_name}, {p.first_name}</div>
              <div className="text-xs text-gray-400">MRN: {p.mrn} · DOB: {p.date_of_birth?.substring(0,10)} · Age {age(p.date_of_birth)} · {p.sex}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Admit Dialog ──────────────────────────────────────────────
function AdmitDialog({ patient, onSuccess, onCancel }) {
  const [locations, setLocations] = useState([]);
  const [providers, setProviders] = useState([]);
  const [form, setForm] = useState({ encounter_type:'INPATIENT', location_id:'', attending_id:'', admit_source:'PHYSICIAN_REFERRAL', financial_class:'COMMERCIAL', chief_complaint:'', admitting_dx:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    fetch(`${API}/encounters/locations/available`).then(r => r.json()).then(d => setLocations(d.locations || []));
    fetch(`${API}/encounters/providers/list`).then(r => r.json()).then(d => setProviders(d.providers || []));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}/encounters/admit`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ mrn: patient.mrn, ...form, location_id: form.location_id || null, attending_id: form.attending_id || null })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      onSuccess(data);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 max-w-lg w-full">
      <h3 className="font-bold text-gray-900 mb-1">Admit Patient</h3>
      <p className="text-xs text-gray-400 mb-4">
        {patient.first_name} {patient.last_name} · MRN: {patient.mrn}
        <span className="ml-2 text-blue-500 font-medium">→ Fires ADT^A01</span>
      </p>
      {error && <div className="bg-red-50 text-red-700 text-xs rounded-lg px-3 py-2 mb-3">{error}</div>}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Encounter Type</label>
          <select value={form.encounter_type} onChange={e => set('encounter_type', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="INPATIENT">Inpatient</option>
            <option value="OBSERVATION">Observation</option>
            <option value="EMERGENCY">Emergency</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Bed Assignment</label>
          <select value={form.location_id} onChange={e => set('location_id', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">No bed assigned</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.unit} — Room {l.room} Bed {l.bed}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Attending Physician</label>
          <select value={form.attending_id} onChange={e => set('attending_id', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Select attending…</option>
            {providers.map(p => <option key={p.id} value={p.id}>Dr. {p.first_name} {p.last_name} — {p.specialty}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Admit Source</label>
          <select value={form.admit_source} onChange={e => set('admit_source', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
            {['PHYSICIAN_REFERRAL','EMERGENCY','TRANSFER','CLINIC','DIRECT'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Financial Class</label>
          <select value={form.financial_class} onChange={e => set('financial_class', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
            {['COMMERCIAL','MEDICARE','MEDICAID','SELF_PAY','WORKERS_COMP'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Chief Complaint</label>
          <input value={form.chief_complaint} onChange={e => set('chief_complaint', e.target.value)}
            placeholder="e.g. Chest pain, shortness of breath"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Admitting Diagnosis</label>
          <input value={form.admitting_dx} onChange={e => set('admitting_dx', e.target.value)}
            placeholder="e.g. R06.00 — Dyspnea, unspecified"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="flex gap-3 mt-5">
        <button onClick={submit} disabled={loading} className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm">
          {loading ? 'Admitting…' : 'Admit Patient → Send A01'}
        </button>
        <button onClick={onCancel} className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
      </div>
    </div>
  );
}

// ── HL7 Viewer ────────────────────────────────────────────────
function HL7Viewer({ csn }) {
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch(`${API}/encounters/${csn}/hl7`).then(r => r.json()).then(d => {
      setEvents(d.hl7_events || []);
      if (d.hl7_events?.[0]) setSelected(d.hl7_events[0]);
    });
  }, [csn]);

  if (!events.length) return <div className="text-xs text-gray-400 p-3">No HL7 events yet for this encounter.</div>;

  const segments = selected?.hl7_message?.split('\r').filter(Boolean) || [];

  return (
    <div className="bg-gray-950 rounded-xl overflow-hidden">
      <div className="flex gap-2 p-3 border-b border-gray-800 overflow-x-auto">
        {events.map((e, i) => (
          <button key={i} onClick={() => setSelected(e)}
            className={`text-xs px-3 py-1 rounded-full whitespace-nowrap font-mono ${selected === e ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
            {e.event_type}
          </button>
        ))}
      </div>
      <div className="p-4 font-mono text-xs overflow-x-auto">
        {segments.map((seg, i) => {
          const type = seg.substring(0, 3);
          const colors = { MSH:'text-yellow-300', EVN:'text-purple-300', PID:'text-green-300', PV1:'text-blue-300' };
          const fields = seg.split('|');
          return (
            <div key={i} className="mb-1.5">
              <span className={`font-bold ${colors[type] || 'text-gray-300'}`}>{fields[0]}</span>
              <span className="text-gray-500">|</span>
              <span className="text-gray-300">{fields.slice(1).join('|')}</span>
            </div>
          );
        })}
        <div className="mt-3 pt-3 border-t border-gray-800 text-gray-500 text-xs">
          Sent: {fmt(selected?.sent_at)}
        </div>
      </div>
    </div>
  );
}

// ── Census View ───────────────────────────────────────────────
function Census({ onDischarge, onViewHL7 }) {
  const [census, setCensus] = useState([]);

  const load = async () => {
    const r = await fetch(`${API}/encounters/census`);
    const d = await r.json();
    setCensus(d.census || []);
  };

  useEffect(() => { load(); }, []);

  const units = [...new Set(census.map(e => e.unit || 'Unassigned'))].sort();

  if (!census.length) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
      <div className="text-4xl mb-3">🛏</div>
      <p className="text-gray-500 text-sm">No admitted patients. Use Admit to add the first one.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {units.map(unit => (
        <div key={unit} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
            <h3 className="font-semibold text-blue-900 text-sm">{unit}</h3>
            <span className="text-xs text-blue-500">{census.filter(e => (e.unit || 'Unassigned') === unit).length} patients</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left px-5 py-2">Patient</th>
                <th className="text-left px-5 py-2">MRN</th>
                <th className="text-left px-5 py-2">Bed</th>
                <th className="text-left px-5 py-2">Attending</th>
                <th className="text-left px-5 py-2">Admitted</th>
                <th className="text-left px-5 py-2">CSN</th>
                <th className="px-5 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {census.filter(e => (e.unit || 'Unassigned') === unit).map(enc => (
                <tr key={enc.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{enc.last_name}, {enc.first_name} <span className="text-gray-400 font-normal">· {age(enc.date_of_birth)}y {enc.sex}</span></td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{enc.mrn}</td>
                  <td className="px-5 py-3 text-gray-600">{enc.room}/{enc.bed || '—'}</td>
                  <td className="px-5 py-3 text-gray-600">{enc.prov_last ? `Dr. ${enc.prov_last}` : '—'}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{fmt(enc.admit_datetime)}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-400">{enc.csn}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => onViewHL7(enc.csn)} className="text-xs text-blue-600 hover:underline">HL7</button>
                      <button onClick={() => onDischarge(enc)} className="text-xs text-orange-600 hover:underline">Discharge</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// ── Message Log ───────────────────────────────────────────────
function MessageLog() {
  const [msgs, setMsgs] = useState([]);

  useEffect(() => {
    const load = async () => {
      const r = await fetch(`${API}/messages?limit=20`);
      const d = await r.json();
      setMsgs(d.messages || []);
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm">HL7 Message Log</h3>
        <span className="text-xs text-gray-400">Auto-refreshes every 5s</span>
      </div>
      {!msgs.length
        ? <div className="p-6 text-center text-xs text-gray-400">No messages yet. Register a patient to generate the first one.</div>
        : <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wide">
                <th className="text-left px-5 py-2">Type</th>
                <th className="text-left px-5 py-2">Direction</th>
                <th className="text-left px-5 py-2">MRN</th>
                <th className="text-left px-5 py-2">Status</th>
                <th className="text-left px-5 py-2">Time</th>
              </tr></thead>
              <tbody>
                {msgs.map(m => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-2 font-mono font-semibold text-blue-700">{m.message_type}</td>
                    <td className="px-5 py-2 text-gray-500">{m.direction}</td>
                    <td className="px-5 py-2 font-mono text-gray-600">{m.patient_mrn || '—'}</td>
                    <td className="px-5 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.status === 'SENT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{m.status}</span>
                    </td>
                    <td className="px-5 py-2 text-gray-400">{fmt(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      }
    </div>
  );
}

// ── Main ADT Page ─────────────────────────────────────────────
export default function ADTModule() {
  const [view, setView]       = useState('census');
  const [admitPatient, setAdmitPatient] = useState(null);
  const [hl7CSN, setHL7CSN]   = useState(null);
  const [toast, setToast]     = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  const handleDischarge = async (enc) => {
    if (!window.confirm(`Discharge ${enc.first_name} ${enc.last_name}? This sends ADT^A03.`)) return;
    const r = await fetch(`${API}/encounters/${enc.csn}/discharge`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ discharge_disp:'HOME' })
    });
    if (r.ok) { showToast(`✅ ${enc.first_name} ${enc.last_name} discharged — ADT^A03 sent`); }
  };

  const tabs = [
    { id:'census',   label:'Census',           icon:'🛏' },
    { id:'register', label:'Register Patient',  icon:'➕' },
    { id:'search',   label:'Patient Search',    icon:'🔍' },
    { id:'log',      label:'Message Log',       icon:'📡' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center gap-3 mb-4">
          <a href="/" className="text-gray-400 hover:text-gray-600 text-sm">← MedCore</a>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-700">Registration / ADT</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-2">Module 1</span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Registration & ADT</h1>
            <p className="text-sm text-gray-500 mt-0.5">Patient identity · Admit · Discharge · Transfer · HL7 v2 ADT messages</p>
          </div>
          <div className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <span className="font-semibold text-gray-600">Epic equivalent:</span> Prelude / ADT module
          </div>
        </div>
        <div className="flex gap-1 mt-4">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setView(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === t.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toast */}
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm rounded-xl px-5 py-3 shadow-xl">{toast}</div>}

      {/* Admit Dialog */}
      {admitPatient && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <AdmitDialog
            patient={admitPatient}
            onCancel={() => setAdmitPatient(null)}
            onSuccess={(data) => { setAdmitPatient(null); showToast(`✅ Admitted — ADT^A01 sent · CSN: ${data.encounter.csn}`); setView('census'); }}
          />
        </div>
      )}

      {/* HL7 Viewer Dialog */}
      {hl7CSN && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4">
          <div className="bg-gray-950 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div>
                <h3 className="text-white font-semibold text-sm">HL7 Message Viewer</h3>
                <p className="text-gray-400 text-xs">CSN: {hl7CSN}</p>
              </div>
              <button onClick={() => setHL7CSN(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto"><HL7Viewer csn={hl7CSN} /></div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-6xl mx-auto px-8 py-6">
        {view === 'census' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Inpatient Census</h2>
              <button onClick={() => setView('search')} className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl">
                + Admit Patient
              </button>
            </div>
            <Census
              onDischarge={handleDischarge}
              onViewHL7={(csn) => setHL7CSN(csn)}
            />
          </>
        )}

        {view === 'register' && (
          <RegisterForm
            onSuccess={(patient) => { showToast(`✅ Registered: ${patient.first_name} ${patient.last_name} · MRN: ${patient.mrn}`); setView('census'); }}
            onCancel={() => setView('census')}
          />
        )}

        {view === 'search' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-900 mb-1">Patient Search</h2>
            <p className="text-xs text-gray-400 mb-4">Search by name or MRN. Select a patient to admit or view their record.</p>
            <PatientSearch
              onSelect={(patient) => setAdmitPatient(patient)}
            />
            <p className="text-xs text-gray-400 mt-3">💡 After selecting a patient, you can admit them (ADT^A01) or register an outpatient visit (ADT^A04).</p>
          </div>
        )}

        {view === 'log' && (
          <>
            <div className="mb-4">
              <h2 className="font-semibold text-gray-900">HL7 Message Log</h2>
              <p className="text-xs text-gray-400 mt-0.5">Every ADT event that flows through MedCore is logged here. In real hospitals, integration teams monitor this constantly.</p>
            </div>
            <MessageLog />
          </>
        )}
      </div>
    </div>
  );
}
