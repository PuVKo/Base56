import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OrderModal from '../components/OrderModal';

const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAYS_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

const statusColor = {
  'Завершен': 'bg-emerald-500',
  'В процессе': 'bg-blue-500',
  'Запланирован': 'bg-amber-500',
  'Отменен': 'bg-red-400',
};

export default function CalendarView() {
  const [orders, setOrders] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [modal, setModal] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const load = async () => {
    const data = await base44.entities.Order.list('-date', 2000);
    setOrders(data);
  };

  useEffect(() => { load(); }, []);

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const ordersMap = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      if (!o.date) return;
      const d = new Date(o.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(o);
      }
    });
    return map;
  }, [orders, year, month]);

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Mon-start

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isToday = (d) => d && year === today.getFullYear() && month === today.getMonth() && d === today.getDate();

  const monthOrders = orders.filter(o => {
    if (!o.date) return false;
    const d = new Date(o.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  const monthRevenue = monthOrders.filter(o => o.status === 'Завершен').reduce((s, o) => s + (o.amount || 0), 0);

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Календарь</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{monthOrders.length} заказов · {monthRevenue.toLocaleString('ru-RU')} ₽</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl overflow-hidden">
            <button onClick={prev} className="px-3 py-2 hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-4 py-2 text-sm font-semibold min-w-32 text-center">{MONTHS_RU[month]} {year}</span>
            <button onClick={next} className="px-3 py-2 hover:bg-muted transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <Button size="sm" onClick={() => setModal('new')}>
            <Plus className="w-4 h-4 mr-1" /> Новый заказ
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAYS_RU.map(d => (
            <div key={d} className={`py-3 text-center text-xs font-semibold text-muted-foreground ${d === 'Сб' || d === 'Вс' ? 'text-rose-400' : ''}`}>{d}</div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const dayOrders = day ? (ordersMap[day] || []) : [];
            const isWeekend = (i % 7) >= 5;
            return (
              <div
                key={i}
                className={`min-h-24 p-2 border-b border-r border-border last:border-r-0 ${!day ? 'bg-muted/20' : isWeekend ? 'bg-rose-50/30' : 'hover:bg-muted/10'} transition-colors`}
              >
                {day && (
                  <>
                    <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday(day) ? 'bg-primary text-white' : isWeekend ? 'text-rose-500' : 'text-foreground'}`}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {dayOrders.slice(0, 3).map(o => (
                        <button
                          key={o.id}
                          onClick={() => setSelectedOrder(o)}
                          className={`w-full text-left text-xs px-1.5 py-0.5 rounded text-white truncate ${statusColor[o.status] || 'bg-muted-foreground'}`}
                          title={o.title}
                        >
                          {o.time_range ? `${o.time_range.split('-')[0]} ` : ''}{o.title}
                        </button>
                      ))}
                      {dayOrders.length > 3 && (
                        <div className="text-xs text-muted-foreground pl-1">+{dayOrders.length - 3} ещё</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected order detail */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
          <div className="bg-card rounded-2xl border border-border p-6 max-w-sm w-full space-y-3 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-foreground text-lg leading-tight">{selectedOrder.title}</h3>
              <Button variant="ghost" size="sm" onClick={() => { setModal(selectedOrder); setSelectedOrder(null); }}>✏️</Button>
            </div>
            {selectedOrder.date && <p className="text-sm text-muted-foreground">📅 {selectedOrder.date}{selectedOrder.time_range ? ` · ${selectedOrder.time_range}` : ''}</p>}
            {selectedOrder.source && <p className="text-sm text-muted-foreground">📍 {selectedOrder.source}</p>}
            {selectedOrder.amount > 0 && <p className="text-sm font-semibold">💰 {selectedOrder.amount.toLocaleString('ru-RU')} ₽</p>}
            {selectedOrder.description && <p className="text-sm text-foreground">{selectedOrder.description}</p>}
            {selectedOrder.tags && (
              <div className="flex flex-wrap gap-1">
                {selectedOrder.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                  <span key={t} className="text-xs bg-secondary px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            )}
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
              selectedOrder.status === 'Завершен' ? 'bg-emerald-100 text-emerald-700' :
              selectedOrder.status === 'Запланирован' ? 'bg-amber-100 text-amber-700' :
              'bg-muted text-muted-foreground'
            }`}>{selectedOrder.status}</span>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedOrder(null)}>Закрыть</Button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <OrderModal
          open={!!modal}
          onClose={() => setModal(null)}
          order={modal !== 'new' ? modal : null}
          onSaved={load}
        />
      )}
    </div>
  );
}