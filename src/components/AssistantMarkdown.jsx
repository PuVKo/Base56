import ReactMarkdown from 'react-markdown';

/**
 * Ответ ассистента: Markdown (**жирный**, списки, абзацы). Без сырого HTML из модели.
 */
export function AssistantMarkdown({ text }) {
  return (
    <div
      className={[
        'text-sm leading-relaxed text-notion-fg/95',
        '[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
        '[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-0.5',
        '[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:space-y-0.5',
        '[&_strong]:font-semibold [&_strong]:text-notion-fg',
        '[&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-2 [&_h1]:mb-1',
        '[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1',
        '[&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-1.5 [&_h3]:mb-0.5',
        '[&_code]:text-xs [&_code]:rounded [&_code]:bg-black/25 [&_code]:px-1 [&_code]:py-0.5',
        '[&_a]:text-violet-300 [&_a]:underline [&_a]:underline-offset-2',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-notion-border [&_blockquote]:pl-2 [&_blockquote]:text-notion-muted',
      ].join(' ')}
    >
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}
