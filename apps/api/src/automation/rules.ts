import { TaskPriority, TrashBin } from '@prisma/client';

export const FILL_LEVEL_FULL_THRESHOLD = 90;
export const BATTERY_LOW_THRESHOLD = 20;
export const OFFLINE_HOURS = 24;

export type Issue = 'fill' | 'battery' | 'offline';

const ISSUE_PRIORITY: Record<Issue, number> = {
  battery: 1,
  fill: 2,
  offline: 3,
};

const ISSUE_TO_TASK_PRIORITY: Record<Issue, TaskPriority> = {
  battery: TaskPriority.medium,
  fill: TaskPriority.high,
  offline: TaskPriority.urgent,
};

const ISSUE_DUE_HOURS: Record<Issue, number> = {
  battery: 24,
  fill: 4,
  offline: 6,
};

const ISSUE_SINGULAR_TITLE: Record<Issue, (code: string) => string> = {
  fill: (code) => `Esvaziar lixeira ${code}`,
  battery: (code) => `Trocar bateria ${code}`,
  offline: (code) => `Verificar lixeira offline ${code}`,
};

const ISSUE_LABEL: Record<Issue, string> = {
  fill: 'cheia',
  battery: 'bateria baixa',
  offline: 'offline',
};

export function detectIssues(
  bin: Pick<TrashBin, 'fillLevel' | 'batteryLevel' | 'lastSeenAt' | 'status'>,
  now: Date,
): Issue[] {
  const issues: Issue[] = [];
  if (bin.fillLevel !== null && bin.fillLevel >= FILL_LEVEL_FULL_THRESHOLD) {
    issues.push('fill');
  }
  if (bin.batteryLevel !== null && bin.batteryLevel <= BATTERY_LOW_THRESHOLD) {
    issues.push('battery');
  }
  const cutoffMs = OFFLINE_HOURS * 60 * 60 * 1000;
  if (!bin.lastSeenAt || now.getTime() - bin.lastSeenAt.getTime() >= cutoffMs) {
    issues.push('offline');
  }
  return issues.sort((a, b) => ISSUE_PRIORITY[b] - ISSUE_PRIORITY[a]);
}

export function composePriority(issues: Issue[]): TaskPriority {
  let worst: TaskPriority = TaskPriority.low;
  let worstRank = -1;
  for (const issue of issues) {
    const candidate = ISSUE_TO_TASK_PRIORITY[issue];
    const rank = ISSUE_PRIORITY[issue];
    if (rank > worstRank) {
      worst = candidate;
      worstRank = rank;
    }
  }
  return worst;
}

export function composeTitle(code: string, issues: Issue[]): string {
  if (issues.length === 0) return `Atender lixeira ${code}`;
  if (issues.length === 1) return ISSUE_SINGULAR_TITLE[issues[0]](code);
  const labels = issues.map((i) => ISSUE_LABEL[i]).join(', ');
  return `Atender lixeira ${code} (${labels})`;
}

export function composeDescription(code: string, issues: Issue[]): string {
  if (issues.length === 0) {
    return `A lixeira ${code} já normalizou, mas a tarefa segue aberta aguardando confirmação no local.`;
  }
  const items = issues.map((i) => `- ${ISSUE_LABEL[i]}`).join('\n');
  return `Problemas detectados automaticamente na lixeira ${code}:\n${items}`;
}

export function computeDueDate(issues: Issue[], now: Date): Date {
  let minHours = 24;
  for (const issue of issues) {
    const hours = ISSUE_DUE_HOURS[issue];
    if (hours < minHours) minHours = hours;
  }
  return new Date(now.getTime() + minHours * 60 * 60 * 1000);
}

export function issuesEqual(a: string[], b: Issue[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  for (let i = 0; i < sortedA.length; i += 1) {
    if (sortedA[i] !== sortedB[i]) return false;
  }
  return true;
}
