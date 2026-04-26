import { NextResponse } from 'next/server';
import {
  getJob,
  getJobMaterials,
  getJobMaterialBundles,
  getJobActivities,
  getJobContacts,
  listStaff,
  listCompanies,
} from '@/lib/servicem8';

const num = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const GST_RATE = 0.1;

function exGst(li) {
  const p = num(li.price);
  return String(li.displayed_amount_is_tax_inclusive) === '1' && li.tax_rate_uuid
    ? p / (1 + GST_RATE)
    : p;
}

function classify(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('labour') || n.includes('labor')) return 'labour';
  if (n.includes('bstc')) return 'bstc';
  if (n.includes('stc')) return 'stc';
  return 'material';
}

function activityHours(a) {
  if (!a.start_date || !a.end_date) return 0;
  const start = new Date(a.start_date.replace(' ', 'T'));
  const end = new Date(a.end_date.replace(' ', 'T'));
  if (isNaN(start) || isNaN(end)) return 0;
  return Math.max(0, (end - start) / 3600000);
}

export async function GET(_request, { params }) {
  try {
    const { uuid } = await params;

    const [job, items, bundles, activities, contacts, staffList, companies] = await Promise.all([
      getJob(uuid),
      getJobMaterials(uuid),
      getJobMaterialBundles(uuid),
      getJobActivities(uuid),
      getJobContacts(uuid),
      listStaff(),
      listCompanies(),
    ]);

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    // Look up customer
    let customer = '';
    if (job.company_uuid) {
      const co = companies.find((c) => c.uuid === job.company_uuid);
      if (co?.name) customer = co.name;
    }
    if (!customer && contacts[0]) {
      customer =
        [contacts[0].first, contacts[0].last].filter(Boolean).join(' ').trim() ||
        contacts[0].email ||
        '';
    }

    // Index staff for activity cost lookup
    const staffById = new Map(staffList.map((s) => [s.uuid, s]));

    // Annotate line items with derived fields
    const annotated = items
      .filter((li) => li.active === 1 || li.active === '1')
      .map((li) => {
        const qty = num(li.quantity);
        const unitPriceEx = exGst(li);
        const unitCost = num(li.cost);
        return {
          ...li,
          _kind: classify(li.name),
          _unitPriceExGst: unitPriceEx,
          _unitCost: unitCost,
          _lineRevenueEx: unitPriceEx * Math.abs(qty),
          _lineCost: unitCost * Math.abs(qty),
          _qty: qty,
        };
      });

    // Index bundles
    const bundleMap = new Map(bundles.map((b) => [b.uuid, b]));

    // Group items by bundle
    const byBundle = new Map();
    annotated.forEach((li) => {
      const bid = li.job_material_bundle_uuid || '__loose';
      if (!byBundle.has(bid)) {
        byBundle.set(bid, {
          bundleUuid: bid,
          bundle: bundleMap.get(bid) || null,
          items: [],
        });
      }
      byBundle.get(bid).items.push(li);
    });

    // Sum items into per-bundle totals
    const bundleSummaries = Array.from(byBundle.values()).map((b) => {
      const sums = b.items.reduce(
        (acc, li) => {
          if (li._kind === 'labour') {
            acc.labourCost += li._lineCost;
            acc.labourRevenue += li._lineRevenueEx;
          } else if (li._kind === 'stc' || li._kind === 'bstc') {
            acc.stcRebate += li._lineRevenueEx;
          } else {
            acc.materialsCost += li._lineCost;
            acc.materialsRevenue += li._lineRevenueEx;
          }
          return acc;
        },
        { labourCost: 0, labourRevenue: 0, materialsCost: 0, materialsRevenue: 0, stcRebate: 0 },
      );
      return { ...b, totals: sums };
    });

    // Sort bundles by sort_order so the lowest (typically the quote snapshot) is first
    bundleSummaries.sort((a, b) => {
      const sa = a.bundle ? num(a.bundle.sort_order) : 99999;
      const sb = b.bundle ? num(b.bundle.sort_order) : 99999;
      return sa - sb;
    });

    // Activities with derived hours and labour cost (uses staff hourly_cost_rate if present)
    const activityRows = activities
      .filter((a) => a.active === 1 || a.active === '1')
      .map((a) => {
        const hours = activityHours(a);
        const staff = staffById.get(a.staff_uuid);
        const hourlyCostRate =
          num(staff?.hourly_cost_rate) || num(staff?.hourly_rate) || 0;
        return {
          ...a,
          _staffName: staff
            ? [staff.first, staff.last].filter(Boolean).join(' ').trim()
            : '',
          _hours: hours,
          _hourlyCostRate: hourlyCostRate,
          _activityCost: hours * hourlyCostRate,
        };
      });

    const activityActualLabourCost = activityRows.reduce((s, a) => s + a._activityCost, 0);
    const activityActualHours = activityRows.reduce((s, a) => s + a._hours, 0);

    return NextResponse.json({
      job: {
        ...job,
        customer,
      },
      bundles: bundleSummaries,
      itemsLooseCount: byBundle.has('__loose') ? byBundle.get('__loose').items.length : 0,
      activities: activityRows,
      derived: {
        activityActualHours,
        activityActualLabourCost,
        // The lowest-sort-order bundle is treated as the QUOTE; others as ACTUALS
        // Confirm with user — see notes panel in the drawer.
        quotedBundleUuid: bundleSummaries[0]?.bundleUuid || null,
        actualBundleUuids: bundleSummaries.slice(1).map((b) => b.bundleUuid),
      },
    });
  } catch (error) {
    console.error('Job detail error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
