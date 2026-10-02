import { useEffect } from 'react';

// Shared popup: bottom sheet on phones, centred dialog on larger screens. Esc / backdrop closes it.
export default function ModalShell({ onClose, children, className = '', style = {}, padded = true }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(15,23,45,.55)' }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`fade-in w-full sm:max-w-sm card rounded-b-none sm:rounded-b-[18px] max-h-[92vh] overflow-y-auto ${padded ? 'p-5' : ''} ${className}`}
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom,0px))', ...style }}
      >
        {children}
      </div>
    </div>
  );
}

export const CloseButton = ({ onClick, className = '' }) => (
  <button
    onClick={onClick}
    aria-label="Close"
    className={`tap w-8 h-8 rounded-full flex items-center justify-center ${className}`}
    style={{ background: 'var(--bg)' }}
  >
    ✕
  </button>
);
