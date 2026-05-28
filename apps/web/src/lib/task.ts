import type { Task } from '../types';

// Deep-link to the map focused on the task's bin or position.
// Bins take precedence (a bin already carries its own location);
// returns null when the task has neither.
export function taskMapHref(task: Task): string | null {
  if (task.trashBin) return `/map?bin=${task.trashBin.id}`;
  if (task.location) return `/map?location=${task.location.id}`;
  return null;
}
