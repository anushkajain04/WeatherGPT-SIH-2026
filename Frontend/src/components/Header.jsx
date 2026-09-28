import { PersonIcon, PinIcon } from './Icons';

export default function Header({ location, hasAlert, onAlert, onProfile, onLocation }) {
  return (
    <div style={{ background: 'var(--navy)', paddingTop: 'calc(env(safe-area-inset-top,0px) + 10px)' }} className="px-4 lg:px-6 pb-3 lg:pb-4 text-white sticky top-0 z-20">
      <div className="max-w-4xl mx-auto grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 lg:gap-x-6 gap-y-3 items-center">
        {/* logo + name */}
        <div className="col-start-1 row-start-1 flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 lg:w-14 lg:h-14 rounded-xl flex items-center justify-center text-xl lg:text-2xl shrink-0" style={{ background: 'var(--saffron)' }}>⛅</div>
          <div className="min-w-0 flex flex-col justify-center">
            <p className="font-bold leading-none text-lg lg:text-2xl">WeatherGPT</p>
            <p className="text-[12px] lg:text-base opacity-75 leading-none mt-1.5 truncate">Ministry of Earth Sciences</p>
          </div>
        </div>

        {/* alert + profile — centred vertically across the header on desktop */}
        <div className="col-start-2 row-start-1 lg:row-span-2 self-center flex items-center gap-2 lg:gap-4">
          {hasAlert && (
            <button onClick={onAlert} className="inline-flex h-11 lg:h-14 min-w-[96px] lg:min-w-[10.5rem] px-3 lg:px-8 rounded-full text-base lg:text-lg font-bold items-center justify-center gap-1.5 lg:gap-2" style={{ background: 'var(--saffron)', color: 'var(--navy-dark)' }}>
              ⚠️ Alert
            </button>
          )}
          <button onClick={onProfile} aria-label="Profile" className="w-11 h-11 lg:w-16 lg:h-16 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,.18)' }}>
            <PersonIcon className="w-6 h-6 lg:w-9 lg:h-9" />
          </button>
        </div>

        {/* location */}
        <button onClick={onLocation} className="col-span-2 lg:col-span-1 lg:col-start-1 lg:row-start-2 justify-self-start max-w-full min-h-[44px] lg:min-h-[48px] flex items-center gap-2 text-base lg:text-lg rounded-xl px-3 lg:px-5" style={{ background: 'rgba(255,255,255,.12)' }}>
          <PinIcon className="shrink-0 lg:w-6 lg:h-6" />
          <span className="font-medium truncate">{location}</span>
          <span className="opacity-70 shrink-0">· change</span>
        </button>
      </div>
    </div>
  );
}
