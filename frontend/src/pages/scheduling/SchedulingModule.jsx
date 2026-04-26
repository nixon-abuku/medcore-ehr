import { useState, useEffect } from 'react';

const API = '/api/scheduling';
const ADT = '/api/adt';

function fmt(dtStr) { if (!dtStr) return '—'; return new Date(dtStr).toLocaleString(); }
function fmtDate(d) { if (!d) return '—'; return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' }); }
function age(dob) { if (!dob) return '?'; return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25*24*60*60*1000)); }
function today() { return new Date().toISOString().substring(0,10); }

const statusColors = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  ARRIVED:   'bg-green-100 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-500',
  CANCELLED: 'bg-red-100 text-red-600',
  NO_SHOW:   'bg-orange-100 text-orange-700',
};

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";

// ── Book Appointment Form ─────────────────────────────────────
function BookForm({ onSuccess, onCancel }) {
  const [providers, setProviders]     = useState([]);
  const [visitTypes, setVisitTypes]   = useState([]);
  const [slots, setSlots]             = useState([]);
  const [provider_id, setProviderId]  = useState('');
  const [visit_type_id, setVtId]      = useState('');
  const [appt_date, setDate]          = useState(today());
  const [slot_id, setSlotId]          = useState('');
  const [patient_mrn, setMrn]         = useState('');
  const [chief_complaint, setCC]      = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [patientName, setPatientName] = useState('');

  useEffect(() => {
    fetch(`${API}/providers`).then(r=>r.json()).then(d=>setProviders(d.providers||[]));
    fetch(`${API}/visit-types`).then(r=>r.json()).then(d=>setVisitTypes(d.visit_types||[]));
  }, []);

  useEffect(() => {
    if (!provider_id || !appt_date) { setSlots([]); return; }
    fetch(`${API}/slots?provider_id=${provider_id}&date=${appt_date}&status=AVAILABLE`)
      .then(r=>r.json()).then(d=>setSlots(d.slots||[]));
  }, [provider_id, appt_date]);

  const lookupMrn = async () => {
    if (!patient_mrn) return;
    try {
      const r = await fetch(`${ADT}/patients/${patient_mrn}`);
      const d = await r.json();
      if (r.ok) setPatientName(`${d.patient.first_name} ${d.patient.last_name}`);
      else { setPatientName(''); setError('Patient MRN not found'); }
    } catch { setError('Could not look up patient'); }
  };

  const submit = async () => {
    if (!patient_mrn || !provider_id || !appt_date || !slot_id) {
      setError('Patient MRN, provider, date, and time slot are required.'); return;
    }
    setLoading(true); setError('');
    try {
      const selectedSlot = slots.find(s => s.id === parseInt(slot_id));
      const r = await fetch(`${API}/appointments`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ patient_mrn, provider_id: parseInt(provider_id), visit_type_id: visit_type_id ? parseInt(visit_type_id) : null,
          appt_date, start_time: selectedSlot?.start_time, slot_id: parseInt(slot_id), chief_complaint })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      onSuccess(data.appointment);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Book Appointment</h2>
          <p className="text-xs text-gray-400 mt-0.5">Fires SIU^S12 when booked. In Epic this is done in Cadence.</p>
        </div>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-sm">✕ Cancel</button>
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="col-span-2">
          <label className={labelCls}>Patient MRN <span className="text-red-500">*</span></label>
          <div className="flex gap-2">
            <input value={patient_mrn} onChange={e=>setMrn(e.target.value)} placeholder="e.g. M100000" className={inputCls} />
            <button onClick={lookupMrn} className="px-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-600 whitespace-nowrap">Look up</button>
          </div>
          {patientName && <p className="text-xs text-green-600 mt-1 font-medium">✓ {patientName}</p>}
        </div>
        <div>
          <label className={labelCls}>Provider <span className="text-red-500">*</span></label>
          <select value={provider_id} onChange={e=>setProviderId(e.target.value)} className={inputCls}>
            <option value="">Select provider…</option>
            {providers.map(p=><option key={p.id} value={p.id}>Dr. {p.first_name} {p.last_name} — {p.specialty}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Visit Type</label>
          <select value={visit_type_id} onChange={e=>setVtId(e.target.value)} className={inputCls}>
            <option value="">Select type…</option>
            {visitTypes.map(v=><option key={v.id} value={v.id}>{v.name} ({v.duration_min} min)</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Date <span className="text-red-500">*</span></label>
          <input type="date" value={appt_date} onChange={e=>setDate(e.target.value)} min={today()} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Time Slot <span className="text-red-500">*</span></label>
          <select value={slot_id} onChange={e=>setSlotId(e.target.value)} className={inputCls}>
            <option value="">
              {!provider_id ? 'Select provider first' : slots.length === 0 ? 'No slots — create schedule first' : 'Pick a time…'}
            </option>
            {slots.map(s=><option key={s.id} value={s.id}>{s.start_time?.substring(0,5)} – {s.end_time?.substring(0,5)}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Chief Complaint / Reason for Visit</label>
          <input value={chief_complaint} onChange={e=>setCC(e.target.value)} placeholder="e.g. Annual checkup, knee pain follow-up" className={inputCls} />
        </div>
      </div>

      <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 mb-5 text-xs text-purple-700">
        <span className="font-semibold">What happens when you book:</span> A SIU^S12 HL7 message fires. Downstream systems (lab, imaging, pharmacy) use this to pre-stage orders and prepare for the visit.
      </div>

      <div className="flex gap-3 pt-4 border-t border-gray-100">
        <button onClick={submit} disabled={loading} className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm">
          {loading ? 'Booking…' : 'Book Appointment → Send S12'}
        </button>
        <button onClick={onCancel} className="px-6 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
      </div>
    </div>
  );
}

// ── Create Schedule Form ──────────────────────────────────────
function CreateScheduleForm({ onSuccess, onCancel }) {
  const [providers, setProviders] = useState([]);
  const [provider_id, setProviderId] = useState('');
  const [schedule_date, setDate]    = useState(today());
  const [start_time, setStart]      = useState('08:00');
  const [end_time, setEnd]          = useState('17:00');
  const [department, setDept]       = useState('OUTPATIENT');
  const [slot_duration, setDur]     = useState(30);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    fetch(`${API}/providers`).then(r=>r.json()).then(d=>setProviders(d.providers||[]));
  }, []);

  const submit = async () => {
    if (!provider_id || !schedule_date) { setError('Provider and date required.'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}/schedules`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ provider_id: parseInt(provider_id), schedule_date, start_time, end_time, department, location_name:'CLINIC', slot_duration: parseInt(slot_duration) })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      onSuccess(data);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const slotCount = start_time && end_time && slot_duration
    ? Math.floor((new Date(`2000-01-01T${end_time}`) - new Date(`2000-01-01T${start_time}`)) / (slot_duration * 60000))
    : 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-lg">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Create Provider Schedule</h2>
          <p className="text-xs text-gray-400 mt-0.5">Generates bookable time slots for a provider on a given day.</p>
        </div>
        <button onClick={onCancel} className="text-gray-400 text-sm">✕</button>
      </div>
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}
      <div className="space-y-3">
        <div><label className={labelCls}>Provider</label>
          <select value={provider_id} onChange={e=>setProviderId(e.target.value)} className={inputCls}>
            <option value="">Select…</option>
            {providers.map(p=><option key={p.id} value={p.id}>Dr. {p.first_name} {p.last_name} — {p.specialty}</option>)}
          </select></div>
        <div><label className={labelCls}>Date</label>
          <input type="date" value={schedule_date} onChange={e=>setDate(e.target.value)} min={today()} className={inputCls} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Start Time</label>
            <input type="time" value={start_time} onChange={e=>setStart(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>End Time</label>
            <input type="time" value={end_time} onChange={e=>setEnd(e.target.value)} className={inputCls} /></div>
        </div>
        <div><label className={labelCls}>Slot Duration (minutes)</label>
          <select value={slot_duration} onChange={e=>setDur(e.target.value)} className={inputCls}>
            {[15,20,30,45,60,90].map(d=><option key={d} value={d}>{d} min</option>)}
          </select></div>
        <div><label className={labelCls}>Department</label>
          <select value={department} onChange={e=>setDept(e.target.value)} className={inputCls}>
            {['OUTPATIENT','CARDIOLOGY','INTERNAL MEDICINE','SURGERY','EMERGENCY','FAMILY MEDICINE'].map(d=><option key={d}>{d}</option>)}
          </select></div>
      </div>
      {slotCount > 0 && (
        <div className="mt-4 bg-purple-50 border border-purple-100 rounded-xl p-3 text-xs text-purple-700">
          This will create <span className="font-bold">{slotCount} slots</span> of {slot_duration} min each.
        </div>
      )}
      <div className="flex gap-3 mt-5">
        <button onClick={submit} disabled={loading} className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm">
          {loading ? 'Creating…' : `Create Schedule (${slotCount} slots)`}
        </button>
        <button onClick={onCancel} className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
      </div>
    </div>
  );
}

// ── Appointment List ──────────────────────────────────────────
function AppointmentList({ onViewHL7, onCancel, onNoShow, refresh }) {
  const [appointments, setAppts] = useState([]);
  const [filterDate, setFilterDate] = useState(today());
  const [filterProvider, setFilterProvider] = useState('');
  const [providers, setProviders] = useState([]);

  useEffect(() => { fetch(`${API}/providers`).then(r=>r.json()).then(d=>setProviders(d.providers||[])); }, []);

  useEffect(() => {
    let url = `${API}/appointments?limit=100`;
    if (filterDate) url += `&date=${filterDate}`;
    if (filterProvider) url += `&provider_id=${filterProvider}`;
    fetch(url).then(r=>r.json()).then(d=>setAppts(d.appointments||[]));
  }, [filterDate, filterProvider, refresh]);

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
        <select value={filterProvider} onChange={e=>setFilterProvider(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white">
          <option value="">All providers</option>
          {providers.map(p=><option key={p.id} value={p.id}>Dr. {p.last_name}</option>)}
        </select>
        <button onClick={()=>{setFilterDate('');setFilterProvider('');}} className="text-xs text-gray-400 hover:text-gray-600 px-3">Clear</button>
      </div>

      {!appointments.length
        ? <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <div className="text-4xl mb-3">📅</div>
            <p className="text-gray-500 text-sm">No appointments found. Create a provider schedule first, then book.</p>
          </div>
        : <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide bg-gray-50">
                <th className="text-left px-5 py-3">Time</th>
                <th className="text-left px-5 py-3">Patient</th>
                <th className="text-left px-5 py-3">Visit Type</th>
                <th className="text-left px-5 py-3">Provider</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Chief Complaint</th>
                <th className="px-5 py-3"></th>
              </tr></thead>
              <tbody>
                {appointments.map(a=>(
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{a.start_time?.substring(0,5)}</div>
                      <div className="text-xs text-gray-400">{fmtDate(a.appt_date)}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{a.last_name}, {a.first_name}</div>
                      <div className="text-xs text-gray-400">MRN: {a.patient_mrn} · {age(a.date_of_birth)}y {a.sex}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{backgroundColor: a.vt_color+'20', color: a.vt_color}}>
                        {a.vt_name || '—'}
                      </span>
                      <div className="text-xs text-gray-400 mt-0.5">{a.duration_min} min</div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">Dr. {a.prov_last}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[a.status]||'bg-gray-100 text-gray-600'}`}>{a.status}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs max-w-xs truncate">{a.chief_complaint||'—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2 whitespace-nowrap">
                        <button onClick={()=>onViewHL7(a.id)} className="text-xs text-purple-600 hover:underline">HL7</button>
                        {a.status==='SCHEDULED' && <>
                          <button onClick={()=>onCancel(a)} className="text-xs text-red-500 hover:underline">Cancel</button>
                          <button onClick={()=>onNoShow(a)} className="text-xs text-orange-500 hover:underline">No-Show</button>
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      }
    </div>
  );
}

// ── HL7 Viewer ────────────────────────────────────────────────
function HL7Viewer({ apptId, onClose }) {
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch(`${API}/appointments/${apptId}/hl7`).then(r=>r.json()).then(d=>{
      setEvents(d.siu_events||[]);
      if (d.siu_events?.[0]) setSelected(d.siu_events[0]);
    });
  }, [apptId]);

  const segments = selected?.hl7_message?.split('\r').filter(Boolean)||[];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4">
      <div className="bg-gray-950 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div><h3 className="text-white font-semibold text-sm">SIU HL7 Message Viewer</h3>
            <p className="text-gray-400 text-xs">Appointment #{apptId}</p></div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="flex gap-2 p-3 border-b border-gray-800">
          {events.map((e,i)=>(
            <button key={i} onClick={()=>setSelected(e)}
              className={`text-xs px-3 py-1 rounded-full font-mono ${selected===e?'bg-purple-600 text-white':'bg-gray-800 text-gray-300'}`}>
              {e.event_type}
            </button>
          ))}
        </div>
        <div className="p-4 max-h-96 overflow-y-auto font-mono text-xs">
          {!events.length
            ? <div className="text-gray-400">No HL7 events yet.</div>
            : segments.map((seg,i)=>{
                const type=seg.substring(0,3);
                const colors={MSH:'text-yellow-300',SCH:'text-purple-300',PID:'text-green-300',AIP:'text-blue-300',AIL:'text-cyan-300'};
                const fields=seg.split('|');
                return(
                  <div key={i} className="mb-1.5">
                    <span className={`font-bold ${colors[type]||'text-gray-300'}`}>{fields[0]}</span>
                    <span className="text-gray-500">|</span>
                    <span className="text-gray-300">{fields.slice(1).join('|')}</span>
                  </div>
                );
              })
          }
          <div className="mt-3 pt-3 border-t border-gray-800 text-gray-500 text-xs">Sent: {fmt(selected?.sent_at)}</div>
        </div>
      </div>
    </div>
  );
}

// ── Main Scheduling Page ──────────────────────────────────────
export default function SchedulingModule() {
  const [view, setView]         = useState('appointments');
  const [hl7ApptId, setHL7Id]   = useState(null);
  const [toast, setToast]       = useState('');
  const [refresh, setRefresh]   = useState(0);

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),4000); };
  const bump = () => setRefresh(r => r + 1);

  const handleCancel = async appt => {
    if (!window.confirm(`Cancel appointment for ${appt.first_name} ${appt.last_name}? Sends SIU^S15.`)) return;
    const r = await fetch(`${API}/appointments/${appt.id}/cancel`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ reason:'Patient request' }) });
    if (r.ok) { showToast(`✅ Cancelled — SIU^S15 sent`); bump(); }
  };

  const handleNoShow = async appt => {
    if (!window.confirm(`Mark ${appt.first_name} ${appt.last_name} as no-show? Sends SIU^S26.`)) return;
    const r = await fetch(`${API}/appointments/${appt.id}/noshow`, { method:'POST', headers:{'Content-Type':'application/json'} });
    if (r.ok) { showToast(`✅ No-show recorded — SIU^S26 sent`); bump(); }
  };

  const tabs = [
    { id:'appointments', label:'Appointments',   icon:'📅' },
    { id:'book',         label:'Book Appointment',icon:'➕' },
    { id:'schedule',     label:'Create Schedule', icon:'🗓' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center gap-3 mb-4">
          <a href="/" className="text-gray-400 hover:text-gray-600 text-sm">← MedCore</a>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-700">Scheduling</span>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full ml-2">Module 2</span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Scheduling</h1>
            <p className="text-sm text-gray-500 mt-0.5">Appointments · Provider calendars · Slots · HL7 SIU messages</p>
          </div>
          <div className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <span className="font-semibold text-gray-600">Epic equivalent:</span> Cadence module
          </div>
        </div>
        <div className="flex gap-1 mt-4">
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setView(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view===t.id?'bg-purple-600 text-white':'text-gray-600 hover:bg-gray-100'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm rounded-xl px-5 py-3 shadow-xl">{toast}</div>}
      {hl7ApptId && <HL7Viewer apptId={hl7ApptId} onClose={()=>setHL7Id(null)} />}

      <div className="max-w-6xl mx-auto px-8 py-6">
        {view==='appointments' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">Appointment Schedule</h2>
                <p className="text-xs text-gray-400 mt-0.5">First create a provider schedule, then book appointments into the slots.</p>
              </div>
              <button onClick={()=>setView('book')} className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-xl">+ Book Appointment</button>
            </div>
            <AppointmentList onViewHL7={setHL7Id} onCancel={handleCancel} onNoShow={handleNoShow} refresh={refresh} />
          </>
        )}
        {view==='book' && (
          <BookForm
            onSuccess={appt => { showToast(`✅ Booked — SIU^S12 sent · ${appt.appt_date} ${appt.start_time?.substring(0,5)}`); setView('appointments'); bump(); }}
            onCancel={()=>setView('appointments')}
          />
        )}
        {view==='schedule' && (
          <CreateScheduleForm
            onSuccess={data => { showToast(`✅ Schedule created — ${data.slots_created} slots generated`); setView('book'); }}
            onCancel={()=>setView('appointments')}
          />
        )}
      </div>

      {view==='appointments' && (
        <div className="max-w-6xl mx-auto px-8 pb-8">
          <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5 mt-2">
            <h3 className="font-semibold text-purple-900 text-sm mb-2">How to get started with Scheduling</h3>
            <ol className="text-xs text-purple-700 space-y-1 list-decimal list-inside">
              <li>Click <strong>Create Schedule</strong> — pick a provider, date, and hours. This generates the time slots.</li>
              <li>Click <strong>Book Appointment</strong> — enter a patient MRN, pick the provider/date/slot.</li>
              <li>Watch the appointment appear in the list and click <strong>HL7</strong> to see the SIU^S12 message.</li>
              <li>Try <strong>Cancel</strong> or <strong>No-Show</strong> to see SIU^S15 and SIU^S26.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
