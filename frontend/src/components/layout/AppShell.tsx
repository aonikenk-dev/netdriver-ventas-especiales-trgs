import { NavLink, Outlet } from 'react-router-dom';
import { FileSpreadsheet, FileWarning, FolderOpen, Truck } from 'lucide-react';
import { useTramitesStore } from '@/store/useTramitesStore';
import '@/styles/layout.scss';

const NAV_ITEMS = [
  { to: '/tramites', label: 'Tramites', icon: FileSpreadsheet, badge: false },
  { to: '/pdfs', label: 'Documentos', icon: FolderOpen, badge: false },
  { to: '/remitos', label: 'Remitos', icon: Truck, badge: false },
  { to: '/logs-excel', label: 'Logs Excel', icon: FileWarning, badge: true },
];

export function AppShell() {
  const erroresExcel = useTramitesStore((s) => s.erroresExcel);

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar__brand">
          <img src="/logo-2026.png" alt="Netdriver" className="app-sidebar__brand-logo" />
          <span className="app-sidebar__brand-sub">Ventas Especiales TRGS</span>
        </div>

        <nav className="app-sidebar__nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `app-nav-link${isActive ? ' app-nav-link--active' : ''}`}
            >
              <Icon />
              {label}
              {badge && erroresExcel.length > 0 && (
                <span className="app-nav-link__badge">{erroresExcel.length}</span>
              )}
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
