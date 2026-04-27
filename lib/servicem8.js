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
  const res = await fetch(`${BASE}/${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`ServiceM8 ${res.status} on ${path}: ${text.slice(0, 200)}`);
  }
  return res.json();
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
