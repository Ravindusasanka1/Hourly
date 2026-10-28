import { useState, type FormEvent } from 'react';
import { CATEGORY_TYPES, COLOR_PRESETS, validateCategoryName } from '../lib/categories';
import { useAppStore } from '../store/useAppStore';
import type { Category, CategoryType } from '../types';
import { Modal } from './Modal';

interface CategoryFormProps {
  /** Category to edit, or null to add a new one. */
  category: Category | null;
  onClose: () => void;
}

export function CategoryForm({ category, onClose }: CategoryFormProps) {
  const categories = useAppStore((s) => s.categories);
  const addCategory = useAppStore((s) => s.addCategory);
  const updateCategory = useAppStore((s) => s.updateCategory);

  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? COLOR_PRESETS[0]);
  const [type, setType] = useState<CategoryType>(category?.type ?? 'productive');
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(
    category?.dailyGoalMinutes !== undefined ? String(category.dailyGoalMinutes) : '',
  );
  const [touched, setTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const nameError = validateCategoryName(name, categories, category?.id);
  const typeChanged = category !== null && category.type !== type;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const parsedGoal = dailyGoalMinutes.trim() ? Number(dailyGoalMinutes.trim()) : undefined;
    const input = {
      name,
      color,
      type,
      dailyGoalMinutes: parsedGoal && parsedGoal > 0 ? parsedGoal : undefined,
    };
    const result = category ? updateCategory(category.id, input) : addCategory(input);
    if (result.ok) onClose();
    else setSubmitError(result.error);
  };

  return (
    <Modal open id="category-form" title={category ? 'Edit category' : 'New category'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div>
          <label htmlFor="category-name" className="label">
            Name
          </label>
          <input
            id="category-name"
            className="input"
            value={name}
            maxLength={40}
            onChange={(e) => {
              setName(e.target.value);
              setSubmitError(null);
            }}
            onBlur={() => setTouched(true)}
            placeholder="e.g. Reading"
            autoFocus
          />
          {touched && nameError && <p className="mt-1.5 text-sm text-rose-500">{nameError}</p>}
        </div>

        <fieldset>
          <legend className="label">Color</legend>
          <div className="flex flex-wrap items-center gap-2.5">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                id={`category-color-${c.slice(1)}`}
                type="button"
                aria-label={`Color ${c}`}
                aria-pressed={color.toLowerCase() === c}
                onClick={() => setColor(c)}
                className="h-10 w-10 rounded-full transition active:scale-90"
                style={{
                  backgroundColor: c,
                  outline: color.toLowerCase() === c ? `3px solid ${c}` : 'none',
                  outlineOffset: 3,
                }}
              />
            ))}
            <label
              className="relative flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-slate-300 dark:border-white/20"
              title="Custom color"
            >
              <span className="sr-only">Custom color</span>
              <input
                id="category-color-custom"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <span className="h-5 w-5 rounded-full" style={{ backgroundColor: color }} />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend className="label">Type</legend>
          <div className="grid grid-cols-3 gap-2" role="radiogroup">
            {CATEGORY_TYPES.map((t) => (
              <button
                key={t.value}
                id={`category-type-${t.value}`}
                type="button"
                role="radio"
                aria-checked={type === t.value}
                onClick={() => setType(t.value)}
                className={`${type === t.value ? 'chip-on' : 'chip-off'} justify-center`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {typeChanged && (
            <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
              Changing the type also changes past statistics for this category.
            </p>
          )}
        </fieldset>

        <div>
          <label htmlFor="category-daily-goal" className="label">
            Daily goal (minutes, optional)
          </label>
          <input
            id="category-daily-goal"
            className="input"
            type="number"
            min="1"
            max="1440"
            placeholder="e.g. 60"
            value={dailyGoalMinutes}
            onChange={(e) => setDailyGoalMinutes(e.target.value)}
          />
        </div>

        {submitError && <p className="text-sm text-rose-500">{submitError}</p>}

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button id="category-form-cancel" type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button id="category-form-save" type="submit" className="btn-primary" disabled={touched && nameError !== null}>
            {category ? 'Save' : 'Add'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
