import ReactMarkdown from 'react-markdown';

function resolveLocationString(locationResolved) {
  if (!locationResolved) return null;
  if (typeof locationResolved === 'string') return locationResolved.trim();
  if (typeof locationResolved === 'object') {
    return (locationResolved.city || locationResolved.name || locationResolved.location || '').trim();
  }
  return null;
}

// type: 'user' (right) | 'assistant' (left) | 'alert' (official IMD card, visually distinct)
export default function MessageBubble({ message, onRetry }) {
  const { type, text, location_resolved, requestedLocation, isError, weatherUnavailable, retryText } = message;

  const resolvedPlace = resolveLocationString(location_resolved);
  const showPlaceNotice =
    type === 'assistant' &&
    resolvedPlace &&
    requestedLocation &&
    resolvedPlace.toLowerCase() !== requestedLocation.toLowerCase();

  const showRetryButton = (isError || weatherUnavailable) && typeof onRetry === 'function';

  if (type === 'user') {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[80%] rounded-2xl rounded-br-sm px-3 py-2 text-base text-white whitespace-pre-wrap"
          style={{ background: 'var(--navy)' }}
        >
          {text}
        </div>
      </div>
    );
  }

  if (type === 'alert') {
    return (
      <div className="flex">
        <div
          className="max-w-[85%] rounded-2xl rounded-bl-sm px-3 py-2 text-base"
          style={{ border: '1.5px solid var(--saffron)', background: '#FFF8EC', color: '#14213D' }}
        >
          <span className="text-[11px] font-bold" style={{ color: 'var(--warn)' }}>IMD ALERT</span>
          <div className="mt-1 markdown-content">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                ul: ({ children }) => <ul className="list-disc ml-4 my-1 space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal ml-4 my-1 space-y-0.5">{children}</ol>,
                li: ({ children }) => <li>{children}</li>,
              }}
            >
              {text}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div
        className="max-w-[80%] rounded-2xl rounded-bl-sm px-3 py-2 text-base"
        style={{
          background: isError ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg)',
          border: isError ? '1px solid rgba(239, 68, 68, 0.3)' : undefined,
          color: isError ? '#b91c1c' : 'inherit',
        }}
      >
        <div className="markdown-content">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-bold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              ul: ({ children }) => <ul className="list-disc ml-4 my-1 space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal ml-4 my-1 space-y-0.5">{children}</ol>,
              li: ({ children }) => <li>{children}</li>,
            }}
          >
            {text}
          </ReactMarkdown>
        </div>
      </div>

      {showPlaceNotice && (
        <span className="text-[11px] px-1 opacity-70 italic" style={{ color: 'var(--sub)' }}>
          Answer is for {resolvedPlace}
        </span>
      )}

      {showRetryButton && (
        <button
          type="button"
          onClick={() => onRetry(retryText || '')}
          className="mt-0.5 ml-1 px-2.5 py-1 text-xs font-medium rounded-lg border flex items-center gap-1 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
          style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
        >
          🔄 Try again
        </button>
      )}
    </div>
  );
}
