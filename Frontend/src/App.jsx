import { useEffect, useRef, useState } from 'react';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import ChatbotBar from './components/ChatbotBar';
import ChatWindow from './components/ChatWindow';
import AlertModal from './components/AlertModal';
import LocationModal from './components/LocationModal';
import ProfileModal from './components/ProfileModal';
import { INITIAL_CHAT, WEATHER, HOURLY, DAILY, AQI, ROLES } from './data/mockData';
import { fetchDashboard, sendChat, logoutSession } from './api';
import { setUnauthorizedHandler } from './api/client';

export default function App() {
  const [user, setUser] = useState(null);             // { contact, role, language, location }
  const [data, setData] = useState({ weather: WEATHER, hourly: HOURLY, daily: DAILY, aqi: AQI, advisory: ROLES.citizen });
  const [alerts, setAlerts] = useState([]);            // alerts[] from the backend
  const popupPending = useRef(false);                 // show the alert popup once right after login
  const [chatMessages, setChatMessages] = useState(INITIAL_CHAT);
  const [isListening, setIsListening] = useState(false);
  const [dashError, setDashError] = useState('');      // shown as a banner if the dashboard can't load
  const [reloadKey, setReloadKey] = useState(0);        // bump to retry the dashboard fetch
  const [modal, setModal] = useState(null);            // 'alert' | 'profile' | 'location' | 'chat' | null

  // mic "listening…" animation is cosmetic — auto-stops after 2.2s
  useEffect(() => {
    if (!isListening) return;
    const t = setTimeout(() => setIsListening(false), 2200);
    return () => clearTimeout(t);
  }, [isListening]);

  // (re)load dashboard data whenever the user, their location or their role changes
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setDashError('');
    fetchDashboard({ location: user.location, role: user.role })
      .then(({ alerts: a, ...rest }) => {
        if (cancelled) return;
        setData(rest);
        setAlerts(a || []);
        if (popupPending.current && a?.length) setModal('alert');
        popupPending.current = false;
      })
      .catch((err) => {
        if (cancelled || err?.status === 401) return; // 401 is handled by the logout handler
        setDashError(err?.message || 'Could not load weather data.');
      });
    return () => { cancelled = true; };
  }, [user?.location, user?.role, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // any 401 from the backend (expired session) sends the user back to the login page
  useEffect(() => { setUnauthorizedHandler(() => { setUser(null); setModal(null); }); }, []);

  const login = (u) => { popupPending.current = true; setUser(u); };
  const logout = () => { logoutSession(); setDashError(''); setUser(null); setModal(null); setIsListening(false); };
  const close = () => { setModal(null); setIsListening(false); };
  const sendMessage = async (text) => {
    const add = (msg) => setChatMessages((m) => [...m, { id: Date.now() + Math.random(), ...msg }]);
    add({ type: 'user', text });
    try {
      const res = await sendChat({ message: text, language: user.language, location: user.location, role: user.role });
      if (res?.reply) add({ type: res.type || 'assistant', text: res.reply });
    } catch (err) {
      if (err?.status === 401) return;
      add({ type: 'assistant', text: 'Sorry, something went wrong. Please try again.' });
    }
  };

  if (!user) return <LoginPage onLogin={login} />;

  return (
    <>
      <Dashboard
        user={user}
        data={data}
        alerts={alerts}
        error={dashError}
        onRetry={() => setReloadKey((k) => k + 1)}
        onOpenAlert={() => setModal('alert')}
        onOpenProfile={() => setModal('profile')}
        onOpenLocation={() => setModal('location')}
        onOpenChat={() => setModal('chat')}
      />
      <ChatbotBar onOpen={() => setModal('chat')} />

      {modal === 'alert' && <AlertModal alert={alerts[0]} advisory={data.advisory} role={user.role} onClose={close} />}
      {modal === 'location' && (
        <LocationModal current={user.location} onClose={close} onApply={(location) => { setUser({ ...user, location }); close(); }} />
      )}
      {modal === 'profile' && (
        <ProfileModal
          user={user}
          onClose={close}
          onSave={({ role, language }) => { setUser({ ...user, role, language }); close(); }}
          onChangeLocation={() => setModal('location')}
          onLogout={logout}
        />
      )}
      {modal === 'chat' && (
        <ChatWindow
          messages={chatMessages}
          isListening={isListening}
          onSend={sendMessage}
          onToggleMic={() => setIsListening((v) => !v)}
          onClose={close}
        />
      )}
    </>
  );
}
