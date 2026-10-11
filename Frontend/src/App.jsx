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
import i18n from './i18n';

const LOCATION_STORAGE_KEY = 'wgpt_active_location';

function getStoredLocation(user) {
  try {
    const raw = sessionStorage.getItem(LOCATION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.label === 'string') {
        return {
          label: parsed.label,
          lat: parsed.lat != null ? Number(Number(parsed.lat).toFixed(2)) : null,
          lon: parsed.lon != null ? Number(Number(parsed.lon).toFixed(2)) : null,
        };
      }
    }
  } catch {}
  return {
    label: user?.location || 'Pune, Maharashtra',
    lat: null,
    lon: null,
  };
}

function WeatherApp() {
  const { user, login, logout, updateUser } = useAuth();
  const [data, setData] = useState(null);
  const [activeLocation, setActiveLocation] = useState(() => getStoredLocation(user));
  const [displayedLocation, setDisplayedLocation] = useState(() => getStoredLocation(user).label);
  const [alerts, setAlerts] = useState([]); // alerts[] from the backend
  const popupPending = useRef(false); // show the alert popup once right after login
  const [chatMessages, setChatMessages] = useState([
    { id: 'welcome', type: 'assistant', textKey: 'chat_welcome_message' },
  ]);
  const [isChatPending, setIsChatPending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [dashError, setDashError] = useState(null); // { message, type: 'not_found' | 'unavailable' | 'mismatch' }
  const [reloadKey, setReloadKey] = useState(0); // bump to retry the dashboard fetch
  const [modal, setModal] = useState(null); // 'alert' | 'profile' | 'location' | 'chat' | null

  // Dark/Light Theme state with localStorage persistence & OS preference default
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('wgpt_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('wgpt_theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  // Sync activeLocation with user.location if user profile changed to a different label
  useEffect(() => {
    if (user?.location && user.location !== activeLocation.label && activeLocation.lat == null) {
      const nextLoc = { label: user.location, lat: null, lon: null };
      setActiveLocation(nextLoc);
      try {
        sessionStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(nextLoc));
      } catch {}
    }
  }, [user?.location]);

  // mic "listening…" animation is cosmetic — auto-stops after 2.2s
  useEffect(() => {
    if (!isListening) return;
    const t = setTimeout(() => setIsListening(false), 2200);
    return () => clearTimeout(t);
  }, [isListening]);

  // (re)load dashboard data whenever activeLocation, user.role or reloadKey changes
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setDashError(null);

    const reqLabel = activeLocation.label;
    const reqLat = activeLocation.lat;
    const reqLon = activeLocation.lon;

    fetchDashboard({
      location: reqLabel,
      role: user.role,
      lat: reqLat,
      lon: reqLon,
    })
      .then(({ alerts: a, ...rest }) => {
        if (cancelled) return;
        // Success: update both displayedLocation and data together
        setDisplayedLocation(reqLabel);
        setData(rest);
        setAlerts(a || []);
        setDashError(null);
        if (popupPending.current && a?.length) setModal('alert');
        popupPending.current = false;
      })
      .catch((err) => {
        if (cancelled || err?.status === 401) return;
        console.error('Raw dashboard error:', err);

        const isNotFound = err?.status === 404;
        const requestedLoc = reqLabel;
        const currentDisplayed = displayedLocation;

        if (data && requestedLoc !== currentDisplayed) {
          // Mismatch: keep previous location and its data on screen; show warning
          setDashError({
            type: isNotFound ? 'not_found' : 'mismatch',
            message: i18n.t('error_location_mismatch', {
              newLocation: requestedLoc,
              previousLocation: currentDisplayed,
              defaultValue: `Couldn’t load weather for ${requestedLoc}. Still showing ${currentDisplayed}.`,
            }),
          });
        } else if (isNotFound) {
          // 404 (location not found): show friendly prompt to change location without retry
          setDashError({
            type: 'not_found',
            message: i18n.t('error_location_not_found', {
              defaultValue: 'We couldn’t find weather for this place. Please choose a nearby city.',
            }),
          });
        } else {
          // 5xx / network error: show temporary unavailable with retry
          setDashError({
            type: 'unavailable',
            message: i18n.t('error_weather_unavailable', {
              location: requestedLoc,
              defaultValue: `Live weather data is temporarily unavailable — showing the last known forecast for ${requestedLoc}.`,
            }),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeLocation.label, activeLocation.lat, activeLocation.lon, user?.role, reloadKey]);

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
    if (!text || isChatPending) return;
    const add = (msg) => setChatMessages((m) => [...m, { id: Date.now() + Math.random(), ...msg }]);
    add({ type: 'user', text });
    setIsChatPending(true);

    try {
      const activeLocStr = typeof activeLocation === 'object' && activeLocation !== null
        ? activeLocation.label
        : activeLocation;
      const profileLocStr = user?.location || '';
      const chosenLoc = activeLocStr || profileLocStr || '';
      const plainCity = chosenLoc.split(',')[0].split(' · ')[0].replace(/[^a-zA-Z\s-]/g, '').trim() || 'Delhi';
      const role = user?.role || 'normal_user';
      const language = user?.preferredLanguage || 'en';
      const sessionId = user?.id ? `session_${user.id}` : (user?.contact ? `session_${user.contact}` : 'session_default');

      const res = await sendChat({
        query: text,
        role,
        location: activeLocStr,
        fallbackLocation: profileLocStr,
        language,
        sessionId,
        lat: activeLocation?.lat != null ? activeLocation.lat : undefined,
        lon: activeLocation?.lon != null ? activeLocation.lon : undefined,
      });

      if (res?.answer) {
        add({
          type: 'assistant',
          text: res.answer,
          location_resolved: res.location_resolved,
          requestedLocation: plainCity,
          weatherUnavailable: !!res.weatherUnavailable,
          retryText: text,
        });
      } else if (res?.reply) {
        add({
          type: res.type || 'assistant',
          text: res.reply,
          location_resolved: res.location_resolved,
          requestedLocation: plainCity,
          weatherUnavailable: !!res.weatherUnavailable,
          retryText: text,
        });
      } else {
        // Fallback: never hang silently without a bubble
        add({
          type: 'assistant',
          text: 'No response received from the weather service. Please try again.',
          isError: true,
          retryText: text,
        });
      }
    } catch (err) {
      console.error('Chat error:', err);
      if (err?.data) {
        console.error('Chat error response body:', JSON.stringify(err.data));
      }
      if (err?.status === 401) {
        handleLogout();
        return;
      }

      const activeLocStr = typeof activeLocation === 'object' && activeLocation !== null
        ? activeLocation.label
        : activeLocation;
      const targetCity = (activeLocStr || user?.location || 'this place')
        .split(',')[0]
        .split(' · ')[0]
        .replace(/[^a-zA-Z\s-]/g, '')
        .trim() || 'this place';

      let errorText = 'Sorry, something went wrong. Please try again.';
      if (
        (err?.status === 400 || err?.code === 'LOCATION_UNRESOLVABLE') &&
        (err?.message?.toLowerCase().includes('location') ||
          err?.message?.toLowerCase().includes('city') ||
          err?.code?.toLowerCase().includes('location'))
      ) {
        errorText = i18n.t('chat_error_location_unrecognized', {
          city: targetCity,
          defaultValue: `I couldn’t recognise ${targetCity}. Please choose a nearby larger city from the location menu.`,
        });
      } else if (err?.status === 504 || err?.code === 'TIMEOUT') {
        errorText = 'The weather assistant is waking up, please try again in a minute';
      } else if (err?.status === 503) {
        errorText = 'Our AI systems are busy, try again shortly';
      } else if (err?.name === 'ApiError' && err?.status && err.status !== 502 && typeof err?.message === 'string') {
        errorText = err.message;
      }
      add({ type: 'assistant', text: errorText, isError: true, retryText: text });
    } finally {
      setIsChatPending(false);
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

  const handleApplyLocation = async (newLocation) => {
    try {
      const label = typeof newLocation === 'object' && newLocation !== null ? newLocation.label : newLocation;
      const lat = typeof newLocation === 'object' && newLocation !== null ? newLocation.lat : null;
      const lon = typeof newLocation === 'object' && newLocation !== null ? newLocation.lon : null;

      const nextLoc = {
        label,
        lat: lat != null ? Number(Number(lat).toFixed(2)) : null,
        lon: lon != null ? Number(Number(lon).toFixed(2)) : null,
      };

      setActiveLocation(nextLoc);
      try {
        sessionStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(nextLoc));
      } catch {}

      await updateUser({ location: label });
    } catch (err) {
      console.error('Failed to update location:', err);
    }
    close();
  };

  useEffect(() => {
    if (user?.preferredLanguage) {
      i18n.changeLanguage(user.preferredLanguage);
    }
  }, [user?.preferredLanguage]);

  const handleLanguageChange = async (newLang) => {
    try {
      i18n.changeLanguage(newLang);
      await updateUser({ preferredLanguage: newLang });
    } catch (err) {
      console.error('Failed to update language preference:', err);
    }
  };

  return (
    <ProtectedRoute fallback={<LoginPage onLogin={handleLogin} />}>
      {user && (
        <>
          <Dashboard
            user={user}
            location={displayedLocation}
            data={data}
            alerts={alerts}
            error={dashError}
            theme={theme}
            onToggleTheme={toggleTheme}
            onLanguageChange={handleLanguageChange}
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
              advisory={data?.advisory}
              role={user.role}
              onClose={close}
            />
          )}
          {modal === 'location' && (
            <LocationModal
              current={displayedLocation || user.location}
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
              isPending={isChatPending}
              isListening={isListening}
              activeLocation={displayedLocation || user.location}
              onOpenLocation={() => setModal('location')}
              onSend={sendMessage}
              onRetry={sendMessage}
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
