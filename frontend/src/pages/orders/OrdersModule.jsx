import { useState, useEffect } from 'react';

const API = '/api/orders';
const ADT = '/api/adt';

function fmt(dt) { if(!dt)return'—'; return new Date(dt).toLocaleString(); }
function age(dob) { if(!dob)return'?'; return Math.floor((Date.now()-new Date(dob).getTime())/(365.25*24*60*60*1000)); }

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";

const typeColors = {
  LAB:      { bg:'bg-blue-50',   border:'border-blue-200',   text:'text-blue-700',   badge:'bg-blue-100 text-blue-700'   },
  MED:      { bg:'bg-green-50',  border:'border-green-200',  text:'text-green-700',  badge:'bg-green-100 text-green-700'  },
  IMAGING:  { bg:'bg-purple-50', border:'border-purple-200', text:'text-purple-700', badge:'bg-purple-100 text-purple-700' },
  PROCEDURE:{ bg:'bg-orange-50', border:'border-orange-200', text:'text-orange-700', badge:'bg-orange-100 text-orange-700' },
};

const statusColors = {
  PENDING:     'bg-yellow-100 text-yellow-700',
  SENT:        'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  COMPLETED:   'bg-green-100 text-green-700',
  CANCELLED:   'bg-red-100 text-red-700',
  ERROR:       'bg-red-100 text-red-700',
};

// ── Patient Lookup ────────────────────────────────────────────
function PatientLookup({ onSelect }) {
  const [mrn, setMrn]         = useState('');
  const [patient, setPatient] = useState(null);
  const [error, setError]     = useState('');

  const lookup = async () => {
    if (!mrn) return;
    setError('');
    try {
      const r = await fetch(`${ADT}/patients/${mrn}`);
      const d = await r.json();
      if (!r.ok) { setError('Patient not found'); setPatient(null); return; }
      setPatient(d.patient);
      onSelect(d.patient, d.encounters);
    } catch { setError('Lookup failed'); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
      <h3 className="font-semibold text-gray-900 text-sm mb-3">Patient Context</h3>
      <div className="flex gap-2">
        <input value={mrn} onChange={e=>setMrn(e.target.value)} onKeyDown={e=>e.key==='Enter'&&lookup()}
          placeholder="Enter MRN (e.g. M100000)" className={inputCls} />
        <button onClick={lookup} className="px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium whitespace-nowrap">Look up</button>
      </div>
      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
      {patient && (
        <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3">
          <div className="font-semibold text-green-900 text-sm">{patient.last_name}, {patient.first_name}</div>
          <div className="text-xs text-green-700 mt-0.5">MRN: {patient.mrn} · DOB: {patient.date_of_birth?.substring(0,10)} · Age {age(patient.date_of_birth)} · {patient.sex}</div>
        </div>
      )}
    </div>
  );
}

// ── Order Entry Form ──────────────────────────────────────────
function OrderForm({ patient, encounters, onSuccess }) {
  const [catalog, setCatalog]         = useState([]);
  const [providers, setProviders]     = useState([]);
  const [orderSets, setOrderSets]     = useState([]);
  const [activeType, setActiveType]   = useState('LAB');
  const [selectedItem, setItem]       = useState(null);
  const [encounter_csn, setCSN]       = useState('');
  const [provider_id, setProvider]    = useState('');
  const [priority, setPriority]       = useState('ROUTINE');
  const [indication, setIndication]   = useState('');
  const [instructions, setInstructions] = useState('');
  const [dose, setDose]               = useState('');
  const [dose_unit, setDoseUnit]      = useState('mg');
  const [route, setRoute]             = useState('PO');
  const [frequency, setFreq]          = useState('');
  const [body_part, setBodyPart]      = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [selectedSet, setSet]         = useState('');

  useEffect(() => {
    fetch(`${API}/catalog?type=${activeType}`).then(r=>r.json()).then(d=>{ setCatalog(d.catalog||[]); setItem(null); });
  }, [activeType]);

  useEffect(() => {
    fetch(`${API}/providers`).then(r=>r.json()).then(d=>setProviders(d.providers||[]));
    fetch(`${API}/order-sets`).then(r=>r.json()).then(d=>setOrderSets(d.order_sets||[]));
  }, []);

  const placeOrder = async () => {
    if (!selectedItem || !patient) { setError('Select a patient and an order item.'); return; }
    setLoading(true); setError('');
    try {
      const body = {
        patient_mrn: patient.mrn, encounter_csn: encounter_csn||null,
        catalog_id: selectedItem.id, order_type: activeType,
        order_name: selectedItem.name, order_code: selectedItem.code,
        order_code_system: selectedItem.code_system,
        priority, ordering_provider_id: provider_id||null,
        clinical_indication: indication, special_instructions: instructions,
        specimen_type: selectedItem.specimen_type,
        dose, dose_unit, route, frequency, body_part,
      };
      const r = await fetch(`${API}/orders`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      onSuccess(data);
      setItem(null); setIndication(''); setInstructions(''); setDose(''); setFreq(''); setBodyPart('');
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const placeOrderSet = async () => {
    if (!selectedSet || !patient) return;
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}/orders/order-set`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ patient_mrn: patient.mrn, encounter_csn: encounter_csn||null, order_set_id: parseInt(selectedSet), ordering_provider_id: provider_id||null })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      onSuccess({ order: null, orders_placed: data.orders_placed, isSet: true });
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const types = ['LAB','IMAGING','MED','PROCEDURE'];

  if (!patient) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
      <div className="text-4xl mb-3">📋</div>
      <p className="text-gray-500 text-sm">Look up a patient above to start entering orders.</p>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Order type tabs */}
      <div className="flex border-b border-gray-100">
        {types.map(t => (
          <button key={t} onClick={()=>setActiveType(t)}
            className={`flex-1 py-3 text-xs font-semibold transition-colors ${activeType===t?`${typeColors[t]?.text} border-b-2 border-current bg-gray-50`:'text-gray-500 hover:bg-gray-50'}`}>
            {t === 'LAB' ? '🔬 Lab' : t === 'MED' ? '💊 Medications' : t === 'IMAGING' ? '📡 Imaging' : '⚙️ Procedure'}
          </button>
        ))}
      </div>

      <div className="p-5">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mb-4">{error}</div>}

        {/* Order set quick-picker */}
        <div className="flex gap-2 mb-4 pb-4 border-b border-gray-100">
          <select value={selectedSet} onChange={e=>setSet(e.target.value)} className={inputCls}>
            <option value="">Order Sets (quick-order bundles)…</option>
            {orderSets.map(s=><option key={s.id} value={s.id}>{s.name} ({s.items?.length||0} orders)</option>)}
          </select>
          <button onClick={placeOrderSet} disabled={!selectedSet||loading}
            className="px-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-lg text-xs font-medium whitespace-nowrap">
            Place Set
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelCls}>Encounter (CSN)</label>
            <select value={encounter_csn} onChange={e=>setCSN(e.target.value)} className={inputCls}>
              <option value="">No encounter linked</option>
              {(encounters||[]).filter(e=>e.encounter_status==='ADMITTED'||e.encounter_status==='REGISTERED').map(e=>(
                <option key={e.csn} value={e.csn}>CSN: {e.csn} — {e.encounter_type} ({e.encounter_status})</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Ordering Provider</label>
            <select value={provider_id} onChange={e=>setProvider(e.target.value)} className={inputCls}>
              <option value="">Select provider…</option>
              {providers.map(p=><option key={p.id} value={p.id}>Dr. {p.first_name} {p.last_name}</option>)}
            </select>
          </div>
        </div>

        {/* Order catalog */}
        <div className="mb-4">
          <label className={labelCls}>Select Order <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-100 rounded-xl p-2">
            {catalog.map(item => (
              <button key={item.id} onClick={()=>setItem(item)}
                className={`text-left p-2 rounded-lg border text-xs transition-all ${selectedItem?.id===item.id?`${typeColors[activeType]?.border} ${typeColors[activeType]?.bg} font-semibold`:'border-gray-100 hover:border-gray-300 hover:bg-gray-50'}`}>
                <div className="font-medium text-gray-900 leading-tight">{item.name}</div>
                {item.code && <div className="text-gray-400 mt-0.5 font-mono">{item.code}</div>}
                {item.specimen_type && <div className="text-gray-400">Specimen: {item.specimen_type}</div>}
              </button>
            ))}
          </div>
        </div>

        {selectedItem && (
          <div className={`rounded-xl p-3 mb-4 border ${typeColors[activeType]?.bg} ${typeColors[activeType]?.border}`}>
            <div className={`font-semibold text-sm ${typeColors[activeType]?.text}`}>Selected: {selectedItem.name}</div>
            {selectedItem.code && <div className="text-xs text-gray-500 mt-0.5">Code: {selectedItem.code} ({selectedItem.code_system})</div>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className={labelCls}>Priority</label>
            <select value={priority} onChange={e=>setPriority(e.target.value)} className={inputCls}>
              <option value="ROUTINE">Routine</option>
              <option value="STAT">STAT</option>
              <option value="ASAP">ASAP</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Clinical Indication</label>
            <input value={indication} onChange={e=>setIndication(e.target.value)} placeholder="Why this order is being placed" className={inputCls} />
          </div>
        </div>

        {/* Medication-specific fields */}
        {activeType === 'MED' && (
          <div className="grid grid-cols-3 gap-3 mb-4 bg-green-50 rounded-xl p-3 border border-green-100">
            <div><label className={labelCls}>Dose</label>
              <input value={dose} onChange={e=>setDose(e.target.value)} placeholder="e.g. 10" className={inputCls} /></div>
            <div><label className={labelCls}>Unit</label>
              <select value={dose_unit} onChange={e=>setDoseUnit(e.target.value)} className={inputCls}>
                {['mg','mcg','g','mEq','units','mL','%'].map(u=><option key={u}>{u}</option>)}
              </select></div>
            <div><label className={labelCls}>Route</label>
              <select value={route} onChange={e=>setRoute(e.target.value)} className={inputCls}>
                {['PO','IV','SQ','IM','SL','TOP','INH'].map(r=><option key={r}>{r}</option>)}
              </select></div>
            <div className="col-span-3"><label className={labelCls}>Frequency</label>
              <select value={frequency} onChange={e=>setFreq(e.target.value)} className={inputCls}>
                <option value="">Select…</option>
                {['Daily','BID','TID','QID','Q4H','Q6H','Q8H','Q12H','PRN','Once','Weekly'].map(f=><option key={f}>{f}</option>)}
              </select></div>
          </div>
        )}

        {/* Imaging-specific fields */}
        {activeType === 'IMAGING' && (
          <div className="grid grid-cols-2 gap-3 mb-4 bg-purple-50 rounded-xl p-3 border border-purple-100">
            <div><label className={labelCls}>Body Part</label>
              <input value={body_part} onChange={e=>setBodyPart(e.target.value)} placeholder="e.g. Chest, Head, Knee" className={inputCls} /></div>
            <div><label className={labelCls}>Special Instructions</label>
              <input value={instructions} onChange={e=>setInstructions(e.target.value)} placeholder="e.g. With contrast" className={inputCls} /></div>
          </div>
        )}

        <div className="pt-4 border-t border-gray-100">
          <div className={`text-xs mb-3 p-3 rounded-xl ${typeColors[activeType]?.bg} ${typeColors[activeType]?.text}`}>
            <span className="font-semibold">What fires: </span>
            {activeType==='MED' ? 'RDE^O11 → routed to mock Pharmacy' : activeType==='IMAGING' ? 'ORM^O01 → routed to mock Radiology' : 'ORM^O01 → routed to mock Lab'}
          </div>
          <button onClick={placeOrder} disabled={!selectedItem||loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm">
            {loading ? 'Placing Order…' : `Place ${activeType} Order → Send ${activeType==='MED'?'RDE^O11':'ORM^O01'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Order List ────────────────────────────────────────────────
function OrderList({ onViewHL7, onCancel, refresh }) {
  const [orders, setOrders]     = useState([]);
  const [filterMrn, setMrn]     = useState('');
  const [filterType, setType]   = useState('');
  const [filterStatus, setStatus] = useState('');

  useEffect(() => {
    let url = `${API}/orders?limit=100`;
    if (filterMrn) url += `&patient_mrn=${filterMrn}`;
    if (filterType) url += `&type=${filterType}`;
    if (filterStatus) url += `&status=${filterStatus}`;
    fetch(url).then(r=>r.json()).then(d=>setOrders(d.orders||[]));
  }, [filterMrn, filterType, filterStatus, refresh]);

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <input value={filterMrn} onChange={e=>setMrn(e.target.value)} placeholder="Filter by MRN…"
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-green-300" />
        <select value={filterType} onChange={e=>setType(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white">
          <option value="">All types</option>
          {['LAB','MED','IMAGING','PROCEDURE'].map(t=><option key={t}>{t}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setStatus(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white">
          <option value="">All statuses</option>
          {['PENDING','SENT','IN_PROGRESS','COMPLETED','CANCELLED'].map(s=><option key={s}>{s}</option>)}
        </select>
        <button onClick={()=>{setMrn('');setType('');setStatus('');}} className="text-xs text-gray-400 hover:text-gray-600 px-3">Clear</button>
      </div>

      {!orders.length
        ? <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-500 text-sm">No orders yet. Look up a patient and place your first order.</p>
          </div>
        : <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide bg-gray-50">
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Order</th>
                <th className="text-left px-4 py-3">Patient</th>
                <th className="text-left px-4 py-3">Placer #</th>
                <th className="text-left px-4 py-3">Priority</th>
                <th className="text-left px-4 py-3">Provider</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Ordered</th>
                <th className="px-4 py-3"></th>
              </tr></thead>
              <tbody>
                {orders.map(o=>(
                  <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${typeColors[o.order_type]?.badge||'bg-gray-100 text-gray-600'}`}>{o.order_type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 text-xs leading-tight max-w-xs">{o.order_name}</div>
                      {o.order_code && <div className="text-gray-400 font-mono text-xs">{o.order_code}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-gray-900">{o.last_name}, {o.first_name}</div>
                      <div className="text-xs text-gray-400 font-mono">{o.patient_mrn}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{o.placer_order_num}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${o.priority==='STAT'?'text-red-600':o.priority==='ASAP'?'text-orange-500':'text-gray-500'}`}>{o.priority}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{o.prov_last?`Dr. ${o.prov_last}`:'—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[o.status]||'bg-gray-100 text-gray-600'}`}>{o.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmt(o.ordered_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 whitespace-nowrap">
                        <button onClick={()=>onViewHL7(o.id)} className="text-xs text-green-600 hover:underline">HL7</button>
                        {o.status==='SENT'&&<button onClick={()=>onCancel(o)} className="text-xs text-red-500 hover:underline">Cancel</button>}
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
function HL7Viewer({ orderId, onClose }) {
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    fetch(`${API}/orders/${orderId}/hl7`).then(r=>r.json()).then(d=>{
      setEvents(d.orm_events||[]);
      if(d.orm_events?.[0]) setSelected(d.orm_events[0]);
    });
  }, [orderId]);
  const segments = selected?.hl7_message?.split('\r').filter(Boolean)||[];
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4">
      <div className="bg-gray-950 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h3 className="text-white font-semibold text-sm">Order HL7 Message Viewer</h3>
            <p className="text-gray-400 text-xs">Order #{orderId} — {selected?.destination}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="flex gap-2 p-3 border-b border-gray-800">
          {events.map((e,i)=>(
            <button key={i} onClick={()=>setSelected(e)}
              className={`text-xs px-3 py-1 rounded-full font-mono ${selected===e?'bg-green-600 text-white':'bg-gray-800 text-gray-300'}`}>
              {e.event_type}
            </button>
          ))}
        </div>
        <div className="p-4 max-h-96 overflow-y-auto font-mono text-xs">
          {!events.length
            ? <div className="text-gray-400">No HL7 events yet.</div>
            : segments.map((seg,i)=>{
                const type=seg.substring(0,3);
                const colors={MSH:'text-yellow-300',PID:'text-green-300',PV1:'text-blue-300',ORC:'text-orange-300',OBR:'text-cyan-300',RXO:'text-pink-300',RXR:'text-purple-300'};
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
          <div className="mt-3 pt-3 border-t border-gray-800 text-gray-500 text-xs">
            Sent to: {selected?.destination} · {fmt(selected?.sent_at)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Orders Page ──────────────────────────────────────────
export default function OrdersModule() {
  const [view, setView]         = useState('orders');
  const [patient, setPatient]   = useState(null);
  const [encounters, setEncounters] = useState([]);
  const [hl7OrderId, setHL7Id]  = useState(null);
  const [toast, setToast]       = useState('');
  const [refresh, setRefresh]   = useState(0);

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),5000); };
  const bump = () => setRefresh(r=>r+1);

  const handleCancel = async order => {
    if (!window.confirm(`Cancel order: ${order.order_name}? Sends cancellation HL7.`)) return;
    const r = await fetch(`${API}/orders/${order.id}/cancel`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ reason:'Clinician cancelled' }) });
    if (r.ok) { showToast(`✅ Order cancelled — ${order.order_type==='MED'?'RDE^O11':'ORM^O01'} CA sent`); bump(); }
  };

  const handleOrderSuccess = (data) => {
    if (data.isSet) {
      showToast(`✅ Order set placed — ${data.orders_placed} orders sent`);
    } else {
      showToast(`✅ ${data.order?.order_type} order placed — ${data.order?.order_type==='MED'?'RDE^O11':'ORM^O01'} → ${data.destination}`);
    }
    bump();
    setView('orders');
  };

  const tabs = [
    { id:'orders', label:'Order List', icon:'📋' },
    { id:'entry',  label:'Place Orders', icon:'➕' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center gap-3 mb-4">
          <a href="/" className="text-gray-400 hover:text-gray-600 text-sm">← MedCore</a>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-700">Orders (CPOE)</span>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-2">Module 3</span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Orders (CPOE)</h1>
            <p className="text-sm text-gray-500 mt-0.5">Lab · Medications · Imaging · ORM^O01 · RDE^O11 · Placer/Filler orders</p>
          </div>
          <div className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <span className="font-semibold text-gray-600">Epic equivalent:</span> Beaker / Willow / Radiant
          </div>
        </div>
        <div className="flex gap-1 mt-4">
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setView(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view===t.id?'bg-green-600 text-white':'text-gray-600 hover:bg-gray-100'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm rounded-xl px-5 py-3 shadow-xl max-w-sm">{toast}</div>}
      {hl7OrderId && <HL7Viewer orderId={hl7OrderId} onClose={()=>setHL7Id(null)} />}

      <div className="max-w-6xl mx-auto px-8 py-6">
        {view === 'entry' && (
          <>
            <PatientLookup onSelect={(p, encs) => { setPatient(p); setEncounters(encs||[]); }} />
            <OrderForm patient={patient} encounters={encounters} onSuccess={handleOrderSuccess} />
            <div className="mt-4 bg-green-50 border border-green-100 rounded-2xl p-5">
              <h3 className="font-semibold text-green-900 text-sm mb-2">How orders work in healthcare integration</h3>
              <div className="text-xs text-green-700 space-y-1">
                <p>• <strong>Lab orders</strong> fire ORM^O01 → received by the Lab Information System (LIS) → analyzer runs the test → results come back as ORU^R01 (Module 4)</p>
                <p>• <strong>Medication orders</strong> fire RDE^O11 → received by the Pharmacy System → pharmacist verifies → dispenses to the floor</p>
                <p>• <strong>Imaging orders</strong> fire ORM^O01 → received by PACS/RIS → added to modality worklist → tech performs study → report comes back as MDM^T02</p>
                <p>• The <strong>Placer Order Number</strong> (PLO3XXXXX) is YOUR system's ID. The Filler assigns their own number when they accept it.</p>
              </div>
            </div>
          </>
        )}
        {view === 'orders' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">Order List</h2>
                <p className="text-xs text-gray-400 mt-0.5">All orders placed in MedCore. Click HL7 to see the raw message sent to the fulfilling system.</p>
              </div>
              <button onClick={()=>setView('entry')} className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl">+ Place Orders</button>
            </div>
            <OrderList onViewHL7={setHL7Id} onCancel={handleCancel} refresh={refresh} />
          </>
        )}
      </div>
    </div>
  );
}
