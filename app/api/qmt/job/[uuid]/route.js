import { NextResponse } from 'next/server';
import {
  getJob,
  getJobMaterials,
  getJobMaterialBundles,
  getJobActivities,
  getJobContacts,
  listStaff,
  listCompanies,
  listMaterials,
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

function isLabourMaterial(material) {
  const code = (material?.item_number || '').toLowerCase();
  return code.includes('labour') || code.includes('labor');
}

export async function GET(_request, { params }) {
  try {
    const { uuid } = await params;

    const [job, items, bundles, activities, contacts, staffList, companies, materials] =
      await Promise.all([
        getJob(uuid),
        getJobMaterials(uuid),
        getJobMaterialBundles(uuid),
        getJobActivities(uuid),
        getJobContacts(uuid),
        listStaff(),
        listCompanies(),
        listMaterials(),
      ]);

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const materialsById = new Map(materials.map((m) => [m.uuid, m]));
    const staffById = new Map(staffList.map((s) => [s.uuid, s]));

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

    // Annotate active line items with kind + derived fields
    const activeItems = items
      .filter((li) => li.active === 1 || li.active === '1')
      .map((li) => {
        const mat = materialsById.get(li.material_uuid);
        const qty = num(li.quantity);
        const unitPriceEx = exGst(li);
        const unitCost = num(li.cost);
        return {
          ...li,
          _kind: isLabourMaterial(mat) ? 'labour' : 'material',
          _itemNumber: mat?.item_number || '',
          _materialName: mat?.name || '',
          _unitPriceExGst: unitPriceEx,
          _unitCost: unitCost,
          _qty: qty,
          _lineRevenueEx: unitPriceEx * qty,
          _lineCost: unitCost * qty,
        };
      });

    // Group by bundle for the drawer view
    const bundleMap = new Map(bundles.map((b) => [b.uuid, b]));
    const byBundle = new Map();
    activeItems.forEach((li) => {
      const bid = li.job_material_bundle_uuid || '__loose';
      if (!byBundle.has(bid)) {
        byBundle.set(bid, { bundleUuid: bid, bundle: bundleMap.get(bid) || null, items: [] });
      }
      byBundle.get(bid).items.push(li);
    });

    const bundleSummaries = Array.from(byBundle.values()).map((b) => {
      const sums = b.items.reduce(
        (acc, li) => {
          if (li._kind === 'labour') {
            acc.labourCost += li._lineCost;
            acc.labourRevenue += li._lineRevenueEx;
            acc.labourHours += li._qty;
          } else {
            acc.materialsCost += li._lineCost;
            acc.materialsRevenue += li._lineRevenueEx;
          }
          return acc;
        },
        { materialsCost: 0, materialsRevenue: 0, labourCost: 0, labourRevenue: 0, labourHours: 0 },
      );
      return { ...b, totals: sums };
    });

    bundleSummaries.sort((a, b) => {
      const sa = a.bundle ? num(a.bundle.sort_order) : 99999;
      const sb = b.bundle ? num(b.bundle.sort_order) : 99999;
      return sa - sb;
    });

    // Estimated side: line items split by labour catalog
    const estTotals = activeItems.reduce(
      (acc, li) => {
        if (li._kind === 'labour') {
          acc.labour.cost += li._lineCost;
          acc.labour.revenue += li._lineRevenueEx;
          acc.labour.hours += li._qty;
        } else {
          acc.materials.cost += li._lineCost;
          acc.materials.revenue += li._lineRevenueEx;
        }
        return acc;
      },
      { materials: { cost: 0, revenue: 0 }, labour: { cost: 0, revenue: 0, hours: 0 } },
    );

    // Actual labour: from recorded activities × staff material rate
    const actLabour = { cost: 0, hours: 0, breakdown: [] };
    const breakdownByStaff = new Map();
    activities.forEach((a) => {
      if (a.active !== 1 && a.active !== '1') return;
      if (a.activity_was_recorded !== 1 && a.activity_was_recorded !== '1') return;
      if (!a.material_uuid) return;
      if (!a.start_date || !a.end_date) return;
      if (a.start_date.startsWith('0000') || a.end_date.startsWith('0000')) return;
      const s = new Date(a.start_date.replace(' ', 'T'));
      const e = new Date(a.end_date.replace(' ', 'T'));
      if (isNaN(s) || isNaN(e)) return;
      const hours = Math.max(0, (e - s) / 3600000);
      const mat = materialsById.get(a.material_uuid);
      const rate = num(mat?.cost);
      const cost = hours * rate;
      actLabour.hours += hours;
      actLabour.cost += cost;
      const key = a.staff_uuid || mat?.uuid || 'unknown';
      if (!breakdownByStaff.has(key)) {
        const staff = staffById.get(a.staff_uuid);
        breakdownByStaff.set(key, {
          staff: staff
            ? [staff.first, staff.last].filter(Boolean).join(' ').trim()
            : mat?.name || 'Unknown',
          materialName: mat?.name || '',
          rate,
          hours: 0,
          cost: 0,
        });
      }
      const row = breakdownByStaff.get(key);
      row.hours += hours;
      row.cost += cost;
    });
    actLabour.breakdown = Array.from(breakdownByStaff.values()).sort(
      (a, b) => b.hours - a.hours,
    );

    // Annotate every activity for the timesheet table (includes scheduled/admin)
    const annotatedActivities = activities
      .filter((a) => a.active === 1 || a.active === '1')
      .map((a) => {
        const start =
          a.start_date && !a.start_date.startsWith('0000')
            ? new Date(a.start_date.replace(' ', 'T'))
            : null;
        const end =
          a.end_date && !a.end_date.startsWith('0000')
            ? new Date(a.end_date.replace(' ', 'T'))
            : null;
        const hours =
          start && end && !isNaN(start) && !isNaN(end)
            ? Math.max(0, (end - start) / 3600000)
            : 0;
        const mat = materialsById.get(a.material_uuid);
        const rate = num(mat?.cost);
        const staff = staffById.get(a.staff_uuid);
        return {
          ...a,
          _staffName: staff ? [staff.first, staff.last].filter(Boolean).join(' ').trim() : '',
          _hours: hours,
          _materialName: mat?.name || '',
          _rate: rate,
          _activityCost:
            (a.activity_was_recorded === 1 || a.activity_was_recorded === '1') && a.material_uuid
              ? hours * rate
              : 0,
        };
      });

    // Build est/actual comparison for the drawer header
    const buildSide = (mat, lab) => {
      const invoice = mat.revenue + lab.revenue;
      const totalCost = mat.cost + lab.cost;
      const gpInc = invoice - totalCost;
      const gpEx = invoice - mat.cost;
      return {
        materials: mat,
        labour: lab,
        invoice,
        totalCost,
        gpIncLabour: gpInc,
        gpExLabour: gpEx,
        marginIncLabour: invoice > 0 ? gpInc / invoice : 0,
        marginExLabour: invoice > 0 ? gpEx / invoice : 0,
      };
    };

    const estimated = buildSide(estTotals.materials, estTotals.labour);
    const actual = buildSide(estTotals.materials, {
      cost: actLabour.cost,
      revenue: estTotals.labour.revenue, // labour invoice always from line items
      hours: actLabour.hours,
      breakdown: actLabour.breakdown,
    });

    return NextResponse.json({
      job: { ...job, customer },
      bundles: bundleSummaries,
      activities: annotatedActivities,
      estimated,
      actual,
    });
  } catch (error) {
    console.error('Job detail error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
