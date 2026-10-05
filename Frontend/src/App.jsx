import { useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import ChatbotBar from './components/ChatbotBar';
import ChatWindow from './components/ChatWindow';
import AlertModal from './components/AlertModal';
import LocationModal from './components/LocationModal';
import ProfileModal from './components/ProfileModal';
import { INITIAL_CHAT, WEATHER, HOURLY, DAILY, AQI, ROLES } from './data/mockData';
import { fetchDashboard, sendChat } from './api';

function WeatherApp() {
  const { user, login, logout, updateUser } = useAuth();
  const [data, setData] = useState({
    weather: WEATHER,
    hourly: HOURLY,
    daily: DAILY,
    aqi: AQI,
    advisory: ROLES.normal_user || ROLES.citizen,
  });
  const [alerts, setAlerts] = useState([]); // alerts[] from the backend
  const popupPending = useRef(false); // show the alert popup once right after login
  const [chatMessages, setChatMessages] = useState(INITIAL_CHAT);
  const [isListening, setIsListening] = useState(false);
  const [dashError, setDashError] = useState(''); // shown as a banner if the dashboard can't load
  const [reloadKey, setReloadKey] = useState(0); // bump to retry the dashboard fetch
  const [modal, setModal] = useState(null); // 'alert' | 'profile' | 'location' | 'chat' | null

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
        if (cancelled || err?.status === 401) return;
        setDashError(err?.message || 'Could not load weather data.');
      });
    return () => {
      cancelled = true;
    };
  }, [user?.location, user?.role, reloadKey]);

  const handleLogin = (u) => {
    popupPending.current = true;
    login(u);
  };

  const handleLogout = async () => {
    setDashError('');
    setModal(null);
    setIsListening(false);
    await logout();
  };

  const close = () => {
    setModal(null);
    setIsListening(false);
  };

  const sendMessage = async (text) => {
    const add = (msg) => setChatMessages((m) => [...m, { id: Date.now() + Math.random(), ...msg }]);
    add({ type: 'user', text });
    try {
      const res = await sendChat({
        message: text,
        language: user?.preferredLanguage || user?.language || 'en',
        location: user?.location,
        role: user?.role,
      });
      if (res?.reply) add({ type: res.type || 'assistant', text: res.reply });
    } catch (err) {
      if (err?.status === 401) return;
      add({ type: 'assistant', text: 'Sorry, something went wrong. Please try again.' });
    }
  };

  const handleSaveProfile = async ({ role, language }) => {
    try {
      await updateUser({ role, preferredLanguage: language });
    } catch {
      // Handled in context
    }
    close();
  };

  const handleApplyLocation = async (location) => {
    try {
      await updateUser({ location });
    } catch {
      // Handled in context
    }
    close();
  };

  return (
    <ProtectedRoute fallback={<LoginPage onLogin={handleLogin} />}>
      {user && (
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

          {modal === 'alert' && (
            <AlertModal
              alert={alerts[0]}
              advisory={data.advisory}
              role={user.role}
              onClose={close}
            />
          )}
          {modal === 'location' && (
            <LocationModal
              current={user.location}
              onClose={close}
              onApply={handleApplyLocation}
            />
          )}
          {modal === 'profile' && (
            <ProfileModal
              user={user}
              onClose={close}
              onSave={handleSaveProfile}
              onChangeLocation={() => setModal('location')}
              onLogout={handleLogout}
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
      )}
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WeatherApp />
    </AuthProvider>
  );
}
