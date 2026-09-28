import { MicIcon } from './Icons';

// Prominent docked bar — the entry point to the chatbot (UI only).
export default function ChatbotBar({ onOpen }) {
  return (
    <div className="zoom-main fixed left-0 right-0 bottom-0 lg:bottom-6 z-30 px-4 flex flex-col items-center" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 10px)' }}>
      <p className="hidden lg:block text-lg font-semibold mb-2" style={{ color: 'var(--navy)' }}>🤖 Ask WeatherGPT — your AI weather &amp; alerts assistant</p>
      <div className="w-full max-w-xl lg:max-w-none lg:w-[760px] card flex items-center gap-2 lg:gap-3 px-2.5 lg:px-4 py-2.5 lg:py-4 shadow-lg chat-dock-accent" style={{ border: '1.5px solid var(--saffron)' }}>
        <button onClick={onOpen} className="flex-1 min-w-0 truncate text-left min-h-[48px] lg:min-h-[58px] px-4 lg:px-6 rounded-full text-base lg:text-xl" style={{ background: 'var(--bg)', color: 'var(--sub)' }}>💬 Ask WeatherGPT anything…</button>
        <button onClick={onOpen} aria-label="Voice" className="w-[48px] h-[48px] lg:w-[58px] lg:h-[58px] rounded-full flex items-center justify-center text-white shrink-0" style={{ background: 'var(--navy)' }}>
          <MicIcon className="w-5 h-5 lg:w-7 lg:h-7" />
        </button>
      </div>
    </div>
  );
}
