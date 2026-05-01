import { useState, useEffect, useCallback } from 'react';
import { Eye, Search, ChevronDown, RefreshCw, CheckCircle, AlertCircle, Activity } from 'lucide-react';

const API = '/api/adt';

// ── Helpers ──────────────────────────────────────────────────
function age(dob) {
  if (!dob) return '?';
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}
function fmt(dtStr) {
  if (!dtStr) return '—';
  return new Date(dtStr).toLocaleString();
}
function fmtShort(dtStr) {
  if (!dtStr) return '';
  const diff = Math.floor((Date.now() - new Date(dtStr).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return diff + 'm ago';
  if (diff < 1440) return Math.floor(diff / 60) + 'h ago';
  return Math.floor(diff / 1440) + 'd ago';
}

const UNIT_CAPACITY = { '4 WEST': 8, 'EMERGENCY': 5, 'ICU': 4, 'PEDIATRICS': 6 };

const MSG_TYPE_INFO = {
  'ADT^A01': { label: 'A01 - Admit',     color: 'bg-blue-500'   },
  'ADT^A03': { label: 'A03 - Discharge', color: 'bg-orange-500' },
  'ADT^A08': { label: 'A08 - Update',    color: 'bg-purple-500' },
  'ADT^A02': { label: 'A02 - Transfer',  color: 'bg-indigo-500' },
  'ADT^A04': { label: 'A04 - Register',  color: 'bg-green-500'  },
  'ADT^A11': { label: 'A11 - Cancel',    color: 'bg-red-500'    },
  'ORM^O01': { label: 'ORM - Order',     color: 'bg-teal-500'   },
  'ORU^R01': { label: 'ORU - Result',    color: 'bg-amber-500'  },
};

// ── Field Component ──────────────────────────────────────────
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
  const [q, setQ]             = useState('');
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
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or MRN…"
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
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

// ── Update Demographics Dialog (fires ADT^A08) ────────────────
function UpdateDemographicsDialog({ patient, onSuccess, onCancel }) {
  const [form, setForm] = useState({
    phone_home:    patient.phone_home    || '',
    phone_mobile:  patient.phone_mobile  || '',
    phone_work:    patient.phone_work    || '',
    email:         patient.email         || '',
    address_line1: patient.address_line1 || '',
    address_line2: patient.address_line2 || '',
    city:          patient.city          || '',
    state:         patient.state         || '',
    zip:           patient.zip           || '',
    marital_status:patient.marital_status|| '',
    preferred_lang:patient.preferred_lang|| 'English',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}/patients/${patient.mrn}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Update failed');
      onSuccess(data.patient);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 max-w-lg w-full">
      <h3 className="font-bold text-gray-900 mb-1">Update Demographics</h3>
      <p className="text-xs text-gray-400 mb-4">
        {patient.first_name} {patient.last_name} · MRN: {patient.mrn}
        <span className="ml-2 text-purple-600 font-medium">→ Fires ADT^A08</span>
      </p>
      {error && <div className="bg-red-50 text-red-700 text-xs rounded-lg px-3 py-2 mb-3">{error}</div>}
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Contact</h4>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="Phone (Home)"   k="phone_home"   form={form} set={set} />
        <Field label="Phone (Mobile)" k="phone_mobile" form={form} set={set} />
        <Field label="Phone (Work)"   k="phone_work"   form={form} set={set} />
        <Field label="Email"          k="email" type="email" form={form} set={set} />
      </div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Address</h4>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="col-span-3"><Field label="Address Line 1" k="address_line1" form={form} set={set} /></div>
        <div className="col-span-3"><Field label="Address Line 2" k="address_line2" form={form} set={set} /></div>
        <Field label="City"  k="city"  form={form} set={set} />
        <Field label="State" k="state" form={form} set={set} />
        <Field label="ZIP"   k="zip"   form={form} set={set} />
      </div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Other</h4>
      <div className="grid grid-cols-2 gap-3 mb-5">
        <Field label="Marital Status" k="marital_status" opts={['Single','Married','Divorced','Widowed','Separated']} form={form} set={set} />
        <Field label="Preferred Language" k="preferred_lang" opts={['English','Spanish','French','Mandarin','Arabic','Portuguese','Other']} form={form} set={set} />
      </div>
      <div className="flex gap-3">
        <button onClick={submit} disabled={loading}
          className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm">
          {loading ? 'Updating…' : 'Save & Send A08'}
        </button>
        <button onClick={onCancel} className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
      </div>
    </div>
  );
}

// ── HL7 Viewer ────────────────────────────────────────────────
function HL7Viewer({ csn }) {
  const [events, setEvents]     = useState([]);
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
        <div className="mt-3 pt-3 border-t border-gray-800 text-gray-500 text-xs">Sent: {fmt(selected?.sent_at)}</div>
      </div>
    </div>
  );
}

// ── Message Log ───────────────────────────────────────────────
function MessageLog({ onSelect }) {
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
        ? <div className="p-6 text-center text-xs text-gray-400">No messages yet.</div>
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
                  <tr key={m.id} onClick={() => onSelect(m)} className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer">
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

// ── ADT Right Rail ────────────────────────────────────────────
function ADTRightRail({ messages }) {
  const recentADT = messages
    .filter(m => m.message_type?.startsWith('ADT'))
    .slice(0, 6);

  const interfaceItems = [
    { label: 'Mirth Connect',    ok: true },
    { label: 'FHIR Server (R4)', ok: true },
    { label: 'Keycloak',         ok: true },
    { label: 'Interface Engine', ok: true },
  ];

  return (
    <div className="w-72 flex-shrink-0 space-y-4">
      {/* Recent ADT Messages */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-900">Recent ADT Messages</h3>
          <button className="text-[10px] text-blue-600 hover:underline">View all</button>
        </div>
        {recentADT.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <RefreshCw className="w-4 h-4 text-gray-300 animate-spin mx-auto mb-2" />
            <p className="text-xs text-gray-400">Loading...</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentADT.map((m, i) => {
              const info = MSG_TYPE_INFO[m.message_type] || { label: m.message_type, color: 'bg-gray-500' };
              const isOk = m.status === 'SENT' || m.status === 'RECEIVED';
              return (
                <div key={i} className="px-4 py-3 flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${isOk ? 'bg-green-500' : 'bg-red-400'}`}></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-900">{info.label}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                      MRN: {m.patient_mrn || '—'} · {m.direction}
                    </div>
                    <div className="text-[9px] text-gray-400 mt-0.5">{fmtShort(m.created_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="px-4 py-2.5 border-t border-gray-100">
          <p className="text-[10px] text-gray-400">
            View message log →
          </p>
        </div>
      </div>

      {/* ADT Interface Health */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-900">ADT Interface Health</h3>
          <button className="text-[10px] text-blue-600 hover:underline">View all</button>
        </div>
        <div className="divide-y divide-gray-50">
          {interfaceItems.map(({ label, ok }) => (
            <div key={label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-gray-600">{label}</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                <span className="text-[10px] font-medium text-green-600">Connected</span>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-2.5 border-t border-gray-50 bg-gray-50">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-green-500" />
            <span className="text-[10px] text-green-600 font-medium">All interfaces operational</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Census View (polished) ────────────────────────────────────
function Census({ onDischarge, onViewHL7, onUpdate, messages }) {
  const [census, setCensus]         = useState([]);
  const [searchQ, setSearchQ]       = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]             = useState(1);
  const PAGE_SIZE = 20;

  const load = async () => {
    const r = await fetch(`${API}/encounters/census`);
    const d = await r.json();
    setCensus(d.census || []);
  };
  useEffect(() => { load(); }, []);

  const units = [...new Set(census.map(e => e.unit || 'Unassigned'))].sort();

  // Stats derived from census
  const inpatients = census.filter(e => (e.encounter_type || '').toUpperCase() !== 'EMERGENCY');
  const edPatients = census.filter(e => (e.encounter_type || '').toUpperCase() === 'EMERGENCY');
  const now = Date.now();
  const events24h = messages.filter(m => m.message_type?.startsWith('ADT') && (now - new Date(m.created_at).getTime()) < 86400000).length;

  // Filtered rows
  const filtered = census.filter(e => {
    const name = `${e.first_name} ${e.last_name} ${e.mrn}`.toLowerCase();
    if (searchQ && !name.includes(searchQ.toLowerCase())) return false;
    if (unitFilter && (e.unit || 'Unassigned') !== unitFilter) return false;
    if (statusFilter === 'Inpatient' && (e.encounter_type || '').toUpperCase() === 'EMERGENCY') return false;
    if (statusFilter === 'ED' && (e.encounter_type || '').toUpperCase() !== 'EMERGENCY') return false;
    return true;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filteredUnits = [...new Set(paginated.map(e => e.unit || 'Unassigned'))].sort();

  const isED = (enc) => (enc.encounter_type || '').toUpperCase() === 'EMERGENCY' || (enc.unit || '').toUpperCase() === 'EMERGENCY';

  if (!census.length) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
      <div className="text-4xl mb-3">🛏</div>
      <p className="text-gray-500 text-sm">No admitted patients. Use Admit to add the first one.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 4 Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <div className="text-[10px] text-gray-500">Total Inpatients</div>
            <div className="text-2xl font-bold text-gray-900">{inpatients.length}</div>
            <div className="text-[10px] text-gray-400">Across {units.length} unit{units.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="text-[10px] text-gray-500">ED Patients</div>
            <div className="text-2xl font-bold text-gray-900">{edPatients.length}</div>
            <div className="text-[10px] text-gray-400">Active now</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="text-[10px] text-gray-500">ADT Events (24h)</div>
            <div className="text-2xl font-bold text-gray-900">{events24h}</div>
            <div className="text-[10px] text-gray-400">Messages processed</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Activity className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500">Interface Health</div>
            <div className="text-lg font-bold text-green-600">Healthy</div>
            <div className="text-[10px] text-gray-400">All interfaces operational</div>
          </div>
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={searchQ}
            onChange={e => { setSearchQ(e.target.value); setPage(1); }}
            placeholder="Search patients by name, MRN, or attending..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div className="relative">
          <select
            value={unitFilter}
            onChange={e => { setUnitFilter(e.target.value); setPage(1); }}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-gray-700"
          >
            <option value="">All Units</option>
            {units.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-gray-700"
          >
            <option value="">All Statuses</option>
            <option value="Inpatient">Inpatient</option>
            <option value="ED">ED</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Refresh">
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Census Table by Unit */}
      {filteredUnits.map(unit => {
        const rows = paginated.filter(e => (e.unit || 'Unassigned') === unit);
        const cap  = UNIT_CAPACITY[unit] || 10;
        const occ  = Math.round((census.filter(e => (e.unit || 'Unassigned') === unit).length / cap) * 100);
        return (
          <div key={unit} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900 text-sm">{unit}</span>
                <span className="text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-2 py-0.5">{rows.length} patient{rows.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Occupancy</span>
                <span className={`font-semibold ${occ >= 80 ? 'text-red-600' : occ >= 60 ? 'text-amber-600' : 'text-green-600'}`}>{occ}%</span>
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-wider">
                  <th className="text-left px-5 py-2.5">Patient</th>
                  <th className="text-left px-5 py-2.5">MRN</th>
                  <th className="text-left px-5 py-2.5">Bed</th>
                  <th className="text-left px-5 py-2.5">Attending</th>
                  <th className="text-left px-5 py-2.5">Admitted</th>
                  <th className="text-left px-5 py-2.5">CSN</th>
                  <th className="text-left px-5 py-2.5">Status / Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(enc => (
                  <tr key={enc.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {enc.last_name}, {enc.first_name}
                      <span className="text-gray-400 font-normal text-xs ml-1">· {age(enc.date_of_birth)}y {enc.sex}</span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{enc.mrn}</td>
                    <td className="px-5 py-3 text-gray-600 text-xs">{enc.room}/{enc.bed || '—'}</td>
                    <td className="px-5 py-3 text-gray-600 text-xs">{enc.prov_last ? `Dr. ${enc.prov_last}` : '—'}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{fmt(enc.admit_datetime)}</td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-400">{enc.csn}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Status chip */}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isED(enc) ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                          {isED(enc) ? 'ED' : 'Inpatient'}
                        </span>
                        {/* View button */}
                        <button
                          onClick={() => onViewHL7(enc.csn)}
                          className="flex items-center gap-1 text-[10px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg transition-colors"
                        >
                          <Eye className="w-3 h-3" /> View
                        </button>
                        <button onClick={() => onViewHL7(enc.csn)} className="text-[10px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors">HL7</button>
                        <button onClick={() => onUpdate(enc)} className="text-[10px] font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded-lg transition-colors">Update</button>
                        <button onClick={() => onDischarge(enc)} className="text-[10px] font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 px-2 py-1 rounded-lg transition-colors">Discharge</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Pagination */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-3">
        <span className="text-xs text-gray-500">
          Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} patient{filtered.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(1)} disabled={page === 1} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors">
            <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
          </button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors">
            <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="w-7 h-7 flex items-center justify-center text-xs font-semibold bg-blue-600 text-white rounded">{page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page * PAGE_SIZE >= filtered.length} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors">
            <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
          <button onClick={() => setPage(Math.ceil(filtered.length / PAGE_SIZE))} disabled={page * PAGE_SIZE >= filtered.length} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors">
            <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
          </button>
          <span className="text-xs text-gray-400 ml-2">20 / page</span>
        </div>
      </div>
    </div>
  );
}

// ── Main ADT Module ───────────────────────────────────────────
export default function ADTModule() {
  const [view, setView]             = useState('census');
  const [admitPatient, setAdmitPatient] = useState(null);
  const [updatePatient, setUpdatePatient] = useState(null);
  const [hl7CSN, setHL7CSN]         = useState(null);
  const [toast, setToast]           = useState('');
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [messages, setMessages]     = useState([]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  // Fetch messages for right rail + stat cards
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API}/messages?limit=50`);
        const d = await r.json();
        setMessages(d.messages || []);
      } catch {}
    };
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const handleDischarge = async (enc) => {
    if (!window.confirm(`Discharge ${enc.first_name} ${enc.last_name}? This sends ADT^A03.`)) return;
    const r = await fetch(`${API}/encounters/${enc.csn}/discharge`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ discharge_disp:'HOME' })
    });
    if (r.ok) { showToast(`✅ ${enc.first_name} ${enc.last_name} discharged — ADT^A03 sent`); }
  };

  const handleUpdate = async (enc) => {
    const r = await fetch(`${API}/patients/${enc.mrn}`);
    const d = await r.json();
    if (d.patient) setUpdatePatient(d.patient);
    else showToast('❌ Could not load patient');
  };

  const tabs = [
    { id:'census',   label:'Census',           icon:'🛏' },
    { id:'register', label:'Register Patient',  icon:'➕' },
    { id:'search',   label:'Patient Search',    icon:'🔍' },
    { id:'log',      label:'Message Log',       icon:'📡' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
          <a href="/" className="hover:text-gray-700">🏥 MedCore</a>
          <span className="text-gray-300">/</span>
          <span className="font-semibold text-gray-700">Registration & ADT</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-1">Module 1</span>
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

      {/* Admit modal */}
      {admitPatient && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <AdmitDialog
            patient={admitPatient}
            onCancel={() => setAdmitPatient(null)}
            onSuccess={(data) => { setAdmitPatient(null); showToast(`✅ Admitted — ADT^A01 sent · CSN: ${data.encounter.csn}`); setView('census'); }}
          />
        </div>
      )}

      {/* Update Demographics modal */}
      {updatePatient && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <UpdateDemographicsDialog
            patient={updatePatient}
            onCancel={() => setUpdatePatient(null)}
            onSuccess={(p) => { setUpdatePatient(null); showToast(`✅ ${p.first_name} ${p.last_name} updated — ADT^A08 sent`); }}
          />
        </div>
      )}

      {/* HL7 viewer modal (from census) */}
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

      {/* Message viewer modal (from log) */}
      {selectedMsg && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4" onClick={() => setSelectedMsg(null)}>
          <div className="bg-gray-950 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div>
                <h3 className="text-white font-semibold text-sm">HL7 Message Viewer</h3>
                <p className="text-gray-400 text-xs">
                  <span className="font-mono text-blue-300">{selectedMsg.message_type}</span>
                  {' · '}{selectedMsg.direction}
                  {selectedMsg.patient_mrn && <> · MRN: <span className="font-mono">{selectedMsg.patient_mrn}</span></>}
                  {' · '}{fmt(selectedMsg.created_at)}
                </p>
              </div>
              <button onClick={() => setSelectedMsg(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="p-4 max-h-[28rem] overflow-y-auto font-mono text-xs">
              {selectedMsg.raw_message
                ? selectedMsg.raw_message.split(/\r|\n/).filter(Boolean).map((seg, i) => {
                    const type   = seg.substring(0, 3);
                    const colors = { MSH:'text-yellow-300', EVN:'text-purple-300', PID:'text-green-300', PV1:'text-blue-300', ORC:'text-pink-300', OBR:'text-orange-300', OBX:'text-cyan-300' };
                    const fields = seg.split('|');
                    return (
                      <div key={i} className="mb-1.5 break-all">
                        <span className={`font-bold ${colors[type] || 'text-gray-300'}`}>{fields[0]}</span>
                        <span className="text-gray-500">|</span>
                        <span className="text-gray-300">{fields.slice(1).join('|')}</span>
                      </div>
                    );
                  })
                : <div className="text-gray-500 italic">No raw HL7 body — this event was logged without a payload.</div>
              }
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-8 py-6">
        {view === 'census' && (
          <div className="flex gap-6 items-start">
            {/* Left: census */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Inpatient Census</h2>
                <button onClick={() => setView('search')} className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-2">
                  <span>+</span> Admit Patient
                </button>
              </div>
              <Census
                onDischarge={handleDischarge}
                onUpdate={handleUpdate}
                onViewHL7={(csn) => setHL7CSN(csn)}
                messages={messages}
              />
            </div>
            {/* Right rail */}
            <ADTRightRail messages={messages} />
          </div>
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
            <PatientSearch onSelect={(patient) => setAdmitPatient(patient)} />
            <p className="text-xs text-gray-400 mt-3">💡 After selecting a patient, you can admit them (ADT^A01) or register an outpatient visit (ADT^A04).</p>
          </div>
        )}

        {view === 'log' && (
          <>
            <div className="mb-4">
              <h2 className="font-semibold text-gray-900">HL7 Message Log</h2>
              <p className="text-xs text-gray-400 mt-0.5">Every ADT event that flows through MedCore is logged here. Click any row to view the raw HL7 message.</p>
            </div>
            <MessageLog onSelect={setSelectedMsg} />
          </>
        )}
      </div>
    </div>
  );
}
