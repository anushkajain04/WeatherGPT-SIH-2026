import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ModalShell, { CloseButton } from './ModalShell';
import { ROLE_OPTIONS, LANGUAGE_OPTIONS } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import { updateMe } from '../api';
import { capitalizeWords } from '../utils/text';

export default function ProfileModal({ user, onSave, onChangeLocation, onLogout, onClose }) {
  const { t } = useTranslation();
  const auth = useAuth();
  const [name, setName] = useState(user?.name ? capitalizeWords(user.name) : '');
  const [role, setRole] = useState(user?.role || 'normal_user');
  const [language, setLanguage] = useState(user?.preferredLanguage || user?.language || 'en');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const cleanName = capitalizeWords(name.trim());
    if (cleanName && (cleanName.length < 2 || cleanName.length > 60 || !/^[a-zA-Z\s]+$/.test(cleanName))) {
      return setError('Name must be 2–60 characters and contain letters and spaces only.');
    }

    setError('');
    setBusy(true);

    const updates = {
      name: cleanName || undefined,
      role,
      preferredLanguage: language,
    };

    try {
      if (auth?.updateUser) {
        await auth.updateUser(updates);
      } else {
        await updateMe(updates);
      }
      if (onSave) {
        await onSave({ name: cleanName, role, language });
      } else if (onClose) {
        onClose();
      }
    } catch (err) {
      setError(err?.message || 'Failed to update profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      onClose={onClose}
      className="scrollbar-none"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('your_profile')}</h3>
        <CloseButton onClick={onClose} />
      </div>
      <div className="mt-4 space-y-3">
        <div>
          <p className="text-[13px] font-medium" style={{ color: 'var(--sub)' }}>
            {t('phone_email')}
          </p>
          <p className="text-base font-medium mt-0.5">{user.contact}</p>
        </div>
        <div>
          <label htmlFor="p-name" className="text-[13px] font-medium" style={{ color: 'var(--sub)' }}>
            {t('name')}
          </label>
          <input
            id="p-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(capitalizeWords(e.target.value));
              if (error) setError('');
            }}
            placeholder={t('your_name')}
            maxLength={60}
            className="tap w-full mt-1 rounded-xl px-3 py-2 outline-none"
          />
        </div>
        <div>
          <label htmlFor="p-role" className="text-[13px] font-medium" style={{ color: 'var(--sub)' }}>
            {t('role')}
          </label>
          <select
            id="p-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="tap w-full mt-1 rounded-xl px-3 py-2 outline-none"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div
          className="flex items-center justify-between rounded-xl px-3 py-2"
          style={{ background: 'var(--bg)' }}
        >
          <div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--sub)' }}>
              {t('location')}
            </p>
            <p className="text-base font-medium">{user.location}</p>
          </div>
          <button
            onClick={onChangeLocation}
            className="tap px-3 rounded-full text-[14px] font-semibold"
            style={{ border: '1px solid var(--line)', color: 'var(--navy)' }}
          >
            {t('btn_change')}
          </button>
        </div>
        <div>
          <label htmlFor="p-lang" className="text-[13px] font-medium" style={{ color: 'var(--sub)' }}>
            {t('language')}
          </label>
          <select
            id="p-lang"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="tap w-full mt-1 rounded-xl px-3 py-2 outline-none"
          >
            {LANGUAGE_OPTIONS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && (
        <p className="text-[13px] mt-2" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
      <button
        onClick={handleSave}
        disabled={busy}
        className="tap w-full mt-4 rounded-xl text-white font-semibold py-2.5 disabled:opacity-60"
        style={{ background: 'var(--navy)' }}
      >
        {busy ? t('saving') : t('btn_save_changes')}
      </button>
      <button
        onClick={onLogout}
        className="tap w-full mt-2 rounded-xl font-semibold py-2.5"
        style={{ border: '1px solid var(--line)', color: 'var(--danger)' }}
      >
        {t('btn_sign_out')}
      </button>
    </ModalShell>
  );
}
