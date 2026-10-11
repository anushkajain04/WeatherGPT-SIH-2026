import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PersonIcon, PinIcon } from './Icons';
import { useAuth } from '../context/AuthContext';
import { LANGUAGE_OPTIONS } from '../data/mockData';

export default function Header({
  user: propUser,
  location,
  hasAlert,
  onAlert,
  onProfile,
  onLocation,
  theme = 'light',
  onToggleTheme,
  onLanguageChange,
}) {
  const { t, i18n } = useTranslation();
  const auth = useAuth();
  const user = propUser || auth?.user;
  const currentLang = user?.preferredLanguage || user?.language || i18n.language || 'en';
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!langOpen) return;
    const handleClickOutside = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [langOpen]);

  const activeOption = LANGUAGE_OPTIONS.find((l) => l.code === currentLang) || LANGUAGE_OPTIONS[0];

  const handleSelectLang = (code) => {
    i18n.changeLanguage(code);
    if (onLanguageChange) {
      onLanguageChange(code);
    }
    setLangOpen(false);
  };

  return (
    <header
      style={{
        background: 'var(--navy)',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
      }}
      className="px-3 sm:px-6 py-3 sm:py-3.5 text-white sticky top-0 z-30 shadow-md min-h-[64px] sm:min-h-[72px] flex items-center"
    >
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-3 sm:gap-4">
        {/* Left: Brand logo + name */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-sm"
            style={{ background: 'var(--saffron)' }}
          >
            ⛅
          </div>
          <div className="flex items-baseline gap-1.5 truncate">
            <span className="font-bold text-lg sm:text-xl tracking-tight">WeatherGPT</span>
            <span className="text-xs opacity-75 hidden md:inline ml-1 font-medium">MoES</span>
          </div>
        </div>

        {/* Right: Controls strip */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Location pill control */}
          <button
            type="button"
            onClick={onLocation}
            aria-label={`Change location. Currently ${location}`}
            title={location}
            className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-full flex items-center gap-1.5 shrink-0 hover:bg-white/20 active:scale-95 transition-all text-xs font-medium border max-w-[140px] xs:max-w-[180px] sm:max-w-[220px]"
            style={{
              background: 'rgba(255,255,255,.16)',
              borderColor: 'rgba(255,255,255,.25)',
            }}
          >
            <PinIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">{location}</span>
            <span className="hidden sm:inline opacity-70 shrink-0 font-normal">· {t('btn_change', 'change')}</span>
          </button>

          {/* Alert button */}
          {hasAlert && (
            <button
              type="button"
              onClick={onAlert}
              className="h-8 sm:h-9 px-3 rounded-full text-xs font-bold flex items-center gap-1 shrink-0 shadow-sm active:scale-95 transition-all"
              style={{ background: 'var(--saffron)', color: 'var(--navy-dark)' }}
            >
              ⚠️ {t('alert')}
            </button>
          )}

          {/* Theme toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 text-sm sm:text-base hover:bg-white/20 active:scale-95 transition-all"
            style={{ background: 'rgba(255,255,255,.16)' }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* Persistent native-script language switcher dropdown pill */}
          <div className="relative" ref={langRef}>
            <button
              type="button"
              onClick={() => setLangOpen((prev) => !prev)}
              aria-expanded={langOpen}
              aria-label="Select language"
              title={`Language: ${activeOption.label}`}
              className="h-8 sm:h-9 px-2.5 rounded-full flex items-center justify-center gap-1.5 shrink-0 hover:bg-white/20 active:scale-95 transition-all text-xs font-medium border"
              style={{
                background: 'rgba(255,255,255,.16)',
                borderColor: 'rgba(255,255,255,.25)',
              }}
            >
              <span className="select-none leading-none">🌐</span>
              <span className="truncate max-w-[70px] sm:max-w-none">{activeOption.label}</span>
              <span className="text-[10px] opacity-75 select-none">▾</span>
            </button>

            {langOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-48 rounded-2xl shadow-2xl border p-1 z-50 overflow-y-auto max-h-72"
                style={{
                  background: 'var(--card)',
                  borderColor: 'var(--line)',
                  color: 'var(--ink)',
                }}
              >
                {LANGUAGE_OPTIONS.map((l) => {
                  const isSelected = l.code === currentLang;
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => handleSelectLang(l.code)}
                      className="w-full px-3 py-2 text-left text-xs sm:text-sm font-medium rounded-xl flex items-center justify-between transition-colors"
                      style={{
                        background: isSelected ? 'var(--navy)' : 'transparent',
                        color: isSelected ? '#ffffff' : 'var(--ink)',
                      }}
                    >
                      <span>{l.label}</span>
                      {isSelected && <span className="font-bold text-xs">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Profile control: avatar-style compact icon */}
          <button
            type="button"
            onClick={onProfile}
            aria-label="User Profile"
            title={user?.name || user?.contact || 'Profile'}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 hover:bg-white/20 active:scale-95 transition-all"
            style={{ background: 'rgba(255,255,255,.22)' }}
          >
            <PersonIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
