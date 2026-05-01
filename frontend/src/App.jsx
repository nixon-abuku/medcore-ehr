import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import ADTModule from './pages/adt/ADTModule.jsx';
import SchedulingModule from './pages/scheduling/SchedulingModule.jsx';
import OrdersModule from './pages/orders/OrdersModule.jsx';
import ResultsModule from './pages/results/ResultsModule.jsx';
import DocumentationModule from './pages/documentation/DocumentationModule.jsx';
import BillingModule from './pages/billing/BillingModule.jsx';
import MockSystemsModule from './pages/mock-systems/MockSystemsModule.jsx';
import PatientPortal from './pages/portal/PatientPortal.jsx';

const MODULES = [
  { id:'adt',           name:'Registration / ADT',    icon:'🏥', desc:'Patient identity, admit, discharge', color:'blue'    },
  { id:'scheduling',    name:'Scheduling',             icon:'📅', desc:'Appointments, slots, SIU messages',  color:'purple'  },
  { id:'orders',        name:'Orders (CPOE)',           icon:'📋', desc:'Lab, medications, imaging orders',   color:'green'   },
  { id:'results',       name:'Results',                icon:'🔬', desc:'ORU^R01, OBX values, flags',         color:'yellow'  },
  { id:'documentation', name:'Clinical Documentation', icon:'📝', desc:'Notes, vitals, problems, allergies', color:'red'     },
  { id:'billing',       name:'Billing & Charging',     icon:'💲', desc:'DFT^P03, X12 837/835, claims',       color:'emerald' },
  { id:'mock-systems',  name:'Mock External Systems',  icon:'🔌', desc:'Mirth channels, mock lab/pharm/rad', color:'indigo'  },
  { id:'portal',        name:'Patient Portal',         icon:'👤', desc:'MyChart equiv. SMART on FHIR',       color:'cyan'    },
];
const cMap = {
  blue:'bg-blue-50 border-blue-300 hover:border-blue-500',purple:'bg-purple-50 border-purple-300 hover:border-purple-500',
  green:'bg-green-50 border-green-300 hover:border-green-500',yellow:'bg-yellow-50 border-yellow-300 hover:border-yellow-500',
  red:'bg-red-50 border-red-300 hover:border-red-500',emerald:'bg-emerald-50 border-emerald-300 hover:border-emerald-500',
  indigo:'bg-indigo-50 border-indigo-300 hover:border-indigo-500',cyan:'bg-cyan-50 border-cyan-300 hover:border-cyan-500',
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
        <div className="bg-green-600/20 border border-green-500/30 rounded-2xl p-6 mb-8">
          <h2 className="text-2xl font-bold mb-1">Modules 1–8 Active 🏥📅📋🔬📝💲🔌👤</h2>
          <p className="text-green-200 text-sm">Full clinical + financial + integration + patient portal workflow.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {MODULES.map(mod=>(
            <div key={mod.id} onClick={()=>navigate(`/${mod.id}`)}
              className={`rounded-xl border-2 p-5 transition-all ${cMap[mod.color]} text-slate-800 cursor-pointer shadow-md hover:shadow-lg`}>
              <div className="flex items-start justify-between mb-2">
                <span className="text-2xl">{mod.icon}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">● Active</span>
              </div>
              <h4 className="font-semibold text-sm mb-1">{mod.name}</h4>
              <p className="text-xs text-slate-500">{mod.desc}</p>
            </div>
          ))}
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
