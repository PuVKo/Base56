import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OrderComments({ orderId }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const load = async () => {
    const data = await base44.entities.Comment.filter({ order_id: orderId }, 'created_date', 200);
    setComments(data);
  };

  useEffect(() => {
    if (orderId) load();
  }, [orderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleAdd = async () => {
    if (!text.trim()) return;
    setLoading(true);
    await base44.entities.Comment.create({ order_id: orderId, text: text.trim() });
    setText('');
    await load();
    setLoading(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.Comment.delete(id);
    await load();
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  const fmt = (d) => {
    const date = new Date(d);
    return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-foreground">Комментарии</h4>

      {comments.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Нет комментариев. Напишите первый...</p>
      )}

      <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
        {comments.map((c) => (
          <div key={c.id} className="group flex gap-2 items-start">
            <div className="flex-1 bg-muted rounded-xl px-3 py-2 text-sm">
              <p className="whitespace-pre-wrap break-words">{c.text}</p>
              <p className="text-xs text-muted-foreground mt-1">{fmt(c.created_date)}</p>
            </div>
            <button
              onClick={() => handleDelete(c.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 items-end">
        <textarea
          className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-h-[38px] max-h-28"
          placeholder="Написать комментарий... (Enter для отправки)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
        />
        <Button size="icon" onClick={handleAdd} disabled={loading || !text.trim()} className="shrink-0">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}