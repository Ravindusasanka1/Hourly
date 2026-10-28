/** Pure helpers for the optional timer goal (SPEC section 6). */

export const MAX_GOAL_MINUTES = 24 * 60;

/** Goal chips. `null` = no goal. */
export const GOAL_PRESETS: readonly { minutes: number | null; label: string }[] = [
  { minutes: null, label: 'None' },
  { minutes: 25, label: '25m' },
  { minutes: 45, label: '45m' },
  { minutes: 60, label: '60m' },
  { minutes: 90, label: '90m' },
  { minutes: 120, label: '2h' },
];

/** Parse a custom goal in whole minutes. Returns null if invalid. */
export function parseCustomGoal(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const minutes = Number(trimmed);
  if (minutes < 1 || minutes > MAX_GOAL_MINUTES) return null;
  return minutes;
}

export function isPresetGoal(minutes: number | null): boolean {
  return GOAL_PRESETS.some((p) => p.minutes === minutes);
}
