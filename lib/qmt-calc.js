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

// Sum line items for a given job, splitting labour vs materials via the catalog.
// Returns separate { materials, labour } sums in {cost, revenue} form.
// signed qty: STC/BSTC have negative qty and naturally subtract from materials.
function summariseJobLineItems(items, materialsById) {
  const out = {
    materials: { cost: 0, revenue: 0 },
    labour: { cost: 0, revenue: 0, hours: 0 },
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
      out.labour.hours += qty; // labour qty is hours by convention
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
    materials: lineSums.materials,
    labour: {
      cost: activitySums.cost,
      hours: activitySums.hours,
      revenue: lineSums.labour.revenue, // invoice side comes from line items
      breakdown: activitySums.breakdown,
    },
  };
}

function deriveSide(side) {
  const invoice = side.materials.revenue + side.labour.revenue;
  const totalCost = side.materials.cost + side.labour.cost;
  const gpInc = invoice - totalCost;
  const gpEx = invoice - side.materials.cost;
  return {
    materials: side.materials,
    labour: side.labour,
    invoice,
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

export function processJobs({
  jobs,
  lineItems,
  contacts,
  companies,
  materials,
  activities,
  staff,
  jobTypes,
}) {
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
      const actual = deriveSide(buildActualSide(items, materialsById, acts, staffById));
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
        estimated,
        actual,
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
        estRevenue: 0,
        estGpInc: 0,
        estGpEx: 0,
        actRevenue: 0,
        actGpInc: 0,
        actGpEx: 0,
      };
    }
    const b = buckets[k];
    b.count += 1;
    b.estRevenue += p.estimated.invoice;
    b.estGpInc += p.estimated.gpIncLabour;
    b.estGpEx += p.estimated.gpExLabour;
    b.actRevenue += p.actual.invoice;
    b.actGpInc += p.actual.gpIncLabour;
    b.actGpEx += p.actual.gpExLabour;
  });
  return Object.values(buckets).map((b) => ({
    ...b,
    estMarginInc: b.estRevenue > 0 ? b.estGpInc / b.estRevenue : 0,
    estMarginEx: b.estRevenue > 0 ? b.estGpEx / b.estRevenue : 0,
    actMarginInc: b.actRevenue > 0 ? b.actGpInc / b.actRevenue : 0,
    actMarginEx: b.actRevenue > 0 ? b.actGpEx / b.actRevenue : 0,
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
    b.estRevenue += p.estimated.invoice;
    b.estGpInc += p.estimated.gpIncLabour;
    b.estGpEx += p.estimated.gpExLabour;
    b.actRevenue += p.actual.invoice;
    b.actGpInc += p.actual.gpIncLabour;
    b.actGpEx += p.actual.gpExLabour;
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
  const total = processedJobs.length;
  const won = processedJobs.filter(
    (p) => p.status === 'Completed' || p.status === 'Work Order',
  ).length;
  const lost = processedJobs.filter((p) => p.status === 'Unsuccessful').length;
  const decided = won + lost;
  const totalQuotedValue = processedJobs.reduce((s, p) => s + p.estimated.invoice, 0);
  const wonValue = processedJobs
    .filter((p) => p.status === 'Completed' || p.status === 'Work Order')
    .reduce((s, p) => s + p.estimated.invoice, 0);
  const totalEstGp = processedJobs.reduce((s, p) => s + p.estimated.gpIncLabour, 0);
  const totalActGp = processedJobs.reduce((s, p) => s + p.actual.gpIncLabour, 0);
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
    avgActMarginInc: totalQuotedValue > 0 ? totalActGp / totalQuotedValue : 0,
  };
}
