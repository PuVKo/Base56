import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = [
  'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))'
];

export default function SourceChart({ orders }) {
  const data = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      const s = o.source?.trim() || 'Не указан';
      // Normalize source
      let key = s;
      if (s.toLowerCase().includes('авито')) key = 'Авито';
      else if (s.toLowerCase().includes('юла')) key = 'Юла';
      else if (s.toLowerCase().includes('сайт')) key = 'Сайт';
      else if (s.toLowerCase().includes('партнер') || s.toLowerCase().includes('партнёр')) key = 'Партнеры';
      else if (s.toLowerCase().includes('фарпост')) key = 'Фарпост';
      else if (s.toLowerCase().includes('вк') || s.toLowerCase().includes('vk')) key = 'ВКонтакте';
      else if (s.toLowerCase().includes('инст') || s.toLowerCase().includes('inst')) key = 'Instagram';
      else if (s === 'Не указан') key = 'Не указан';
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [orders]);

  return (
    <div className="bg-card rounded-2xl p-5 border border-border">
      <h3 className="text-sm font-semibold text-foreground mb-4">Источники лидов</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip
            formatter={(v, n) => [v, n]}
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}