import { MicIcon } from './Icons';

// UI only: toggles the "listening" state. Plug Bhashini speech-to-text in via onToggle.
export default function MicButton({ isListening, onToggle }) {
  return (
    <button onClick={onToggle} aria-label="Voice input" aria-pressed={isListening} className="tap w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: 'var(--saffron)' }}>
      <MicIcon />
    </button>
  );
}
