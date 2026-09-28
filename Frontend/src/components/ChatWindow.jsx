import { useEffect, useRef, useState } from 'react';
import { CloseButton } from './ModalShell';
import MessageBubble from './MessageBubble';
import MicButton from './MicButton';
import { QUICK_REPLIES, QUICK_REPLY_LABELS } from '../data/mockData';

// UI only — there is no assistant response. Hook onSend / onToggleMic to the real backend later.
export default function ChatWindow({ messages, isListening, onSend, onToggleMic, onClose }) {
  const [draft, setDraft] = useState('');
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0" style={{ background: 'rgba(15,23,45,.45)' }} onClick={onClose} />
      <div className="fade-in relative w-full sm:w-[600px] h-[90svh] sm:h-[720px] sm:mb-4 card rounded-b-none sm:rounded-[18px] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom,0px)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--navy)' }}>💬</div>
            <div>
              <p className="font-semibold text-base leading-none">WeatherGPT chat</p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--sub)' }}>UI preview — not connected yet</p>
            </div>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
          <div ref={endRef} />
        </div>

        <div className="px-3 pt-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2">
            {QUICK_REPLIES.map((q) => (
              <button key={q} onClick={() => onSend(q)} className="shrink-0 tap px-3 rounded-full text-[14px]" style={{ border: '1px solid var(--line)' }}>
                {QUICK_REPLY_LABELS[q] || q}
              </button>
            ))}
          </div>
        </div>

        {isListening && (
          <div className="flex flex-col items-center justify-center py-3">
            <div className="listening w-14 h-14 rounded-full flex items-center justify-center text-white text-xl" style={{ background: 'var(--danger)' }}>🎙️</div>
            <p className="text-[13px] mt-2" style={{ color: 'var(--sub)' }}>Listening…</p>
          </div>
        )}

        <div className="px-3 pb-3 pt-1 flex items-center gap-2">
          <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Type your question…" aria-label="Your question" className="tap flex-1 rounded-full px-4 py-2 outline-none" style={{ border: '1px solid var(--line)' }} />
          <MicButton isListening={isListening} onToggle={onToggleMic} />
          <button onClick={send} aria-label="Send" className="tap w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: 'var(--navy)' }}>➤</button>
        </div>
      </div>
    </div>
  );
}
