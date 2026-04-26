import { useState, useEffect } from 'react';

const API = '/api/documentation';
const ADT = '/api/adt';

function fmt(dt) { if(!dt)return'—'; return new Date(dt).toLocaleString(); }
function fmtDate(dt) { if(!dt)return'—'; return new Date(dt).toLocaleDateString(); }

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";

const severityColors = {
  LIFE_THREATENING: 'bg-red-600 text-white',
  SEVERE:           'bg-red-100 text-red-800',
  MODERATE:         'bg-orange-100 text-orange-800',
  MILD:             'bg-yellow-100 text-yellow-800',
};

// ── Patient Context ───────────────────────────────────────────
function PatientContext({ onSelect }) {
  const [mrn, setMrn]         = useState('');
  const [patient, setPatient] = useState(null);
  const [error, setError]     = useState('');

  const lookup = async () => {
    if (!mrn) return;
    const r = await fetch(`${ADT}/patients/${mrn}`);
    const d = await r.json();
    if (!r.ok) { setError('Patient not found'); return; }
    setPatient(d.patient);
    onSelect(d.patient, d.encounters || []);
    setError('');
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
      <h3 className="font-semibold text-gray-900 text-sm mb-3">Patient</h3>
      <div className="flex gap-2">
        <input value={mrn} onChange={e=>setMrn(e.target.value)} onKeyDown={e=>e.key==='Enter'&&lookup()}
          placeholder="Enter MRN…" className={inputCls} />
        <button onClick={lookup} className="px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium whitespace-nowrap">Look up</button>
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      {patient && (
        <div className="mt-2 bg-red-50 border border-red-100 rounded-xl p-2.5 text-xs">
          <span className="font-semibold text-red-900">{patient.last_name}, {patient.first_name}</span>
          <span className="text-red-600 ml-2">MRN: {patient.mrn} · DOB: {patient.date_of_birth?.substring(0,10)} · {patient.sex}</span>
        </div>
      )}
    </div>
  );
}

// ── Vitals Entry ──────────────────────────────────────────────
function VitalsEntry({ patient, onSaved }) {
  const [temp, setTemp]       = useState('');
  const [hr, setHr]           = useState('');
  const [rr, setRr]           = useState('');
  const [sbp, setSbp]         = useState('');
  const [dbp, setDbp]         = useState('');
  const [o2, setO2]           = useState('');
  const [o2del, setO2del]     = useState('Room air');
  const [weight, setWeight]   = useState('');
  const [height, setHeight]   = useState('');
  const [pain, setPain]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const submit = async () => {
    if (!patient) { setError('Select a patient first'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}/vitals`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          patient_mrn: patient.mrn, temperature: temp||null, heart_rate: hr||null,
          respiratory_rate: rr||null, bp_systolic: sbp||null, bp_diastolic: dbp||null,
          oxygen_sat: o2||null, oxygen_delivery: o2del, weight_kg: weight||null,
          height_cm: height||null, pain_score: pain||null
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      onSaved(d.vitals);
      setTemp(''); setHr(''); setRr(''); setSbp(''); setDbp(''); setO2(''); setWeight(''); setHeight(''); setPain('');
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-semibold text-gray-900 text-sm mb-4">Record Vitals</h3>
      {error && <div className="bg-red-50 text-red-700 text-xs rounded-lg px-3 py-2 mb-3">{error}</div>}
      <div className="grid grid-cols-3 gap-3">
        <div><label className={labelCls}>Temperature (°F)</label>
          <input value={temp} onChange={e=>setTemp(e.target.value)} placeholder="98.6" className={inputCls} /></div>
        <div><label className={labelCls}>Heart Rate (bpm)</label>
          <input value={hr} onChange={e=>setHr(e.target.value)} placeholder="72" className={inputCls} /></div>
        <div><label className={labelCls}>Resp Rate</label>
          <input value={rr} onChange={e=>setRr(e.target.value)} placeholder="16" className={inputCls} /></div>
        <div><label className={labelCls}>BP Systolic</label>
          <input value={sbp} onChange={e=>setSbp(e.target.value)} placeholder="120" className={inputCls} /></div>
        <div><label className={labelCls}>BP Diastolic</label>
          <input value={dbp} onChange={e=>setDbp(e.target.value)} placeholder="80" className={inputCls} /></div>
        <div><label className={labelCls}>SpO2 (%)</label>
          <input value={o2} onChange={e=>setO2(e.target.value)} placeholder="98" className={inputCls} /></div>
        <div><label className={labelCls}>O2 Delivery</label>
          <select value={o2del} onChange={e=>setO2del(e.target.value)} className={inputCls}>
            {['Room air','2L NC','4L NC','6L NC','Face mask','NRB','BIPAP','Ventilator'].map(o=><option key={o}>{o}</option>)}
          </select></div>
        <div><label className={labelCls}>Weight (kg)</label>
          <input value={weight} onChange={e=>setWeight(e.target.value)} placeholder="70.5" className={inputCls} /></div>
        <div><label className={labelCls}>Pain Score (0-10)</label>
          <input value={pain} onChange={e=>setPain(e.target.value)} placeholder="0" className={inputCls} /></div>
      </div>
      <button onClick={submit} disabled={loading||!patient}
        className="mt-4 w-full bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm">
        {loading ? 'Saving…' : 'Save Vitals'}
      </button>
    </div>
  );
}

// ── Vitals Flowsheet ──────────────────────────────────────────
function VitalsFlowsheet({ mrn, refresh }) {
  const [vitals, setVitals] = useState([]);
  useEffect(() => {
    if (!mrn) return;
    fetch(`${API}/vitals/${mrn}`).then(r=>r.json()).then(d=>setVitals(d.vitals||[]));
  }, [mrn, refresh]);

  if (!mrn || !vitals.length) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-4">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="font-semibold text-gray-900 text-sm">Vitals Flowsheet</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wide">
            <th className="text-left px-4 py-2">Time</th>
            <th className="px-4 py-2">Temp</th>
            <th className="px-4 py-2">HR</th>
            <th className="px-4 py-2">RR</th>
            <th className="px-4 py-2">BP</th>
            <th className="px-4 py-2">SpO2</th>
            <th className="px-4 py-2">Weight</th>
            <th className="px-4 py-2">Pain</th>
          </tr></thead>
          <tbody>
            {vitals.map((v,i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-500">{fmt(v.recorded_at)}</td>
                <td className="px-4 py-2 text-center font-medium">{v.temperature ? `${v.temperature}°F` : '—'}</td>
                <td className="px-4 py-2 text-center font-medium">{v.heart_rate||'—'}</td>
                <td className="px-4 py-2 text-center">{v.respiratory_rate||'—'}</td>
                <td className="px-4 py-2 text-center font-medium">{v.bp_systolic&&v.bp_diastolic?`${v.bp_systolic}/${v.bp_diastolic}`:'—'}</td>
                <td className="px-4 py-2 text-center">{v.oxygen_sat ? `${v.oxygen_sat}%` : '—'}</td>
                <td className="px-4 py-2 text-center">{v.weight_kg ? `${v.weight_kg}kg` : '—'}</td>
                <td className="px-4 py-2 text-center">{v.pain_score ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Note Writer ───────────────────────────────────────────────
function NoteWriter({ patient, encounters, onSaved }) {
  const [noteTypes, setNoteTypes]   = useState([]);
  const [templates, setTemplates]   = useState([]);
  const [providers, setProviders]   = useState([]);
  const [note_type_id, setTypeId]   = useState('');
  const [author_id, setAuthor]      = useState('');
  const [encounter_csn, setCSN]     = useState('');
  const [title, setTitle]           = useState('');
  const [content, setContent]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    fetch(`${API}/note-types`).then(r=>r.json()).then(d=>setNoteTypes(d.note_types||[]));
    fetch(`${API}/providers`).then(r=>r.json()).then(d=>setProviders(d.providers||[]));
  }, []);

  useEffect(() => {
    if (!note_type_id) return;
    fetch(`${API}/templates?note_type_id=${note_type_id}`).then(r=>r.json()).then(d=>setTemplates(d.templates||[]));
  }, [note_type_id]);

  const loadTemplate = (template) => {
    setTitle(template.name);
    setContent(template.content);
  };

  const save = async (sign = false) => {
    if (!patient || !content) { setError('Patient and note content required'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}/notes`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ patient_mrn: patient.mrn, encounter_csn: encounter_csn||null,
          note_type_id: note_type_id||null, title, content, author_id: author_id||null })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      let note = d.note;
      if (sign) {
        const sr = await fetch(`${API}/notes/${note.id}/sign`, { method:'POST' });
        const sd = await sr.json();
        note = sd.note;
      }
      onSaved(note, sign);
      setContent(''); setTitle('');
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-semibold text-gray-900 text-sm mb-4">Write Clinical Note</h3>
      {error && <div className="bg-red-50 text-red-700 text-xs rounded-lg px-3 py-2 mb-3">{error}</div>}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div><label className={labelCls}>Note Type</label>
          <select value={note_type_id} onChange={e=>setTypeId(e.target.value)} className={inputCls}>
            <option value="">Select note type…</option>
            {noteTypes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select></div>
        <div><label className={labelCls}>Author</label>
          <select value={author_id} onChange={e=>setAuthor(e.target.value)} className={inputCls}>
            <option value="">Select provider…</option>
            {providers.map(p=><option key={p.id} value={p.id}>Dr. {p.first_name} {p.last_name}</option>)}
          </select></div>
        <div><label className={labelCls}>Encounter (CSN)</label>
          <select value={encounter_csn} onChange={e=>setCSN(e.target.value)} className={inputCls}>
            <option value="">No encounter</option>
            {(encounters||[]).map(e=><option key={e.csn} value={e.csn}>CSN {e.csn} — {e.encounter_type}</option>)}
          </select></div>
        <div><label className={labelCls}>Note Title</label>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Daily Progress Note" className={inputCls} /></div>
      </div>

      {templates.length > 0 && (
        <div className="mb-3">
          <label className={labelCls}>Load Template (SmartText)</label>
          <div className="flex gap-2 flex-wrap">
            {templates.map(t => (
              <button key={t.id} onClick={() => loadTemplate(t)}
                className="text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg">
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div><label className={labelCls}>Note Content <span className="text-red-500">*</span></label>
        <textarea value={content} onChange={e=>setContent(e.target.value)}
          rows={14} placeholder="Begin typing your note, or load a template above…"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 font-mono resize-none" />
      </div>

      <div className="flex gap-3 mt-4">
        <button onClick={()=>save(false)} disabled={loading||!patient||!content}
          className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl py-2.5 text-sm disabled:opacity-40">
          Save as Draft
        </button>
        <button onClick={()=>save(true)} disabled={loading||!patient||!content||!author_id}
          className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm">
          {loading ? 'Signing…' : 'Sign Note → Send MDM^T02'}
        </button>
      </div>
      {!author_id && <p className="text-xs text-gray-400 mt-1 text-center">Select an author to enable signing</p>}
    </div>
  );
}

// ── Notes List ────────────────────────────────────────────────
function NotesList({ mrn, refresh, onViewHL7 }) {
  const [notes, setNotes] = useState([]);
  useEffect(() => {
    let url = `${API}/notes?limit=50`;
    if (mrn) url += `&patient_mrn=${mrn}`;
    fetch(url).then(r=>r.json()).then(d=>setNotes(d.notes||[]));
  }, [mrn, refresh]);

  if (!notes.length) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
      <div className="text-3xl mb-2">📝</div>
      <p className="text-gray-500 text-sm">No notes yet. Write and sign a note to see it here.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {notes.map(n => (
        <div key={n.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${n.status==='SIGNED'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}`}>
                  {n.status}
                </span>
                <span className="text-xs text-gray-400">{n.type_name || 'Note'}</span>
                {n.status==='SIGNED' && <span className="text-xs text-green-600">→ MDM^T02 sent</span>}
              </div>
              <h4 className="font-semibold text-gray-900 text-sm">{n.title || 'Untitled Note'}</h4>
              <p className="text-xs text-gray-400 mt-0.5">{n.author_name||'Unknown'} · {fmt(n.authored_at)} · MRN: {n.patient_mrn}</p>
              <p className="text-xs text-gray-500 mt-2 line-clamp-2 font-mono bg-gray-50 rounded p-2">{n.content?.substring(0,200)}…</p>
            </div>
            {n.status==='SIGNED' && (
              <button onClick={()=>onViewHL7(n.id)} className="ml-3 text-xs text-red-500 hover:underline whitespace-nowrap">View HL7</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Problem List ──────────────────────────────────────────────
function ProblemList({ patient }) {
  const [problems, setProblems] = useState([]);
  const [desc, setDesc]         = useState('');
  const [icd10, setIcd10]       = useState('');
  const [icd10disp, setDisp]    = useState('');
  const [loading, setLoading]   = useState(false);

  const load = () => {
    if (!patient) return;
    fetch(`${API}/problems/${patient.mrn}`).then(r=>r.json()).then(d=>setProblems(d.problems||[]));
  };
  useEffect(() => { load(); }, [patient]);

  const add = async () => {
    if (!desc||!patient) return;
    setLoading(true);
    try {
      await fetch(`${API}/problems`, { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ patient_mrn: patient.mrn, description: desc, icd10_code: icd10||null, icd10_display: icd10disp||null }) });
      setDesc(''); setIcd10(''); setDisp(''); load();
    } catch(e) {} finally { setLoading(false); }
  };

  const resolve = async (id) => {
    await fetch(`${API}/problems/${id}/resolve`, { method:'PATCH' }); load();
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-semibold text-gray-900 text-sm mb-4">Problem List</h3>
      <div className="flex gap-2 mb-4">
        <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Problem description…" className={inputCls} />
        <input value={icd10} onChange={e=>setIcd10(e.target.value)} placeholder="ICD-10" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none" />
        <button onClick={add} disabled={loading||!patient||!desc} className="px-4 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white rounded-lg text-sm font-medium whitespace-nowrap">+ Add</button>
      </div>
      {!problems.length
        ? <p className="text-xs text-gray-400 text-center py-4">No problems on file.</p>
        : <div className="space-y-2">
            {problems.map(p => (
              <div key={p.id} className={`flex items-center justify-between rounded-xl px-4 py-2.5 border ${p.status==='ACTIVE'?'bg-orange-50 border-orange-100':'bg-gray-50 border-gray-100'}`}>
                <div>
                  <span className="text-sm font-medium text-gray-900">{p.description}</span>
                  {p.icd10_code && <span className="ml-2 text-xs font-mono text-gray-400">{p.icd10_code}</span>}
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${p.status==='ACTIVE'?'bg-orange-100 text-orange-700':'bg-gray-100 text-gray-500'}`}>{p.status}</span>
                </div>
                {p.status==='ACTIVE' && (
                  <button onClick={()=>resolve(p.id)} className="text-xs text-gray-400 hover:text-green-600">Mark Resolved</button>
                )}
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ── Allergy List ──────────────────────────────────────────────
function AllergyList({ patient }) {
  const [allergies, setAllergies] = useState([]);
  const [allergen, setAllergen]   = useState('');
  const [reaction, setReaction]   = useState('');
  const [severity, setSeverity]   = useState('MODERATE');
  const [atype, setAtype]         = useState('DRUG');
  const [loading, setLoading]     = useState(false);

  const load = () => {
    if (!patient) return;
    fetch(`${API}/allergies/${patient.mrn}`).then(r=>r.json()).then(d=>setAllergies(d.allergies||[]));
  };
  useEffect(() => { load(); }, [patient]);

  const add = async () => {
    if (!allergen||!patient) return;
    setLoading(true);
    try {
      await fetch(`${API}/allergies`, { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ patient_mrn: patient.mrn, allergen, allergen_type: atype, reaction, severity }) });
      setAllergen(''); setReaction(''); load();
    } catch(e) {} finally { setLoading(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-semibold text-gray-900 text-sm mb-4">
        Allergies
        {allergies.some(a=>a.severity==='LIFE_THREATENING') && <span className="ml-2 text-xs bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse">⚠ CRITICAL ALLERGY</span>}
      </h3>
      <div className="grid grid-cols-4 gap-2 mb-4">
        <input value={allergen} onChange={e=>setAllergen(e.target.value)} placeholder="Allergen name…" className={inputCls + " col-span-2"} />
        <select value={atype} onChange={e=>setAtype(e.target.value)} className={inputCls}>
          {['DRUG','FOOD','ENVIRONMENTAL','OTHER'].map(t=><option key={t}>{t}</option>)}
        </select>
        <select value={severity} onChange={e=>setSeverity(e.target.value)} className={inputCls}>
          {['MILD','MODERATE','SEVERE','LIFE_THREATENING'].map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
        <input value={reaction} onChange={e=>setReaction(e.target.value)} placeholder="Reaction…" className={inputCls + " col-span-3"} />
        <button onClick={add} disabled={loading||!patient||!allergen} className="bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white rounded-lg text-sm font-medium">+ Add</button>
      </div>
      {!allergies.length
        ? <p className="text-xs text-gray-400 text-center py-3">No known allergies (NKA).</p>
        : <div className="space-y-2">
            {allergies.map(a => (
              <div key={a.id} className={`flex items-center justify-between rounded-xl px-4 py-2.5 border ${severityColors[a.severity]||'bg-yellow-50 border-yellow-100'}`}>
                <div>
                  <span className="font-semibold text-sm">{a.allergen}</span>
                  <span className="ml-2 text-xs opacity-75">{a.allergen_type}</span>
                  {a.reaction && <span className="ml-2 text-xs opacity-75">→ {a.reaction}</span>}
                </div>
                <span className="text-xs font-bold opacity-90">{a.severity.replace('_',' ')}</span>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ── HL7 Viewer ────────────────────────────────────────────────
function HL7Viewer({ noteId, onClose }) {
  const [events, setEvents] = useState([]);
  const [sel, setSel]       = useState(null);
  useEffect(() => {
    fetch(`${API}/notes/${noteId}/hl7`).then(r=>r.json()).then(d=>{
      setEvents(d.mdm_events||[]);
      if(d.mdm_events?.[0]) setSel(d.mdm_events[0]);
    });
  }, [noteId]);
  const segs = sel?.hl7_message?.split('\r').filter(Boolean)||[];
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4">
      <div className="bg-gray-950 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
        <div className="flex justify-between px-5 py-4 border-b border-gray-800">
          <div><h3 className="text-white font-semibold text-sm">MDM HL7 Viewer</h3><p className="text-gray-400 text-xs">Note #{noteId}</p></div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="flex gap-2 p-3 border-b border-gray-800">
          {events.map((e,i)=>(
            <button key={i} onClick={()=>setSel(e)} className={`text-xs px-3 py-1 rounded-full font-mono ${sel===e?'bg-red-600 text-white':'bg-gray-800 text-gray-300'}`}>{e.event_type}</button>
          ))}
        </div>
        <div className="p-4 max-h-96 overflow-y-auto font-mono text-xs">
          {!events.length ? <div className="text-gray-400">No MDM events.</div> : segs.map((seg,i)=>{
            const type=seg.substring(0,3);
            const colors={MSH:'text-yellow-300',EVN:'text-purple-300',PID:'text-green-300',PV1:'text-blue-300',TXA:'text-orange-300',OBX:'text-pink-300'};
            return(
              <div key={i} className="mb-1.5">
                <span className={`font-bold ${colors[type]||'text-gray-300'}`}>{seg.substring(0,3)}</span>
                <span className="text-gray-500">|</span>
                <span className="text-gray-300">{seg.substring(4)}</span>
              </div>
            );
          })}
          <div className="mt-3 pt-3 border-t border-gray-800 text-gray-500 text-xs">Sent: {fmt(sel?.sent_at)}</div>
        </div>
      </div>
    </div>
  );
}

// ── Main Documentation Page ───────────────────────────────────
export default function DocumentationModule() {
  const [view, setView]       = useState('notes');
  const [patient, setPatient] = useState(null);
  const [encounters, setEncs] = useState([]);
  const [hl7NoteId, setHL7]   = useState(null);
  const [toast, setToast]     = useState('');
  const [refresh, setRefresh] = useState(0);

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),4000); };
  const bump = () => setRefresh(r=>r+1);

  const tabs = [
    { id:'notes',    label:'Notes',        icon:'📝' },
    { id:'vitals',   label:'Vitals',       icon:'🩺' },
    { id:'problems', label:'Problem List', icon:'🏷' },
    { id:'allergies',label:'Allergies',    icon:'⚠️' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center gap-3 mb-4">
          <a href="/" className="text-gray-400 hover:text-gray-600 text-sm">← MedCore</a>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-700">Clinical Documentation</span>
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full ml-2">Module 5</span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clinical Documentation</h1>
            <p className="text-sm text-gray-500 mt-0.5">Notes · Vitals · Problem List · Allergies · MDM^T02</p>
          </div>
          <div className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <span className="font-semibold text-gray-600">Epic equivalent:</span> ClinDoc / SmartText
          </div>
        </div>
        <div className="flex gap-1 mt-4">
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setView(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view===t.id?'bg-red-500 text-white':'text-gray-600 hover:bg-gray-100'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm rounded-xl px-5 py-3 shadow-xl">{toast}</div>}
      {hl7NoteId && <HL7Viewer noteId={hl7NoteId} onClose={()=>setHL7(null)} />}

      <div className="max-w-5xl mx-auto px-8 py-6">
        <PatientContext onSelect={(p,encs)=>{setPatient(p);setEncs(encs||[]);}} />

        {view==='notes' && (
          <>
            <NoteWriter patient={patient} encounters={encounters}
              onSaved={(note, signed) => { showToast(signed?`✅ Note signed — MDM^T02 sent · Doc ID: ${note.doc_id}`:`📝 Draft saved · ${note.doc_id}`); bump(); }} />
            <div className="mt-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Note History</h3>
              <NotesList mrn={patient?.mrn} refresh={refresh} onViewHL7={id=>setHL7(id)} />
            </div>
          </>
        )}

        {view==='vitals' && (
          <>
            <VitalsEntry patient={patient} onSaved={(v)=>{showToast('✅ Vitals recorded'); bump();}} />
            <VitalsFlowsheet mrn={patient?.mrn} refresh={refresh} />
            {!patient && <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">Look up a patient to record and view vitals.</div>}
          </>
        )}

        {view==='problems' && (
          patient ? <ProblemList patient={patient} /> :
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">Look up a patient to manage their problem list.</div>
        )}

        {view==='allergies' && (
          patient ? <AllergyList patient={patient} /> :
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">Look up a patient to manage their allergies.</div>
        )}
      </div>
    </div>
  );
}
