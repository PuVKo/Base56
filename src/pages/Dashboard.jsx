import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import StatsCards from '../components/StatsCards';
import RevenueChart from '../components/RevenueChart';
import SourceChart from '../components/SourceChart';
import TagsChart from '../components/TagsChart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OrderModal from '../components/OrderModal';

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.Order.list('-date', 2000);
    setOrders(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const years = [...new Set(orders
    .filter(o => o.date)
    .map(o => new Date(o.date).getFullYear())
  )].sort((a, b) => b - a);

  if (years.length && !years.includes(year)) setYear(years[0]);

  const recent = [...orders]
    .filter(o => o.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const statusColor = {
    'Завершен': 'bg-emerald-100 text-emerald-700',
    'В процессе': 'bg-blue-100 text-blue-700',
    'Запланирован': 'bg-amber-100 text-amber-700',
    'Отменен': 'bg-red-100 text-red-700',
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Дашборд</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Обзор вашей деятельности</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(years.length ? years : [new Date().getFullYear()]).map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowModal(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Новый заказ
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <StatsCards orders={orders.filter(o => !o.date || new Date(o.date).getFullYear() === year)} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <RevenueChart orders={orders} year={year} />
            </div>
            <SourceChart orders={orders.filter(o => !o.date || new Date(o.date).getFullYear() === year)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <TagsChart orders={orders.filter(o => !o.date || new Date(o.date).getFullYear() === year)} />
            {/* Recent orders */}
            <div className="lg:col-span-2 bg-card rounded-2xl p-5 border border-border">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-foreground">Последние заказы</h3>
                <Link to="/orders" className="text-xs text-primary hover:underline">Все заказы →</Link>
              </div>
              <div className="space-y-2">
                {recent.map(o => (
                  <div key={o.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{o.title}</p>
                      <p className="text-xs text-muted-foreground">{o.date} · {o.source || '—'}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                      {o.amount > 0 && <span className="text-sm font-semibold text-foreground">{o.amount.toLocaleString('ru-RU')} ₽</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[o.status] || 'bg-muted text-muted-foreground'}`}>{o.status}</span>
                    </div>
                  </div>
                ))}
                {recent.length === 0 && <p className="text-sm text-muted-foreground">Нет заказов</p>}
              </div>
            </div>
          </div>
        </>
      )}

      {showModal && <OrderModal open={showModal} onClose={() => setShowModal(false)} onSaved={load} />}
    </div>
  );
}