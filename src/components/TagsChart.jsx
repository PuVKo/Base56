import { useMemo } from 'react';

const COLORS = [
  'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-pink-500', 'bg-sky-500', 'bg-orange-500'
];

export default function TagsChart({ orders }) {
  const data = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      const tags = (o.tags || '').split(',').map(t => t.trim()).filter(Boolean);
      tags.forEach(t => { map[t] = (map[t] || 0) + 1; });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [orders]);

  const max = data[0]?.[1] || 1;

  return (
    <div className="bg-card rounded-2xl p-5 border border-border">
      <h3 className="text-sm font-semibold text-foreground mb-4">По тегам</h3>
      <div className="space-y-3">
        {data.map(([tag, count], i) => (
          <div key={tag}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-foreground font-medium">{tag}</span>
              <span className="text-muted-foreground">{count}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${COLORS[i % COLORS.length]}`}
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {data.length === 0 && <p className="text-sm text-muted-foreground">Нет данных</p>}
      </div>
    </div>
  );
}