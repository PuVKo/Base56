import { Calendar, LayoutDashboard, LayoutGrid, Settings, Table2 } from 'lucide-react';

export const MAIN_VIEWS = [
  { id: 'dashboard', label: 'Дашборд', shortLabel: 'Итоги', icon: LayoutDashboard },
  { id: 'calendar', label: 'Календарь', shortLabel: 'Календ.', icon: Calendar },
  { id: 'gallery', label: 'Плитки', shortLabel: 'Плитки', icon: LayoutGrid },
  { id: 'table', label: 'Таблица', shortLabel: 'Табл.', icon: Table2 },
  { id: 'settings', label: 'Настройки', shortLabel: 'Настр.', icon: Settings },
];
