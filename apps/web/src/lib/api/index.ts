import { authApi, usersApi } from '@/modules/auth/api/auth.api';
import { sensorReadingsApi, trashBinsApi } from '@/modules/trash-bins/api/trash-bins.api';
import { locationsApi } from '@/modules/locations/api/locations.api';
import { camerasApi } from '@/modules/security/api/cameras.api';
import { tasksApi } from '@/modules/tasks/api/tasks.api';
import { notificationsApi } from '@/modules/notifications/api/notifications.api';
import { analyticsApi, reportsApi } from '@/modules/analytics/api/analytics.api';

export { ApiError } from './client';
export type { DateRange } from './client';

export const api = {
  auth: authApi,
  users: usersApi,
  trashBins: trashBinsApi,
  sensorReadings: sensorReadingsApi,
  locations: locationsApi,
  cameras: camerasApi,
  tasks: tasksApi,
  notifications: notificationsApi,
  analytics: analyticsApi,
  reports: reportsApi,
};
