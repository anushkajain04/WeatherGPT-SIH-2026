import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloseButton } from './ModalShell';
import MessageBubble from './MessageBubble';
import MicButton from './MicButton';

const SUGGESTION_CHIP_KEYS = [
  'chat_chip_rain',
  'chat_chip_safe',
  'chat_chip_forecast',
];

export default function ChatWindow({
  messages,
  isPending = false,
  isListening,
  activeLocation,
  onOpenLocation,
  onSend,
  onRetry,
  onToggleMic,
  onClose,
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [showWarmupHint, setShowWarmupHint] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  // Lock body scroll while open, restore on close
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Auto-scroll to newest message
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isPending, showWarmupHint]);

  // Show warmup hint after 8 seconds of pending
  useEffect(() => {
    let timer;
    if (isPending) {
      setShowWarmupHint(false);
      timer = setTimeout(() => {
        setShowWarmupHint(true);
      }, 8000);
    } else {
      setShowWarmupHint(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isPending]);

  const send = () => {
    const text = draft.trim();
    if (!text || isPending) return;
    onSend(text);
    setDraft('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('chat_panel_title', 'WeatherGPT chat')}
        onClick={(e) => e.stopPropagation()}
        className="w-full h-[100dvh] sm:w-[min(960px,96vw)] sm:h-[min(90dvh,860px)] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200"
        style={{
          background: 'var(--card)',
          color: 'var(--ink)',
          border: '1px solid var(--line)',
        }}
      >
        {/* Fixed Header */}
        <div
          className="flex items-center justify-between px-4 sm:px-6 py-2.5 shrink-0"
          style={{ borderBottom: '1px solid var(--line)', background: 'var(--card)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-base shrink-0"
              style={{ background: 'var(--navy)' }}
            >
              💬
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-base sm:text-lg leading-tight truncate">
                  {t('chat_panel_title', 'WeatherGPT chat')}
                </h2>
                {activeLocation && (
                  <button
                    type="button"
                    onClick={onOpenLocation}
                    title={activeLocation}
                    className="text-xs px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1 shrink-0 transition-colors"
                    style={{ color: 'var(--ink)' }}
                  >
                    <span>📍</span>
                    <span className="truncate max-w-[120px] sm:max-w-[160px] font-medium">{activeLocation}</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] sm:text-xs mt-0.5 truncate" style={{ color: 'var(--sub)' }}>
                {t('chat_panel_subtitle', 'Ask anything about the weather')}
              </p>
            </div>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {/* Scrollable Message List */}
        <div
          className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-3 space-y-3.5"
          style={{ overscrollBehavior: 'contain' }}
        >
          {messages.map((m) => {
            const resolved = { ...m, text: m.textKey ? t(m.textKey) : m.text };
            return (
              <MessageBubble
                key={m.id}
                message={resolved}
                onRetry={onRetry}
              />
            );
          })}

          {isPending && (
            <div className="flex flex-col items-start gap-1.5 pt-1">
              <div
                className="px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                }}
              >
                <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              {showWarmupHint && (
                <p className="text-xs px-2 text-amber-600 dark:text-amber-400 font-medium">
                  {t('chat_waking_up_hint', 'Waking up the service, this can take up to a minute')}
                </p>
              )}
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Fixed Bottom Input Area */}
        <div
          className="shrink-0 space-y-2 px-3 sm:px-6 pt-1.5 pb-2.5 sm:pb-3"
          style={{
            borderTop: '1px solid var(--line)',
            background: 'var(--card)',
            paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 10px)',
          }}
        >
          {/* Suggestion chips wrapping naturally */}
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTION_CHIP_KEYS.map((key) => {
              const chipText = t(key);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={isPending}
                  onClick={() => onSend(chipText)}
                  className="tap px-3 py-1 rounded-full text-xs font-medium transition-all hover:opacity-85 disabled:opacity-50"
                  style={{
                    border: '1px solid var(--line)',
                    background: 'var(--bg)',
                    color: 'var(--ink)',
                  }}
                >
                  {chipText}
                </button>
              );
            })}
          </div>

          {isListening && (
            <div className="flex flex-col items-center justify-center py-2">
              <div
                className="listening w-12 h-12 rounded-full flex items-center justify-center text-white text-lg"
                style={{ background: 'var(--danger)' }}
              >
                🎙️
              </div>
              <p className="text-xs mt-1.5" style={{ color: 'var(--sub)' }}>
                Listening…
              </p>
            </div>
          )}

          {/* Text input and send controls */}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              disabled={isPending}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isPending && send()}
              placeholder={t('chat_input_placeholder', 'Type your question…')}
              aria-label="Your question"
              className="tap flex-1 rounded-full px-4 py-2.5 outline-none text-sm sm:text-base disabled:opacity-60"
              style={{
                border: '1px solid var(--line)',
                background: 'var(--bg)',
                color: 'var(--ink)',
              }}
            />
            <MicButton isListening={isListening} onToggle={onToggleMic} />
            <button
              type="button"
              onClick={send}
              disabled={isPending || !draft.trim()}
              aria-label="Send"
              className="tap w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0 disabled:opacity-40 transition-opacity"
              style={{ background: 'var(--navy)' }}
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
