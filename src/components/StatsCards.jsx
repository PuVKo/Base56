import { TrendingUp, Camera, DollarSign, Clock } from 'lucide-react';

const Card = ({ icon: Icon, label, value, sub, color }) => (
  <div className="bg-card rounded-2xl p-5 border border-border">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold mt-1 text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  </div>
);

export default function StatsCards({ orders }) {
  const completed = orders.filter(o => o.status === 'Завершен');
  const totalRevenue = completed.reduce((sum, o) => sum + (o.amount || 0), 0);
  const avgRevenue = completed.filter(o => o.amount > 0).length
    ? totalRevenue / completed.filter(o => o.amount > 0).length
    : 0;

  const formatRub = (n) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}K ₽` : `${Math.round(n)} ₽`;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card icon={Camera} label="Всего заказов" value={orders.length} sub={`${completed.length} завершено`} color="bg-primary" />
      <Card icon={DollarSign} label="Общий доход" value={formatRub(totalRevenue)} sub="от завершённых" color="bg-emerald-500" />
      <Card icon={TrendingUp} label="Средний чек" value={formatRub(avgRevenue)} sub="по оплаченным" color="bg-amber-500" />
      <Card icon={Clock} label="Текущих" value={orders.filter(o => o.status === 'Запланирован' || o.status === 'В процессе').length} sub="активных" color="bg-violet-500" />
    </div>
  );
}