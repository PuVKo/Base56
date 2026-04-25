import { useCallback, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { apiFetch } from '@/lib/api';

/**
 * Чат с LLM (OpenRouter на сервере). История — только user/assistant для API.
 */
export function AssistantView() {
  const [messages, setMessages] = useState(
    /** @type {{ role: 'user' | 'assistant'; content: string }[]} */ ([]),
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const bottomRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setError(null);
    const nextThread = [...messages, { role: 'user', content: text }];
    setMessages(nextThread);
    setLoading(true);
    scrollToBottom();
    try {
      const timezone =
        typeof Intl !== 'undefined'
          ? Intl.DateTimeFormat().resolvedOptions().timeZone || ''
          : '';
      const data = await apiFetch('/api/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: nextThread, timezone }),
      });
      const content =
        data && typeof data.message === 'object' && typeof data.message.content === 'string'
          ? data.message.content
          : '';
      setMessages((prev) => [...prev, { role: 'assistant', content: content || '(пустой ответ)' }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [input, loading, messages, scrollToBottom]);

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-full min-h-[320px] gap-4">
      <p className="text-sm text-notion-muted">
        Запросы идут на сервер с вашей сессией: модель может читать и менять записи через инструменты. Нужен{' '}
        <span className="text-notion-muted/90 font-medium">OPENROUTER_API_KEY</span> в{' '}
        <code className="text-xs bg-notion-surface px-1 rounded">server/.env</code>.
      </p>
      <p className="text-xs text-notion-muted/85">
        Поле «Клиент» из записей в модель не передаётся. Текст сообщений в чате не фильтруется — не дублируйте там персональные данные без нужды.
      </p>
      <div className="flex-1 min-h-0 rounded-xl border border-notion-border bg-notion-surface/40 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-notion-muted">Например: «Покажи записи на завтра» или «Создай запись на 2026-04-25, название Консультация».</p>
        ) : null}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                m.role === 'user'
                  ? 'bg-violet-600/90 text-white'
                  : 'bg-notion-hover/80 text-white/95 border border-notion-border/60'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading ? (
          <div className="text-xs text-notion-muted">Думаю…</div>
        ) : null}
        <div ref={bottomRef} />
      </div>
      {error ? (
        <div className="text-sm text-rose-300 bg-rose-950/20 border border-rose-500/25 rounded-lg px-3 py-2" role="alert">
          {error}
        </div>
      ) : null}
      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder="Сообщение…"
          className="flex-1 min-h-[2.75rem] max-h-40 rounded-lg border border-notion-border bg-notion-bg px-3 py-2 text-sm text-white placeholder:text-notion-muted focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-y"
          disabled={loading}
          aria-label="Сообщение ассистенту"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={loading || !input.trim()}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-white text-notion-bg text-sm font-medium hover:bg-white/90 disabled:opacity-40 disabled:pointer-events-none"
        >
          <Send className="w-4 h-4" aria-hidden />
          Отправить
        </button>
      </div>
    </div>
  );
}
