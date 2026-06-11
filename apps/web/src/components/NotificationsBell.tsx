import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { Notification, NotificationKind } from '../types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '../lib/format';

const POLL_INTERVAL_MS = 30_000;

const KIND_DOT: Record<NotificationKind, string> = {
  task_assigned: 'bg-blue-500',
  task_urgent: 'bg-destructive',
  task_overdue: 'bg-amber-500',
  task_done: 'bg-primary',
  task_auto: 'bg-muted-foreground/50',
  task_mention: 'bg-purple-500',
};

const KIND_LABEL: Record<NotificationKind, string> = {
  task_assigned: 'Atribuída',
  task_urgent: 'Urgente',
  task_overdue: 'Atrasada',
  task_done: 'Concluída',
  task_auto: 'Automática',
  task_mention: 'Menção',
};

export function NotificationsBell({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      const { count } = await api.notifications.unreadCount();
      setUnread(count);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
    }
  }, []);

  const refreshList = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.notifications.list();
      setItems(list);
      setUnread(list.filter((n) => !n.readAt).length);
    } catch {
      // silencioso — o badge volta no próximo poll
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCount();
    const id = window.setInterval(() => {
      void refreshCount();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [refreshCount]);

  useEffect(() => {
    if (open) void refreshList();
  }, [open, refreshList]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [open]);

  const handleItemClick = async (n: Notification) => {
    if (!n.readAt) {
      try {
        await api.notifications.markRead(n.id);
        setItems((current) =>
          current.map((item) =>
            item.id === n.id ? { ...item, readAt: new Date().toISOString() } : item,
          ),
        );
        setUnread((c) => Math.max(0, c - 1));
      } catch {
        // ignore
      }
    }
    if (n.taskId) {
      setOpen(false);
      navigate('/tasks');
    }
  };

  const handleMarkAll = async () => {
    try {
      const { updated } = await api.notifications.markAllRead();
      const now = new Date().toISOString();
      setItems((current) =>
        current.map((item) => (item.readAt ? item : { ...item, readAt: now })),
      );
      setUnread((c) => Math.max(0, c - updated));
    } catch {
      // ignore
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className={cn('relative justify-start', collapsed && 'justify-center px-0')}
        aria-label="Notificações"
        title={collapsed ? 'Notificações' : undefined}
      >
        <Bell className="h-4 w-4" />
        {!collapsed && 'Notificações'}
        {unread > 0 && (
          <span
            className={cn(
              'absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground',
              collapsed ? 'right-1 top-1' : 'right-2 top-1.5',
            )}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>

      {open && (
        <div
          className={cn(
            'absolute z-50 max-h-[28rem] w-80 overflow-hidden rounded-xl border border-border bg-card shadow-lg',
            collapsed ? 'left-full top-0 ml-2' : 'left-0 bottom-full mb-2',
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">Notificações</span>
            {items.some((n) => !n.readAt) && (
              <button
                type="button"
                onClick={() => void handleMarkAll()}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                Carregando...
              </div>
            ) : items.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                Nenhuma notificação por aqui.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => {
                  const isUnread = !n.readAt;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => void handleItemClick(n)}
                        className={cn(
                          'flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors hover:bg-muted/60',
                          isUnread && 'bg-primary/5',
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={cn(
                              'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                              KIND_DOT[n.kind],
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                'text-xs leading-snug',
                                isUnread ? 'font-semibold' : 'text-muted-foreground',
                              )}
                            >
                              {n.title}
                            </p>
                            {n.body && (
                              <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                                {n.body}
                              </p>
                            )}
                            <p className="mt-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                              <span>{KIND_LABEL[n.kind]}</span>
                              <span>·</span>
                              <span>{formatRelativeTime(n.createdAt)}</span>
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
