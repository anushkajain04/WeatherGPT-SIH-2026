import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ModalShell, { CloseButton } from './ModalShell';
import { POPULAR_CITIES } from '../data/mockData';
import { CrosshairIcon } from './Icons';
import { resolveCity, resolveCityByPincode, searchPlaces, updateMe } from '../api';

export default function LocationModal({ current, onApply, onClose }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [pin, setPin] = useState('');
  const [gpsLabel, setGpsLabel] = useState(t('use_current_location'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const debounceTimer = useRef(null);

  // Debounced search on typing >= 3 characters
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setIsSearching(false);
      setHasSearched(false);
      setSelectedIndex(-1);
      return;
    }

    setIsSearching(true);
    setHasSearched(false);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(q);
        setSuggestions(results || []);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
        setHasSearched(true);
        setSelectedIndex(-1);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchQuery]);

  const selectPlace = async (place) => {
    setError('');
    setBusy(true);
    try {
      // Save label to profile
      await updateMe({ location: place.label }).catch(() => {});
      if (onApply) {
        await onApply({
          label: place.label,
          lat: place.lat != null ? Number(place.lat) : null,
          lon: place.lon != null ? Number(place.lon) : null,
        });
      }
    } catch (err) {
      setError(err?.message || 'Failed to apply location.');
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (e) => {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        selectPlace(suggestions[selectedIndex]);
      }
    }
  };

  const detectGps = () => {
    if (!navigator.geolocation) {
      setGpsLabel(t('geo_not_supported', 'Geolocation not supported'));
      setTimeout(() => setGpsLabel(t('use_current_location')), 2500);
      return;
    }
    setGpsLabel(t('detecting'));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await resolveCity(latitude, longitude);
          const resolvedName =
            res?.formatted || res?.city || res?.location || (typeof res === 'string' ? res : null);
          if (resolvedName) {
            setGpsLabel(t('location_detected'));
            await selectPlace({
              label: resolvedName,
              lat: res?.lat != null ? Number(res.lat) : latitude,
              lon: res?.lon != null ? Number(res.lon) : longitude,
            });
          } else {
            setGpsLabel(t('use_current_location'));
          }
        } catch {
          setGpsLabel(t('use_current_location'));
        }
      },
      () => setGpsLabel(t('use_current_location')),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  };

  const handleApplyPin = async () => {
    const cleanPin = pin.trim();
    if (!/^\d{6}$/.test(cleanPin)) {
      return setError(t('enter_valid_pin', 'Please enter a valid 6-digit Indian PIN code.'));
    }

    setError('');
    setBusy(true);
    try {
      const res = await resolveCityByPincode(cleanPin);
      if (res?.formatted || res?.city) {
        const targetLocation = res.formatted || res.city;
        await selectPlace({
          label: targetLocation,
          lat: res?.lat != null ? Number(res.lat) : null,
          lon: res?.lon != null ? Number(res.lon) : null,
        });
      } else {
        setError(t('could_not_resolve_pin', 'Could not resolve location for this PIN code.'));
      }
    } catch (err) {
      setError(err?.message || t('could_not_resolve_pin', 'Could not resolve PIN code.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{t('change_location')}</h3>
        <CloseButton onClick={onClose} />
      </div>

      {/* GPS Button */}
      <button
        type="button"
        onClick={detectGps}
        disabled={busy}
        className="tap w-full mt-4 rounded-xl px-3 py-2 flex items-center justify-center gap-2 text-base font-medium disabled:opacity-60"
        style={{ border: '1px solid var(--line)', color: 'var(--navy)' }}
      >
        <CrosshairIcon /> <span>{gpsLabel}</span>
      </button>

      <div className="flex items-center gap-2 my-3">
        <span className="flex-1 h-px" style={{ background: 'var(--line)' }} />
        <span className="text-[12px] font-semibold" style={{ color: 'var(--sub)' }}>
          {t('or')}
        </span>
        <span className="flex-1 h-px" style={{ background: 'var(--line)' }} />
      </div>

      {/* Search Input */}
      <div className="relative">
        <label htmlFor="place-search" className="text-[13px] font-medium" style={{ color: 'var(--sub)' }}>
          {t('search_place_label', 'Search city, town or village')}
        </label>
        <input
          id="place-search"
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (error) setError('');
          }}
          onKeyDown={handleKeyDown}
          placeholder={t('search_place_placeholder', 'Type at least 3 letters (e.g. Manali, Leh)')}
          className="tap w-full mt-1 rounded-xl px-3 py-2 outline-none text-sm"
          style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}
        />

        {/* Search Results Dropdown */}
        {searchQuery.trim().length >= 3 && (
          <div
            className="mt-1 rounded-xl border shadow-lg max-h-56 overflow-y-auto p-1 text-sm z-10"
            style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
          >
            {isSearching && (
              <p className="px-3 py-2 text-xs opacity-75" style={{ color: 'var(--sub)' }}>
                {t('searching', 'Searching places…')}
              </p>
            )}

            {!isSearching && hasSearched && suggestions.length === 0 && (
              <p className="px-3 py-2 text-xs opacity-75" style={{ color: 'var(--sub)' }}>
                {t('no_places_found', 'No places found')}
              </p>
            )}

            {!isSearching &&
              suggestions.map((p, idx) => (
                <button
                  key={`${p.label}-${p.lat}-${p.lon}`}
                  type="button"
                  onClick={() => selectPlace(p)}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between text-sm transition-colors ${
                    selectedIndex === idx ? 'bg-black/5 dark:bg-white/10 font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  style={{ color: 'var(--ink)' }}
                >
                  <span className="truncate">{p.label}</span>
                  <span className="text-xs opacity-60 shrink-0 ml-2">
                    {p.lat.toFixed(2)}, {p.lon.toFixed(2)}
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Popular Cities list */}
      <div className="mt-4">
        <label className="text-[13px] font-medium block mb-1.5" style={{ color: 'var(--sub)' }}>
          {t('popular_cities', 'Popular cities')}
        </label>
        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-0.5">
          {POPULAR_CITIES.map((c) => (
            <button
              key={c.name}
              type="button"
              disabled={busy}
              onClick={() => selectPlace(c)}
              className="tap px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors hover:border-black/30 dark:hover:border-white/30"
              style={{
                borderColor: current === c.label || current?.startsWith(c.name) ? 'var(--navy)' : 'var(--line)',
                background: current === c.label || current?.startsWith(c.name) ? 'var(--navy)' : 'var(--bg)',
                color: current === c.label || current?.startsWith(c.name) ? '#fff' : 'var(--ink)',
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* PIN code lookup */}
      <div className="mt-4">
        <label htmlFor="pin" className="text-[13px] font-medium block" style={{ color: 'var(--sub)' }}>
          {t('enter_pin')}
        </label>
        <div className="flex gap-2 mt-1">
          <input
            id="pin"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
              if (error) setError('');
            }}
            placeholder="e.g. 411001"
            className="tap flex-1 rounded-xl px-3 py-2 outline-none text-sm"
            style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}
          />
          <button
            type="button"
            onClick={handleApplyPin}
            disabled={busy || pin.length !== 6}
            className="tap px-4 py-2 rounded-xl text-white font-semibold text-sm disabled:opacity-50 shrink-0"
            style={{ background: 'var(--navy)' }}
          >
            {busy ? t('applying') : t('btn_apply')}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-[13px] mt-3" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
    </ModalShell>
  );
}
