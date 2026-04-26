import { useState, useEffect } from 'react';

const API = '/api/portal';

function fmt(dt) { if(!dt)return'—'; return new Date(dt).toLocaleString(); }
function fmtDate(dt) { if(!dt)return'—'; return new Date(dt).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}); }
function age(dob) { if(!dob)return'?'; return Math.floor((Date.now()-new Date(dob).getTime())/(365.25*24*60*60*1000)); }
function money(v) { if(!v&&v!==0)return'—'; return `$${parseFloat(v).toLocaleString('en-US',{minimumFractionDigits:2})}`; }

const flagColors = {
  HH:'bg-red-600 text-white', LL:'bg-red-600 text-white',
  H:'bg-orange-100 text-orange-800', L:'bg-blue-100 text-blue-800',
  N:'bg-green-50 text-green-700', '':'bg-gray-50 text-gray-500',
};

const severityColors = {
  LIFE_THREATENING:'bg-red-600 text-white',
  SEVERE:'bg-red-100 text-red-800',
  MODERATE:'bg-orange-100 text-orange-800',
  MILD:'bg-yellow-100 text-yellow-800',
};

// ── Patient Login ─────────────────────────────────────────────
function PatientLogin({ onLogin }) {
  const [mrn, setMrn]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const login = async () => {
    if (!mrn) return;
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}/summary/${mrn}`);
      const d = await r.json();
      if (!r.ok || !d.patient) { setError('Patient record not found. Please check your MRN.'); return; }
      onLogin(d);
    } catch { setError('Unable to connect. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-10 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🏥</span>
          </div>
          <h1 className="text-2xl font-bold text-white">MedCore MyChart</h1>
          <p className="text-blue-200 text-sm mt-1">Your personal health record</p>
        </div>

        {/* Login form */}
        <div className="px-8 py-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Sign in to your account</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Medical Record Number (MRN)</label>
            <input value={mrn} onChange={e=>setMrn(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()}
              placeholder="Enter your MRN (e.g. M100000)"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <button onClick={login} disabled={loading||!mrn}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm mt-2">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <div className="mt-6 bg-blue-50 rounded-xl p-4 text-xs text-blue-700">
            <p className="font-semibold mb-1">LEARNING — SMART on FHIR:</p>
            <p>In real MyChart, patients authenticate via OAuth2. The app redirects to Epic's authorization server, the patient logs in, and an access token is returned. That token is used for all FHIR API calls. We're simulating that flow here using the MRN as the identity.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────
function Dashboard({ data, onNavigate }) {
  const { patient, results, medications, problems, allergies, appointments, vitals } = data;
  const hasCritical = results?.some(r => parseInt(r.critical_count) > 0);
  const unread = results?.filter(r => !r.acknowledged_at).length || 0;

  const cards = [
    { id:'results',      icon:'🔬', label:'Test Results',    count: results?.length||0,      badge: unread > 0 ? unread : null, badgeColor:'bg-red-500',  color:'blue'   },
    { id:'medications',  icon:'💊', label:'Medications',     count: medications?.length||0,   badge:null, color:'green'  },
    { id:'appointments', icon:'📅', label:'Appointments',    count: appointments?.length||0,  badge:null, color:'purple' },
    { id:'problems',     icon:'📋', label:'Health Issues',   count: problems?.length||0,      badge:null, color:'orange' },
    { id:'allergies',    icon:'⚠️', label:'Allergies',       count: allergies?.length||0,     badge:null, color:'red'    },
    { id:'vitals',       icon:'🩺', label:'Vitals',          count: vitals ? '1 recent' : 0, badge:null, color:'teal'   },
    { id:'notes',        icon:'📝', label:'Visit Notes',     count:'',                        badge:null, color:'gray'   },
    { id:'fhir',         icon:'⚡', label:'FHIR Resources',  count:'',                        badge:null, color:'indigo' },
  ];

  const bgMap = {
    blue:'bg-blue-50 border-blue-200 hover:border-blue-400',
    green:'bg-green-50 border-green-200 hover:border-green-400',
    purple:'bg-purple-50 border-purple-200 hover:border-purple-400',
    orange:'bg-orange-50 border-orange-200 hover:border-orange-400',
    red:'bg-red-50 border-red-200 hover:border-red-400',
    teal:'bg-teal-50 border-teal-200 hover:border-teal-400',
    gray:'bg-gray-50 border-gray-200 hover:border-gray-400',
    indigo:'bg-indigo-50 border-indigo-200 hover:border-indigo-400',
  };

  return (
    <div>
      {/* Critical alert */}
      {hasCritical && (
        <div className="bg-red-600 text-white rounded-2xl p-4 mb-6 flex items-center gap-3">
          <span className="text-2xl animate-pulse">🚨</span>
          <div>
            <p className="font-bold">Critical Lab Values Require Attention</p>
            <p className="text-red-100 text-sm">Your care team has been notified. Please contact your provider.</p>
          </div>
        </div>
      )}

      {/* Welcome + latest vitals */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="col-span-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
          <h2 className="text-xl font-bold mb-1">Welcome back, {patient.first_name}</h2>
          <p className="text-blue-200 text-sm">MRN: {patient.mrn} · DOB: {fmtDate(patient.date_of_birth)} · Age {age(patient.date_of_birth)}</p>
          {unread > 0 && <p className="mt-3 bg-white/20 rounded-lg px-3 py-1.5 text-sm inline-block">📬 {unread} new result{unread!==1?'s':''} to review</p>}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Latest Vitals</p>
          {vitals ? (
            <div className="space-y-1.5 text-xs">
              {vitals.temperature && <div className="flex justify-between"><span className="text-gray-500">Temp</span><span className="font-semibold">{vitals.temperature}°F</span></div>}
              {vitals.bp_systolic && <div className="flex justify-between"><span className="text-gray-500">BP</span><span className="font-semibold">{vitals.bp_systolic}/{vitals.bp_diastolic}</span></div>}
              {vitals.heart_rate && <div className="flex justify-between"><span className="text-gray-500">HR</span><span className="font-semibold">{vitals.heart_rate} bpm</span></div>}
              {vitals.oxygen_sat && <div className="flex justify-between"><span className="text-gray-500">SpO2</span><span className="font-semibold">{vitals.oxygen_sat}%</span></div>}
              <p className="text-gray-400 pt-1">{fmt(vitals.recorded_at)}</p>
            </div>
          ) : <p className="text-gray-400 text-xs">No vitals on record</p>}
        </div>
      </div>

      {/* Navigation cards */}
      <div className="grid grid-cols-4 gap-3">
        {cards.map(card => (
          <button key={card.id} onClick={()=>onNavigate(card.id)}
            className={`relative text-left rounded-2xl border-2 p-4 transition-all ${bgMap[card.color]} shadow-sm hover:shadow-md`}>
            {card.badge && (
              <span className={`absolute top-3 right-3 ${card.badgeColor} text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center`}>
                {card.badge}
              </span>
            )}
            <div className="text-2xl mb-2">{card.icon}</div>
            <p className="font-semibold text-gray-900 text-sm">{card.label}</p>
            {card.count !== '' && <p className="text-xs text-gray-500 mt-0.5">{card.count} {typeof card.count === 'number' ? 'record'+(card.count!==1?'s':'') : ''}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Results View ──────────────────────────────────────────────
function ResultsView({ mrn }) {
  const [results, setResults]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [obs, setObs]           = useState([]);

  useEffect(() => {
    fetch(`${API}/results/${mrn}`).then(r=>r.json()).then(d=>setResults(d.results||[]));
  }, [mrn]);

  const viewDetail = async (report) => {
    setSelected(report);
    const r = await fetch(`/api/results/reports/${report.id}`);
    const d = await r.json();
    setObs(d.observations||[]);
  };

  return (
    <div>
      <h2 className="font-bold text-gray-900 text-lg mb-4">Test Results</h2>
      {!results.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">No results on file.</div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            {results.map(r => {
              const hasCrit = parseInt(r.critical_count) > 0;
              const hasAbn  = parseInt(r.abnormal_count) > 0;
              return (
                <div key={r.id} onClick={()=>viewDetail(r)}
                  className={`bg-white rounded-xl border cursor-pointer p-4 hover:shadow-md transition-all ${hasCrit?'border-red-400':hasAbn?'border-orange-200':'border-gray-100'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-900 text-sm">{r.test_name}</span>
                    {hasCrit && <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">🚨 CRITICAL</span>}
                    {!hasCrit && hasAbn && <span className="text-xs bg-orange-100 text-orange-700 font-medium px-2 py-0.5 rounded-full">⚠ ABNORMAL</span>}
                  </div>
                  <p className="text-xs text-gray-400">{fmt(r.received_time)} · {r.obs_count} components</p>
                  {!r.acknowledged_at && <span className="text-xs text-blue-600 font-medium">● New</span>}
                </div>
              );
            })}
          </div>
          <div>
            {selected ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-4">
                <div className={`px-5 py-4 ${parseInt(selected.critical_count)>0?'bg-red-600 text-white':'bg-gray-50'}`}>
                  <h3 className="font-bold text-sm">{selected.test_name}</h3>
                  <p className={`text-xs mt-0.5 ${parseInt(selected.critical_count)>0?'text-red-100':'text-gray-400'}`}>{fmt(selected.received_time)}</p>
                </div>
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-2">Test</th>
                    <th className="text-right px-4 py-2">Result</th>
                    <th className="text-left px-4 py-2">Range</th>
                    <th className="text-center px-4 py-2">Flag</th>
                  </tr></thead>
                  <tbody>
                    {obs.map((o,i) => (
                      <tr key={i} className={`border-b border-gray-50 ${o.abnormal_flag==='HH'||o.abnormal_flag==='LL'?'bg-red-50':o.abnormal_flag&&o.abnormal_flag!=='N'?'bg-orange-50':''}`}>
                        <td className="px-4 py-2 font-medium text-gray-900">{o.observation_name}</td>
                        <td className="px-4 py-2 text-right font-bold">{o.value_display||o.value_numeric||o.value_text||'—'}</td>
                        <td className="px-4 py-2 text-gray-400">{o.reference_range||'—'}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${flagColors[o.abnormal_flag]||flagColors['']}`}>{o.abnormal_flag||'—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
                Click a result to see details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Medications View ──────────────────────────────────────────
function MedicationsView({ mrn }) {
  const [meds, setMeds] = useState([]);
  useEffect(() => { fetch(`${API}/medications/${mrn}`).then(r=>r.json()).then(d=>setMeds(d.medications||[])); }, [mrn]);
  return (
    <div>
      <h2 className="font-bold text-gray-900 text-lg mb-4">Medications</h2>
      {!meds.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">No medications on file.</div>
      ) : (
        <div className="space-y-3">
          {meds.map(m => (
            <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-lg">💊</div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{m.order_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {m.dose && `${m.dose} ${m.dose_unit||''}`} {m.route && `· ${m.route}`} {m.frequency && `· ${m.frequency}`}
                  </p>
                  <p className="text-xs text-gray-300 mt-0.5">Ordered: {fmt(m.ordered_at)}</p>
                </div>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.status==='COMPLETED'?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700'}`}>{m.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Appointments View ─────────────────────────────────────────
function AppointmentsView({ mrn }) {
  const [apts, setApts] = useState([]);
  useEffect(() => { fetch(`${API}/appointments/${mrn}`).then(r=>r.json()).then(d=>setApts(d.appointments||[])); }, [mrn]);
  return (
    <div>
      <h2 className="font-bold text-gray-900 text-lg mb-4">Appointments</h2>
      {!apts.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">No appointments on file.</div>
      ) : (
        <div className="space-y-3">
          {apts.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-lg">📅</div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{a.visit_type}</p>
                    <p className="text-xs text-gray-400">Dr. {a.prov_first} {a.prov_last} {a.specialty ? `· ${a.specialty}` : ''}</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.status==='SCHEDULED'?'bg-purple-100 text-purple-700':'bg-gray-100 text-gray-600'}`}>{a.status}</span>
              </div>
              <p className="text-sm text-gray-600 ml-13">{fmtDate(a.start_time)} at {new Date(a.start_time).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</p>
              {a.location && <p className="text-xs text-gray-400 mt-1">📍 {a.location}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Problems View ─────────────────────────────────────────────
function ProblemsView({ mrn }) {
  const [problems, setProblems] = useState([]);
  useEffect(() => { fetch(`${API}/problems/${mrn}`).then(r=>r.json()).then(d=>setProblems(d.problems||[])); }, [mrn]);
  return (
    <div>
      <h2 className="font-bold text-gray-900 text-lg mb-4">Health Issues & Diagnoses</h2>
      {!problems.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">No active health issues on file.</div>
      ) : (
        <div className="space-y-2">
          {problems.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{p.description}</p>
                {p.icd10_code && <p className="text-xs font-mono text-gray-400 mt-0.5">ICD-10: {p.icd10_code}</p>}
                {p.onset_date && <p className="text-xs text-gray-400">Since: {fmtDate(p.onset_date)}</p>}
              </div>
              <span className="text-xs bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full">{p.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Allergies View ────────────────────────────────────────────
function AllergiesView({ mrn }) {
  const [allergies, setAllergies] = useState([]);
  useEffect(() => { fetch(`${API}/allergies/${mrn}`).then(r=>r.json()).then(d=>setAllergies(d.allergies||[])); }, [mrn]);
  return (
    <div>
      <h2 className="font-bold text-gray-900 text-lg mb-4">Allergies</h2>
      {!allergies.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">No known allergies (NKA).</div>
      ) : (
        <div className="space-y-2">
          {allergies.map(a => (
            <div key={a.id} className={`rounded-xl border p-4 ${severityColors[a.severity]||'bg-yellow-50 border-yellow-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">{a.allergen} <span className="text-xs font-normal opacity-75">({a.allergen_type})</span></p>
                  {a.reaction && <p className="text-xs opacity-75 mt-0.5">Reaction: {a.reaction}</p>}
                </div>
                <span className="text-xs font-bold opacity-90">{a.severity.replace('_',' ')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── FHIR Explorer ─────────────────────────────────────────────
function FHIRExplorer({ mrn }) {
  const [fhirData, setFhirData] = useState(null);
  const [loading, setLoading]   = useState(false);

  const fetchFHIR = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/fhir/Patient/${mrn}`);
      const d = await r.json();
      setFhirData(d);
    } catch(e) { setFhirData({ error: e.message }); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <h2 className="font-bold text-gray-900 text-lg mb-2">FHIR Resource Explorer</h2>
      <p className="text-sm text-gray-500 mb-4">
        This shows your patient data as a real FHIR R4 Patient resource — the same format Epic sends to third-party apps via the SMART on FHIR API.
      </p>
      <button onClick={fetchFHIR} disabled={loading}
        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl px-5 py-2.5 text-sm mb-4">
        {loading ? 'Fetching from FHIR server…' : 'Fetch FHIR Patient Resource →'}
      </button>

      {fhirData && (
        <div className="bg-gray-950 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
            <span className="text-white font-mono text-sm">GET /fhir/Patient/medcore-{mrn}</span>
            <span className="text-green-400 text-xs">{fhirData.error ? '❌ Error' : '✅ 200 OK'}</span>
          </div>
          <pre className="p-5 text-green-300 font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto">
            {JSON.stringify(fhirData, null, 2)}
          </pre>
        </div>
      )}

      <div className="mt-4 bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-800">
        <p className="font-semibold mb-2">How SMART on FHIR works in Epic:</p>
        <p className="mb-1">1. Patient opens MyChart → clicks a third-party app (e.g. Apple Health)</p>
        <p className="mb-1">2. App redirects to Epic authorization server</p>
        <p className="mb-1">3. Patient logs in → grants permission (scopes: patient/Patient.read, patient/Observation.read)</p>
        <p className="mb-1">4. Authorization code returned to app</p>
        <p className="mb-1">5. App exchanges code for access token</p>
        <p>6. App calls FHIR API with token → gets patient data in FHIR R4 format (like what you see above)</p>
      </div>
    </div>
  );
}

// ── Notes View ────────────────────────────────────────────────
function NotesView({ mrn }) {
  const [notes, setNotes]     = useState([]);
  const [selected, setSelected] = useState(null);
  useEffect(() => { fetch(`${API}/notes/${mrn}`).then(r=>r.json()).then(d=>setNotes(d.notes||[])); }, [mrn]);
  return (
    <div>
      <h2 className="font-bold text-gray-900 text-lg mb-4">Visit Notes</h2>
      {!notes.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">No signed notes available.</div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            {notes.map(n => (
              <div key={n.id} onClick={()=>setSelected(n)}
                className={`bg-white rounded-xl border cursor-pointer p-4 hover:shadow-md transition-all ${selected?.id===n.id?'border-blue-400 bg-blue-50':'border-gray-100'}`}>
                <p className="font-semibold text-gray-900 text-sm">{n.title||'Untitled Note'}</p>
                <p className="text-xs text-gray-400 mt-0.5">{n.note_type_name} · {n.author_name}</p>
                <p className="text-xs text-gray-300">{fmt(n.signed_at)}</p>
              </div>
            ))}
          </div>
          <div>
            {selected ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-4">
                <h3 className="font-bold text-gray-900 text-sm mb-1">{selected.title}</h3>
                <p className="text-xs text-gray-400 mb-3">{selected.author_name} · {fmt(selected.signed_at)}</p>
                <pre className="text-xs text-gray-700 font-mono bg-gray-50 rounded-xl p-4 whitespace-pre-wrap max-h-96 overflow-y-auto">{selected.content}</pre>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">Select a note to read it</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Portal ───────────────────────────────────────────────
export default function PatientPortal() {
  const [session, setSession] = useState(null);
  const [view, setView]       = useState('dashboard');
  const [refreshData, setRefreshData] = useState(null);

  const handleLogin = (data) => {
    setSession(data);
    setRefreshData(data);
    setView('dashboard');
  };

  const handleLogout = () => { setSession(null); setView('dashboard'); };

  if (!session) return <PatientLogin onLogin={handleLogin} />;

  const { patient } = session;
  const mrn = patient.mrn;

  const navItems = [
    { id:'dashboard',    label:'Home',        icon:'🏠' },
    { id:'results',      label:'Results',     icon:'🔬' },
    { id:'medications',  label:'Medications', icon:'💊' },
    { id:'appointments', label:'Schedule',    icon:'📅' },
    { id:'problems',     label:'Health',      icon:'📋' },
    { id:'allergies',    label:'Allergies',   icon:'⚠️' },
    { id:'notes',        label:'Notes',       icon:'📝' },
    { id:'fhir',         label:'FHIR API',    icon:'⚡' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">M</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-sm">MedCore MyChart</h1>
            <p className="text-xs text-gray-400">Patient Portal · Module 8</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900">{patient.first_name} {patient.last_name}</p>
            <p className="text-xs text-gray-400">MRN: {mrn}</p>
          </div>
          <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5">Sign out</button>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar nav */}
        <div className="w-48 bg-white border-r border-gray-100 min-h-screen pt-4 flex-shrink-0">
          {navItems.map(item => (
            <button key={item.id} onClick={()=>setView(item.id)}
              className={`w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${view===item.id?'bg-blue-50 text-blue-700 font-semibold border-r-2 border-blue-600':'text-gray-600 hover:bg-gray-50'}`}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
          <div className="mx-4 mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 font-semibold mb-1">Epic equivalent</p>
            <p className="text-xs text-gray-300">MyChart + SMART on FHIR</p>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 px-8 py-6 max-w-5xl">
          {view==='dashboard'    && <Dashboard data={refreshData||session} onNavigate={setView} />}
          {view==='results'      && <ResultsView mrn={mrn} />}
          {view==='medications'  && <MedicationsView mrn={mrn} />}
          {view==='appointments' && <AppointmentsView mrn={mrn} />}
          {view==='problems'     && <ProblemsView mrn={mrn} />}
          {view==='allergies'    && <AllergiesView mrn={mrn} />}
          {view==='notes'        && <NotesView mrn={mrn} />}
          {view==='fhir'         && <FHIRExplorer mrn={mrn} />}
        </div>
      </div>
    </div>
  );
}
