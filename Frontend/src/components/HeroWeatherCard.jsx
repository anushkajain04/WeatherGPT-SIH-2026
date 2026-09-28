const Stat = ({ label, value }) => (
  <div className="rounded-xl px-3 py-2 lg:py-3 lg:px-5 text-center lg:text-left lg:flex lg:items-center lg:justify-between" style={{ background: 'rgba(255,255,255,.1)' }}>
    <p className="text-[12px] lg:text-base opacity-70">{label}</p>
    <p className="font-semibold lg:text-base">{value}</p>
  </div>
);

export default function HeroWeatherCard({ weather }) {
  return (
    <div style={{ background: 'var(--navy)' }} className="text-white px-5 lg:px-8 pt-5 lg:pt-7 pb-5 lg:pb-7">
      <div className="lg:flex lg:items-center lg:justify-between lg:gap-8">
        <div>
          <p className="text-[13px] lg:text-base opacity-70">Today · updated just now</p>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-5xl lg:text-6xl font-bold">{weather.temp}°</span>
            <span className="text-5xl lg:text-6xl">{weather.icon}</span>
          </div>
          <p className="text-base mt-1 opacity-90">{weather.summary}</p>
          <p className="text-[13px] lg:text-base opacity-70 mt-1">Feels like {weather.feelsLike}° · High {weather.high}° · Low {weather.low}°</p>
        </div>
        <div className="grid grid-cols-3 lg:flex lg:flex-col gap-2 lg:gap-3 mt-5 lg:mt-0 lg:w-64">
          <Stat label="Rain" value={`${weather.rain}%`} />
          <Stat label="Humidity" value={`${weather.humidity}%`} />
          <Stat label="Wind" value={`${weather.wind} km/h`} />
        </div>
      </div>
    </div>
  );
}
