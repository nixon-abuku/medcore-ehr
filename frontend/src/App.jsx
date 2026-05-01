import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import {
  Activity, UserPlus, Calendar, ClipboardList, FlaskConical,
  FileText, DollarSign, Network, UserCircle, ExternalLink
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
  { label: 'Patient Portal', url: PORTAL_URL,   note: 'MyChart equiv.', external: false },
  { label: 'Mirth Connect',  url: MIRTH_URL,    note: 'admin/admin',    external: true  },
  { label: 'FHIR Server',    url: FHIR_URL,     note: 'R4',             external: true  },
  { label: 'Keycloak',       url: KEYCLOAK_URL, note: 'admin/admin',    external: true  },
];

const MODULES = [
  { id:'adt',           name:'Registration / ADT',     Icon:UserPlus,       desc:'Patient identity, admit, discharge', epic:'Prelude / ADT',           accent:'blue'    },
  { id:'scheduling',    name:'Scheduling',             Icon:Calendar,       desc:'Appointments, slots, SIU messages',  epic:'Cadence',                 accent:'purple'  },
  { id:'orders',        name:'Orders (CPOE)',          Icon:ClipboardList,  desc:'Lab, medications, imaging orders',   epic:'ASAP / OpTime / Beaker',  accent:'green'   },
  { id:'results',       name:'Results',                Icon:FlaskConical,   desc:'ORU R01, OBX values, flags',         epic:'Beaker / Results Routing',accent:'amber'   },
  { id:'documentation', name:'Clinical Documentation', Icon:FileText,       desc:'Notes, vitals, problems, allergies', epic:'Notes / Synopsis',        accent:'rose'    },
  { id:'billing',       name:'Billing & Charging',     Icon:DollarSign,     desc:'DFT P03, X12 837/835, claims',       epic:'Resolute',                accent:'emerald' },
  { id:'mock-systems',  name:'Mock External Systems',  Icon:Network,        desc:'Mirth channels, mock lab/pharm/rad', epic:'Bridges / Interconnect',  accent:'indigo'  },
  { id:'portal',        name:'Patient Portal',         Icon:UserCircle,     desc:'MyChart equiv. SMART on FHIR',       epic:'MyChart',                 accent:'sky'     },
];

const accentMap = {
  blue:    { iconBg:'bg-blue-50',    iconText:'text-blue-600',    ring:'hover:ring-blue-200' },
  purple:  { iconBg:'bg-purple-50',  iconText:'text-purple-600',  ring:'hover:ring-purple-200' },
  green:   { iconBg:'bg-green-50',   iconText:'text-green-600',   ring:'hover:ring-green-200' },
  amber:   { iconBg:'bg-amber-50',   iconText:'text-amber-600',   ring:'hover:ring-amber-200' },
  rose:    { iconBg:'bg-rose-50',    iconText:'text-rose-600',    ring:'hover:ring-rose-200' },
  emerald: { iconBg:'bg-emerald-50', iconText:'text-emerald-600', ring:'hover:ring-emerald-200' },
  indigo:  { iconBg:'bg-indigo-50',  iconText:'text-indigo-600',  ring:'hover:ring-indigo-200' },
  sky:     { iconBg:'bg-sky-50',     iconText:'text-sky-600',     ring:'hover:ring-sky-200' },
};

function Dashboard() {
  const [status, setStatus] = useState(null);
  const navigate = useNavigate();
  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(setStatus).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="px-8 py-3 flex items-center justify-between">
          <span className="font-medium text-gray-900 text-sm">Overview</span>
          <div className="flex items-center gap-2 text-xs bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${status ? 'bg-green-500' : 'bg-amber-400 animate-pulse'}`}></span>
            <span className="text-gray-600">{status ? 'All systems healthy' : 'Connecting...'}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-8 py-8">
        <div className="bg-gradient-to-br from-slate-800 to-blue-900 rounded-2xl p-8 mb-8 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-green-400 text-sm font-semibold">Platform Healthy</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">All modules are active</h1>
            <p className="text-slate-300 text-sm mb-6">Your training environment is fully operational and ready for integration practice.</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5 text-xs text-white">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                8 / 8 Modules Active
              </div>
              <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5 text-xs text-white">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                All Systems Online
              </div>
              <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5 text-xs text-white">
                HL7 v2 · FHIR R4 · Mirth Connect
              </div>
            </div>
          </div>
          <div className="absolute right-12 top-1/2 -translate-y-1/2 w-28 h-28 bg-blue-400/30 rounded-full"></div>
          <div className="absolute right-8 top-1/2 -translate-y-1/2 w-20 h-20 bg-blue-500/20 rounded-full blur-xl"></div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          {MODULES.map((mod, index) => {
            const a = accentMap[mod.accent];
            const Icon = mod.Icon;
            return (
              <div
                key={mod.id}
                onClick={() => navigate('/' + mod.id)}
                className={`group bg-white rounded-xl border border-gray-200 p-5 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 hover:ring-2 ${a.ring}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-10 h-10 ${a.iconBg} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${a.iconText}`} />
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100">Active</span>
                </div>
                <div className="text-[10px] text-gray-400 font-medium mb-0.5">{index + 1}.</div>
                <h4 className="font-semibold text-sm text-gray-900 mb-1">{mod.name}</h4>
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">{mod.desc}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">
                  Epic: <span className="text-gray-600 normal-case font-normal">{mod.epic}</span>
                </p>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Developer Access &amp; Quick Links</h3>
          <div className="grid grid-cols-4 gap-4">
            {DEV_LINKS.map((l, i) => (
              <a
                key={i}
                href={l.url}
                target={l.external ? '_blank' : '_self'}
                rel="noreferrer"
                className="flex flex-col items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                  <ExternalLink className="w-5 h-5 text-gray-500 group-hover:text-blue-600" />
                </div>
                <div className="text-center">
                  <div className="text-xs font-semibold text-gray-900">{l.label}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{l.note}</div>
                </div>
                <div className="w-full text-center text-[10px] font-medium text-blue-600 bg-blue-50 group-hover:bg-blue-100 border border-blue-200 rounded-lg py-1.5 transition-colors">
                  Open
                </div>
              </a>
            ))}
          </div>
        </div>

        <footer className="text-[11px] text-gray-400 flex items-center justify-between py-2">
          <span>MedCore EHR · Self-built healthcare integration training environment</span>
          <div className="flex items-center gap-3">
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Training</span>
            <span>Not for clinical or production use</span>
          </div>
        </footer>
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
