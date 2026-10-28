import { useState } from 'react';
import { GOAL_PRESETS, MAX_GOAL_MINUTES, isPresetGoal, parseCustomGoal } from '../lib/goal';

interface GoalPickerProps {
  value: number | null;
  onChange: (minutes: number | null) => void;
}

/** Optional goal chips: None, 25m, 45m, 60m, 90m, 2h, Custom. */
export function GoalPicker({ value, onChange }: GoalPickerProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const customActive = value !== null && !isPresetGoal(value);

  const applyCustom = () => {
    const minutes = parseCustomGoal(customText);
    if (minutes === null) {
      setError(`Enter whole minutes between 1 and ${MAX_GOAL_MINUTES}.`);
      return;
    }
    setError(null);
    setCustomOpen(false);
    onChange(minutes);
  };

  return (
    <div>
      <p className="label text-center">Goal (optional)</p>
      <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Goal">
        {GOAL_PRESETS.map((p) => (
          <button
            key={p.label}
            id={`goal-${p.minutes ?? 'none'}`}
            type="button"
            role="radio"
            aria-checked={value === p.minutes}
            className={value === p.minutes ? 'chip-on' : 'chip-off'}
            onClick={() => {
              setCustomOpen(false);
              onChange(p.minutes);
            }}
          >
            {p.label}
          </button>
        ))}
        <button
          id="goal-custom"
          type="button"
          role="radio"
          aria-checked={customActive}
          className={customActive || customOpen ? 'chip-on' : 'chip-off'}
          onClick={() => setCustomOpen((o) => !o)}
        >
          {customActive ? `${value}m` : 'Custom'}
        </button>
      </div>
      {customOpen && (
        <form
          className="animate-fade-in mx-auto mt-3 flex max-w-xs gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            applyCustom();
          }}
        >
          <input
            id="goal-custom-input"
            className="input"
            inputMode="numeric"
            placeholder="Minutes"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            autoFocus
          />
          <button id="goal-custom-set" type="submit" className="btn-primary">
            Set
          </button>
        </form>
      )}
      {error && customOpen && <p className="mt-2 text-center text-sm text-rose-500">{error}</p>}
    </div>
  );
}
