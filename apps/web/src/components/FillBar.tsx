interface FillBarProps {
  value: number | null;
}

export function FillBar({ value }: FillBarProps) {
  if (value === null || value === undefined) {
    return <span className="muted">—</span>;
  }

  const safe = Math.max(0, Math.min(100, value));
  const tone = safe >= 90 ? 'danger' : safe >= 70 ? 'warning' : '';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="fill-bar">
        <div
          className={`fill-bar__inner${tone ? ` fill-bar__inner--${tone}` : ''}`}
          style={{ width: `${safe}%` }}
        />
      </div>
      <span className="muted" style={{ fontSize: 12, minWidth: 32 }}>
        {safe}%
      </span>
    </div>
  );
}
