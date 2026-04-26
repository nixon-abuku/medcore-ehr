import { useState, useEffect } from 'react';

const API = '/api/billing';
const ADT = '/api/adt';

function fmt(dt) { if(!dt)return'—'; return new Date(dt).toLocaleString(); }
function money(v) { if(!v&&v!==0)return'—'; return `$${parseFloat(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`; }

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-white";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";

const statusColors = {
  OPEN:'bg-blue-100 text-blue-700', BILLED:'bg-yellow-100 text-yellow-700',
  PAID:'bg-green-100 text-green-700', DENIED:'bg-red-100 text-red-700',
  PENDING:'bg-gray-100 text-gray-600', SUBMITTED:'bg-purple-100 text-purple-700',
  VOIDED:'bg-red-100 text-red-500', PARTIAL:'bg-orange-100 text-orange-700',
};

// ── Patient Lookup ────────────────────────────────────────────
function PatientLookup({ onSelect }) {
  const [mrn, setMrn]         = useState('');
  const [patient, setPatient] = useState(null);
  const [error, setError]     = useState('');
  const lookup = async () => {
    const r = await fetch(`${ADT}/patients/${mrn}`);
    const d = await r.json();
    if (!r.ok) { setError('Not found'); return; }
    setPatient(d.patient); onSelect(d.patient, d.encounters||[]); setError('');
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
      <h3 className="font-semibold text-gray-900 text-sm mb-3">Patient</h3>
      <div className="flex gap-2">
        <input value={mrn} onChange={e=>setMrn(e.target.value)} onKeyDown={e=>e.key==='Enter'&&lookup()} placeholder="Enter MRN…" className={inputCls} />
        <button onClick={lookup} className="px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">Look up</button>
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      {patient && <div className="mt-2 bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 text-xs">
        <span className="font-semibold text-emerald-900">{patient.last_name}, {patient.first_name}</span>
        <span className="text-emerald-600 ml-2">MRN: {patient.mrn}</span>
      </div>}
    </div>
  );
}

// ── Open Account Form ─────────────────────────────────────────
function OpenAccountForm({ patient, encounters, onSaved }) {
  const [payers, setPayers]           = useState([]);
  const [financial_class, setFCls]    = useState('COMMERCIAL');
  const [payer_id, setPayerId]        = useState('');
  const [member_id, setMemberId]      = useState('');
  const [group_number, setGroupNum]   = useState('');
  const [encounter_csn, setCSN]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  useEffect(() => { fetch(`${API}/payers`).then(r=>r.json()).then(d=>setPayers(d.payers||[])); }, []);

  const submit = async () => {
    if (!patient) { setError('Select patient first'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}/accounts`, { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ patient_mrn: patient.mrn, encounter_csn: encounter_csn||null, financial_class, payer_id: payer_id||null, member_id, group_number }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      onSaved(d.account);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
      <h3 className="font-semibold text-gray-900 text-sm mb-4">Open Billing Account <span className="text-xs text-gray-400 font-normal ml-1">→ Fires BAR^P01</span></h3>
      {error && <div className="bg-red-50 text-red-700 text-xs rounded-lg px-3 py-2 mb-3">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Financial Class</label>
          <select value={financial_class} onChange={e=>setFCls(e.target.value)} className={inputCls}>
            {['COMMERCIAL','MEDICARE','MEDICAID','SELF_PAY'].map(f=><option key={f}>{f}</option>)}
          </select></div>
        <div><label className={labelCls}>Payer</label>
          <select value={payer_id} onChange={e=>setPayerId(e.target.value)} className={inputCls}>
            <option value="">Select payer…</option>
            {payers.map(p=><option key={p.id} value={p.id}>{p.name} ({p.payer_type})</option>)}
          </select></div>
        <div><label className={labelCls}>Member ID</label>
          <input value={member_id} onChange={e=>setMemberId(e.target.value)} placeholder="Insurance member ID" className={inputCls} /></div>
        <div><label className={labelCls}>Group Number</label>
          <input value={group_number} onChange={e=>setGroupNum(e.target.value)} placeholder="Group number" className={inputCls} /></div>
        <div className="col-span-2"><label className={labelCls}>Encounter (CSN)</label>
          <select value={encounter_csn} onChange={e=>setCSN(e.target.value)} className={inputCls}>
            <option value="">No encounter</option>
            {(encounters||[]).map(e=><option key={e.csn} value={e.csn}>CSN {e.csn} — {e.encounter_type} ({e.encounter_status})</option>)}
          </select></div>
      </div>
      <button onClick={submit} disabled={loading||!patient} className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm">
        {loading?'Opening…':'Open Account → Send BAR^P01'}
      </button>
    </div>
  );
}

// ── Charge Entry ──────────────────────────────────────────────
function ChargeEntry({ patient, accounts, onSaved }) {
  const [cdm, setCdm]               = useState([]);
  const [selCdm, setSelCdm]         = useState('');
  const [account_id, setAcct]       = useState('');
  const [icd10, setIcd10]           = useState('');
  const [icd10desc, setIcd10desc]   = useState('');
  const [quantity, setQty]          = useState(1);
  const [deptFilter, setDeptFilter] = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    let url = `${API}/charge-master`;
    if (deptFilter) url += `?dept=${deptFilter}`;
    fetch(url).then(r=>r.json()).then(d=>setCdm(d.charge_master||[]));
  }, [deptFilter]);

  const submit = async () => {
    if (!selCdm||!patient) { setError('Select patient and charge'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}/charges`, { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ patient_mrn: patient.mrn, account_id: account_id||null, cdm_code: selCdm, quantity: parseInt(quantity), icd10_primary: icd10||null, icd10_desc: icd10desc||null, charge_source:'MANUAL' }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      onSaved(d.charge);
      setSelCdm(''); setIcd10(''); setIcd10desc(''); setQty(1);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const depts = [...new Set(cdm.map(c=>c.department))].sort();
  const selectedItem = cdm.find(c=>c.cdm_code===selCdm);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-semibold text-gray-900 text-sm mb-4">Enter Charge <span className="text-xs text-gray-400 font-normal ml-1">→ Fires DFT^P03</span></h3>
      {error && <div className="bg-red-50 text-red-700 text-xs rounded-lg px-3 py-2 mb-3">{error}</div>}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div><label className={labelCls}>Account</label>
          <select value={account_id} onChange={e=>setAcct(e.target.value)} className={inputCls}>
            <option value="">No account</option>
            {(accounts||[]).map(a=><option key={a.id} value={a.id}>{a.account_num} ({a.status})</option>)}
          </select></div>
        <div><label className={labelCls}>Department Filter</label>
          <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)} className={inputCls}>
            <option value="">All departments</option>
            {depts.map(d=><option key={d}>{d}</option>)}
          </select></div>
      </div>

      <div className="mb-4">
        <label className={labelCls}>Select Charge (CDM) <span className="text-red-500">*</span></label>
        <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto border border-gray-100 rounded-xl p-2">
          {cdm.map(item => (
            <button key={item.cdm_code} onClick={()=>setSelCdm(item.cdm_code)}
              className={`text-left p-2 rounded-lg border text-xs transition-all ${selCdm===item.cdm_code?'border-emerald-400 bg-emerald-50':'border-gray-100 hover:border-gray-300'}`}>
              <div className="font-medium text-gray-900 leading-tight">{item.description}</div>
              <div className="text-gray-400 mt-0.5">CPT: {item.cpt_code} · <span className="text-emerald-700 font-semibold">{money(item.charge_amount)}</span></div>
            </button>
          ))}
        </div>
      </div>

      {selectedItem && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-4 text-xs">
          <span className="font-semibold text-emerald-900">{selectedItem.description}</span>
          <span className="text-emerald-600 ml-2">CPT {selectedItem.cpt_code} · Revenue {selectedItem.revenue_code} · {money(selectedItem.charge_amount)}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div><label className={labelCls}>Quantity</label>
          <input type="number" min="1" value={quantity} onChange={e=>setQty(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>ICD-10 Code</label>
          <input value={icd10} onChange={e=>setIcd10(e.target.value)} placeholder="e.g. I10" className={inputCls} /></div>
        <div><label className={labelCls}>ICD-10 Description</label>
          <input value={icd10desc} onChange={e=>setIcd10desc(e.target.value)} placeholder="e.g. Hypertension" className={inputCls} /></div>
      </div>

      <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 mb-4 text-xs text-yellow-800">
        <span className="font-semibold">Remember:</span> Every charge needs a diagnosis code (ICD-10) for medical necessity. CPT without ICD-10 = claim denial.
      </div>

      <button onClick={submit} disabled={loading||!selCdm||!patient}
        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm">
        {loading?'Posting Charge…':'Post Charge → Send DFT^P03'}
      </button>
    </div>
  );
}

// ── Charge List ───────────────────────────────────────────────
function ChargeList({ patient, onViewHL7, onVoid, refresh }) {
  const [charges, setCharges] = useState([]);
  useEffect(() => {
    if (!patient) return;
    fetch(`${API}/charges?patient_mrn=${patient.mrn}`).then(r=>r.json()).then(d=>setCharges(d.charges||[]));
  }, [patient, refresh]);

  if (!charges.length) return <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">No charges yet.</div>;

  const total = charges.filter(c=>c.status!=='VOIDED').reduce((s,c)=>s+parseFloat(c.charge_amount)*c.quantity,0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
        <h3 className="font-semibold text-gray-900 text-sm">Charge Detail</h3>
        <span className="text-sm font-bold text-emerald-700">Total: {money(total)}</span>
      </div>
      <table className="w-full text-xs">
        <thead><tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wide">
          <th className="text-left px-4 py-2">Charge #</th>
          <th className="text-left px-4 py-2">Description</th>
          <th className="text-left px-4 py-2">CPT</th>
          <th className="text-left px-4 py-2">ICD-10</th>
          <th className="text-right px-4 py-2">Amount</th>
          <th className="text-left px-4 py-2">Status</th>
          <th className="px-4 py-2"></th>
        </tr></thead>
        <tbody>
          {charges.map(c=>(
            <tr key={c.id} className={`border-b border-gray-50 hover:bg-gray-50 ${c.status==='VOIDED'?'opacity-50':''}`}>
              <td className="px-4 py-2.5 font-mono text-gray-400">{c.charge_num}</td>
              <td className="px-4 py-2.5 text-gray-900 font-medium max-w-xs">{c.cpt_description}</td>
              <td className="px-4 py-2.5 font-mono text-gray-500">{c.cpt_code}</td>
              <td className="px-4 py-2.5 font-mono text-gray-500">{c.icd10_primary||<span className="text-red-400">MISSING</span>}</td>
              <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{money(c.charge_amount * c.quantity)}</td>
              <td className="px-4 py-2.5"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[c.status]||'bg-gray-100 text-gray-600'}`}>{c.status}</span></td>
              <td className="px-4 py-2.5">
                <div className="flex gap-2">
                  <button onClick={()=>onViewHL7(c.id)} className="text-xs text-emerald-600 hover:underline">HL7</button>
                  {c.status==='PENDING'&&<button onClick={()=>onVoid(c)} className="text-xs text-red-500 hover:underline">Void</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Claims Panel ──────────────────────────────────────────────
function ClaimsPanel({ patient, accounts, refresh, onRefresh }) {
  const [claims, setClaims] = useState([]);
  const [selAccount, setSelAcct] = useState('');
  const [selPayer, setSelPayer]   = useState('');
  const [payers, setPayers]       = useState([]);
  const [loading, setLoading]     = useState({});
  const [toast, setToast]         = useState('');

  useEffect(() => { fetch(`${API}/payers`).then(r=>r.json()).then(d=>setPayers(d.payers||[])); }, []);
  useEffect(() => {
    if (!patient) return;
    fetch(`${API}/claims?patient_mrn=${patient.mrn}`).then(r=>r.json()).then(d=>setClaims(d.claims||[]));
  }, [patient, refresh]);

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),5000); };

  const submitClaim = async () => {
    if (!selAccount||!selPayer) return;
    setLoading(l=>({...l,submit:true}));
    try {
      const r = await fetch(`${API}/claims`, { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ account_id: parseInt(selAccount), payer_id: parseInt(selPayer) }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      showToast(`✅ Claim ${d.claim.claim_num} submitted — X12 837 sent · ${money(d.claim.total_billed)} billed`);
      onRefresh();
    } catch(e) { showToast(`❌ ${e.message}`); }
    finally { setLoading(l=>({...l,submit:false})); }
  };

  const processRemittance = async (claimId) => {
    setLoading(l=>({...l,[claimId]:true}));
    try {
      const payPct = Math.random() > 0.2 ? 80 : 60; // simulate varying payments
      const r = await fetch(`${API}/claims/${claimId}/remittance`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ payment_pct: payPct }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      showToast(`💳 Remittance received — Paid: ${money(d.paid)} · Denied: ${money(d.denied)} (${payPct}% payment rate)`);
      onRefresh();
    } catch(e) { showToast(`❌ ${e.message}`); }
    finally { setLoading(l=>({...l,[claimId]:false})); }
  };

  return (
    <div className="space-y-4">
      {toast && <div className="bg-gray-900 text-white text-sm rounded-xl px-5 py-3 shadow-xl">{toast}</div>}

      {/* Submit new claim */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 text-sm mb-4">Submit Claim <span className="text-xs text-gray-400 font-normal">→ X12 837</span></h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Account to Bill</label>
            <select value={selAccount} onChange={e=>setSelAcct(e.target.value)} className={inputCls}>
              <option value="">Select account…</option>
              {(accounts||[]).map(a=><option key={a.id} value={a.id}>{a.account_num} · {money(a.total_charges)} · {a.status}</option>)}
            </select></div>
          <div><label className={labelCls}>Payer</label>
            <select value={selPayer} onChange={e=>setSelPayer(e.target.value)} className={inputCls}>
              <option value="">Select payer…</option>
              {payers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select></div>
        </div>
        <button onClick={submitClaim} disabled={loading.submit||!selAccount||!selPayer||!patient}
          className="mt-3 w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm">
          {loading.submit?'Submitting…':'Submit Claim → Send X12 837'}
        </button>
      </div>

      {/* Claims list */}
      {claims.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="font-semibold text-gray-900 text-sm">Claims</h3>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wide">
              <th className="text-left px-4 py-2">Claim #</th>
              <th className="text-left px-4 py-2">Payer</th>
              <th className="text-right px-4 py-2">Billed</th>
              <th className="text-right px-4 py-2">Paid</th>
              <th className="text-right px-4 py-2">Denied</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr></thead>
            <tbody>
              {claims.map(c=>(
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-gray-500">{c.claim_num}</td>
                  <td className="px-4 py-2.5 text-gray-900">{c.payer_name}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-700">{money(c.total_billed)}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-green-700">{money(c.total_paid)}</td>
                  <td className="px-4 py-2.5 text-right text-red-600">{money(c.total_denied)}</td>
                  <td className="px-4 py-2.5"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[c.status]||'bg-gray-100 text-gray-600'}`}>{c.status}</span></td>
                  <td className="px-4 py-2.5">
                    {c.status==='SUBMITTED' && (
                      <button onClick={()=>processRemittance(c.id)} disabled={loading[c.id]}
                        className="text-xs bg-green-100 hover:bg-green-200 text-green-700 font-medium px-2 py-1 rounded-lg whitespace-nowrap disabled:opacity-50">
                        {loading[c.id]?'Processing…':'Receive 835 →'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Eligibility Check ─────────────────────────────────────────
function EligibilityCheck({ patient }) {
  const [payers, setPayers]     = useState([]);
  const [payer_id, setPayerId]  = useState('');
  const [member_id, setMemberId] = useState('');
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);

  useEffect(() => { fetch(`${API}/payers`).then(r=>r.json()).then(d=>setPayers(d.payers||[])); }, []);

  const check = async () => {
    if (!patient||!payer_id) return;
    setLoading(true); setResult(null);
    try {
      const r = await fetch(`${API}/eligibility`, { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ patient_mrn: patient.mrn, payer_id: parseInt(payer_id), member_id }) });
      const d = await r.json();
      setResult(d);
    } catch(e) {} finally { setLoading(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-semibold text-gray-900 text-sm mb-4">Eligibility Check <span className="text-xs text-gray-400 font-normal">→ X12 270/271</span></h3>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div><label className={labelCls}>Payer</label>
          <select value={payer_id} onChange={e=>setPayerId(e.target.value)} className={inputCls}>
            <option value="">Select…</option>
            {payers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
        <div><label className={labelCls}>Member ID</label>
          <input value={member_id} onChange={e=>setMemberId(e.target.value)} placeholder="Insurance member ID" className={inputCls} /></div>
        <div className="flex items-end">
          <button onClick={check} disabled={loading||!patient||!payer_id}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold rounded-xl py-2 text-sm">
            {loading?'Checking…':'Check Eligibility → 270'}
          </button>
        </div>
      </div>
      {result && (
        <div className={`rounded-xl p-4 border ${result.covered?'bg-green-50 border-green-200':'bg-red-50 border-red-200'}`}>
          <div className={`font-bold text-sm mb-2 ${result.covered?'text-green-800':'text-red-800'}`}>
            {result.covered ? '✅ ELIGIBLE — Patient is covered' : '❌ NOT ELIGIBLE — Patient not covered'}
          </div>
          <div className="text-xs text-gray-600">Patient: {result.patient} · Payer: {result.payer}</div>
          <button onClick={()=>document.getElementById('x12-raw').classList.toggle('hidden')}
            className="text-xs text-gray-400 hover:text-gray-600 mt-2">Show X12 270/271 raw messages</button>
          <div id="x12-raw" className="hidden mt-2">
            <pre className="text-xs bg-gray-950 text-green-300 p-3 rounded-lg overflow-x-auto max-h-40 overflow-y-auto">{result.x12_270}</pre>
            <pre className="text-xs bg-gray-950 text-yellow-300 p-3 rounded-lg overflow-x-auto max-h-40 overflow-y-auto mt-2">{result.x12_271}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ── HL7 Viewer ────────────────────────────────────────────────
function HL7Viewer({ chargeId, onClose }) {
  const [charge, setCharge] = useState(null);
  useEffect(() => {
    fetch(`${API}/charges?patient_mrn=all`).then(()=>{});
    // Get charge directly
    fetch(`${API}/charges`).then(r=>r.json()).then(d=>{
      const c = d.charges?.find(c=>c.id===chargeId);
      setCharge(c);
    });
  }, [chargeId]);

  const segs = charge?.hl7_message?.split('\r').filter(Boolean)||[];
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4">
      <div className="bg-gray-950 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
        <div className="flex justify-between px-5 py-4 border-b border-gray-800">
          <div><h3 className="text-white font-semibold text-sm">DFT^P03 Message Viewer</h3>
            <p className="text-gray-400 text-xs">Charge #{charge?.charge_num}</p></div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-4 max-h-96 overflow-y-auto font-mono text-xs">
          {segs.map((seg,i)=>{
            const type=seg.substring(0,3);
            const colors={MSH:'text-yellow-300',EVN:'text-purple-300',PID:'text-green-300',PV1:'text-blue-300',FT1:'text-orange-300'};
            return(
              <div key={i} className="mb-1.5">
                <span className={`font-bold ${colors[type]||'text-gray-300'}`}>{seg.substring(0,3)}</span>
                <span className="text-gray-500">|</span>
                <span className="text-gray-300">{seg.substring(4)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main Billing Page ─────────────────────────────────────────
export default function BillingModule() {
  const [view, setView]       = useState('charges');
  const [patient, setPatient] = useState(null);
  const [encounters, setEncs] = useState([]);
  const [accounts, setAccts]  = useState([]);
  const [hl7ChargeId, setHL7] = useState(null);
  const [toast, setToast]     = useState('');
  const [refresh, setRefresh] = useState(0);

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),5000); };
  const bump = () => setRefresh(r=>r+1);

  const loadAccounts = (mrn) => {
    fetch(`${API}/accounts?patient_mrn=${mrn}`).then(r=>r.json()).then(d=>setAccts(d.accounts||[]));
  };

  const handleSelectPatient = (p, encs) => {
    setPatient(p); setEncs(encs||[]);
    loadAccounts(p.mrn);
  };

  const handleVoid = async (charge) => {
    if (!window.confirm(`Void charge ${charge.charge_num}?`)) return;
    await fetch(`${API}/charges/${charge.id}/void`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ reason:'Voided by user' }) });
    showToast(`✅ Charge voided`); bump();
  };

  const tabs = [
    { id:'charges',     label:'Charge Entry',      icon:'💲' },
    { id:'claims',      label:'Claims',             icon:'📄' },
    { id:'eligibility', label:'Eligibility',        icon:'✓'  },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center gap-3 mb-4">
          <a href="/" className="text-gray-400 hover:text-gray-600 text-sm">← MedCore</a>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-700">Billing & Charging</span>
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full ml-2">Module 6</span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Billing & Charging</h1>
            <p className="text-sm text-gray-500 mt-0.5">DFT^P03 · BAR^P01 · X12 270/271 · X12 837 · X12 835</p>
          </div>
          <div className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <span className="font-semibold text-gray-600">Epic equivalent:</span> Resolute (HB + PB)
          </div>
        </div>
        <div className="flex gap-1 mt-4">
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setView(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view===t.id?'bg-emerald-600 text-white':'text-gray-600 hover:bg-gray-100'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm rounded-xl px-5 py-3 shadow-xl max-w-sm">{toast}</div>}
      {hl7ChargeId && <HL7Viewer chargeId={hl7ChargeId} onClose={()=>setHL7(null)} />}

      <div className="max-w-5xl mx-auto px-8 py-6">
        <PatientLookup onSelect={handleSelectPatient} />

        {view==='charges' && (
          <>
            <OpenAccountForm patient={patient} encounters={encounters}
              onSaved={acct=>{ showToast(`✅ Account ${acct.account_num} opened — BAR^P01 sent`); loadAccounts(patient.mrn); bump(); }} />
            <ChargeEntry patient={patient} accounts={accounts}
              onSaved={c=>{ showToast(`✅ Charge posted — DFT^P03 sent · ${money(c.charge_amount)}`); bump(); }} />
            <div className="mt-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Charge Detail</h3>
              <ChargeList patient={patient} onViewHL7={id=>setHL7(id)} onVoid={handleVoid} refresh={refresh} />
            </div>
          </>
        )}

        {view==='claims' && (
          <ClaimsPanel patient={patient} accounts={accounts} refresh={refresh} onRefresh={bump} />
        )}

        {view==='eligibility' && (
          <EligibilityCheck patient={patient} />
        )}

        <div className="mt-6 bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
          <h3 className="font-semibold text-emerald-900 text-sm mb-2">Revenue Cycle in Healthcare Integration</h3>
          <div className="text-xs text-emerald-800 space-y-1">
            <p>• Admit patient → <strong>BAR^P01</strong> opens the billing account in the billing system</p>
            <p>• Clinical events (labs, procedures, room) → <strong>DFT^P03</strong> drops charges automatically</p>
            <p>• Every charge needs CPT (what) + ICD-10 (why) — missing diagnosis = claim denial</p>
            <p>• Charges reviewed → <strong>X12 837</strong> claim submitted to payer electronically</p>
            <p>• Payer processes → <strong>X12 835</strong> remittance comes back with payment and denial reasons</p>
            <p>• Denial reason codes (CO-45, PR-1, CO-97) tell you WHY they didn't pay — integration engineers build 835 parsers to handle these</p>
          </div>
        </div>
      </div>
    </div>
  );
}
