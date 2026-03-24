import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import OrderModal from '../components/OrderModal';

const statusColor = {
  'Завершен': 'bg-emerald-100 text-emerald-700',
  'В процессе': 'bg-blue-100 text-blue-700',
  'Запланирован': 'bg-amber-100 text-amber-700',
  'Отменен': 'bg-red-100 text-red-700',
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterTag, setFilterTag] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [modal, setModal] = useState(null); // null | 'new' | order object

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.Order.list('-date', 2000);
    setOrders(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

  const years = [...new Set(orders.filter(o => o.date).map(o => new Date(o.date).getFullYear()))].sort((a, b) => b - a);
  const sources = [...new Set(orders.map(o => o.source?.trim()).filter(Boolean))].sort();
  const tags = [...new Set(orders.flatMap(o => (o.tags || '').split(',').map(t => t.trim()).filter(Boolean)))].sort();

  const normalizeSource = (s) => {
    if (!s) return '—';
    const ls = s.toLowerCase();
    if (ls.includes('авито')) return 'Авито';
    if (ls.includes('юла')) return 'Юла';
    if (ls.includes('сайт')) return 'Сайт';
    if (ls.includes('партнер') || ls.includes('партнёр')) return 'Партнеры';
    if (ls.includes('фарпост')) return 'Фарпост';
    return s.length > 20 ? s.slice(0, 20) + '…' : s;
  };

  const filtered = useMemo(() => {
    let res = [...orders];
    if (search) res = res.filter(o => o.title?.toLowerCase().includes(search.toLowerCase()) || o.description?.toLowerCase().includes(search.toLowerCase()));
    if (filterYear !== 'all') res = res.filter(o => o.date && new Date(o.date).getFullYear() === Number(filterYear));
    if (filterMonth !== 'all') res = res.filter(o => o.date && new Date(o.date).getMonth() === Number(filterMonth));
    if (filterSource !== 'all') res = res.filter(o => {
      const ls = (o.source || '').toLowerCase();
      if (filterSource === 'Авито') return ls.includes('авито');
      if (filterSource === 'Юла') return ls.includes('юла');
      if (filterSource === 'Сайт') return ls.includes('сайт');
      if (filterSource === 'Партнеры') return ls.includes('партнер') || ls.includes('партнёр');
      if (filterSource === 'Фарпост') return ls.includes('фарпост');
      return o.source === filterSource;
    });
    if (filterTag !== 'all') res = res.filter(o => (o.tags || '').split(',').map(t => t.trim()).includes(filterTag));
    if (filterStatus !== 'all') res = res.filter(o => o.status === filterStatus);

    res.sort((a, b) => {
      let va = a[sortField] ?? '', vb = b[sortField] ?? '';
      if (sortField === 'date') { va = va ? new Date(va) : 0; vb = vb ? new Date(vb) : 0; }
      if (sortField === 'amount') { va = va || 0; vb = vb || 0; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return res;
  }, [orders, search, filterYear, filterMonth, filterSource, filterTag, filterStatus, sortField, sortDir]);

  const totalRevenue = filtered.filter(o => o.status === 'Завершен').reduce((s, o) => s + (o.amount || 0), 0);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 opacity-20" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  const handleDelete = async (id) => {
    if (!confirm('Удалить заказ?')) return;
    await base44.entities.Order.delete(id);
    load();
  };

  const normalizedSources = [...new Set(sources.map(s => {
    const ls = s.toLowerCase();
    if (ls.includes('авито')) return 'Авито';
    if (ls.includes('юла')) return 'Юла';
    if (ls.includes('сайт')) return 'Сайт';
    if (ls.includes('партнер') || ls.includes('партнёр')) return 'Партнеры';
    if (ls.includes('фарпост')) return 'Фарпост';
    return s;
  }))].sort();

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Заказы</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} записей · {totalRevenue.toLocaleString('ru-RU')} ₽ доход</p>
        </div>
        <Button onClick={() => setModal('new')} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Новый заказ
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-2xl border border-border p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-28"><SelectValue placeholder="Год" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все годы</SelectItem>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Месяц" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все месяцы</SelectItem>
            {MONTHS_RU.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Источник" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все источники</SelectItem>
            {normalizedSources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Тег" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все теги</SelectItem>
            {tags.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Статус" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {['Запланирован','В процессе','Завершен','Отменен'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('date')}>
                    <span className="flex items-center gap-1">Дата <SortIcon field="date" /></span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('title')}>
                    <span className="flex items-center gap-1">Название <SortIcon field="title" /></span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Время</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Источник</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Теги</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('amount')}>
                    <span className="flex items-center gap-1">Сумма <SortIcon field="amount" /></span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Статус</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{o.date || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground max-w-48 truncate">{o.title}</div>
                      {o.description && <div className="text-xs text-muted-foreground truncate max-w-48">{o.description}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap hidden md:table-cell">{o.time_range || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{normalizeSource(o.source)}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(o.tags || '').split(',').map(t => t.trim()).filter(Boolean).map(t => (
                          <span key={t} className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">
                      {o.amount > 0 ? `${o.amount.toLocaleString('ru-RU')} ₽` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${statusColor[o.status] || 'bg-muted text-muted-foreground'}`}>{o.status || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setModal(o)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(o.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Заказы не найдены</td></tr>
                )}
              </tbody>
            </table>
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