import { NavLink, Outlet } from 'react-router-dom';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const sections: { title?: string; items: NavItem[] }[] = [
  {
    items: [{ to: '/dashboard', label: 'Dashboard', icon: '◆' }],
  },
  {
    title: 'Operação',
    items: [
      { to: '/bins', label: 'Lixeiras', icon: '🗑' },
      { to: '/map', label: 'Mapa', icon: '🗺' },
      { to: '/tasks', label: 'Tarefas', icon: '✓' },
    ],
  },
];

export function MainLayout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__brand-mark">C</div>
          <div>
            <div className="sidebar__brand-title">Colecta</div>
            <div className="sidebar__brand-subtitle">Gestão de lixeiras</div>
          </div>
        </div>

        {sections.map((section, idx) => (
          <nav className="sidebar__nav" key={idx}>
            {section.title && (
              <div className="sidebar__section-title">{section.title}</div>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `sidebar__link${isActive ? ' active' : ''}`
                }
              >
                <span className="sidebar__icon" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        ))}
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
