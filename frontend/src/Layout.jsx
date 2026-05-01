import { useNavigate, useLocation } from 'react-router-dom';
import {
  UserPlus, Calendar, ClipboardList, FlaskConical,
  FileText, DollarSign, Network, UserCircle,
  LayoutDashboard, Settings, BookOpen, Activity,
  ChevronDown
} from 'lucide-react';
import { useState } from 'react';

const NAV_MODULES = [
  { id: 'adt',           name: 'Registration / ADT',     Icon: UserPlus,      path: '/adt'           },
  { id: 'scheduling',    name: 'Scheduling',             Icon: Calendar,      path: '/scheduling'    },
  { id: 'orders',        name: 'Orders (CPOE)',          Icon: ClipboardList, path: '/orders'        },
  { id: 'results',       name: 'Results',                Icon: FlaskConical,  path: '/results'       },
  { id: 'documentation', name: 'Clinical Documentation', Icon: FileText,      path: '/documentation' },
  { id: 'billing',       name: 'Billing & Charging',     Icon: DollarSign,    path: '/billing'       },
  { id: 'mock-systems',  name: 'Mock External Systems',  Icon: Network,       path: '/mock-systems'  },
  { id: 'portal',        name: 'Patient Portal',         Icon: UserCircle,    path: '/portal'        },
];

const DEV_LINKS = [
  { name: 'Monitoring',    Icon: Activity,   path: null },
  { name: 'Documentation', Icon: BookOpen,   path: null },
  { name: 'Settings',      Icon: Settings,   path: null },
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [devOpen, setDevOpen] = useState(true);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 h-full w-64 bg-slate-900 flex flex-col z-30 overflow-y-auto">
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-5 py-5 cursor-pointer border-b border-slate-700/50"
          onClick={() => navigate('/')}
        >
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">M</div>
          <div>
            <div className="text-white font-semibold text-sm leading-tight">MedCore EHR</div>
            <div className="text-slate-400 text-[10px] leading-tight">Integration Training</div>
          </div>
        </div>

        {/* Overview */}
        <div className="px-3 pt-4 pb-2">
          <button
            onClick={() => navigate('/')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive('/') && location.pathname === '/'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
            Overview
          </button>
        </div>

        {/* Core Modules */}
        <div className="px-3 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-3 mb-2 mt-2">Core Modules</p>
          <nav className="space-y-0.5">
            {NAV_MODULES.map(({ id, name, Icon, path }) => (
              <button
                key={id}
                onClick={() => navigate(path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  isActive(path)
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Developer Access */}
        <div className="px-3 pb-4 mt-auto">
          <button
            onClick={() => setDevOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-400 transition-colors"
          >
            Developer Access
            <ChevronDown className={`w-3 h-3 transition-transform ${devOpen ? 'rotate-0' : '-rotate-90'}`} />
          </button>
          {devOpen && (
            <nav className="space-y-0.5 mt-1">
              {DEV_LINKS.map(({ name, Icon }) => (
                <button
                  key={name}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-white hover:bg-slate-800 transition-colors text-left"
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{name}</span>
                </button>
              ))}
            </nav>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-700/50">
          <p className="text-[10px] text-slate-600">Not for clinical use</p>
          <p className="text-[10px] text-slate-600">Training environment only</p>
        </div>
      </aside>

      {/* Main content — offset by sidebar width */}
      <div className="ml-64 flex-1 flex flex-col min-h-screen">
        {children}
      </div>
    </div>
  );
}
