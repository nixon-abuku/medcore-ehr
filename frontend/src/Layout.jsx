import { useNavigate, useLocation } from 'react-router-dom';
import {
  UserPlus, Calendar, ClipboardList, FlaskConical,
  FileText, DollarSign, Network, UserCircle,
  LayoutDashboard, Settings, BookOpen, Activity,
  ChevronDown, Bell, Search, Moon, Sun, FileStack
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

const DEV_ITEMS = [
  { name: 'Monitoring',     Icon: Activity,   path: null },
  { name: 'Documentation',  Icon: BookOpen,   path: null },
  { name: 'Settings',       Icon: Settings,   path: null },
  { name: 'Release Notes',  Icon: FileStack,  path: null },
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [devOpen, setDevOpen] = useState(true);
  const [dark, setDark] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  // Current page label for top bar
  const currentPage = NAV_MODULES.find(m => location.pathname.startsWith(m.path))?.name
    || (location.pathname === '/' ? 'Overview' : 'MedCore EHR');

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* ── Sidebar ─────────────────────────────────── */}
      <aside className="fixed top-0 left-0 h-full w-64 bg-slate-900 flex flex-col z-30 overflow-y-auto">
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-5 py-4 cursor-pointer border-b border-slate-700/50 flex-shrink-0"
          onClick={() => navigate('/')}
        >
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">M</div>
          <div>
            <div className="text-white font-semibold text-sm leading-tight">MedCore EHR</div>
            <div className="text-slate-400 text-[10px] leading-tight">Integration Training</div>
          </div>
        </div>

        {/* Overview */}
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={() => navigate('/')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === '/'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
            Overview
          </button>
        </div>

        {/* Core Modules */}
        <div className="px-3 pb-2 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-3 mb-2 mt-3">Core Modules</p>
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
        <div className="px-3 pb-3 border-t border-slate-700/50 pt-3">
          <button
            onClick={() => setDevOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-400 transition-colors"
          >
            Developer Access
            <ChevronDown className={`w-3 h-3 transition-transform ${devOpen ? '' : '-rotate-90'}`} />
          </button>
          {devOpen && (
            <nav className="space-y-0.5 mt-1">
              {DEV_ITEMS.map(({ name, Icon }) => (
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

        {/* Dark mode toggle + footer */}
        <div className="px-5 py-3 border-t border-slate-700/50 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-600">Not for clinical use</p>
            <p className="text-[10px] text-slate-600">Training environment</p>
          </div>
          <button
            onClick={() => setDark(d => !d)}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
            title="Toggle theme"
          >
            {dark
              ? <Sun className="w-3.5 h-3.5 text-amber-400" />
              : <Moon className="w-3.5 h-3.5 text-slate-400" />
            }
          </button>
        </div>
      </aside>

      {/* ── Main area (sidebar offset) ──────────────── */}
      <div className="ml-64 flex-1 flex flex-col min-h-screen">
        {/* Global top bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 h-14 flex items-center px-6 gap-4">
          {/* Breadcrumb / page title */}
          <div className="text-sm font-medium text-gray-900 flex-shrink-0">
            {currentPage}
          </div>

          {/* Search bar */}
          <div className={`flex-1 max-w-xl mx-auto relative ${searchFocused ? 'ring-2 ring-blue-300 rounded-xl' : ''}`}>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search modules, systems, or documentation..."
                className="flex-1 text-xs bg-transparent outline-none text-gray-700 placeholder-gray-400"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <kbd className="text-[9px] text-gray-400 bg-gray-100 border border-gray-200 rounded px-1 py-0.5">⌘</kbd>
                <kbd className="text-[9px] text-gray-400 bg-gray-100 border border-gray-200 rounded px-1 py-0.5">K</kbd>
              </div>
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* System health pill */}
            <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              <span className="text-[10px] font-medium text-green-700">All systems healthy</span>
              <ChevronDown className="w-2.5 h-2.5 text-green-600" />
            </div>

            {/* Notifications */}
            <button className="relative w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
  <Bell className="w-4 h-4 text-gray-500" />
  <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border border-white flex items-center justify-center">
    <span className="text-[8px] font-bold text-white">3</span>
  </span>
</button>

            {/* Help */}
            <button className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors text-gray-500 text-sm font-semibold">
              ?
            </button>

            {/* Profile avatar */}
            <button className="flex items-center gap-2 rounded-lg hover:bg-gray-100 px-2 py-1.5 transition-colors">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
                NA
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-medium text-gray-900 leading-tight">Nixon Abuku</div>
                <div className="text-[9px] text-gray-500 leading-tight">Admin</div>
              </div>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>
          </div>
        </header>

        {/* Page content */}
        {children}
      </div>
    </div>
  );
}
