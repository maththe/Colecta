import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Map, CheckSquare, Trash2, LogOut, Moon, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
}

const sections: { title?: string; items: NavItem[] }[] = [
  {
    items: [{ to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard }],
  },
  {
    title: 'Operação',
    items: [
      { to: '/map', label: 'Mapa', Icon: Map },
      { to: '/bins', label: 'Lixeiras', Icon: Trash2 },
      { to: '/tasks', label: 'Tarefas', Icon: CheckSquare },
    ],
  },
];

export function MainLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const isDark = theme === 'dark';

  const initials = user?.name
    ?.split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?';

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col gap-6 border-r border-border bg-sidebar px-4 py-6">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            C
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">Colecta</div>
            <div className="text-xs text-muted-foreground">Gestão de lixeiras</div>
          </div>
        </div>

        {sections.map((section, idx) => (
          <nav className="flex flex-col gap-1" key={idx}>
            {section.title && (
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary/10 font-semibold text-primary'
                      : 'text-foreground hover:bg-muted',
                  )
                }
              >
                <item.Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        ))}

        <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
          {user && (
            <div className="flex items-center gap-2.5 px-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{user.name}</div>
                <div className="truncate text-xs text-muted-foreground">{user.email}</div>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="w-full justify-start"
            aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {isDark ? 'Modo claro' : 'Modo escuro'}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start">
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
