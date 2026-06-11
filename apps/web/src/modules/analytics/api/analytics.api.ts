import type {
  AnalyticsSummary,
  BinActivityRow,
  ProductivityRow,
  ThroughputBucket,
} from '@/types';
import { downloadBlob, rangeQuery, request, type DateRange } from '@/lib/api/client';

export const analyticsApi = {
  summary: (range?: DateRange) =>
    request<AnalyticsSummary>(`/analytics/summary${rangeQuery(range)}`),
  productivity: (range?: DateRange) =>
    request<ProductivityRow[]>(`/analytics/productivity${rangeQuery(range)}`),
  throughput: (weeks?: number) =>
    request<ThroughputBucket[]>(`/analytics/throughput${weeks ? `?weeks=${weeks}` : ''}`),
  bins: (range?: DateRange) =>
    request<BinActivityRow[]>(`/analytics/bins${rangeQuery(range)}`),
};

export const reportsApi = {
  tasksCsv: (range?: DateRange) => {
    const filename = `colecta-tasks-${new Date().toISOString().slice(0, 10)}.csv`;
    return downloadBlob(`/reports/tasks.csv${rangeQuery(range)}`, filename);
  },
};
