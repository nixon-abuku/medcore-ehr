import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import {
  UserPlus, Calendar, ClipboardList, FlaskConical,
  FileText, DollarSign, Network, UserCircle,
  CheckCircle, AlertCircle, RefreshCw,
  Globe, Terminal, Shield, Zap
} from 'lucide-react';
import Layout from './Layout.jsx';
import ADTModule from './pages/adt/ADTModule.jsx';
import SchedulingModule from './pages/scheduling/SchedulingModule.jsx';
import OrdersModule from './pages/orders/OrdersModule.jsx';
import ResultsModule from './pages/results/ResultsModule.jsx';
import DocumentationModule from './pages/documentation/DocumentationModule.jsx';
import BillingModule from './pages/billing/BillingModule.jsx';
import MockSystemsModule from './pages/mock-systems/MockSystemsModule.jsx';
import PatientPortal from './pages/portal/PatientPortal.jsx';

const PORTAL_URL   = '/portal';
const MIRTH_URL    = 'https' + '://' + 'localhost' + ':8444';
const FHIR_URL     = 'http'  + '://' + 'localhost' + ':8081/fhir/metadata';
const KEYCLOAK_URL = 'http'  + '://' + 'localhost' + ':8090';

const DEV_LINKS = [
  { label: 'Patient Portal', url: PORTAL_URL,   note: 'MyChart equivalent\nSMART on FHIR',  external: false, Icon: Globe,    color: 'bg-blue-50 text-blue-600',    btn: 'bg-blue-600 hover:bg-blue-700'    },
  { label: 'Mirth Connect',  url: MIRTH_URL,    note: 'Interface engine\nadmin console',     external: true,  Icon: Zap,      color: 'bg-green-50 text-green-600',  btn: 'bg-green-600 hover:bg-green-700'  },
  { label: 'FHIR Server',    url: FHIR_URL,     note: 'R4 FHIR server\nAPI sandbox',         external: true,  Icon: Shield,   color: 'bg-purple-50 text-purple-600', btn: 'bg-purple-600 hover:bg-purple-700' },
  { label: 'Keycloak',       url: KEYCLOAK_URL, note: 'Identity & access\nmanagement',       external: true,  Icon: Terminal, color: 'bg-orange-50 text-orange-600', btn: 'bg-orange-600 hover:bg-orange-700' },
];

const MODULES = [
  { id:'adt',           name:'Registration / ADT',     Icon:UserPlus,       desc:'Patient identity, admit, discharge', epic:'Prelude / ADT',           accent:'blue'    },
  { id:'scheduling',    name:'Scheduling',             Icon:Calendar,       desc:'Appointments, slots, SIU messages',  epic:'Cadence',                 accent:'purple'  },
  { id:'orders',        name:'Orders (CPOE)',          Icon:ClipboardList,  desc:'Lab, medications, imaging orders',   epic:'ASAP / OpTime / Beaker',  accent:'green'   },
  { id:'results',       name:'Results',                Icon:FlaskConical,   desc:'ORU R01, OBX values, flags',         epic:'Beaker / Results Routing', accent:'amber'   },
  { id:'documentation', name:'Clinical Documentation', Icon:FileText,       desc:'Notes, vitals, problems, allergies', epic:'Notes / Synopsis',        accent:'rose'    },
  { id:'billing',       name:'Billing & Charging',     Icon:DollarSign,     desc:'DFT P03, X12 837/835, claims',       epic:'Resolute',                accent:'emerald' },
  { id:'mock-systems',  name:'Mock External Systems',  Icon:Network,        desc:'Mirth channels, mock lab/pharm/rad', epic:'Bridges / Interconnect',  accent:'indigo'  },
  { id:'portal',        name:'Patient Portal',         Icon:UserCircle,     desc:'MyChart equiv. SMART on FHIR',       epic:'MyChart',                 accent:'sky'     },
];

const accentMap = {
  blue:    { iconBg:'bg-blue-50',    iconText:'text-blue-600',    ring:'hover:ring-blue-200'    },
  purple:  { iconBg:'bg-purple-50',  iconText:'text-purple-600',  ring:'hover:ring-purple-200'  },
  green:   { iconBg:'bg-green-50',   iconText:'text-green-600',   ring:'hover:ring-green-200'   },
  amber:   { iconBg:'bg-amber-50',   iconText:'text-amber-600',   ring:'hover:ring-amber-200'   },
  rose:    { iconBg:'bg-rose-50',    iconText:'text-rose-600',    ring:'hover:ring-rose-200'    },
  emerald: { iconBg:'bg-emerald-50', iconText:'text-emerald-600', ring:'hover:ring-emerald-200' },
  indigo:  { iconBg:'bg-indigo-50',  iconText:'text-indigo-600',  ring:'hover:ring-indigo-200'  },
  sky:     { iconBg:'bg-sky-50',     iconText:'text-sky-600',     ring:'hover:ring-sky-200'     },
};

const MSG_TYPE_COLOR = {
  'ADT^A01': { bg: 'bg-blue-500',   label: 'A01' },
  'ADT^A03': { bg: 'bg-orange-500', label: 'A03' },
  'ADT^A08': { bg: 'bg-purple-500', label: 'A08' },
  'ORM^O01': { bg: 'bg-green-500',  label: 'ORM' },
  'ORU^R01': { bg: 'bg-amber-500',  label: 'ORU' },
  'MDM^T02': { bg: 'bg-rose-500',   label: 'MDM' },
};

const MSG_DESCRIPTIONS = {
  'ADT^A01': 'Patient admitted',
  'ADT^A03': 'Patient discharged',
  'ADT^A08': 'Demographics updated',
  'ORM^O01': 'Lab order placed',
  'ORU^R01': 'Lab result received',
  'MDM^T02': 'Clinical note created',
};

function fmt(dtStr) {
  if (!dtStr) return '';
  const diff = Math.floor((Date.now() - new Date(dtStr).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return diff + 'm ago';
  if (diff < 1440) return Math.floor(diff / 60) + 'h ago';
  return Math.floor(diff / 1440) + 'd ago';
}

function Sparkline({ data, color = '#3B82F6', height = 28 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 72;
  const h = height;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} className="overflow-visible flex-shrink-0">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}

function RightRail({ health }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch('/api/adt/messages?limit=50')
      .then(r => r.json())
      .then(d => { setMessages(d.messages || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const total  = messages.length;
  const failed = messages.filter(m => m.status === 'FAILED' || m.status === 'ERROR').length;
  const sent   = messages.filter(m => m.status === 'SENT').length;
  const recent = messages.slice(0, 6);

  const sentSparkle   = [4, 7, 5, 9, 6, 8, sent > 0 ? sent : 5];
  const failedSparkle = [2, 1, 3, 1, 2, failed, failed > 0 ? failed : 1];

  const systemItems = [
    { label: 'Application',       ok: health?.status === 'ok'                          },
    { label: 'Database',          ok: health?.dependencies?.database === 'ok'          },
    { label: 'Interface Engine',  ok: true                                             },
    { label: 'External Services', ok: true                                             },
  ];

  return (
    <div className="w-80 flex-shrink-0 space-y-4">
      {/* System Overview */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-900">System Overview</h3>
          <button className="text-[10px] text-blue-600 hover:underline">View all</button>
        </div>
        <div className="divide-y divide-gray-50">
          {systemItems.map(({ label, ok }) => (
            <div key={label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-gray-600">{label}</span>
              <div className="flex items-center gap-1.5">
                {ok
                  ? <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  : <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                }
                <span className={`text-[10px] font-semibold ${ok ? 'text-green-600' : 'text-red-500'}`}>
                  {ok ? 'Healthy' : 'Error'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Platform Metrics — 2-column grid with sparklines */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-900">Platform Metrics</h3>
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            Last 24 hours
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-gray-50">
          {/* HL7 Messages */}
          <div className="px-4 py-3">
            <div className="text-[10px] text-gray-500 mb-0.5">HL7 Messages</div>
            <div className="text-xl font-bold text-gray-900">{loading ? '—' : total}</div>
            <div className="text-[10px] text-green-600 flex items-center gap-0.5 mt-0.5">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              {sent} sent
            </div>
            <div className="mt-2"><Sparkline data={sentSparkle} color="#3B82F6" /></div>
          </div>
          {/* Active Users */}
          <div className="px-4 py-3">
            <div className="text-[10px] text-gray-500 mb-0.5">Active Users</div>
            <div className="text-xl font-bold text-gray-900">1</div>
            <div className="text-[10px] text-green-600 mt-0.5">Online now</div>
            <div className="mt-2"><Sparkline data={[1,1,1,1,1,1,1]} color="#10B981" /></div>
          </div>
          {/* Failed Messages */}
          <div className="px-4 py-3">
            <div className="text-[10px] text-gray-500 mb-0.5">Failed Messages</div>
            <div className="text-xl font-bold text-gray-900">{loading ? '—' : failed}</div>
            <div className={`text-[10px] mt-0.5 ${failed > 0 ? 'text-red-500' : 'text-green-600'}`}>
              {failed > 0 ? `${failed} need attention` : 'All clear'}
            </div>
            <div className="mt-2"><Sparkline data={failedSparkle} color={failed > 0 ? '#EF4444' : '#10B981'} /></div>
          </div>
          {/* Avg Response Time */}
          <div className="px-4 py-3">
            <div className="text-[10px] text-gray-500 mb-0.5">Avg Response Time</div>
            <div className="text-xl font-bold text-gray-900">~2ms</div>
            <div className="text-[10px] text-green-600 mt-0.5">Normal range</div>
            <div className="mt-2"><Sparkline data={[3,2,4,2,3,2,2]} color="#8B5CF6" /></div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-900">Recent Activity</h3>
          <button className="text-[10px] text-blue-600 hover:underline">View all</button>
        </div>
        {loading ? (
          <div className="px-4 py-6 text-center">
            <RefreshCw className="w-4 h-4 text-gray-300 animate-spin mx-auto mb-2" />
            <p className="text-xs text-gray-400">Loading...</p>
          </div>
        ) : recent.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-gray-400">No messages yet</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recent.map((m, i) => {
              const typeInfo = MSG_TYPE_COLOR[m.message_type] || { bg: 'bg-gray-500', label: '?' };
              const desc     = MSG_DESCRIPTIONS[m.message_type] || m.message_type;
              const isOk     = m.status === 'SENT' || m.status === 'RECEIVED';
              return (
                <div key={i} className="px-4 py-3 flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full ${typeInfo.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <span className="text-[9px] font-bold text-white">{typeInfo.label}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900">{desc}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                      MRN: {m.patient_mrn || '—'} · {m.direction}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] font-semibold ${isOk ? 'text-green-600' : 'text-red-500'}`}>{m.status}</span>
                      <span className="text-[9px] text-gray-400">{fmt(m.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="px-4 py-2.5 border-t border-gray-100">
          <button onClick={() => window.location.href = '/adt'} className="text-[10px] text-blue-600 hover:underline">
            View message log →
          </button>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [status, setStatus] = useState(null);
  const navigate = useNavigate();
  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(setStatus).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <main className="flex-1 px-8 py-8">
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">
            {/* Hero banner with shield */}
            <div className="bg-gradient-to-br from-slate-800 to-blue-900 rounded-2xl p-8 mb-6 relative overflow-hidden">
              <div className="relative z-10 max-w-lg">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-green-400 text-sm font-semibold">Platform Healthy</span>
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">All modules are active</h1>
                <p className="text-slate-300 text-sm mb-5">Your training environment is fully operational and ready for integration practice.</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5 text-xs text-white">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>8 / 8 Modules Active
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5 text-xs text-white">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>All Systems Online
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5 text-xs text-white">
                    HL7 v2 · FHIR R4 · Mirth
                  </div>
                </div>
              </div>
              {/* Shield */}
              <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center justify-center">
                <div className="absolute w-44 h-44 rounded-full bg-blue-500/10 animate-pulse"></div>
                <div className="absolute w-32 h-32 rounded-full bg-blue-400/15"></div>
                <div className="relative w-28 h-28">
                  <svg viewBox="0 0 100 115" className="w-full h-full" fill="none">
                    <defs>
                      <linearGradient id="sg1" x1="0" y1="0" x2="100" y2="115" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#60A5FA" />
                        <stop offset="100%" stopColor="#1D4ED8" />
                      </linearGradient>
                      <filter id="glow">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                      </filter>
                    </defs>
                    <path d="M50 3 L92 20 L92 58 C92 82 73 100 50 110 C27 100 8 82 8 58 L8 20 Z" fill="url(#sg1)" opacity="0.9" />
                    <path d="M50 12 L84 27 L84 58 C84 77 68 93 50 101 C32 93 16 77 16 58 L16 27 Z" fill="rgba(255,255,255,0.08)" />
                    <path d="M33 56 L46 69 L68 40" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />
                    <path d="M33 56 L46 69 L68 40" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="absolute top-3 right-3 w-2 h-2 bg-blue-300/50 rounded-full"></div>
                <div className="absolute bottom-5 left-1 w-1.5 h-1.5 bg-blue-400/40 rounded-full"></div>
                <div className="absolute top-10 left-3 w-1 h-1 bg-white/30 rounded-full"></div>
              </div>
            </div>

            {/* Module grid */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {MODULES.map((mod, index) => {
                const a = accentMap[mod.accent];
                const Icon = mod.Icon;
                return (
                  <div key={mod.id} onClick={() => navigate('/' + mod.id)}
                    className={`group bg-white rounded-xl border border-gray-200 p-4 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 hover:ring-2 ${a.ring}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-9 h-9 ${a.iconBg} rounded-lg flex items-center justify-center`}>
                        <Icon className={`w-4 h-4 ${a.iconText}`} />
                      </div>
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100">Active</span>
                    </div>
                    <div className="text-[10px] text-gray-400 font-medium mb-0.5">{index + 1}.</div>
                    <h4 className="font-semibold text-xs text-gray-900 mb-1 leading-tight">{mod.name}</h4>
                    <p className="text-[10px] text-gray-500 mb-2 leading-relaxed">{mod.desc}</p>
                    <p className="text-[9px] text-gray-400 uppercase tracking-wide font-medium">
                      Epic: <span className="text-gray-600 normal-case font-normal">{mod.epic}</span>
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Developer Access */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Developer Access &amp; Quick Links</h3>
              <div className="grid grid-cols-4 gap-3">
                {DEV_LINKS.map((l, i) => {
                  const Icon = l.Icon;
                  return (
                    <a key={i} href={l.url} target={l.external ? '_blank' : '_self'} rel="noreferrer"
                      className="flex flex-col items-center gap-3 p-4 rounded-xl border border-gray-200 hover:shadow-md transition-all">
                      <div className={`w-12 h-12 rounded-xl ${l.color} flex items-center justify-center`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-semibold text-gray-900">{l.label}</div>
                        {l.note.split('\n').map((line, j) => (
                          <div key={j} className="text-[10px] text-gray-500 leading-tight">{line}</div>
                        ))}
                      </div>
                      <div className={`w-full text-center text-[10px] font-medium text-white ${l.btn} rounded-lg py-1.5 transition-colors`}>
                        Open {l.label.split(' ')[0]}
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <footer className="text-[11px] text-gray-400 flex items-center justify-between py-2">
              <span>MedCore EHR · Self-built healthcare integration training environment</span>
              <div className="flex items-center gap-3">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Training</span>
                <span>Not for clinical or production use</span>
              </div>
            </footer>
          </div>

          <RightRail health={status} />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/adt/*" element={<ADTModule />} />
          <Route path="/scheduling/*" element={<SchedulingModule />} />
          <Route path="/orders/*" element={<OrdersModule />} />
          <Route path="/results/*" element={<ResultsModule />} />
          <Route path="/documentation/*" element={<DocumentationModule />} />
          <Route path="/billing/*" element={<BillingModule />} />
          <Route path="/mock-systems/*" element={<MockSystemsModule />} />
          <Route path="/portal/*" element={<PatientPortal />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
