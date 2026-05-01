import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Activity, UserPlus, Calendar, ClipboardList, FlaskConical, FileText, DollarSign, Network, UserCircle } from 'lucide-react';
import ADTModule from './pages/adt/ADTModule.jsx';
import SchedulingModule from './pages/scheduling/SchedulingModule.jsx';
import OrdersModule from './pages/orders/OrdersModule.jsx';
import ResultsModule from './pages/results/ResultsModule.jsx';
import DocumentationModule from './pages/documentation/DocumentationModule.jsx';
import BillingModule from './pages/billing/BillingModule.jsx';
import MockSystemsModule from './pages/mock-systems/MockSystemsModule.jsx';
import PatientPortal from './pages/portal/PatientPortal.jsx';

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
  useEffect(()=>{fetch('/api/health').then(r=>r.json()).then(setStatus).catch(()=>{});}, []);
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-200">
         <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white text-lg font-bold">M</div>
      <div>
        <h1 className="text-base font-semibold text-gray-900">MedCore EHR</h1>
        <p className="text-xs text-gray-500">Healthcare Integration Training Environment</p>
      </div>
    </div>
    <div className="flex items-center gap-2 text-xs">
      <span className={`w-2 h-2 rounded-full ${status ? 'bg-green-500' : 'bg-amber-400 animate-pulse'}`}></span>
      <span className="text-gray-600">{status ? 'All systems online' : 'Connecting…'}</span>
    </div>
  </div>
</header>
      <main className="max-w-6xl mx-auto px-8 py-10">
        <div className="bg-white border border-gray-200 rounded-2xl px-6 py-5 mb-8 flex items-center gap-4 shadow-sm">
  <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
    <Activity className="w-5 h-5 text-green-600" />
  </div>
  <div className="flex-1">
    <h2 className="text-sm font-semibold text-gray-900">All 8 modules active</h2>
    <p className="text-xs text-gray-500 mt-0.5">Full clinical, financial, integration, and patient portal workflow online.</p>
  </div>
  <div className="hidden md:flex items-center gap-2 text-xs text-gray-400">
    <span>HL7 v2</span>
    <span className="text-gray-300">·</span>
    <span>FHIR R4</span>
    <span className="text-gray-300">·</span>
    <span>Mirth Connect</span>
  </div>
</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
  {MODULES.map(mod => {
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
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100">● Active</span>
        </div>
        <h4 className="font-semibold text-sm text-gray-900 mb-1">{mod.name}</h4>
        <p className="text-xs text-gray-500 mb-3 leading-relaxed">{mod.desc}</p>
        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">
          Epic equivalent: <span className="text-gray-600 normal-case font-normal">{mod.epic}</span>
        </p>
      </div>
    );
  })}
</div>
        <div className="flex flex-wrap gap-3">
          {[{label:'Patient Portal',url:'/portal',note:'MyChart equiv.'},{label:'Mirth Connect',url:'https://localhost:8444',note:'admin/admin'},{label:'FHIR Server',url:'http://localhost:8081/fhir/metadata',note:'R4'},{label:'Keycloak',url:'http://localhost:8090',note:'admin/admin'}].map((l,i)=>(
            <a key={i} href={l.url} target={l.url.startsWith('http')&&!l.url.includes('localhost:3000')?'_blank':'_self'} rel="noreferrer" className="flex flex-col bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-white">{l.label} ↗</span>
              <span className="text-xs text-white/40">{l.note}</span>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
