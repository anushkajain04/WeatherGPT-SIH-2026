// variant="hourly": Google-style columns with dividers. variant="daily": small cards.
export default function ForecastStrip({ title, items, variant = 'hourly' }) {
  return (
    <>
      <div className={`px-4 lg:px-8 ${variant === 'hourly' ? 'pt-4' : 'pt-3'}`}>
        <p className="text-[14px] lg:text-[16px] font-semibold">{title}</p>
      </div>
      <div className={`flex overflow-x-auto scrollbar-none px-4 lg:px-8 ${variant === 'hourly' ? 'py-2' : 'gap-2 lg:gap-3 py-3'}`}>
        {variant === 'hourly'
          ? items.map((h, i) => (
              <div key={h.time} className={`shrink-0 min-w-[72px] flex-1 text-center py-2 ${i > 0 ? 'border-l-2' : ''}`} style={{ borderColor: '#C3CEE2' }}>
                <p className="text-[13px] lg:text-base font-medium" style={{ color: 'var(--sub)' }}>{h.time}</p>
                <p className="text-2xl lg:text-3xl my-1.5">{h.icon}</p>
                <p className="text-base lg:text-lg font-semibold">{h.temp}</p>
              </div>
            ))
          : items.map((d) => (
              <div key={d.day} className="shrink-0 min-w-[80px] flex-1 rounded-xl px-2 py-3 lg:py-6 text-center" style={{ border: d.isToday ? '1.5px solid var(--navy)' : '1px solid var(--line)' }}>
                <p className={`text-[13px] lg:text-base ${d.isToday ? 'font-semibold' : ''}`} style={{ color: d.isToday ? 'var(--ink)' : 'var(--sub)' }}>{d.day}</p>
                <p className="text-2xl lg:text-3xl my-1.5">{d.icon}</p>
                <p className="text-[14px] lg:text-base"><b>{d.high}</b> <span style={{ color: 'var(--sub)' }}>{d.low}</span></p>
              </div>
            ))}
      </div>
    </>
  );
}
