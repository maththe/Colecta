import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Map,
  CheckSquare,
  Trash2,
  LogOut,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  BarChart3,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/modules/auth/context/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { NotificationsBell } from '@/modules/notifications/components/NotificationsBell';

interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
}

const operationSection = {
  title: 'Operação',
  items: [
    { to: '/map', label: 'Mapa', Icon: Map },
    { to: '/bins', label: 'Lixeiras', Icon: Trash2 },
    { to: '/tasks', label: 'Tarefas', Icon: CheckSquare },
  ],
} satisfies { title?: string; items: NavItem[] };

const dashboardSection = {
  items: [
    { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { to: '/analytics', label: 'Analytics', Icon: BarChart3 },
  ],
} satisfies { title?: string; items: NavItem[] };

const SIDEBAR_STATE_KEY = 'colecta:sidebar-collapsed';

export function MainLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SIDEBAR_STATE_KEY) === '1';
  });

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STATE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const sections: { title?: string; items: NavItem[] }[] =
    user?.role === 'ADMIN'
      ? [dashboardSection, operationSection]
      : [operationSection];

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
      <aside
        className={cn(
          'sticky top-0 flex h-screen shrink-0 flex-col gap-6 border-r border-border bg-sidebar py-6 transition-[width] duration-200',
          collapsed ? 'w-16 px-2' : 'w-60 px-4',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-3',
            collapsed ? 'justify-center px-0' : 'px-2',
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            C
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold leading-tight">Colecta</div>
              <div className="text-xs text-muted-foreground">Gestão de lixeiras</div>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed((c) => !c)}
          className={cn('justify-start', collapsed && 'justify-center px-0')}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" />
              Recolher
            </>
          )}
        </Button>

        {sections.map((section, idx) => (
          <nav className="flex flex-col gap-1" key={idx}>
            {section.title && !collapsed && (
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-lg py-2 text-sm transition-colors',
                    collapsed ? 'justify-center px-0' : 'px-3',
                    isActive
                      ? 'bg-primary/10 font-semibold text-primary'
                      : 'text-foreground hover:bg-muted',
                  )
                }
              >
                <item.Icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.label}
              </NavLink>
            ))}
          </nav>
        ))}

        <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
          <NotificationsBell collapsed={collapsed} />
          {user && (
            <div
              className={cn(
                'flex items-center gap-2.5',
                collapsed ? 'justify-center px-0' : 'px-2',
              )}
              title={collapsed ? `${user.name} — ${user.email}` : undefined}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {initials}
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{user.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                </div>
              )}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className={cn('justify-start', collapsed && 'justify-center px-0')}
            aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
            title={collapsed ? (isDark ? 'Modo claro' : 'Modo escuro') : undefined}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {!collapsed && (isDark ? 'Modo claro' : 'Modo escuro')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className={cn('justify-start', collapsed && 'justify-center px-0')}
            title={collapsed ? 'Sair' : undefined}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && 'Sair'}
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
