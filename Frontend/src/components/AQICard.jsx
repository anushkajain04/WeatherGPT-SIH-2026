const SEGMENTS = ['#1D8A4C', '#E7C331', 'var(--saffron)', 'var(--danger)'];

export default function AQICard({ aqi }) {
  return (
    <div className="px-4 lg:px-8 pb-5 lg:pb-7 pt-4" style={{ borderTop: '1px solid var(--line)' }}>
      <div className="flex items-center justify-between">
        <p className="text-[14px] lg:text-[16px] font-semibold">Air quality index</p>
        <span className="text-[12px] lg:text-base px-2 lg:px-3 py-0.5 lg:py-1 rounded-full font-semibold" style={{ background: '#FDF0DA', color: 'var(--warn)' }}>{aqi.label}</span>
      </div>
      <div className="lg:flex lg:items-center lg:gap-8 mt-2">
        <div className="flex items-baseline gap-2 lg:shrink-0">
          <span className="text-4xl font-bold">{aqi.value}</span>
          <span className="text-[13px] lg:text-base" style={{ color: 'var(--sub)' }}>out of 500</span>
        </div>
        <div className="flex-1 mt-3 lg:mt-0">
          <div className="h-2.5 lg:h-3 rounded-full overflow-hidden flex">
            {SEGMENTS.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}
          </div>
          <div className="flex justify-between text-[11px] lg:text-[13px] mt-1" style={{ color: 'var(--sub)' }}>
            <span>Good</span><span>Moderate</span><span>Poor</span><span>Severe</span>
          </div>
        </div>
      </div>
      <p className="text-[14px] lg:text-[16px] mt-3" style={{ color: 'var(--sub)' }}>PM2.5: {aqi.pm25} µg/m³ · PM10: {aqi.pm10} µg/m³. {aqi.note}</p>
    </div>
  );
}
