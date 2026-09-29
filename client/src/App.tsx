import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import MapPage from './pages/MapPage'
import MeterPage from './pages/MeterPage'
import HierarchyPage from './pages/HierarchyPage'

const NAV = [
  { to: '/',          label: 'Map',       icon: '🗺️' },
  { to: '/hierarchy', label: 'Network',   icon: '🌳' },
]

export default function App() {
  const loc = useLocation()
  const isMeterDetail = loc.pathname.startsWith('/meters/')

  return (
    <div className="flex flex-col h-screen">
      {/* Top nav */}
      <header className="flex items-center gap-6 px-6 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <span className="font-semibold text-white tracking-tight">
          ⚡ Urja Meter Ops
        </span>
        <nav className="flex gap-1">
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ` +
                (isActive
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800')
              }
            >
              <span>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        {isMeterDetail && (
          <span className="ml-auto text-xs text-slate-500">Meter detail</span>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/"           element={<MapPage />} />
          <Route path="/hierarchy"  element={<HierarchyPage />} />
          <Route path="/meters/:id" element={<MeterPage />} />
        </Routes>
      </main>
    </div>
  )
}
