// Shared date helpers. Used by both the daily reports dashboard and the QMT.

// Format a Date as YYYY-MM-DD using LOCAL date parts.
// Avoids the toISOString() trick which shifts to UTC and breaks date strings
// for non-UTC timezones (e.g. AEST midnight becomes the previous day's date).
export function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
