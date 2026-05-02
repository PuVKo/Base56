import { useCallback, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { AssistantMarkdown } from '@/components/AssistantMarkdown';
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
    <div className="content flex flex-col flex-1 min-h-0">
      <div className="asst-shell flex-1 min-h-0 flex flex-col">
        <div className="asst-intro shrink-0">
          <h2>Ассистент</h2>
          <p>
            Запросы идут на сервер с вашей сессией: модель может читать и менять записи через инструменты. Нужен{' '}
            <strong>OPENROUTER_API_KEY</strong> в <code className="text-xs opacity-90">server/.env</code>.
          </p>
          <p className="text-[12px] mt-2 mb-0">
            Поле «Клиент» из записей в модель не передаётся. Не дублируйте персональные данные без нужды.
          </p>
        </div>

        <div className="asst-stream flex-1 min-h-0">
          {messages.length === 0 ? (
            <p className="muted text-sm">
              Например: «Покажи записи на завтра» или «Создай запись на 2026-04-25, название Консультация».
            </p>
          ) : null}
          {messages.map((m, i) => (
            <div key={i} className={`asst-msg ${m.role === 'user' ? 'you' : 'bot'}`}>
              <div className="asst-avatar shrink-0">{m.role === 'user' ? 'Вы' : 'AI'}</div>
              <div className="asst-bubble">
                {m.role === 'user' ? (
                  <span className="whitespace-pre-wrap">{m.content}</span>
                ) : (
                  <AssistantMarkdown text={m.content} />
                )}
              </div>
            </div>
          ))}
          {loading ? <div className="muted text-xs">Думаю…</div> : null}
          <div ref={bottomRef} />
        </div>

        {error ? (
          <div className="text-sm px-3 py-2 rounded-[var(--radius-sm)] border border-rose-500/35 bg-rose-950/25 text-rose-200 shrink-0" role="alert">
            {error}
          </div>
        ) : null}

        <div className="asst-composer shrink-0">
          <div className="asst-input-row">
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
              className="asst-input"
              disabled={loading}
              aria-label="Сообщение ассистенту"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={loading || !input.trim()}
              className="btn btn-primary shrink-0 self-end"
            >
              <Send className="w-4 h-4" aria-hidden />
              Отправить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
