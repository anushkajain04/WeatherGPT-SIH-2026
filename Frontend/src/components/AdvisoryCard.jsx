export default function AdvisoryCard({ advisory }) {
  return (
    <div className="card p-4 lg:p-6">
      <div className="flex items-center gap-2 lg:gap-3">
        <div className="w-9 h-9 lg:w-12 lg:h-12 rounded-full flex items-center justify-center text-lg lg:text-xl" style={{ background: advisory.bg }}>{advisory.icon}</div>
        <div>
          <p className="font-semibold text-base">{advisory.title}</p>
          <p className="text-[12px] lg:text-base" style={{ color: 'var(--sub)' }}>Updated 08:00 AM</p>
        </div>
      </div>
      <p className="text-base mt-3 font-medium">{advisory.headline}</p>
      <div className="grid grid-cols-2 gap-2 mt-3">
        {[advisory.stat1, advisory.stat2].map(([label, value], i) => (
          <div key={label} className="rounded-lg px-3 py-2 lg:py-3" style={{ background: 'var(--bg)' }}>
            <p className="text-[12px] lg:text-base" style={{ color: 'var(--sub)' }}>{label}</p>
            <p className="text-base font-semibold" style={i === 1 ? { color: 'var(--danger)' } : undefined}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
