import { NavLink, Outlet } from 'react-router-dom';
import { FileSpreadsheet, FolderOpen, Truck } from 'lucide-react';
import '@/styles/layout.scss';

const NAV_ITEMS = [
  { to: '/tramites', label: 'Tramites', icon: FileSpreadsheet },
  { to: '/pdfs', label: 'Documentos', icon: FolderOpen },
  { to: '/remitos', label: 'Remitos', icon: Truck },
];

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar__brand">
          {/* <span className="app-sidebar__brand-title">Netdriver</span> */}
          <img src="/logo-2026.png" alt="Netdriver" className="app-sidebar__brand-logo" />
          <span className="app-sidebar__brand-sub">Ventas Especiales TRGS</span>
        </div>

        <nav className="app-sidebar__nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `app-nav-link${isActive ? ' app-nav-link--active' : ''}`}
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="app-main">
        <Outlet />
      </div>
    </div>
  );
}
