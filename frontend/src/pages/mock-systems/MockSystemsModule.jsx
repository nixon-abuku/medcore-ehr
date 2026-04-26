import { useState, useEffect } from 'react';

const API = '/api/mock-systems';

function fmt(dt) { if(!dt)return'—'; return new Date(dt).toLocaleString(); }

function StatusCard({ name, port, httpPort, description, icon, color }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${API}/status/${httpPort}`);
        const d = await r.json();
        setStatus(d);
      } catch { setStatus(null); }
    };
    check();
    const t = setInterval(check, 5000);
    return () => clearInterval(t);
  }, [httpPort]);

  const borderMap = { blue:'border-blue-200', green:'border-green-200', purple:'border-purple-200', orange:'border-orange-200' };
  const bgMap = { blue:'bg-blue-50', green:'bg-green-50', purple:'bg-purple-50', orange:'bg-orange-50' };

  return (
    <div className={`bg-white rounded-2xl border-2 ${borderMap[color]||'border-gray-200'} shadow-sm p-5`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">{name}</h3>
            <p className="text-xs text-gray-400">MLLP :{port} · HTTP :{httpPort}</p>
          </div>
        </div>
        <div className={`w-3 h-3 rounded-full ${status ? 'bg-green-400' : 'bg-red-400'}`}></div>
      </div>
      <p className="text-xs text-gray-500 mb-3">{description}</p>
      {status && (
        <div className={`${bgMap[color]||'bg-gray-50'} rounded-xl p-3 text-xs`}>
          <div className="font-semibold text-gray-700 mb-1">Recent Activity</div>
          {status.dispensed?.length > 0 && status.dispensed.slice(-3).map((d,i) => (
            <div key={i} className="text-gray-600 truncate">{d.drugName} → {d.status}</div>
          ))}
          {status.studies?.length > 0 && status.studies.slice(-3).map((s,i) => (
            <div key={i} className="text-gray-600 truncate">{s.testName} → {s.completedAt?.substring(0,16)}</div>
          ))}
          {!status.dispensed && !status.studies && (
            <div className="text-gray-400">Online — waiting for messages</div>
          )}
        </div>
      )}
      {!status && (
        <div className="bg-red-50 rounded-xl p-3 text-xs text-red-600">
          Offline — check Docker logs
        </div>
      )}
    </div>
  );
}

function MirthChannelViewer() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading]   = useState(false);

  const loadChannels = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/mirth/channels`);
      const d = await r.json();
      setChannels(d.channels || []);
    } catch { setChannels([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadChannels(); }, []);

  const setupChannels = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/mirth/setup`, { method: 'POST' });
      const d = await r.json();
      alert(d.message || 'Setup complete! Refresh to see channels.');
      loadChannels();
    } catch(e) { alert('Setup failed: ' + e.message); }
    finally { setLoading(false); }
  };

  const statusColors = {
    STARTED:  'bg-green-100 text-green-700',
    STOPPED:  'bg-red-100 text-red-700',
    PAUSED:   'bg-yellow-100 text-yellow-700',
    DEPLOYING:'bg-blue-100 text-blue-700',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900 text-sm">Mirth Connect Channels</h3>
          <p className="text-xs text-gray-400 mt-0.5">Real HL7 routing channels — the Epic Bridges equivalent</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadChannels} disabled={loading}
            className="text-xs border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-1.5 rounded-lg">
            Refresh
          </button>
          <button onClick={setupChannels} disabled={loading}
            className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-4 py-1.5 rounded-lg">
            {loading ? 'Setting up…' : 'Setup All Channels'}
          </button>
        </div>
      </div>

      {channels.length === 0 ? (
        <div className="p-8 text-center">
          <div className="text-3xl mb-3">🔌</div>
          <p className="text-gray-600 text-sm font-medium mb-1">No channels configured yet</p>
          <p className="text-gray-400 text-xs mb-4">Click "Setup All Channels" to create and start all 5 routing channels in Mirth Connect.</p>
          <div className="bg-blue-50 rounded-xl p-4 text-xs text-blue-700 text-left max-w-md mx-auto">
            <p className="font-semibold mb-2">What gets created:</p>
            <p>1. ADT_Inbound — logs all ADT messages</p>
            <p>2. Lab_Orders_Out — routes ORM^O01 → Mock Lab</p>
            <p>3. Lab_Results_In — routes ORU^R01 → EHR</p>
            <p>4. Pharmacy_Orders_Out — routes RDE^O11 → Mock Pharmacy</p>
            <p>5. Radiology_Orders_Out — routes ORM^O01 → Mock Radiology</p>
          </div>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide bg-gray-50">
            <th className="text-left px-5 py-3">Channel Name</th>
            <th className="text-left px-5 py-3">Status</th>
            <th className="text-left px-5 py-3">Received</th>
            <th className="text-left px-5 py-3">Filtered</th>
            <th className="text-left px-5 py-3">Sent</th>
            <th className="text-left px-5 py-3">Errored</th>
          </tr></thead>
          <tbody>
            {channels.map((ch, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-5 py-3 font-medium text-gray-900">{ch.name}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[ch.state]||'bg-gray-100 text-gray-600'}`}>
                    {ch.state}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-600">{ch.received || 0}</td>
                <td className="px-5 py-3 text-gray-400">{ch.filtered || 0}</td>
                <td className="px-5 py-3 text-green-600">{ch.sent || 0}</td>
                <td className="px-5 py-3 text-red-500">{ch.error || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function MessageFlowViewer() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/results/../../../api/messages?limit=20');
        // Use integration message log
        const r2 = await fetch('/api/adt/messages?limit=30');
        const d = await r2.json();
        setMessages(d.messages || []);
      } catch {}
    };
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  const typeColors = {
    'ORM^O01': 'text-blue-700 bg-blue-50',
    'ORU^R01': 'text-green-700 bg-green-50',
    'RDE^O11': 'text-purple-700 bg-purple-50',
    'ADT^A01': 'text-orange-700 bg-orange-50',
    'MDM^T02': 'text-red-700 bg-red-50',
    'DFT^P03': 'text-emerald-700 bg-emerald-50',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900 text-sm">Message Flow Log</h3>
          <p className="text-xs text-gray-400">All HL7 messages flowing through MedCore — auto-refreshes every 3s</p>
        </div>
        <span className="text-xs text-gray-400 animate-pulse">● Live</span>
      </div>
      {messages.length === 0 ? (
        <div className="p-6 text-center text-gray-400 text-sm">No messages yet. Place an order to see message flow.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wide">
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Direction</th>
              <th className="text-left px-4 py-2">Channel</th>
              <th className="text-left px-4 py-2">MRN</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Time</th>
            </tr></thead>
            <tbody>
              {messages.map(m => (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-xs ${typeColors[m.message_type]||'bg-gray-100 text-gray-600'}`}>
                      {m.message_type}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{m.direction}</td>
                  <td className="px-4 py-2 text-gray-400 font-mono">{m.channel_name}</td>
                  <td className="px-4 py-2 font-mono text-gray-600">{m.patient_mrn||'—'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${m.status==='SENT'||m.status==='RECEIVED'?'bg-green-100 text-green-700':'bg-red-100 text-red-600'}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-400">{fmt(m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function MockSystemsModule() {
  const mockSystems = [
    { name:'Mock Lab (LIS)',       port:6662, httpPort:7001, icon:'🔬', color:'blue',   description:'Receives ORM^O01 lab orders → processes → returns ORU^R01 results with realistic values and abnormal flags.' },
    { name:'Mock Pharmacy',        port:6663, httpPort:7002, icon:'💊', color:'green',  description:'Receives RDE^O11 medication orders → pharmacist verification → returns RDS^O13 dispense confirmation.' },
    { name:'Mock Radiology (RIS)', port:6664, httpPort:7003, icon:'📡', color:'purple', description:'Receives ORM^O01 imaging orders → tech performs study → radiologist signs → returns MDM^T02 report.' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center gap-3 mb-4">
          <a href="/" className="text-gray-400 hover:text-gray-600 text-sm">← MedCore</a>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-700">Mock External Systems</span>
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full ml-2">Module 7</span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mock External Systems</h1>
            <p className="text-sm text-gray-500 mt-0.5">Real Mirth channels · Mock Lab · Mock Pharmacy · Mock Radiology · End-to-end message flow</p>
          </div>
          <div className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <span className="font-semibold text-gray-600">Epic equivalent:</span> Bridges + external vendor systems
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-6 space-y-6">

        {/* Mock system status cards */}
        <div>
          <h2 className="font-semibold text-gray-900 text-sm mb-3">External System Status</h2>
          <div className="grid grid-cols-3 gap-4">
            {mockSystems.map(s => <StatusCard key={s.name} {...s} />)}
          </div>
        </div>

        {/* Mirth channels */}
        <MirthChannelViewer />

        {/* Message flow */}
        <MessageFlowViewer />

        {/* Learning guide */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
          <h3 className="font-semibold text-indigo-900 text-sm mb-3">How to use Module 7</h3>
          <div className="grid grid-cols-2 gap-4 text-xs text-indigo-800">
            <div>
              <p className="font-semibold mb-2">Step 1 — Set up Mirth channels</p>
              <p>Click "Setup All Channels" above. This creates 5 real Mirth channels via the REST API. Then open <a href="https://localhost:8444" target="_blank" className="underline">Mirth admin</a> to see them running.</p>
            </div>
            <div>
              <p className="font-semibold mb-2">Step 2 — Place a lab order</p>
              <p>Go to Orders (CPOE) → Place a CBC or BMP order. Watch the Message Flow Log — you'll see ORM^O01 fire. Wait 5-30 seconds and ORU^R01 comes back automatically.</p>
            </div>
            <div>
              <p className="font-semibold mb-2">Step 3 — Check Results inbox</p>
              <p>Go to Results → Results Inbox. Your lab result should appear automatically — no "Simulate" button needed. The mock lab did it.</p>
            </div>
            <div>
              <p className="font-semibold mb-2">Step 4 — Open Mirth admin</p>
              <p>Go to <a href="https://localhost:8444" target="_blank" className="underline">https://localhost:8444</a> → Dashboard. Click a channel → Message Browser. You can read every HL7 message that flowed through, raw.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
