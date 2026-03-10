import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/bundles', label: 'Bundles' },
  { to: '/create-log', label: 'Create Log' },
]

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Ardor Pipe Pressure Logs</h1>
        <p className="app-subtitle">Offline-first logging for bundles, logs, pipes, and photos</p>
        <nav className="app-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className="app-nav-link">
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
