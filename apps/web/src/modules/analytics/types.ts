export interface AnalyticsSummary {
  range: { from: string; to: string };
  completed: number;
  avgResolutionMs: number | null;
  onTimeRate: number | null;
  onTime: number;
  withDueDate: number;
  openOverdue: number;
  previousPeriod: {
    completed: number;
    avgResolutionMs: number | null;
    onTimeRate: number | null;
  };
}

export interface BinActivityRow {
  binId: string;
  code: string;
  name: string;
  completed: number;
  pending: number;
}

export interface ProductivityRow {
  userId: string | null;
  userName: string | null;
  completed: number;
  avgResolutionMs: number | null;
  onTime: number;
  withDueDate: number;
}

export interface ThroughputBucket {
  weekStart: string;
  completed: number;
  created: number;
}

export interface ZoneBinsRow {
  zoneId: string | null;
  zoneName: string;
  color: string | null;
  binCount: number;
  fullCount: number;
  avgFillLevel: number | null;
}
