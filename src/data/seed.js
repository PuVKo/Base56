import { newId } from '@/lib/id';

function nowIso() {
  return new Date().toISOString();
}

export function seedBookings() {
  const t = nowIso();
  return [
    {
      id: newId(),
      title: 'Съемка спортфото',
      date: '2026-04-05',
      timeRange: '11:00-14:00',
      description: 'адрес: Лазо 2д/2, 2 этаж вид',
      amount: 6000,
      status: 'booked',
      tagIds: ['photo'],
      sourceId: 'partner',
      clientName: { name: '', phone: '' },
      comments: [],
      createdAt: t,
      updatedAt: t,
    },
    {
      id: newId(),
      title: 'Лимпо клуб',
      date: '2026-04-18',
      timeRange: '13:45-14:45',
      description: '',
      amount: 3000,
      status: 'booked',
      tagIds: ['photo'],
      sourceId: 'limpo',
      clientName: { name: '', phone: '' },
      comments: [],
      createdAt: t,
      updatedAt: t,
    },
    {
      id: newId(),
      title: 'День рождения Дмитрия в кафе Солови',
      date: '2026-03-30',
      timeRange: '19:00-20:00',
      description: '',
      amount: 4500,
      status: 'processing',
      tagIds: ['photo'],
      sourceId: 'avito',
      clientName: { name: 'Анжелика', phone: '' },
      comments: [
        {
          id: newId(),
          text: 'Анжелика +7 924 417 74 07',
          createdAt: t,
        },
        {
          id: newId(),
          text: 'Предоплата 1000, остаток 3500',
          createdAt: t,
        },
      ],
      createdAt: t,
      updatedAt: t,
    },
    {
      id: newId(),
      title: 'Свадьба Любови и Игоря',
      date: '2026-03-28',
      timeRange: '12:00-23:30',
      description: 'Предлагаю сдвинуть сборы чуть раньше',
      amount: 28500,
      status: 'processing',
      tagIds: ['photo'],
      sourceId: 'direct',
      clientName: { name: 'Дима Колбин', phone: '' },
      comments: [],
      createdAt: t,
      updatedAt: t,
    },
  ];
}
