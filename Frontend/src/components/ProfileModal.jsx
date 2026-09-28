import { useState } from 'react';
import ModalShell, { CloseButton } from './ModalShell';
import { ROLE_OPTIONS, LANGUAGES } from '../data/mockData';

export default function ProfileModal({ user, onSave, onChangeLocation, onLogout, onClose }) {
  const [role, setRole] = useState(user.role);
  const [language, setLanguage] = useState(user.language);

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Your profile</h3>
        <CloseButton onClick={onClose} />
      </div>
      <div className="mt-4 space-y-3">
        <div>
          <p className="text-[13px] font-medium" style={{ color: 'var(--sub)' }}>Phone / email</p>
          <p className="text-base font-medium mt-0.5">{user.contact}</p>
        </div>
        <div>
          <label htmlFor="p-role" className="text-[13px] font-medium" style={{ color: 'var(--sub)' }}>Role</label>
          <select id="p-role" value={role} onChange={(e) => setRole(e.target.value)} className="tap w-full mt-1 rounded-xl px-3 py-2 outline-none">
            {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: 'var(--bg)' }}>
          <div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--sub)' }}>Location</p>
            <p className="text-base font-medium">{user.location}</p>
          </div>
          <button onClick={onChangeLocation} className="tap px-3 rounded-full text-[14px] font-semibold" style={{ border: '1px solid var(--line)', color: 'var(--navy)' }}>Change</button>
        </div>
        <div>
          <label htmlFor="p-lang" className="text-[13px] font-medium" style={{ color: 'var(--sub)' }}>Language</label>
          <select id="p-lang" value={language} onChange={(e) => setLanguage(e.target.value)} className="tap w-full mt-1 rounded-xl px-3 py-2 outline-none">
            {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
      </div>
      <button onClick={() => onSave({ role, language })} className="tap w-full mt-4 rounded-xl text-white font-semibold" style={{ background: 'var(--navy)' }}>Save changes</button>
      <button onClick={onLogout} className="tap w-full mt-2 rounded-xl font-semibold" style={{ border: '1px solid var(--line)', color: 'var(--danger)' }}>Log out</button>
    </ModalShell>
  );
}
