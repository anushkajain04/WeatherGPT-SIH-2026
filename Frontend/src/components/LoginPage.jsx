import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CITIES, ROLE_OPTIONS, LANGUAGE_OPTIONS } from '../data/mockData';
import { CrosshairIcon } from './Icons';
import {
  requestOtp,
  verifyOtp,
  resolveCity,
  updateMe,
  requestLinkOtp,
  verifyLinkOtp,
} from '../api';
import { useAuth } from '../context/AuthContext';
import { capitalizeWords } from '../utils/text';

export default function LoginPage({ onLogin }) {
  const { t, i18n } = useTranslation();
  const auth = useAuth();

  // Phase A: step 1 (Contact) | Phase B: step 2 (OTP)
  const [step, setStep] = useState(1);
  const [tab, setTab] = useState('phone'); // 'phone' | 'email'
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [secondaryContact, setSecondaryContact] = useState('');

  // Modal popup overlay for new user setup (Phase C)
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [modalStep, setModalStep] = useState('profile'); // 'profile' | 'secondary_otp'

  // Profile fields inside popup
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [location, setLocation] = useState(CITIES[0]);
  const [preferredLanguage, setPreferredLanguage] = useState(i18n.language || 'en');
  const [gpsLabel, setGpsLabel] = useState(t('detect_my_location'));

  // OTP inputs
  const [otp, setOtp] = useState('');
  const [secondaryOtp, setSecondaryOtp] = useState('');
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [verifiedUser, setVerifiedUser] = useState(null);

  // 30s resend timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) clearInterval(timer);
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Clean canonical primary contact
  const getContactToSubmit = () => {
    if (tab === 'phone') {
      const cleanPhone = phone.replace(/\D/g, '');
      return `+91${cleanPhone}`;
    }
    return email.trim().toLowerCase();
  };

  const getDisplayContact = () => {
    if (tab === 'phone') {
      const cleanPhone = phone.replace(/\D/g, '');
      return cleanPhone ? `+91 ${cleanPhone}` : '';
    }
    return email.trim().toLowerCase();
  };

  // Canonical secondary contact
  const getFormattedSecondary = () => {
    const raw = secondaryContact.trim();
    if (!raw) return '';
    if (tab === 'phone') {
      return raw.toLowerCase();
    }
    const digits = raw.replace(/\D/g, '');
    return digits ? `+91${digits}` : '';
  };

  const getDisplaySecondary = () => {
    const raw = secondaryContact.trim();
    if (!raw) return '';
    if (tab === 'phone') {
      return raw.toLowerCase();
    }
    const digits = raw.replace(/\D/g, '');
    return digits ? `+91 ${digits}` : '';
  };

  const detectGps = () => {
    if (!navigator.geolocation) {
      setGpsLabel('Geolocation not supported');
      setTimeout(() => setGpsLabel(t('detect_my_location')), 2500);
      return;
    }
    setGpsLabel(t('detecting'));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await resolveCity(latitude, longitude);
          const resolvedName =
            res?.formatted || res?.city || res?.location || res?.name || (typeof res === 'string' ? res : null);
          if (resolvedName) {
            setLocation(resolvedName);
            setGpsLabel(t('location_detected'));
            setTimeout(() => setGpsLabel(t('detect_my_location')), 3000);
          } else {
            setGpsLabel(t('detect_my_location'));
          }
        } catch {
          setGpsLabel(t('detect_my_location'));
        }
      },
      () => {
        setGpsLabel(t('detect_my_location'));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Phase A -> Phase B: Request OTP on primary contact only
  const goToOtp = async () => {
    if (tab === 'phone') {
      const cleanDigits = phone.replace(/\D/g, '');
      if (!cleanDigits) {
        return setError('Please enter your mobile number.');
      }
      if (!/^[6-9]\d{9}$/.test(cleanDigits)) {
        return setError('Please enter a valid 10-digit Indian mobile number.');
      }
    } else {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) {
        return setError('Please enter your email address.');
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return setError('Please enter a valid email address.');
      }
    }

    // Optional secondary contact format check
    const rawSecondary = secondaryContact.trim();
    if (rawSecondary) {
      if (tab === 'phone') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawSecondary)) {
          return setError('Please enter a valid email address for secondary contact.');
        }
      } else {
        const digits = rawSecondary.replace(/\D/g, '');
        if (!/^[6-9]\d{9}$/.test(digits)) {
          return setError('Please enter a valid 10-digit Indian mobile number for secondary contact.');
        }
      }
    }

    setError('');
    setBusy(true);
    try {
      await requestOtp(getContactToSubmit());
      setStep(2);
      setCooldown(30);
    } catch (err) {
      setError(err?.message || 'Could not send the code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    if (cooldown > 0 || busy) return;
    setError('');
    setBusy(true);
    try {
      await requestOtp(getContactToSubmit());
      setCooldown(30);
    } catch (err) {
      setError(err?.message || 'Could not resend the code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Phase B: Verify OTP on primary contact
  const verify = async () => {
    if (!/^\d{6}$/.test(otp)) {
      return setError('Please enter the 6-digit verification code.');
    }

    setError('');
    setBusy(true);
    try {
      const res = await verifyOtp(getContactToSubmit(), otp);

      if (res?.success || res?.user || res?.ok) {
        const loggedUser = res.user || {
          contact: getContactToSubmit(),
          preferredLanguage: 'en',
        };

        if (res.isNewUser) {
          // New user: DO NOT call auth.login yet (which would unmount LoginPage).
          // Show the modal overlay on top of the current screen!
          setVerifiedUser(loggedUser);
          setModalStep('profile');
          setShowProfileModal(true);
        } else {
          // Returning user: proceed immediately to dashboard
          if (auth?.login) auth.login(loggedUser);
          if (onLogin) onLogin(loggedUser);
        }
      } else {
        setError(res?.error?.message || 'Incorrect code. Please try again.');
      }
    } catch (err) {
      setError(err?.message || 'Could not verify the code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Helper to complete setup and transition into dashboard
  const finishSetupAndProceed = (finalUser) => {
    setShowProfileModal(false);
    if (auth?.login) auth.login(finalUser);
    if (onLogin) onLogin(finalUser);
  };

  // Phase C Modal: Submit profile completion
  const submitProfileSetup = async () => {
    const cleanName = capitalizeWords(name.trim());
    if (!cleanName) {
      return setModalError('Please enter your name.');
    }
    if (cleanName.length < 2 || cleanName.length > 60 || !/^[a-zA-Z\s]+$/.test(cleanName)) {
      return setModalError('Name must be 2–60 characters and contain letters and spaces only.');
    }

    if (!role) {
      return setModalError('Please select what best describes you.');
    }

    setModalError('');
    setBusy(true);

    try {
      const profilePayload = {
        name: cleanName,
        role,
        location,
        preferredLanguage,
      };

      const updated = await updateMe(profilePayload);
      const finalUser = updated?.user || {
        ...verifiedUser,
        ...profilePayload,
      };
      setVerifiedUser(finalUser);

      // Also switch active UI language if changed
      if (preferredLanguage) {
        i18n.changeLanguage(preferredLanguage);
      }

      const formattedSec = getFormattedSecondary();
      if (formattedSec) {
        // Chain secondary contact OTP into the same modal popup before closing
        try {
          await requestLinkOtp(formattedSec);
          setCooldown(30);
          setModalStep('secondary_otp');
        } catch (linkErr) {
          console.warn('Could not request link OTP immediately:', linkErr);
          finishSetupAndProceed(finalUser);
        }
      } else {
        // No secondary contact -> close popup and proceed to dashboard
        finishSetupAndProceed(finalUser);
      }
    } catch (err) {
      setModalError(err?.message || 'Failed to complete profile setup. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Phase C Modal: Resend Secondary Link OTP
  const resendSecondaryOtp = async () => {
    if (cooldown > 0 || busy) return;
    setModalError('');
    setBusy(true);
    try {
      await requestLinkOtp(getFormattedSecondary());
      setCooldown(30);
    } catch (err) {
      setModalError(err?.message || 'Could not resend the code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Phase C Modal: Verify Secondary Link OTP
  const verifySecondary = async () => {
    if (!/^\d{6}$/.test(secondaryOtp)) {
      return setModalError('Please enter the 6-digit verification code.');
    }
    setModalError('');
    setBusy(true);
    try {
      const res = await verifyLinkOtp(getFormattedSecondary(), secondaryOtp);
      const linkedUser = res?.user || verifiedUser;
      finishSetupAndProceed(linkedUser);
    } catch (err) {
      setModalError(err?.message || 'Could not verify secondary contact code.');
    } finally {
      setBusy(false);
    }
  };

  // Phase C Modal: Skip secondary contact verification
  const skipSecondary = () => {
    finishSetupAndProceed(verifiedUser);
  };

  const tabStyle = (active) => ({
    background: active ? 'var(--navy)' : 'transparent',
    color: active ? '#fff' : 'var(--sub)',
  });

  const cityOptions = CITIES.includes(location) ? CITIES : [location, ...CITIES];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative">
      <div className="w-full max-w-md lg:max-w-lg card overflow-hidden">
        <div style={{ background: 'var(--navy)' }} className="px-6 py-6 text-white text-center">
          <div
            className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: 'var(--saffron)' }}
          >
            ⛅
          </div>
          <p className="text-[12px] tracking-wide opacity-80 mt-3">
            {t('ministry_title')}
          </p>
          <h1 className="text-2xl lg:text-3xl font-bold mt-1">{t('app_title')}</h1>
          <p className="text-[13px] opacity-70 mt-1">{t('app_tagline')}</p>
        </div>

        {/* Phase A: Contact Screen */}
        {step === 1 && (
          <div className="p-5 sm:p-8 space-y-4 sm:space-y-5">
            <div
              className="grid grid-cols-2 rounded-xl overflow-hidden border"
              style={{ borderColor: 'var(--line)' }}
            >
              <button
                type="button"
                onClick={() => {
                  setTab('phone');
                  setSecondaryContact('');
                  setError('');
                }}
                className="tap py-2 text-base font-medium"
                style={tabStyle(tab === 'phone')}
              >
                {t('phone_tab')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('email');
                  setSecondaryContact('');
                  setError('');
                }}
                className="tap py-2 text-base font-medium"
                style={tabStyle(tab === 'email')}
              >
                {t('email_tab')}
              </button>
            </div>

            {tab === 'phone' ? (
              <>
                <div>
                  <label htmlFor="phone" className="text-base font-medium">
                    {t('mobile_number')}
                  </label>
                  <div
                    className="flex mt-1 rounded-xl overflow-hidden border"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    <span className="px-3 flex items-center text-base" style={{ color: 'var(--sub)' }}>
                      +91
                    </span>
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                        if (error) setError('');
                      }}
                      placeholder="9876543210"
                      maxLength={10}
                      className="tap flex-1 px-2 py-2 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="secEmail" className="text-sm font-medium" style={{ color: 'var(--sub)' }}>
                    {t('also_add_email')}{' '}
                    <span className="text-xs opacity-75">({t('optional')})</span>
                  </label>
                  <input
                    id="secEmail"
                    type="email"
                    value={secondaryContact}
                    onChange={(e) => {
                      setSecondaryContact(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="backup@example.com"
                    className="tap w-full mt-1 rounded-xl px-3 py-2 outline-none border"
                    style={{ borderColor: 'var(--line)' }}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="email" className="text-base font-medium">
                    {t('email_tab')}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="you@example.com"
                    className="tap w-full mt-1 rounded-xl px-3 py-2 outline-none border"
                    style={{ borderColor: 'var(--line)' }}
                  />
                </div>

                <div>
                  <label htmlFor="secPhone" className="text-sm font-medium" style={{ color: 'var(--sub)' }}>
                    {t('also_add_phone')}{' '}
                    <span className="text-xs opacity-75">({t('optional')})</span>
                  </label>
                  <div
                    className="flex mt-1 rounded-xl overflow-hidden border"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    <span className="px-3 flex items-center text-base" style={{ color: 'var(--sub)' }}>
                      +91
                    </span>
                    <input
                      id="secPhone"
                      type="tel"
                      value={secondaryContact}
                      onChange={(e) => {
                        setSecondaryContact(e.target.value.replace(/\D/g, '').slice(0, 10));
                        if (error) setError('');
                      }}
                      placeholder="9876543210"
                      maxLength={10}
                      className="tap flex-1 px-2 py-2 outline-none"
                    />
                  </div>
                </div>
              </>
            )}

            {error && (
              <p className="text-[13px]" style={{ color: 'var(--danger)' }}>
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={goToOtp}
              disabled={busy}
              className="tap w-full rounded-xl text-white font-semibold disabled:opacity-60 py-3"
              style={{ background: 'var(--navy)' }}
            >
              {busy ? t('please_wait') : t('btn_continue')}
            </button>
            <p className="text-[12px] text-center" style={{ color: 'var(--sub)' }}>
              {t('official_service')}
            </p>
          </div>
        )}

        {/* Phase B: Primary OTP Screen */}
        {step === 2 && (
          <div className="p-5 sm:p-8 space-y-4 sm:space-y-5">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setOtp('');
                setError('');
              }}
              className="text-base font-medium"
              style={{ color: 'var(--navy)' }}
            >
              ← {t('btn_back')}
            </button>
            <p className="text-base" style={{ color: 'var(--sub)' }}>
              {t('enter_code_sent_to')}{' '}
              <span className="font-medium" style={{ color: 'var(--ink)' }}>
                {getDisplayContact()}
              </span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                if (error) setError('');
              }}
              placeholder="••••••"
              aria-label="OTP"
              className="tap w-full rounded-xl px-3 py-2 text-center text-xl tracking-[0.5em] outline-none border"
              style={{ borderColor: 'var(--line)' }}
            />
            {error && (
              <p className="text-[13px]" style={{ color: 'var(--danger)' }}>
                {error}
              </p>
            )}

            <div className="flex items-center justify-between text-sm pt-1">
              <span style={{ color: 'var(--sub)' }}>{t('didnt_receive_code')}</span>
              <button
                type="button"
                onClick={resendOtp}
                disabled={cooldown > 0 || busy}
                className="font-medium underline disabled:no-underline disabled:opacity-50"
                style={{ color: 'var(--navy)' }}
              >
                {cooldown > 0 ? `${t('resend_in')} ${cooldown}s` : t('resend_code')}
              </button>
            </div>

            <button
              type="button"
              onClick={verify}
              disabled={busy}
              className="tap w-full rounded-xl text-white font-semibold disabled:opacity-60 py-3"
              style={{ background: 'var(--navy)' }}
            >
              {busy ? t('please_wait') : t('btn_verify_continue')}
            </button>
            <p className="text-[12px] text-center" style={{ color: 'var(--sub)' }}>
              {t('official_service')}
            </p>
          </div>
        )}
      </div>

      {/* Phase C: Modal / Popup Overlay for New User Setup */}
      {showProfileModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <div
            className="w-full max-w-md bg-[var(--card)] rounded-2xl shadow-2xl border border-[var(--line)] overflow-hidden max-h-[90vh] overflow-y-auto p-6 space-y-4"
            style={{ background: 'var(--card)' }}
          >
            {modalStep === 'profile' ? (
              <>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--ink)' }}>
                    {t('complete_your_profile')}
                  </h2>
                  <p className="text-[13px] opacity-75 mt-0.5" style={{ color: 'var(--sub)' }}>
                    {t('welcome_complete_profile')}
                  </p>
                </div>

                <div>
                  <label htmlFor="modal-name" className="text-base font-medium">
                    {t('your_name')} <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    id="modal-name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(capitalizeWords(e.target.value));
                      if (modalError) setModalError('');
                    }}
                    placeholder="e.g. Rahul Sharma"
                    maxLength={60}
                    className="tap w-full mt-1 rounded-xl px-3 py-2 outline-none border"
                    style={{ borderColor: 'var(--line)' }}
                  />
                </div>

                <div>
                  <label htmlFor="modal-role" className="text-base font-medium">
                    {t('what_best_describes_you')} <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <select
                    id="modal-role"
                    value={role}
                    onChange={(e) => {
                      setRole(e.target.value);
                      if (modalError) setModalError('');
                    }}
                    className="tap w-full mt-1 rounded-xl px-3 py-2 outline-none border"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    <option value="">{t('select_role')}</option>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-base font-medium">{t('your_location')}</label>
                  <button
                    type="button"
                    onClick={detectGps}
                    className="tap w-full mt-1 rounded-xl px-3 py-2 flex items-center justify-center gap-2 text-base font-medium"
                    style={{ border: '1px solid var(--line)', color: 'var(--navy)' }}
                  >
                    <CrosshairIcon /> <span>{gpsLabel}</span>
                  </button>
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    aria-label="City"
                    className="tap w-full mt-2 rounded-xl px-3 py-2 outline-none border"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    {cityOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="modal-lang" className="text-base font-medium">
                    {t('preferred_language')}
                  </label>
                  <select
                    id="modal-lang"
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value)}
                    className="tap w-full mt-1 rounded-xl px-3 py-2 outline-none border"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    {LANGUAGE_OPTIONS.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>

                {modalError && (
                  <p className="text-[13px]" style={{ color: 'var(--danger)' }}>
                    {modalError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={submitProfileSetup}
                  disabled={busy}
                  className="tap w-full rounded-xl text-white font-semibold disabled:opacity-60 py-3"
                  style={{ background: 'var(--navy)' }}
                >
                  {busy ? t('saving') : t('btn_complete_setup')}
                </button>
              </>
            ) : (
              <>
                {/* Secondary OTP step inside the same modal overlay */}
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--ink)' }}>
                    {t('verify_secondary_contact')}
                  </h2>
                  <p className="text-base mt-1" style={{ color: 'var(--sub)' }}>
                    {t('enter_code_sent_to')}{' '}
                    <span className="font-medium" style={{ color: 'var(--ink)' }}>
                      {getDisplaySecondary()}
                    </span>
                  </p>
                </div>

                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={secondaryOtp}
                  onChange={(e) => {
                    setSecondaryOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                    if (modalError) setModalError('');
                  }}
                  placeholder="••••••"
                  aria-label="Secondary OTP"
                  className="tap w-full rounded-xl px-3 py-2 text-center text-xl tracking-[0.5em] outline-none border"
                  style={{ borderColor: 'var(--line)' }}
                />

                {modalError && (
                  <p className="text-[13px]" style={{ color: 'var(--danger)' }}>
                    {modalError}
                  </p>
                )}

                <div className="flex items-center justify-between text-sm pt-1">
                  <span style={{ color: 'var(--sub)' }}>{t('didnt_receive_code')}</span>
                  <button
                    type="button"
                    onClick={resendSecondaryOtp}
                    disabled={cooldown > 0 || busy}
                    className="font-medium underline disabled:no-underline disabled:opacity-50"
                    style={{ color: 'var(--navy)' }}
                  >
                    {cooldown > 0 ? `${t('resend_in')} ${cooldown}s` : t('resend_code')}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={verifySecondary}
                  disabled={busy}
                  className="tap w-full rounded-xl text-white font-semibold disabled:opacity-60 py-3"
                  style={{ background: 'var(--navy)' }}
                >
                  {busy ? t('verifying') : t('btn_verify_finish')}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={skipSecondary}
                    className="text-sm font-medium underline transition-opacity hover:opacity-80"
                    style={{ color: 'var(--sub)' }}
                  >
                    {t('ill_do_this_later')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
