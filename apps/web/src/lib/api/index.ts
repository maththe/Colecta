import { authApi, usersApi } from './auth.api';
import { sensorReadingsApi, trashBinsApi } from './trash-bins.api';
import { locationsApi } from './locations.api';
import { tasksApi } from './tasks.api';
import { notificationsApi } from './notifications.api';
import { analyticsApi, reportsApi } from './analytics.api';

export { ApiError } from './client';
export type { DateRange } from './client';

export const api = {
  auth: authApi,
  users: usersApi,
  trashBins: trashBinsApi,
  sensorReadings: sensorReadingsApi,
  locations: locationsApi,
  tasks: tasksApi,
  notifications: notificationsApi,
  analytics: analyticsApi,
  reports: reportsApi,
};
