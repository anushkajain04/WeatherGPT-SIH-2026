// type: 'user' (right) | 'assistant' (left) | 'alert' (official IMD card, visually distinct)
export default function MessageBubble({ message }) {
  const { type, text } = message;
  if (type === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm px-3 py-2 text-base text-white" style={{ background: 'var(--navy)' }}>{text}</div>
      </div>
    );
  }
  if (type === 'alert') {
    return (
      <div className="flex">
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3 py-2 text-base" style={{ border: '1.5px solid var(--saffron)', background: '#FFF8EC', color: '#14213D' }}>
          <span className="text-[11px] font-bold" style={{ color: 'var(--warn)' }}>IMD ALERT</span>
          <p className="mt-1">{text}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex">
      <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-3 py-2 text-base" style={{ background: 'var(--bg)' }}>{text}</div>
    </div>
  );
}
