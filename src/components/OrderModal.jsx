import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';

const EMPTY = { title: '', date: '', time_range: '', source: '', description: '', status: 'Запланирован', amount: '', tags: '' };

export default function OrderModal({ open, onClose, order, onSaved }) {
  const [form, setForm] = useState(order ? {
    ...order,
    amount: order.amount ?? ''
  } : EMPTY);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const data = { ...form, amount: form.amount !== '' ? parseFloat(form.amount) : null };
    if (order?.id) {
      await base44.entities.Order.update(order.id, data);
    } else {
      await base44.entities.Order.create(data);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order?.id ? 'Редактировать заказ' : 'Новый заказ'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Название *</Label>
            <Input className="mt-1" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Название проекта" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Дата</Label>
              <Input className="mt-1" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div>
              <Label>Время</Label>
              <Input className="mt-1" value={form.time_range} onChange={e => set('time_range', e.target.value)} placeholder="14:00-16:00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Сумма (₽)</Label>
              <Input className="mt-1" type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="5000" />
            </div>
            <div>
              <Label>Статус</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Запланирован','В процессе','Завершен','Отменен'].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Источник лида</Label>
            <Input className="mt-1" value={form.source} onChange={e => set('source', e.target.value)} placeholder="Авито, ВКонтакте..." />
          </div>
          <div>
            <Label>Теги</Label>
            <Input className="mt-1" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="Фотография, Свадьба..." />
          </div>
          <div>
            <Label>Описание</Label>
            <Textarea className="mt-1" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Детали заказа..." rows={3} />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving || !form.title}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}