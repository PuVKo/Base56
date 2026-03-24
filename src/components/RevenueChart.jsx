import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

const MONTHS_RU = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

export default function RevenueChart({ orders, year }) {
  const data = useMemo(() => {
    const filtered = orders.filter(o => {
      if (!o.date) return false;
      try { return new Date(o.date).getFullYear() === year; } catch { return false; }
    });

    const byMonth = Array.from({ length: 12 }, (_, i) => ({ month: MONTHS_RU[i], revenue: 0, count: 0 }));
    filtered.forEach(o => {
      try {
        const m = new Date(o.date).getMonth();
        byMonth[m].revenue += o.amount || 0;
        byMonth[m].count += 1;
      } catch {}
    });
    return byMonth;
  }, [orders, year]);

  return (
    <div className="bg-card rounded-2xl p-5 border border-border">
      <h3 className="text-sm font-semibold text-foreground mb-4">Доход по месяцам — {year}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barSize={18}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${v/1000}K` : v} />
          <Tooltip
            formatter={(v) => [`${v.toLocaleString('ru-RU')} ₽`, 'Доход']}
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
          />
          <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}