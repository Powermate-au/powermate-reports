// "Neutral" form responses — anything that effectively means "nothing to
// flag". Used by the daily reports dashboard to decide whether a help/notes
// answer should appear as a flag or be ignored.

const NEUTRAL = new Set([
  '',
  'none',
  'n/a',
  'na',
  'nothing',
  'nothing — all clear',
  'nothing - all clear',
  'nothing all clear',
  'none identified this week',
  'none received today',
  'none due this week',
]);

export function isNeutralText(v) {
  if (v === undefined || v === null) return true;
  return NEUTRAL.has(v.toString().toLowerCase().trim());
}
