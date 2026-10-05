import { useState, useEffect } from 'react';
import { CITIES, ROLE_OPTIONS } from '../data/mockData';
import { CrosshairIcon } from './Icons';
import { requestOtp, verifyOtp, resolveCity } from '../api';
import { useAuth } from '../context/AuthContext';

export default function LoginPage({ onLogin }) {
  const auth = useAuth();
  const [step, setStep] = useState(1);
  const [tab, setTab] = useState('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [location, setLocation] = useState(CITIES[0]);
  const [gpsLabel, setGpsLabel] = useState('Detect my location');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

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

  // Clean canonical contact (no placeholder fallback)
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

  const detectGps = () => {
    if (!navigator.geolocation) {
      setGpsLabel('Geolocation not supported');
      setTimeout(() => setGpsLabel('Detect my location'), 2500);
      return;
    }
    setGpsLabel('Detecting…');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await resolveCity(latitude, longitude);
          const resolvedName =
            res?.formatted || res?.city || res?.location || res?.name || (typeof res === 'string' ? res : null);
          if (resolvedName) {
            setLocation(resolvedName);
            setGpsLabel('Location detected ✓');
            setTimeout(() => setGpsLabel('Detect my location'), 3000);
          } else {
            // Graceful fallback to city dropdown
            setGpsLabel('Detect my location');
          }
        } catch {
          // Graceful fallback to city dropdown on failure or 404
          setGpsLabel('Detect my location');
        }
      },
      () => {
        // Graceful fallback on permission denied or error
        setGpsLabel('Detect my location');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  };

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

    const cleanName = name.trim();
    if (!cleanName) {
      return setError('Please enter your name.');
    }
    if (cleanName.length < 2 || cleanName.length > 60 || !/^[a-zA-Z\s]+$/.test(cleanName)) {
      return setError('Name must be 2–60 characters and contain letters and spaces only.');
    }

    if (!role) {
      return setError('Please select what best describes you.');
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

  const verify = async () => {
    if (!/^\d{6}$/.test(otp)) {
      return setError('Please enter the 6-digit verification code.');
    }

    setError('');
    setBusy(true);
    try {
      const res = await verifyOtp(getContactToSubmit(), otp, {
        name: name.trim(),
        role,
        location,
        preferredLanguage: 'en', // Backend expects ISO code
      });

      if (res?.success || res?.user || res?.ok) {
        const loggedUser = res.user || {
          contact: getContactToSubmit(),
          name: name.trim(),
          role,
          location,
          preferredLanguage: 'en',
          language: 'en',
        };
        if (auth?.login) auth.login(loggedUser);
        if (onLogin) onLogin(loggedUser);
      } else {
        setError(res?.error?.message || 'Incorrect code. Please try again.');
      }
    } catch (err) {
      setError(err?.message || 'Could not verify the code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const tabStyle = (active) => ({
    background: active ? 'var(--navy)' : 'transparent',
    color: active ? '#fff' : 'var(--sub)',
  });

  const cityOptions = CITIES.includes(location) ? CITIES : [location, ...CITIES];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md lg:max-w-lg card overflow-hidden">
        <div style={{ background: 'var(--navy)' }} className="px-6 py-6 text-white text-center">
          <div
            className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: 'var(--saffron)' }}
          >
            ⛅
          </div>
          <p className="text-[12px] tracking-wide opacity-80 mt-3">
            GOVERNMENT OF INDIA · MINISTRY OF EARTH SCIENCES
          </p>
          <h1 className="text-2xl lg:text-3xl font-bold mt-1">WeatherGPT</h1>
          <p className="text-[13px] opacity-70 mt-1">Weather &amp; disaster alerts, in your language</p>
        </div>

        {step === 1 ? (
          <div className="p-5 sm:p-8 space-y-4 sm:space-y-5">
            <div
              className="grid grid-cols-2 rounded-xl overflow-hidden border"
              style={{ borderColor: 'var(--line)' }}
            >
              <button
                type="button"
                onClick={() => {
                  setTab('phone');
                  setError('');
                }}
                className="tap py-2 text-base font-medium"
                style={tabStyle(tab === 'phone')}
              >
                Phone number
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('email');
                  setError('');
                }}
                className="tap py-2 text-base font-medium"
                style={tabStyle(tab === 'email')}
              >
                Email address
              </button>
            </div>

            {tab === 'phone' ? (
              <div>
                <label htmlFor="phone" className="text-base font-medium">
                  Mobile number
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
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    maxLength={10}
                    className="tap flex-1 px-2 py-2 outline-none"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="email" className="text-base font-medium">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="tap w-full mt-1 rounded-xl px-3 py-2 outline-none"
                />
              </div>
            )}

            <div>
              <label htmlFor="name" className="text-base font-medium">
                Your name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Enter your name"
                maxLength={60}
                className="tap w-full mt-1 rounded-xl px-3 py-2 outline-none"
              />
            </div>

            <div>
              <label htmlFor="role" className="text-base font-medium">
                What best describes you? <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="tap w-full mt-1 rounded-xl px-3 py-2 outline-none"
              >
                <option value="">Select your role</option>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              {error && (
                <p className="text-[13px] mt-1" style={{ color: 'var(--danger)' }}>
                  {error}
                </p>
              )}
            </div>

            <div>
              <label className="text-base font-medium">Your location</label>
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
                className="tap w-full mt-2 rounded-xl px-3 py-2 outline-none"
              >
                {cityOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={goToOtp}
              disabled={busy}
              className="tap w-full rounded-xl text-white font-semibold disabled:opacity-60 py-3"
              style={{ background: 'var(--navy)' }}
            >
              {busy ? 'Please wait…' : 'Continue'}
            </button>
            <p className="text-[12px] text-center" style={{ color: 'var(--sub)' }}>
              Official service of the Ministry of Earth Sciences
            </p>
          </div>
        ) : (
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
              ← Back
            </button>
            <p className="text-base" style={{ color: 'var(--sub)' }}>
              Enter the 6-digit code sent to{' '}
              <span className="font-medium" style={{ color: 'var(--ink)' }}>
                {getDisplayContact()}
              </span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              aria-label="OTP"
              className="tap w-full rounded-xl px-3 py-2 text-center text-xl tracking-[0.5em] outline-none"
            />
            {error && (
              <p className="text-[13px]" style={{ color: 'var(--danger)' }}>
                {error}
              </p>
            )}

            <div className="flex items-center justify-between text-sm pt-1">
              <span style={{ color: 'var(--sub)' }}>Didn't receive code?</span>
              <button
                type="button"
                onClick={resendOtp}
                disabled={cooldown > 0 || busy}
                className="font-medium underline disabled:no-underline disabled:opacity-50"
                style={{ color: 'var(--navy)' }}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>

            <button
              type="button"
              onClick={verify}
              disabled={busy}
              className="tap w-full rounded-xl text-white font-semibold disabled:opacity-60 py-3"
              style={{ background: 'var(--navy)' }}
            >
              {busy ? 'Please wait…' : 'Verify & continue'}
            </button>
            <p className="text-[12px] text-center" style={{ color: 'var(--sub)' }}>
              Official service of the Ministry of Earth Sciences
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
