interface Props {
  value: number | null;
}

export function BatteryIndicator({ value }: Props) {
  if (value === null || value === undefined) {
    return <span className="muted">—</span>;
  }
  const tone = value <= 15 ? 'danger' : value <= 30 ? 'warning' : 'success';
  return <span className={`badge badge--${tone}`}>{value}%</span>;
}
