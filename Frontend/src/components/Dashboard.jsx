import Header from './Header';
import HeroWeatherCard from './HeroWeatherCard';
import ForecastStrip from './ForecastStrip';
import AQICard from './AQICard';
import AdvisoryCard from './AdvisoryCard';
import HelplineCard from './HelplineCard';

export default function Dashboard({ user, data, alerts, error, onRetry, onOpenAlert, onOpenProfile, onOpenLocation, onOpenChat }) {
  return (
    <div className="zoom-main min-h-screen pb-36 lg:pb-44">
      <Header
        location={user.location}
        hasAlert={alerts.length > 0}
        onAlert={onOpenAlert}
        onProfile={onOpenProfile}
        onLocation={onOpenLocation}
      />
      <main className="px-4 lg:px-6 pt-4 max-w-6xl mx-auto space-y-4">
        {error && (
          <div role="alert" className="card px-4 py-3 flex items-center justify-between gap-3 text-[14px]" style={{ borderColor: 'var(--saffron)' }}>
            <span>⚠️ {error} Showing the last loaded data.</span>
            <button onClick={onRetry} className="font-semibold underline shrink-0">Retry</button>
          </div>
        )}
        {/* one Google-style card: current + hourly + 5-day + AQI */}
        <div className="card overflow-hidden">
          <HeroWeatherCard weather={data.weather} />
          <ForecastStrip title="Next few hours" items={data.hourly} variant="hourly" />
          <ForecastStrip title="Next 5 days" items={data.daily} variant="daily" />
          <AQICard aqi={data.aqi} />
        </div>

        <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
          <AdvisoryCard advisory={data.advisory} />
          <HelplineCard onReport={onOpenChat} />
        </div>
      </main>
    </div>
  );
}
