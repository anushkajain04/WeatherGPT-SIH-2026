import { useState } from 'react';
import { CITIES, ROLE_OPTIONS } from '../data/mockData';
import { CrosshairIcon } from './Icons';
import { requestOtp, verifyOtp } from '../api';

export default function LoginPage({ onLogin }) {
  const [step, setStep] = useState(1);
  const [tab, setTab] = useState('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [location, setLocation] = useState(CITIES[0]);
  const [gpsLabel, setGpsLabel] = useState('Detect my location');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const contact = tab === 'phone' ? `+91 ${phone || '98765 43210'}` : email || 'you@example.com';

  const detectGps = () => {
    setGpsLabel('Detecting…');
    const reset = () => setGpsLabel('Detect my location');
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(() => setGpsLabel('Location detected ✓'), reset);
      } else setTimeout(reset, 600);
    } catch { reset(); }
  };

  const goToOtp = async () => {
    if (!role) return setError('Please select what best describes you.');
    setError(''); setBusy(true);
    try { await requestOtp(contact); setStep(2); }
    catch { setError('Could not send the code. Please try again.'); }
    finally { setBusy(false); }
  };

  const verify = async () => {
    setError(''); setBusy(true);
    try {
      const res = await verifyOtp(contact, otp);
      if (res.ok) onLogin({ contact, role, location, language: 'English' });
      else setError('Incorrect code. Please try again.');
    } catch { setError('Could not verify the code. Please try again.'); }
    finally { setBusy(false); }
  };

  const tabStyle = (active) => ({ background: active ? 'var(--navy)' : 'transparent', color: active ? '#fff' : 'var(--sub)' });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md lg:max-w-lg card overflow-hidden">
        <div style={{ background: 'var(--navy)' }} className="px-6 py-6 text-white text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'var(--saffron)' }}>⛅</div>
          <p className="text-[12px] tracking-wide opacity-80 mt-3">GOVERNMENT OF INDIA · MINISTRY OF EARTH SCIENCES</p>
          <h1 className="text-2xl lg:text-3xl font-bold mt-1">WeatherGPT</h1>
          <p className="text-[13px] opacity-70 mt-1">Weather &amp; disaster alerts, in your language</p>
        </div>

        {step === 1 ? (
          <div className="p-5 sm:p-8 space-y-4 sm:space-y-5">
            <div className="grid grid-cols-2 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--line)' }}>
              <button onClick={() => setTab('phone')} className="tap py-2 text-base font-medium" style={tabStyle(tab === 'phone')}>Phone number</button>
              <button onClick={() => setTab('email')} className="tap py-2 text-base font-medium" style={tabStyle(tab === 'email')}>Email address</button>
            </div>

            {tab === 'phone' ? (
              <div>
                <label htmlFor="phone" className="text-base font-medium">Mobile number</label>
                <div className="flex mt-1 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--line)' }}>
                  <span className="px-3 flex items-center text-base" style={{ color: 'var(--sub)' }}>+91</span>
                  <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" maxLength={10} className="tap flex-1 px-2 py-2 outline-none" />
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="email" className="text-base font-medium">Email address</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="tap w-full mt-1 rounded-xl px-3 py-2 outline-none" />
              </div>
            )}

            <div>
              <label htmlFor="role" className="text-base font-medium">What best describes you? <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select id="role" value={role} onChange={(e) => setRole(e.target.value)} className="tap w-full mt-1 rounded-xl px-3 py-2 outline-none">
                <option value="">Select your role</option>
                {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              {error && <p className="text-[13px] mt-1" style={{ color: 'var(--danger)' }}>{error}</p>}
            </div>

            <div>
              <label className="text-base font-medium">Your location</label>
              <button onClick={detectGps} className="tap w-full mt-1 rounded-xl px-3 py-2 flex items-center justify-center gap-2 text-base font-medium" style={{ border: '1px solid var(--line)', color: 'var(--navy)' }}>
                <CrosshairIcon /> <span>{gpsLabel}</span>
              </button>
              <select value={location} onChange={(e) => setLocation(e.target.value)} aria-label="City" className="tap w-full mt-2 rounded-xl px-3 py-2 outline-none">
                {CITIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>

            <button onClick={goToOtp} disabled={busy} className="tap w-full rounded-xl text-white font-semibold disabled:opacity-60" style={{ background: 'var(--navy)' }}>{busy ? 'Please wait…' : 'Continue'}</button>
            <p className="text-[12px] text-center" style={{ color: 'var(--sub)' }}>Official service of the Ministry of Earth Sciences</p>
          </div>
        ) : (
          <div className="p-5 sm:p-8 space-y-4 sm:space-y-5">
            <button onClick={() => setStep(1)} className="text-base font-medium" style={{ color: 'var(--navy)' }}>← Back</button>
            <p className="text-base" style={{ color: 'var(--sub)' }}>Enter the 6-digit code sent to <span className="font-medium" style={{ color: 'var(--ink)' }}>{contact}</span></p>
            <input type="text" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="••••••" aria-label="OTP" className="tap w-full rounded-xl px-3 py-2 text-center text-xl tracking-[0.5em] outline-none" />
            {error && <p className="text-[13px]" style={{ color: 'var(--danger)' }}>{error}</p>}
            <button onClick={verify} disabled={busy} className="tap w-full rounded-xl text-white font-semibold disabled:opacity-60" style={{ background: 'var(--navy)' }}>{busy ? 'Please wait…' : 'Verify & continue'}</button>
            <p className="text-[13px] text-center" style={{ color: 'var(--sub)' }}>This is a prototype — any 6 digits will work</p>
          </div>
        )}
      </div>
    </div>
  );
}
