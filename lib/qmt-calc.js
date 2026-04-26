// Pure QMT calculation logic. No I/O, no env access.
// All values reported GST-free per Powermate's reporting standard.
//
// Note on Quoted vs Actual: ServiceM8 does NOT expose a quote-snapshot via
// jobmaterial.json. The line items represent the CURRENT state of the job:
// for Quote-status jobs they are the quote; for Completed jobs they reflect
// what was actually billed. Splitting Quoted vs Actual labour requires also
// pulling /jobactivity.json for actual hours — that's a Phase 2B follow-up.

import { parseJobTypeTag } from './qmt-config';

const num = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const GST_RATE = 0.1;

function classifyLineItem(li) {
  const name = (li.name || '').toLowerCase();
  if (name.includes('labour') || name.includes('labor')) return 'labour';
  if (name.includes('bstc')) return 'bstc';
  if (name.includes('stc')) return 'stc';
  return 'material';
}

function exGstUnitPrice(li) {
  const p = num(li.price);
  const isInc = String(li.displayed_amount_is_tax_inclusive) === '1';
  // Tax-inclusive only matters when there's a tax rate; STC residential lines
  // are typically tax-free and marked tax-exclusive already.
  if (isInc && li.tax_rate_uuid) return p / (1 + GST_RATE);
  return p;
}

function summariseLineItems(items) {
  const out = {
    materialsCost: 0,
    materialsRevenue: 0,
    labourCost: 0,
    labourRevenue: 0,
  };
  items.forEach((li) => {
    if (li.active !== 1 && li.active !== '1') return;
    const isLabour = classifyLineItem(li) === 'labour';
    const qty = num(li.quantity); // SIGNED — STC/BSTC have negative qty and naturally subtract
    const cost = num(li.cost);
    const unitPriceEx = exGstUnitPrice(li);
    const lineCost = cost * qty;
    const lineRevenue = unitPriceEx * qty;
    if (isLabour) {
      out.labourCost += lineCost;
      out.labourRevenue += lineRevenue;
    } else {
      // Materials, STC and BSTC all aggregate into materials with signed qty
      out.materialsCost += lineCost;
      out.materialsRevenue += lineRevenue;
    }
  });
  return out;
}

function deriveMargins(s) {
  const invoice = s.materialsRevenue + s.labourRevenue; // STC already nets out via signed qty
  const totalCost = s.materialsCost + s.labourCost;
  const gpInc = invoice - totalCost;
  const gpEx = invoice - s.materialsCost;
  return {
    invoice,
    revenue: invoice,
    materials: s.materialsCost,
    labour: s.labourCost,
    totalCost,
    gpIncLabour: gpInc,
    gpExLabour: gpEx,
    marginIncLabour: invoice > 0 ? gpInc / invoice : 0,
    marginExLabour: invoice > 0 ? gpEx / invoice : 0,
  };
}

const STATUS_MAP = {
  Quote: 'Quote',
  'Work Order': 'Work Order',
  Completed: 'Completed',
  Unsuccessful: 'Unsuccessful',
};

function jobStatus(job) {
  return STATUS_MAP[job.status] || job.status || 'Other';
}

function customerForJob(job, contacts, companies) {
  if (job.company_uuid) {
    const co = companies.find((c) => c.uuid === job.company_uuid);
    if (co?.name) return co.name;
  }
  const contact = contacts.find((c) => c.job_uuid === job.uuid);
  if (contact) {
    return [contact.first, contact.last].filter(Boolean).join(' ').trim() || contact.email || '';
  }
  return '';
}

export function processJobs({ jobs, lineItems, contacts, companies, jobTypes }) {
  const itemsByJob = new Map();
  lineItems.forEach((li) => {
    if (!li.job_uuid) return;
    if (!itemsByJob.has(li.job_uuid)) itemsByJob.set(li.job_uuid, []);
    itemsByJob.get(li.job_uuid).push(li);
  });

  return jobs
    .filter((j) => j.active === 1 || j.active === '1')
    .map((j) => {
      const items = itemsByJob.get(j.uuid) || [];
      const totals = deriveMargins(summariseLineItems(items));
      const jobType =
        parseJobTypeTag(j.job_description || j.description, jobTypes) || 'untagged';
      return {
        uuid: j.uuid,
        jobNumber: j.generated_job_id || '',
        po: j.purchase_order_number || '',
        date: j.date || j.quote_date || j.edit_date || '',
        status: jobStatus(j),
        statusRaw: j.status,
        jobType,
        description: j.job_description || j.description || '',
        customer: customerForJob(j, contacts, companies),
        totals,
      };
    });
}

export function summariseByStatus(processedJobs) {
  const buckets = {};
  processedJobs.forEach((p) => {
    const k = p.status;
    if (!buckets[k]) {
      buckets[k] = {
        status: k,
        count: 0,
        revenue: 0,
        gpIncLabour: 0,
        gpExLabour: 0,
        totalCost: 0,
      };
    }
    buckets[k].count += 1;
    buckets[k].revenue += p.totals.revenue;
    buckets[k].gpIncLabour += p.totals.gpIncLabour;
    buckets[k].gpExLabour += p.totals.gpExLabour;
    buckets[k].totalCost += p.totals.totalCost;
  });
  return Object.values(buckets).map((b) => ({
    ...b,
    marginIncLabour: b.revenue > 0 ? b.gpIncLabour / b.revenue : 0,
    marginExLabour: b.revenue > 0 ? b.gpExLabour / b.revenue : 0,
  }));
}

export function summariseByJobType(processedJobs, jobTypes) {
  const labelByTag = {};
  jobTypes.forEach((t) => (labelByTag[t.tag] = t.label));
  labelByTag.untagged = 'Untagged';

  const buckets = {};
  processedJobs.forEach((p) => {
    const k = p.jobType;
    if (!buckets[k]) {
      buckets[k] = {
        tag: k,
        label: labelByTag[k] || k,
        totalQuoted: 0,
        won: 0,
        lost: 0,
        undecided: 0,
        wonValue: 0,
        revenue: 0,
        gpIncLabour: 0,
        gpExLabour: 0,
      };
    }
    const b = buckets[k];
    b.totalQuoted += 1;
    b.revenue += p.totals.revenue;
    b.gpIncLabour += p.totals.gpIncLabour;
    b.gpExLabour += p.totals.gpExLabour;
    if (p.status === 'Completed' || p.status === 'Work Order') {
      b.won += 1;
      b.wonValue += p.totals.revenue;
    } else if (p.status === 'Unsuccessful') {
      b.lost += 1;
    } else {
      b.undecided += 1;
    }
  });
  return Object.values(buckets).map((b) => ({
    ...b,
    decided: b.won + b.lost,
    winRatioTotal: b.totalQuoted > 0 ? b.won / b.totalQuoted : 0,
    winRatioDecided: b.won + b.lost > 0 ? b.won / (b.won + b.lost) : 0,
    avgMarginIncLabour: b.revenue > 0 ? b.gpIncLabour / b.revenue : 0,
    avgMarginExLabour: b.revenue > 0 ? b.gpExLabour / b.revenue : 0,
  }));
}

export function topLevelKpis(processedJobs) {
  const total = processedJobs.length;
  const won = processedJobs.filter(
    (p) => p.status === 'Completed' || p.status === 'Work Order',
  ).length;
  const lost = processedJobs.filter((p) => p.status === 'Unsuccessful').length;
  const decided = won + lost;
  const totalQuotedValue = processedJobs.reduce((s, p) => s + p.totals.revenue, 0);
  const wonValue = processedJobs
    .filter((p) => p.status === 'Completed' || p.status === 'Work Order')
    .reduce((s, p) => s + p.totals.revenue, 0);
  const totalGpInc = processedJobs.reduce((s, p) => s + p.totals.gpIncLabour, 0);
  return {
    total,
    won,
    lost,
    decided,
    winRatio: total > 0 ? won / total : 0,
    winRatioDecided: decided > 0 ? won / decided : 0,
    totalQuotedValue,
    wonValue,
    avgMarginIncLabour: totalQuotedValue > 0 ? totalGpInc / totalQuotedValue : 0,
  };
}

// Australian FY ends 30 June. Returns the FY for a given date.
// e.g. 2025-08-15 → 2026 (FY26 covers Jul 2025 → Jun 2026)
export function fyForDate(date = new Date()) {
  const month = date.getMonth() + 1; // 1-12
  return month >= 7 ? date.getFullYear() + 1 : date.getFullYear();
}

export function fyDateRange(fy) {
  return {
    start: new Date(`${fy - 1}-07-01`),
    end: new Date(`${fy}-07-01`),
  };
}
