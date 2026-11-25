import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Compose from './pages/Compose'
import Scheduled from './pages/Scheduled'
import Sent from './pages/Sent'
import Login from './pages/Login'

function Layout() {
  const navItems = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Compose', path: '/compose' },
    { name: 'Scheduled', path: '/scheduled' },
    { name: 'Sent', path: '/sent' },
  ]

  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <aside className="w-64 shrink-0 border-r border-slate-800 bg-slate-900 p-6">
        <h1 className="mb-10 text-2xl font-bold">
          ReachInbox<span className="text-blue-500">.</span>
        </h1>

        <nav className="space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `block rounded-lg px-4 py-3 ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {item.name}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 p-8">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/compose" element={<Compose />} />
          <Route path="/scheduled" element={<Scheduled />} />
          <Route path="/sent" element={<Sent />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<Layout />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App