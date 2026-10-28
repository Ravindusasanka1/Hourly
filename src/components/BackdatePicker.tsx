import { useState } from 'react';
import { MS_PER_MINUTE } from '../lib/time';

interface BackdatePickerProps {
  value: number; // minutes: 0 = just now
  onChange: (minutes: number) => void;
  elapsedMs: number;
}

const PRESETS = [0, 5, 10, 15] as const;

export function BackdatePicker({ value, onChange, elapsedMs }: BackdatePickerProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const maxMinutes = Math.floor(elapsedMs / MS_PER_MINUTE);
  const isCustom = value > 0 && !PRESETS.includes(value as (typeof PRESETS)[number]);

  const applyCustom = () => {
    const trimmed = customText.trim();
    if (!/^\d+$/.test(trimmed)) {
      setError('Enter a whole number of minutes.');
      return;
    }
    const mins = Number(trimmed);
    if (mins <= 0) {
      setError('Enter a number greater than 0.');
      return;
    }
    setError(null);
    setCustomOpen(false);
    onChange(mins);
  };

  return (
    <div className="space-y-1.5 text-center">
      <p className="label">Switched earlier? (optional)</p>
      <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Backdated switch">
        {PRESETS.map((p) => {
          const isSelected = value === p;
          const label = p === 0 ? 'Now' : `${p}m ago`;
          return (
            <button
              key={p}
              id={`backdate-${p}`}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={isSelected ? 'chip-on' : 'chip-off'}
              onClick={() => {
                setCustomOpen(false);
                onChange(p);
              }}
            >
              {label}
            </button>
          );
        })}
        <button
          id="backdate-custom"
          type="button"
          role="radio"
          aria-checked={isCustom}
          className={isCustom || customOpen ? 'chip-on' : 'chip-off'}
          onClick={() => setCustomOpen((o) => !o)}
        >
          {isCustom ? `${value}m ago` : 'Custom'}
        </button>
      </div>

      {customOpen && (
        <form
          className="animate-fade-in mx-auto mt-2 flex max-w-xs gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            applyCustom();
          }}
        >
          <input
            id="backdate-custom-input"
            className="input"
            inputMode="numeric"
            placeholder="Minutes ago"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            autoFocus
          />
          <button id="backdate-custom-set" type="submit" className="btn-primary">
            Set
          </button>
        </form>
      )}

      {error && customOpen && <p className="mt-1 text-xs text-rose-500">{error}</p>}
      {value > 0 && maxMinutes < value && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Will clamp to elapsed time ({maxMinutes}m).
        </p>
      )}
    </div>
  );
}
