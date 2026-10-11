import { useTranslation } from 'react-i18next';
import Header from './Header';
import HeroWeatherCard from './HeroWeatherCard';
import ForecastStrip from './ForecastStrip';
import AQICard from './AQICard';
import AdvisoryCard from './AdvisoryCard';
import HelplineCard from './HelplineCard';

function getDisplayName(user) {
  if (!user) return 'Friend';
  if (user.name && user.name.trim()) return user.name.trim();
  const contact = (user.contact || user.phone || user.email || '').trim();
  if (contact.includes('@')) {
    const prefix = contact.split('@')[0];
    if (prefix) return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  const digits = contact.replace(/\D/g, '');
  if (digits.length >= 4) return `User (${digits.slice(-4)})`;
  return contact || 'Friend';
}

export default function Dashboard({
  user,
  location,
  data,
  alerts = [],
  error,
  theme,
  onToggleTheme,
  onLanguageChange,
  onRetry,
  onOpenAlert,
  onOpenProfile,
  onOpenLocation,
  onOpenChat,
}) {
  const { t } = useTranslation();
  const activeLocation = location || user?.location || 'Pune, Maharashtra';

  return (
    <div className="zoom-main min-h-screen pb-36 lg:pb-44">
      <Header
        user={user}
        location={activeLocation}
        hasAlert={alerts.length > 0}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onLanguageChange={onLanguageChange}
        onAlert={onOpenAlert}
        onProfile={onOpenProfile}
        onLocation={onOpenLocation}
      />
      <main className="px-4 lg:px-6 pt-3 max-w-6xl mx-auto space-y-4">
        {/* Welcome greeting banner */}
        <div className="pt-1 pb-0.5">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
            {t('greeting_namaste')}, {getDisplayName(user)}
          </h2>
          <p className="text-sm sm:text-base opacity-75 mt-0.5" style={{ color: 'var(--sub)' }}>
            {t('overview_advisory_for')} <span className="font-medium">{activeLocation}</span>
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="card px-4 py-3 flex items-center justify-between gap-3 text-[14px]"
            style={{ borderColor: 'var(--saffron)' }}
          >
            <span>⚠️ {typeof error === 'object' ? error.message : error}</span>
            <div className="flex items-center gap-2 shrink-0">
              {error?.type === 'not_found' ? (
                <button
                  type="button"
                  onClick={onOpenLocation}
                  className="font-semibold underline shrink-0 cursor-pointer"
                >
                  {t('change_location')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onRetry}
                  className="font-semibold underline shrink-0 cursor-pointer"
                >
                  {t('btn_retry')}
                </button>
              )}
            </div>
          </div>
        )}

        {!data ? (
          <div className="card p-8 text-center space-y-4">
            <p className="text-base" style={{ color: 'var(--sub)' }}>
              {error?.message || t('error_weather_unavailable', { location: activeLocation })}
            </p>
            <div className="flex items-center justify-center gap-3">
              {error?.type === 'not_found' ? (
                <button
                  type="button"
                  onClick={onOpenLocation}
                  className="tap px-4 py-2 rounded-xl text-white font-medium"
                  style={{ background: 'var(--navy)' }}
                >
                  {t('change_location')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onRetry}
                  className="tap px-4 py-2 rounded-xl text-white font-medium"
                  style={{ background: 'var(--navy)' }}
                >
                  {t('btn_retry')}
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Google-style card: current + hourly + 5-day + AQI */}
            <div className="card overflow-hidden">
              <HeroWeatherCard weather={data.weather} />
              <ForecastStrip title={t('next_few_hours')} items={data.hourly} variant="hourly" />
              <ForecastStrip title={t('next_5_days')} items={data.daily} variant="daily" />
              <AQICard aqi={data.aqi} />
            </div>

            <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
              <AdvisoryCard advisory={data.advisory} />
              <HelplineCard onReport={onOpenChat} />
            </div>
          </>
        )}

        {/* Footer attribution */}
        <footer className="text-center pt-2 pb-6 text-xs opacity-75 space-x-2" style={{ color: 'var(--sub)' }}>
          <a
            href="https://openweathermap.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline opacity-80 hover:opacity-100"
          >
            Weather data by OpenWeather
          </a>
          <span>·</span>
          <a
            href="https://open-meteo.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline opacity-80 hover:opacity-100"
          >
            Place search by Open-Meteo.com
          </a>
        </footer>
      </main>
    </div>
  );
}
