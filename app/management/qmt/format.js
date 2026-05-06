// Shared formatting + presentation helpers for the QMT page and drawer.
// Single source of truth — both files import from here.

export function fmtMoney(n, dp = 0) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: dp,
    minimumFractionDigits: dp,
  });
}

export function fmtNum(n, dp = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-AU', {
    maximumFractionDigits: dp,
    minimumFractionDigits: dp,
  });
}

export function fmtPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

export function fmtPerHour(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return `${n.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  })}/hr`;
}

export function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s.replace ? s.replace(' ', 'T') : s);
  if (isNaN(d)) return s;
  return d.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
}

export function fmtDateTime(s) {
  if (!s || s.startsWith('0000')) return '—';
  const d = new Date(s.replace ? s.replace(' ', 'T') : s);
  if (isNaN(d)) return s;
  return d.toLocaleString('en-AU', { hour12: false });
}

export function statusToneCls(status) {
  switch (status) {
    case 'Quote':
      return 'bg-pm-orange-bg text-pm-orange';
    case 'Work Order':
      return 'bg-pm-ocean/10 text-pm-ocean';
    case 'Completed':
      return 'bg-pm-green-bg text-pm-green';
    case 'Unsuccessful':
      return 'bg-pm-red-bg text-pm-red';
    default:
      return 'bg-pm-surface-2 text-pm-text-3';
  }
}

export function marginToneCls(margin, target = 0.3) {
  if (margin === null || margin === undefined || isNaN(margin)) return 'text-pm-text-3';
  if (margin >= target) return 'text-pm-green';
  if (margin >= target - 0.15) return 'text-pm-text';
  return 'text-pm-red';
}

export function deltaCls(delta, goodDirection = 'up') {
  if (delta === 0) return 'text-pm-text-3';
  const positive = delta > 0;
  const isGood = goodDirection === 'up' ? positive : !positive;
  return isGood ? 'text-pm-green' : 'text-pm-red';
}

// Which reason list a job needs (if any). Negative-variance Completed →
// variance cause. Unsuccessful → loss reason. Otherwise: not applicable.
export function reasonContextFor(job) {
  if (!job) return null;
  if (job.status === 'Unsuccessful') return 'loss';
  if (job.status === 'Completed' && job.actual && job.estimated) {
    if (job.actual.marginIncLabour < job.estimated.marginIncLabour) return 'variance';
  }
  return null;
}
