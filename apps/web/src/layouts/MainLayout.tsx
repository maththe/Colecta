import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
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
  Menu,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/modules/auth/context/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { NotificationsBell } from '@/modules/notifications/components/NotificationsBell';
import { USER_ROLE_LABELS } from '@/types';

interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  /** Quando definido, o item só aparece para os papéis listados. */
  roles?: UserRole[];
}

const operationSection = {
  title: 'Operação',
  items: [
    { to: '/map', label: 'Mapa', Icon: Map },
    { to: '/bins', label: 'Lixeiras', Icon: Trash2, roles: ['ADMIN', 'LIMPEZA'] },
    { to: '/security', label: 'Segurança', Icon: ShieldCheck, roles: ['ADMIN', 'SEGURANCA'] },
    { to: '/tasks', label: 'Tarefas', Icon: CheckSquare },
  ],
} satisfies { title?: string; items: NavItem[] };

const dashboardSection = {
  items: [
    { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { to: '/analytics', label: 'Analytics', Icon: BarChart3 },
    { to: '/finance', label: 'Financeiro', Icon: Wallet },
  ],
} satisfies { title?: string; items: NavItem[] };

const SIDEBAR_STATE_KEY = 'colecta:sidebar-collapsed';

export function MainLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SIDEBAR_STATE_KEY) === '1';
  });

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STATE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const visibleItems = (items: NavItem[]): NavItem[] =>
    items.filter((item) => !item.roles || (user != null && item.roles.includes(user.role)));

  const sections: { title?: string; items: NavItem[] }[] = (
    user?.role === 'ADMIN' ? [dashboardSection, operationSection] : [operationSection]
  )
    .map((section) => ({ ...section, items: visibleItems(section.items) }))
    .filter((section) => section.items.length > 0);

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    navigate('/login', { replace: true });
  };

  const isDark = theme === 'dark';
  const navCollapsed = collapsed && !mobileOpen;
  const roleLabel = user ? USER_ROLE_LABELS[user.role] : null;

  const initials = user?.name
    ?.split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?';

  return (
    <div className="min-h-screen bg-background lg:flex">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-sidebar px-4 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          C
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold leading-tight">Colecta</div>
          <div className="truncate text-xs text-muted-foreground">Gestão e Automação</div>
        </div>
      </header>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen w-60 shrink-0 flex-col gap-6 border-r border-border bg-sidebar px-4 py-6 transition-transform duration-200 lg:sticky lg:top-0 lg:z-30 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          navCollapsed && 'lg:w-16 lg:px-2',
        )}
      >
        <div className={cn('flex items-center gap-3 px-2', navCollapsed && 'justify-center px-0')}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            C
          </div>
          {!navCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold leading-tight">Colecta</div>
              <div className="text-xs text-muted-foreground">Gestão e Automação</div>
            </div>
          )}
          {!navCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto lg:hidden"
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed((c) => !c)}
          className={cn('hidden justify-start lg:inline-flex', navCollapsed && 'justify-center px-0')}
          aria-label={navCollapsed ? 'Expandir menu' : 'Recolher menu'}
          title={navCollapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {navCollapsed ? (
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
            {section.title && !navCollapsed && (
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={navCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-lg py-2 text-sm transition-colors',
                    navCollapsed ? 'justify-center px-0' : 'px-3',
                    isActive
                      ? 'bg-primary/10 font-semibold text-primary'
                      : 'text-foreground hover:bg-muted',
                  )
                }
              >
                <item.Icon className="h-4 w-4 shrink-0" />
                {!navCollapsed && item.label}
              </NavLink>
            ))}
          </nav>
        ))}

        <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
          <NotificationsBell collapsed={navCollapsed} />
          {user && (
            <div
              className={cn(
                'flex items-center gap-2.5',
                navCollapsed ? 'justify-center px-0' : 'px-2',
              )}
              title={navCollapsed ? `${user.name} — ${user.email}` : undefined}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {initials}
              </div>
              {!navCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{user.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {roleLabel} · {user.email}
                  </div>
                </div>
              )}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className={cn('justify-start', navCollapsed && 'justify-center px-0')}
            aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
            title={navCollapsed ? (isDark ? 'Modo claro' : 'Modo escuro') : undefined}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {!navCollapsed && (isDark ? 'Modo claro' : 'Modo escuro')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className={cn('justify-start', navCollapsed && 'justify-center px-0')}
            title={navCollapsed ? 'Sair' : undefined}
          >
            <LogOut className="h-4 w-4" />
            {!navCollapsed && 'Sair'}
          </Button>
        </div>
      </aside>

      <main className="relative z-0 flex-1 overflow-x-hidden px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
