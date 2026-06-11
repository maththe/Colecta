import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { TaskComment } from '../types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatRelativeTime } from '../lib/format';

function initialsOf(name: string): string {
  return (
    name
      .split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

export function TaskComments({ taskId }: { taskId: string }) {
  const [items, setItems] = useState<TaskComment[] | null>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await api.tasks.listComments(taskId);
      setItems(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar comentários');
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const trimmed = body.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.tasks.addComment(taskId, trimmed);
      setItems((prev) => (prev ? [...prev, created] : [created]));
      setBody('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao publicar comentário');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Comentários</h3>
        {items && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {items.length}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {items === null ? (
          <p className="text-xs text-muted-foreground">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
            Nenhum comentário ainda.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((c) => (
              <li key={c.id} className="flex gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                  {initialsOf(c.author.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold">{c.author.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelativeTime(c.createdAt)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-snug text-foreground">
                    {c.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Escreva um comentário... (Ctrl/Cmd+Enter para enviar)"
          rows={3}
          disabled={submitting}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => void submit()}
            disabled={!canSubmit}
          >
            <Send className="h-3.5 w-3.5" />
            {submitting ? 'Enviando...' : 'Enviar'}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
