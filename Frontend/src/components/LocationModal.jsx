import { useState } from 'react';
import ModalShell, { CloseButton } from './ModalShell';
import { CITIES } from '../data/mockData';
import { CrosshairIcon } from './Icons';

export default function LocationModal({ current, onApply, onClose }) {
  const [city, setCity] = useState(CITIES.includes(current.split(' · ')[0]) ? current.split(' · ')[0] : CITIES[0]);
  const [pin, setPin] = useState('');
  const [gpsLabel, setGpsLabel] = useState('Use my current location');

  const detectGps = () => {
    setGpsLabel('Detecting…');
    const reset = () => setGpsLabel('Use my current location');
    try {
      if (navigator.geolocation) navigator.geolocation.getCurrentPosition(() => setGpsLabel('Location detected ✓'), reset);
      else setTimeout(reset, 600);
    } catch { reset(); }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Change location</h3>
        <CloseButton onClick={onClose} />
      </div>
      <button onClick={detectGps} className="tap w-full mt-4 rounded-xl px-3 py-2 flex items-center justify-center gap-2 text-base font-medium" style={{ border: '1px solid var(--line)', color: 'var(--navy)' }}>
        <CrosshairIcon /> <span>{gpsLabel}</span>
      </button>
      <div className="flex items-center gap-2 my-3">
        <span className="flex-1 h-px" style={{ background: 'var(--line)' }} />
        <span className="text-[12px]" style={{ color: 'var(--sub)' }}>OR</span>
        <span className="flex-1 h-px" style={{ background: 'var(--line)' }} />
      </div>
      <label htmlFor="city" className="text-[13px] font-medium" style={{ color: 'var(--sub)' }}>Choose a city</label>
      <select id="city" value={city} onChange={(e) => setCity(e.target.value)} className="tap w-full mt-1 rounded-xl px-3 py-2 outline-none">
        {CITIES.map((c) => <option key={c}>{c}</option>)}
      </select>
      <label htmlFor="pin" className="text-[13px] font-medium mt-3 block" style={{ color: 'var(--sub)' }}>Or enter a PIN code</label>
      <input id="pin" type="text" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 411001" className="tap w-full mt-1 rounded-xl px-3 py-2 outline-none" />
      <button onClick={() => onApply(pin.length === 6 ? `${city} · ${pin}` : city)} className="tap w-full mt-4 rounded-xl text-white font-semibold" style={{ background: 'var(--navy)' }}>Apply</button>
    </ModalShell>
  );
}
