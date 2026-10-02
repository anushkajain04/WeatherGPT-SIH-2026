import { HELPLINES } from '../data/mockData';

export default function HelplineCard({ onReport }) {
  return (
    <div className="card p-4 lg:p-6">
      <p className="font-semibold text-base">Safety &amp; helplines</p>
      <div className="mt-2 space-y-2">
        {HELPLINES.map((h) => (
          <a key={h.number} href={`tel:${h.number}`} className="tap flex items-center justify-between rounded-lg px-3 py-2 lg:py-3 text-base" style={{ background: 'var(--bg)' }}>
            <span>{h.icon} {h.label}</span><span className="font-semibold">{h.number}</span>
          </a>
        ))}
      </div>
      <button onClick={onReport} className="tap w-full mt-3 rounded-xl text-base font-semibold" style={{ border: '1px solid var(--line)', color: 'var(--navy)' }}>Report an issue in chat</button>
    </div>
  );
}
