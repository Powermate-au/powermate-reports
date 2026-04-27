// Pure QMT calculation logic. No I/O, no env access.
// All values reported GST-free per Powermate's reporting standard.

import { parseJobTypeTag } from './qmt-config';

const num = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const GST_RATE = 0.1;

function exGstUnitPrice(li) {
  const p = num(li.price);
  return String(li.displayed_amount_is_tax_inclusive) === '1' && li.tax_rate_uuid
    ? p / (1 + GST_RATE)
    : p;
}

// Labour detection uses material catalog item_number (case-insensitive substring).
// "PME LABOUR" is the standard quote item; apprentice/per-staff labour materials
// also have LABOUR/LABOR in the item_number.
function isLabourMaterial(material) {
  const code = (material?.item_number || '').toLowerCase();
  return code.includes('labour') || code.includes('labor');
}

function isStcMaterial(material, lineItem) {
  const code = (material?.item_number || '').toUpperCase();
  if (code.includes('STC')) return true; // covers STC and BSTC
  const name = (lineItem?.name || '').toUpperCase();
  return name.includes('STC REBATE') || name.includes('BSTC REBATE');
}

// Sum line items for a job, separating labour, STC rebates and real materials.
// Materials sums hold the REAL values (i.e. excluding STC adjustments) so
// downstream margin calc can compute Total Revenue to Business correctly.
function summariseJobLineItems(items, materialsById) {
  const out = {
    materials: { cost: 0, revenue: 0 }, // REAL materials, before STC reduction
    labour: { cost: 0, revenue: 0, hours: 0 },
    stcValue: 0, // positive magnitude of STC/BSTC rebate
  };
  items.forEach((li) => {
    if (li.active !== 1 && li.active !== '1') return;
    const mat = materialsById.get(li.material_uuid);
    const qty = num(li.quantity);
    const cost = num(li.cost);
    const unitPriceEx = exGstUnitPrice(li);
    const lineCost = cost * qty;
    const lineRevenue = unitPriceEx * qty;
    if (isLabourMaterial(mat)) {
      out.labour.cost += lineCost;
      out.labour.revenue += lineRevenue;
      out.labour.hours += qty;
    } else if (isStcMaterial(mat, li)) {
      // STC lines have negative qty in SM8 — magnitude is the rebate value
      out.stcValue += Math.abs(unitPriceEx * qty);
    } else {
      out.materials.cost += lineCost;
      out.materials.revenue += lineRevenue;
    }
  });
  return out;
}

// Compute actual labour from /jobactivity records:
// duration = end_date − start_date (no travel_time added)
// rate     = cost on the staff's labour material referenced by activity.material_uuid
// Skip activities without material_uuid or where activity_was_recorded ≠ 1.
function summariseJobActivities(activities, materialsById, staffById) {
  const out = { hours: 0, cost: 0, breakdown: [] };
  const byStaff = new Map();
  activities.forEach((a) => {
    if (a.active !== 1 && a.active !== '1') return;
    if (a.activity_was_recorded !== 1 && a.activity_was_recorded !== '1') return;
    if (!a.material_uuid) return;
    if (!a.start_date || !a.end_date) return;
    if (a.start_date.startsWith('0000') || a.end_date.startsWith('0000')) return;
    const start = new Date(a.start_date.replace(' ', 'T'));
    const end = new Date(a.end_date.replace(' ', 'T'));
    if (isNaN(start) || isNaN(end)) return;
    const hours = Math.max(0, (end - start) / 3600000);
    const mat = materialsById.get(a.material_uuid);
    const rate = num(mat?.cost);
    const cost = hours * rate;
    out.hours += hours;
    out.cost += cost;

    const key = a.staff_uuid || mat?.uuid || 'unknown';
    if (!byStaff.has(key)) {
      const staff = staffById.get(a.staff_uuid);
      byStaff.set(key, {
        staffUuid: a.staff_uuid || null,
        staff: staff
          ? [staff.first, staff.last].filter(Boolean).join(' ').trim()
          : mat?.name || 'Unknown',
        materialUuid: a.material_uuid,
        materialName: mat?.name || '',
        rate,
        hours: 0,
        cost: 0,
      });
    }
    const row = byStaff.get(key);
    row.hours += hours;
    row.cost += cost;
  });
  out.breakdown = Array.from(byStaff.values()).sort((a, b) => b.hours - a.hours);
  return out;
}

// TODO: Materials estimated and actual currently use the same ServiceM8 line item
// source. Future improvement: capture quote-stage material snapshot when a reliable
// source is available.
function buildEstimatedSide(items, materialsById) {
  return summariseJobLineItems(items, materialsById);
}
function buildActualSide(items, materialsById, activities, staffById) {
  const lineSums = summariseJobLineItems(items, materialsById);
  const activitySums = summariseJobActivities(activities, materialsById, staffById);
  return {
    materials: lineSums.materials, // REAL materials
    stcValue: lineSums.stcValue,
    labour: {
      cost: activitySums.cost,
      hours: activitySums.hours,
      revenue: lineSums.labour.revenue, // invoice side comes from line items
      breakdown: activitySums.breakdown,
    },
  };
}

function deriveSide(side) {
  const stcValue = side.stcValue || 0;
  // Total Revenue to Business = real materials price + labour price.
  // Customer-facing Invoice = Total Revenue minus the STC discount.
  const totalRevenue = side.materials.revenue + side.labour.revenue;
  const invoice = totalRevenue - stcValue;
  const totalCost = side.materials.cost + side.labour.cost;
  const gpInc = totalRevenue - totalCost;
  const gpEx = totalRevenue - side.materials.cost;
  // Profit per hour uses GP Ex Labour — treats labour as profit so the metric
  // shows gross margin generated per hour the team is on the job.
  const labourHours = side.labour.hours || 0;
  const dollarsPerHour = labourHours > 0 ? gpEx / labourHours : null;
  return {
    materials: side.materials, // REAL materials cost & revenue
    sm8Materials: {
      cost: side.materials.cost - stcValue,
      revenue: side.materials.revenue - stcValue,
    },
    labour: side.labour,
    stcValue,
    invoice,
    totalRevenue,
    revenue: totalRevenue, // alias kept for any callers reading .revenue
    totalCost,
    gpIncLabour: gpInc,
    gpExLabour: gpEx,
    marginIncLabour: totalRevenue > 0 ? gpInc / totalRevenue : 0,
    marginExLabour: totalRevenue > 0 ? gpEx / totalRevenue : 0,
    dollarsPerHour,
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

function hasAtCostTag(description) {
  return /\*_atcost\b/i.test(description || '');
}

export function processJobs({
  jobs,
  lineItems,
  contacts,
  companies,
  materials,
  activities,
  staff,
  jobTypes,
  excludedUuids = [],
}) {
  const excludedSet = new Set(excludedUuids);
  const materialsById = new Map(materials.map((m) => [m.uuid, m]));
  const staffById = new Map((staff || []).map((s) => [s.uuid, s]));

  const itemsByJob = new Map();
  lineItems.forEach((li) => {
    if (!li.job_uuid) return;
    if (!itemsByJob.has(li.job_uuid)) itemsByJob.set(li.job_uuid, []);
    itemsByJob.get(li.job_uuid).push(li);
  });

  const activitiesByJob = new Map();
  (activities || []).forEach((a) => {
    if (!a.job_uuid) return;
    if (!activitiesByJob.has(a.job_uuid)) activitiesByJob.set(a.job_uuid, []);
    activitiesByJob.get(a.job_uuid).push(a);
  });

  return jobs
    .filter((j) => j.active === 1 || j.active === '1')
    .map((j) => {
      const items = itemsByJob.get(j.uuid) || [];
      const acts = activitiesByJob.get(j.uuid) || [];
      const estimated = deriveSide(buildEstimatedSide(items, materialsById));
      // Actuals only exist once a job has actually started. For Quote and
      // Unsuccessful, the line items are still the quote and there are no
      // activities — showing "Actual" values would mislead.
      const status = jobStatus(j);
      const hasActuals = status === 'Work Order' || status === 'Completed';
      const actual = hasActuals
        ? deriveSide(buildActualSide(items, materialsById, acts, staffById))
        : null;
      const description = j.job_description || j.description || '';
      const jobType = parseJobTypeTag(description, jobTypes) || 'untagged';
      const atCost = hasAtCostTag(description);
      const userExcluded = excludedSet.has(j.uuid);
      return {
        uuid: j.uuid,
        jobNumber: j.generated_job_id || '',
        po: j.purchase_order_number || '',
        date: j.date || j.quote_date || j.edit_date || '',
        status,
        statusRaw: j.status,
        jobType,
        description,
        customer: customerForJob(j, contacts, companies),
        estimated,
        actual,
        atCost,
        userExcluded,
        excludedFromKpis: atCost || userExcluded,
      };
    });
}

export function summariseByStatus(processedJobs) {
  const buckets = {};
  processedJobs.forEach((p) => {
    if (p.excludedFromKpis) return;
    const k = p.status;
    if (!buckets[k]) {
      buckets[k] = {
        status: k,
        count: 0,
        estRevenue: 0,
        estGpInc: 0,
        estGpEx: 0,
        estHours: 0,
        actRevenue: 0,
        actGpInc: 0,
        actGpEx: 0,
        actHours: 0,
      };
    }
    const b = buckets[k];
    b.count += 1;
    b.estRevenue += p.estimated.totalRevenue;
    b.estGpInc += p.estimated.gpIncLabour;
    b.estGpEx += p.estimated.gpExLabour;
    b.estHours += p.estimated.labour.hours || 0;
    if (p.actual) {
      b.actRevenue += p.actual.totalRevenue;
      b.actGpInc += p.actual.gpIncLabour;
      b.actGpEx += p.actual.gpExLabour;
      b.actHours += p.actual.labour.hours || 0;
    }
  });
  return Object.values(buckets).map((b) => ({
    ...b,
    estMarginInc: b.estRevenue > 0 ? b.estGpInc / b.estRevenue : 0,
    estMarginEx: b.estRevenue > 0 ? b.estGpEx / b.estRevenue : 0,
    actMarginInc: b.actRevenue > 0 ? b.actGpInc / b.actRevenue : 0,
    actMarginEx: b.actRevenue > 0 ? b.actGpEx / b.actRevenue : 0,
    estDollarsPerHour: b.estHours > 0 ? b.estGpEx / b.estHours : null,
    actDollarsPerHour: b.actHours > 0 ? b.actGpEx / b.actHours : null,
  }));
}

export function summariseByJobType(processedJobs, jobTypes) {
  const labelByTag = {};
  jobTypes.forEach((t) => (labelByTag[t.tag] = t.label));
  labelByTag.untagged = 'Untagged';

  const buckets = {};
  processedJobs.forEach((p) => {
    if (p.excludedFromKpis) return;
    const k = p.jobType;
    if (!buckets[k]) {
      buckets[k] = {
        tag: k,
        label: labelByTag[k] || k,
        totalQuoted: 0,
        won: 0,
        lost: 0,
        undecided: 0,
        estRevenue: 0,
        estGpInc: 0,
        estGpEx: 0,
        actRevenue: 0,
        actGpInc: 0,
        actGpEx: 0,
      };
    }
    const b = buckets[k];
    b.totalQuoted += 1;
    b.estRevenue += p.estimated.totalRevenue;
    b.estGpInc += p.estimated.gpIncLabour;
    b.estGpEx += p.estimated.gpExLabour;
    if (p.actual) {
      b.actRevenue += p.actual.totalRevenue;
      b.actGpInc += p.actual.gpIncLabour;
      b.actGpEx += p.actual.gpExLabour;
    }
    if (p.status === 'Completed' || p.status === 'Work Order') b.won += 1;
    else if (p.status === 'Unsuccessful') b.lost += 1;
    else b.undecided += 1;
  });
  return Object.values(buckets).map((b) => ({
    ...b,
    decided: b.won + b.lost,
    winRatioTotal: b.totalQuoted > 0 ? b.won / b.totalQuoted : 0,
    winRatioDecided: b.won + b.lost > 0 ? b.won / (b.won + b.lost) : 0,
    estMarginInc: b.estRevenue > 0 ? b.estGpInc / b.estRevenue : 0,
    estMarginEx: b.estRevenue > 0 ? b.estGpEx / b.estRevenue : 0,
    actMarginInc: b.actRevenue > 0 ? b.actGpInc / b.actRevenue : 0,
    actMarginEx: b.actRevenue > 0 ? b.actGpEx / b.actRevenue : 0,
  }));
}

export function topLevelKpis(processedJobs) {
  const counted = processedJobs.filter((p) => !p.excludedFromKpis);
  const total = counted.length;
  const won = counted.filter(
    (p) => p.status === 'Completed' || p.status === 'Work Order',
  ).length;
  const lost = counted.filter((p) => p.status === 'Unsuccessful').length;
  const decided = won + lost;
  const totalQuotedValue = counted.reduce((s, p) => s + p.estimated.totalRevenue, 0);
  const wonValue = counted
    .filter((p) => p.status === 'Completed' || p.status === 'Work Order')
    .reduce((s, p) => s + p.estimated.totalRevenue, 0);
  const totalEstGp = counted.reduce((s, p) => s + p.estimated.gpIncLabour, 0);
  const totalEstGpEx = counted.reduce((s, p) => s + p.estimated.gpExLabour, 0);
  const totalEstHours = counted.reduce((s, p) => s + (p.estimated.labour.hours || 0), 0);
  const jobsWithActuals = counted.filter((p) => p.actual);
  const totalActRevenue = jobsWithActuals.reduce((s, p) => s + p.actual.totalRevenue, 0);
  const totalActGp = jobsWithActuals.reduce((s, p) => s + p.actual.gpIncLabour, 0);
  const totalActGpEx = jobsWithActuals.reduce((s, p) => s + p.actual.gpExLabour, 0);
  const totalActHours = jobsWithActuals.reduce((s, p) => s + (p.actual.labour.hours || 0), 0);
  return {
    total,
    won,
    lost,
    decided,
    winRatio: total > 0 ? won / total : 0,
    winRatioDecided: decided > 0 ? won / decided : 0,
    totalQuotedValue,
    wonValue,
    avgEstMarginInc: totalQuotedValue > 0 ? totalEstGp / totalQuotedValue : 0,
    avgActMarginInc: totalActRevenue > 0 ? totalActGp / totalActRevenue : 0,
    avgEstDollarsPerHour: totalEstHours > 0 ? totalEstGpEx / totalEstHours : null,
    avgActDollarsPerHour: totalActHours > 0 ? totalActGpEx / totalActHours : null,
  };
}
