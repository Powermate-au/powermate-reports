// Default QMT configuration. Live values are read from the Google Sheet
// "Config" tab via /api/config — these are only the seed defaults shown
// when the sheet is empty.

export const DEFAULT_JOB_TYPES = [
  { tag: 'electrical', label: 'Electrical' },
  { tag: 'solar', label: 'Solar' },
  { tag: 'battery', label: 'Battery' },
  { tag: 'offgrid', label: 'Offgrid' },
  { tag: 'aircon', label: 'Aircon' },
  { tag: 'heatpump', label: 'Heat Pump' },
  { tag: 'service', label: 'Service' },
  { tag: 'maintenance', label: 'Maintenance' },
  { tag: 'equipment', label: 'Equipment Hire' },
  { tag: 'internal', label: 'Internal' },
  { tag: 'other', label: 'Other' },
];

// Default margin targets (GST-free) — match the Excel QMT analysis window.
export const DEFAULT_TARGET_INC_LABOUR = 0.425; // 42.5%
export const DEFAULT_TARGET_EX_LABOUR = 0.593; // 59.3%
// Default profit-per-hour target ($/hr, GP Ex Labour ÷ labour hours).
export const DEFAULT_TARGET_DOLLARS_PER_HOUR = 150;

// Variance causes — applied to Completed jobs where actual margin
// came in below estimated. Was previously called "root cause".
export const DEFAULT_VARIANCE_CAUSES = [
  'Poor Estimating',
  'Scope Creep',
  'Inefficient Labour',
  'Labour Stacking',
  'Commercial Dispute',
  'Material Damage / Missing',
];

// Loss reasons — applied to Unsuccessful jobs to track why the
// customer didn't proceed.
export const DEFAULT_LOSS_REASONS = [
  'Price too high',
  'Went with our other option',
  'Went with competitor',
  'Customer changed mind',
  'No response after follow-up',
];

// Back-compat alias kept so existing imports don't break.
export const DEFAULT_ROOT_CAUSES = DEFAULT_VARIANCE_CAUSES;

// Tag format used in ServiceM8 job descriptions, e.g. *_solar
export const TAG_PREFIX = '*_';

export function parseJobTypeTag(description, tags = DEFAULT_JOB_TYPES) {
  if (!description) return null;
  const text = description.toLowerCase();
  for (const t of tags) {
    if (text.includes(`${TAG_PREFIX}${t.tag.toLowerCase()}`)) return t.tag;
  }
  return null;
}
