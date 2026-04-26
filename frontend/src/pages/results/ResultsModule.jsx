import { useState, useEffect } from 'react';

const API = '/api/results';

function fmt(dt) { if(!dt)return'—'; return new Date(dt).toLocaleString(); }
function age(dob) { if(!dob)return'?'; return Math.floor((Date.now()-new Date(dob).getTime())/(365.25*24*60*60*1000)); }

const flagConfig = {
  'HH': { label:'CRITICAL HIGH', bg:'bg-red-600',    text:'text-white',      border:'border-red-600'   },
  'LL': { label:'CRITICAL LOW',  bg:'bg-red-600',    text:'text-white',      border:'border-red-600'   },
  'H':  { label:'HIGH',          bg:'bg-orange-100', text:'text-orange-800', border:'border-orange-300' },
  'L':  { label:'LOW',           bg:'bg-blue-100',   text:'text-blue-800',   border:'border-blue-300'  },
  'A':  { label:'ABNORMAL',      bg:'bg-yellow-100', text:'text-yellow-800', border:'border-yellow-300' },
  'N':  { label:'Normal',        bg:'bg-green-50',   text:'text-green-700',  border:'border-green-200' },
  '':   { label:'—',             bg:'bg-gray-50',    text:'text-gray-500',   border:'border-gray-200'  },
};

function FlagBadge({ flag }) {
  const cfg = flagConfig[flag] || flagConfig[''];
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border} ${flag==='HH'||flag==='LL'?'animate-pulse':''}`}>
      {flag || '—'}
    </span>
  );
}

// ── Pending Orders (simulate results) ────────────────────────
function PendingOrders({ onResultReceived }) {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState({});
  const [toast, setToast]     = useState('');

  const load = () => fetch(`${API}/orders/pending`).then(r=>r.json()).then(d=>setOrders(d.orders||[]));
  useEffect(() => { load(); }, []);

  const simulate = async (order) => {
    setLoading(l => ({ ...l, [order.id]: true }));
    try {
      const r = await fetch(`${API}/simulate`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ order_id: order.id })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      const critCount = data.observations?.filter(o=>o.flag==='HH'||o.flag==='LL').length || 0;
      if (data.has_critical || critCount > 0) {
        setToast(`🚨 CRITICAL VALUES in ${order.order_name} — provider notification required!`);
      } else {
        setToast(`✅ Results received for ${order.order_name}`);
      }
      setTimeout(() => setToast(''), 6000);
      load();
      onResultReceived();
    } catch(e) { alert(e.message); }
    finally { setLoading(l => ({ ...l, [order.id]: false })); }
  };

  if (!orders.length) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
      <div className="text-3xl mb-2">✅</div>
      <p className="text-gray-500 text-sm">No pending orders awaiting results.</p>
      <p className="text-gray-400 text-xs mt-1">Go to Orders (CPOE) and place some lab orders first.</p>
    </div>
  );

  return (
    <div>
      {toast && (
        <div className={`mb-4 rounded-xl px-5 py-3 text-sm font-medium ${toast.includes('CRITICAL')?'bg-red-600 text-white animate-pulse':'bg-gray-900 text-white'}`}>
          {toast}
        </div>
      )}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-yellow-50">
          <h3 className="font-semibold text-yellow-900 text-sm">Pending Lab Orders — Awaiting Results</h3>
          <p className="text-xs text-yellow-700 mt-0.5">Click "Simulate Result" to generate a mock ORU^R01 as if the lab sent it back.</p>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
            <th className="text-left px-5 py-3">Order</th>
            <th className="text-left px-5 py-3">Patient</th>
            <th className="text-left px-5 py-3">Placer #</th>
            <th className="text-left px-5 py-3">Priority</th>
            <th className="text-left px-5 py-3">Ordered</th>
            <th className="px-5 py-3"></th>
          </tr></thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-5 py-3">
                  <div className="font-medium text-gray-900 text-xs">{o.order_name}</div>
                  <div className="text-gray-400 font-mono text-xs">{o.order_code}</div>
                </td>
                <td className="px-5 py-3">
                  <div className="text-xs font-medium text-gray-900">{o.last_name}, {o.first_name}</div>
                  <div className="text-xs text-gray-400 font-mono">{o.patient_mrn}</div>
                </td>
                <td className="px-5 py-3 font-mono text-xs text-gray-500">{o.placer_order_num}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-bold ${o.priority==='STAT'?'text-red-600':'text-gray-500'}`}>{o.priority}</span>
                </td>
                <td className="px-5 py-3 text-xs text-gray-400">{fmt(o.ordered_at)}</td>
                <td className="px-5 py-3">
                  <button onClick={() => simulate(o)} disabled={loading[o.id]}
                    className="text-xs bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap">
                    {loading[o.id] ? 'Generating…' : 'Simulate Result →'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Results Inbox ─────────────────────────────────────────────
function ResultsInbox({ refresh, onViewReport }) {
  const [reports, setReports]     = useState([]);
  const [filterMrn, setMrn]       = useState('');
  const [filterUnread, setUnread] = useState(false);

  useEffect(() => {
    let url = `${API}/reports?limit=100`;
    if (filterMrn) url += `&patient_mrn=${filterMrn}`;
    if (filterUnread) url += `&unread=true`;
    fetch(url).then(r=>r.json()).then(d=>setReports(d.reports||[]));
  }, [filterMrn, filterUnread, refresh]);

  const acknowledge = async (id, e) => {
    e.stopPropagation();
    await fetch(`${API}/reports/${id}/acknowledge`, { method:'POST' });
    setReports(rs => rs.map(r => r.id===id ? {...r, acknowledged_at: new Date().toISOString()} : r));
  };

  if (!reports.length) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
      <div className="text-4xl mb-3">📬</div>
      <p className="text-gray-500 text-sm">No results yet. Go to "Pending Orders" and simulate some results.</p>
    </div>
  );

  return (
    <div>
      <div className="flex gap-3 mb-4 items-center flex-wrap">
        <input value={filterMrn} onChange={e=>setMrn(e.target.value)} placeholder="Filter by MRN…"
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-yellow-300" />
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={filterUnread} onChange={e=>setUnread(e.target.checked)} className="rounded" />
          Unacknowledged only
        </label>
        <button onClick={()=>{setMrn('');setUnread(false);}} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
      </div>

      <div className="space-y-2">
        {reports.map(r => {
          const hasCritical = parseInt(r.critical_count) > 0;
          const hasAbnormal = parseInt(r.abnormal_count) > 0;
          const isUnread = !r.acknowledged_at;
          return (
            <div key={r.id} onClick={() => onViewReport(r.id)}
              className={`bg-white rounded-xl border cursor-pointer hover:shadow-md transition-all p-4 ${hasCritical?'border-red-400 bg-red-50':hasAbnormal?'border-orange-200':'border-gray-100'} ${isUnread?'shadow-sm':''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isUnread && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>}
                  {hasCritical && <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full animate-pulse">🚨 CRITICAL</span>}
                  {!hasCritical && hasAbnormal && <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">⚠ ABNORMAL</span>}
                  <div>
                    <div className="font-semibold text-sm text-gray-900">{r.test_name}</div>
                    <div className="text-xs text-gray-400">MRN: {r.patient_mrn} · {r.result_source} · {fmt(r.received_time)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-xs text-gray-500">
                    <div>{r.obs_count} component{r.obs_count!==1?'s':''}</div>
                    {parseInt(r.abnormal_count)>0 && <div className="text-orange-600 font-medium">{r.abnormal_count} abnormal</div>}
                  </div>
                  {isUnread && (
                    <button onClick={e=>acknowledge(r.id,e)}
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded-lg whitespace-nowrap">
                      Acknowledge
                    </button>
                  )}
                  {!isUnread && <span className="text-xs text-gray-300">✓ Acknowledged</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Report Detail Viewer ──────────────────────────────────────
function ReportDetail({ reportId, onClose, onAcknowledge }) {
  const [report, setReport] = useState(null);
  const [obs, setObs]       = useState([]);
  const [showHL7, setHL7]   = useState(false);

  useEffect(() => {
    fetch(`${API}/reports/${reportId}`).then(r=>r.json()).then(d=>{
      setReport(d.report); setObs(d.observations||[]);
    });
  }, [reportId]);

  const acknowledge = async () => {
    await fetch(`${API}/reports/${reportId}/acknowledge`, { method:'POST' });
    setReport(r => ({ ...r, acknowledged_at: new Date().toISOString() }));
    onAcknowledge();
  };

  if (!report) return null;

  const hasCritical = obs.some(o=>o.abnormal_flag==='HH'||o.abnormal_flag==='LL');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className={`px-6 py-4 border-b ${hasCritical?'bg-red-600 text-white':'bg-white'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`font-bold text-lg ${hasCritical?'text-white':'text-gray-900'}`}>{report.test_name}</h3>
              <p className={`text-xs mt-0.5 ${hasCritical?'text-red-100':'text-gray-400'}`}>
                MRN: {report.patient_mrn} · Placer: {report.placer_order_num} · Filler: {report.filler_order_num} · {report.result_source}
              </p>
            </div>
            <button onClick={onClose} className={`${hasCritical?'text-red-200 hover:text-white':'text-gray-400 hover:text-gray-600'}`}>✕</button>
          </div>
          {hasCritical && (
            <div className="mt-2 bg-red-800 rounded-lg px-3 py-2 text-xs text-white font-medium">
              🚨 CRITICAL VALUES PRESENT — Provider must be notified immediately per policy
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex gap-6 text-xs text-gray-500">
          <span><strong>Collected:</strong> {fmt(report.collection_time)}</span>
          <span><strong>Received:</strong> {fmt(report.received_time)}</span>
          <span><strong>Status:</strong> {report.report_status}</span>
          <span><strong>Lab:</strong> {report.performing_lab}</span>
        </div>

        {/* Observations */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
              <tr className="text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left px-6 py-3">Test Component</th>
                <th className="text-left px-6 py-3">LOINC</th>
                <th className="text-right px-6 py-3">Result</th>
                <th className="text-left px-6 py-3">Units</th>
                <th className="text-left px-6 py-3">Reference Range</th>
                <th className="text-center px-6 py-3">Flag</th>
              </tr>
            </thead>
            <tbody>
              {obs.map((o, i) => {
                const isCrit = o.abnormal_flag==='HH'||o.abnormal_flag==='LL';
                const isAbnormal = o.abnormal_flag && o.abnormal_flag!=='N' && o.abnormal_flag!=='';
                return (
                  <tr key={i} className={`border-b border-gray-50 ${isCrit?'bg-red-50':isAbnormal?'bg-orange-50':''}`}>
                    <td className={`px-6 py-3 font-medium text-sm ${isCrit?'text-red-900':isAbnormal?'text-orange-900':'text-gray-900'}`}>{o.observation_name}</td>
                    <td className="px-6 py-3 font-mono text-xs text-gray-400">{o.observation_code}</td>
                    <td className={`px-6 py-3 text-right font-bold text-base ${isCrit?'text-red-700':isAbnormal?'text-orange-700':'text-gray-900'}`}>
                      {o.value_display || o.value_numeric || o.value_text || '—'}
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-500">{o.units}</td>
                    <td className="px-6 py-3 text-xs text-gray-400">{o.reference_range}</td>
                    <td className="px-6 py-3 text-center"><FlagBadge flag={o.abnormal_flag} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* HL7 Raw message toggle */}
        <div className="px-6 py-2 border-t border-gray-100">
          <button onClick={()=>setHL7(!showHL7)} className="text-xs text-gray-400 hover:text-gray-600">
            {showHL7?'Hide':'Show'} raw ORU^R01 message
          </button>
          {showHL7 && (
            <div className="mt-2 bg-gray-950 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-48 overflow-y-auto">
              {report.raw_hl7?.split('\r').filter(Boolean).map((seg,i)=>{
                const type=seg.substring(0,3);
                const colors={MSH:'text-yellow-300',PID:'text-green-300',ORC:'text-orange-300',OBR:'text-cyan-300',OBX:'text-pink-300'};
                return(
                  <div key={i} className="mb-1">
                    <span className={`font-bold ${colors[type]||'text-gray-300'}`}>{seg.substring(0,3)}</span>
                    <span className="text-gray-500">|</span>
                    <span className="text-gray-300">{seg.substring(4)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
          <div className="text-xs text-gray-400">
            {report.acknowledged_at ? `✓ Acknowledged ${fmt(report.acknowledged_at)}` : 'Not yet acknowledged'}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600">Close</button>
            {!report.acknowledged_at && (
              <button onClick={acknowledge} className={`px-5 text-white font-semibold rounded-xl py-2 text-sm ${hasCritical?'bg-red-600 hover:bg-red-700':'bg-green-600 hover:bg-green-700'}`}>
                {hasCritical ? '🚨 Acknowledge Critical' : 'Acknowledge Results'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Results Page ─────────────────────────────────────────
export default function ResultsModule() {
  const [view, setView]         = useState('inbox');
  const [viewReportId, setView2] = useState(null);
  const [refresh, setRefresh]   = useState(0);

  const bump = () => setRefresh(r=>r+1);

  const tabs = [
    { id:'inbox',   label:'Results Inbox',    icon:'📬' },
    { id:'pending', label:'Pending Orders',   icon:'⏳' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center gap-3 mb-4">
          <a href="/" className="text-gray-400 hover:text-gray-600 text-sm">← MedCore</a>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-700">Results</span>
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full ml-2">Module 4</span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Results</h1>
            <p className="text-sm text-gray-500 mt-0.5">ORU^R01 · OBX segments · LOINC codes · Abnormal flags · Critical values</p>
          </div>
          <div className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <span className="font-semibold text-gray-600">Epic equivalent:</span> Beaker Results / In Basket
          </div>
        </div>
        <div className="flex gap-1 mt-4">
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setView(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view===t.id?'bg-yellow-500 text-white':'text-gray-600 hover:bg-gray-100'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {viewReportId && (
        <ReportDetail reportId={viewReportId} onClose={()=>setView2(null)} onAcknowledge={bump} />
      )}

      <div className="max-w-6xl mx-auto px-8 py-6">
        {view==='inbox' && (
          <>
            <div className="mb-4">
              <h2 className="font-semibold text-gray-900">Results Inbox</h2>
              <p className="text-xs text-gray-400 mt-0.5">Click any result to view observations, OBX values, and the raw ORU^R01 message. Critical values are highlighted.</p>
            </div>
            <ResultsInbox refresh={refresh} onViewReport={id=>{setView2(id);}} />
          </>
        )}
        {view==='pending' && (
          <>
            <div className="mb-4">
              <h2 className="font-semibold text-gray-900">Pending Lab Orders</h2>
              <p className="text-xs text-gray-400 mt-0.5">These orders have been sent to the lab but no results have come back yet. Simulate receiving an ORU^R01.</p>
            </div>
            <PendingOrders onResultReceived={()=>{bump();setView('inbox');}} />
          </>
        )}

        {view==='inbox' && (
          <div className="mt-6 bg-yellow-50 border border-yellow-100 rounded-2xl p-5">
            <h3 className="font-semibold text-yellow-900 text-sm mb-2">How results work in healthcare integration</h3>
            <div className="text-xs text-yellow-800 space-y-1">
              <p>• The lab analyzer finishes a test → sends <strong>ORU^R01</strong> to Mirth Connect via MLLP</p>
              <p>• Mirth routes it to the EHR → the EHR matches it to the original order via <strong>Placer Order Number</strong></p>
              <p>• Each test component = one <strong>OBX segment</strong> with value, units, range, and abnormal flag</p>
              <p>• <strong>HH / LL flags</strong> = critical values — must notify the ordering provider immediately (Joint Commission requirement)</p>
              <p>• The result lands in the provider's <strong>In Basket</strong> (Epic) awaiting acknowledgment</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
