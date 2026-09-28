import ModalShell, { CloseButton } from './ModalShell';
import { ROLE_NAMES } from '../data/mockData';

// Popup for an official IMD alert + role-specific precautions. Closes with X, "Got it", Esc or backdrop.
export default function AlertModal({ alert, advisory, role, onClose }) {
  if (!alert) return null;
  return (
    <ModalShell onClose={onClose} className="relative" style={{ borderTop: '4px solid var(--saffron)' }}>
      <CloseButton onClick={onClose} className="absolute top-3 right-3" />
      <span className="inline-block text-[12px] font-bold px-2 py-1 rounded" style={{ background: 'var(--saffron)', color: '#3a2600' }}>{alert.level} ALERT</span>
      <p className="text-[12px] mt-2" style={{ color: 'var(--sub)' }}>{alert.validity}</p>
      <h3 className="font-semibold mt-2">{alert.title}</h3>
      <p className="text-base mt-2" style={{ color: 'var(--sub)' }}>{alert.description}</p>
      <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
        <p className="text-[13px] font-semibold" style={{ color: 'var(--sub)' }}>For you as a {ROLE_NAMES[role] || 'citizen'}</p>
        <div className="mt-1 space-y-1">
          {advisory.foryou.map((t) => <p key={t} className="text-base">• {t}</p>)}
        </div>
      </div>
      <button onClick={onClose} className="tap w-full mt-4 rounded-xl text-white font-semibold" style={{ background: 'var(--navy)' }}>Got it</button>
    </ModalShell>
  );
}
