// ServiceM8 REST API client. Server-side only — never import from client code.

const BASE = 'https://api.servicem8.com/api_1.0';

function authHeaders() {
  const key = process.env.SERVICEM8_API_KEY;
  if (!key) throw new Error('SERVICEM8_API_KEY is not set');
  if (key.startsWith('smk-')) {
    return { 'x-api-key': key };
  }
  return { Authorization: 'Basic ' + Buffer.from(`${key}:`).toString('base64') };
}

async function fetchJson(path, { revalidate = 600, fresh = false } = {}) {
  const init = fresh
    ? { headers: { ...authHeaders(), Accept: 'application/json' }, cache: 'no-store' }
    : { headers: { ...authHeaders(), Accept: 'application/json' }, next: { revalidate } };
  const url = `${BASE}/${path}`;
  const maxAttempts = 3;
  let lastErrText = '';
  let lastStatus = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res.json();
    lastStatus = res.status;
    lastErrText = await res.text().catch(() => '');
    const transient = res.status === 502 || res.status === 503 || res.status === 504;
    if (!transient || attempt === maxAttempts) break;
    await new Promise((r) => setTimeout(r, 300 * 2 ** (attempt - 1)));
  }
  throw new Error(`ServiceM8 ${lastStatus} on ${path}: ${lastErrText.slice(0, 200)}`);
}

export async function listJobs(opts) {
  return fetchJson('job.json', opts);
}

export async function listJobMaterials(opts) {
  return fetchJson('jobmaterial.json', opts);
}

export async function listJobMaterialBundles(opts) {
  return fetchJson('jobmaterialbundle.json', opts);
}

export async function listJobContacts(opts) {
  return fetchJson('jobcontact.json', opts);
}

export async function listCompanies(opts) {
  return fetchJson('company.json', opts);
}

export async function listStaff(opts) {
  return fetchJson('staff.json', opts);
}

export async function listJobActivities(opts) {
  return fetchJson('jobactivity.json', opts);
}

export async function listMaterials(opts) {
  // Master catalog — used to look up item_number for labour detection
  // and staff-specific labour cost rates referenced by activities.
  return fetchJson('material.json', opts);
}

// Per-job lookups — no caching, called on-demand for the detail drawer.
function odataFilter(field, value) {
  return encodeURIComponent(`${field} eq '${value}'`);
}

export async function getJob(uuid) {
  const res = await fetchJson(`job.json?%24filter=${odataFilter('uuid', uuid)}`, { revalidate: 0 });
  return Array.isArray(res) ? res[0] : null;
}

export async function getJobMaterials(jobUuid) {
  return fetchJson(`jobmaterial.json?%24filter=${odataFilter('job_uuid', jobUuid)}`, { revalidate: 0 });
}

export async function getJobMaterialBundles(jobUuid) {
  return fetchJson(
    `jobmaterialbundle.json?%24filter=${odataFilter('job_uuid', jobUuid)}`,
    { revalidate: 0 },
  );
}

export async function getJobActivities(jobUuid) {
  return fetchJson(
    `jobactivity.json?%24filter=${odataFilter('job_uuid', jobUuid)}`,
    { revalidate: 0 },
  );
}

export async function getJobContacts(jobUuid) {
  return fetchJson(
    `jobcontact.json?%24filter=${odataFilter('job_uuid', jobUuid)}`,
    { revalidate: 0 },
  );
}
