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

async function fetchJson(path, { revalidate = 600 } = {}) {
  const res = await fetch(`${BASE}/${path}`, {
    headers: { ...authHeaders(), Accept: 'application/json' },
    next: { revalidate },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`ServiceM8 ${res.status} on ${path}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function listJobs() {
  return fetchJson('job.json');
}

export async function listJobMaterials() {
  return fetchJson('jobmaterial.json');
}

export async function listJobMaterialBundles() {
  return fetchJson('jobmaterialbundle.json');
}

export async function listJobContacts() {
  return fetchJson('jobcontact.json');
}

export async function listCompanies() {
  return fetchJson('company.json');
}

export async function listStaff() {
  return fetchJson('staff.json');
}

export async function listJobActivities() {
  return fetchJson('jobactivity.json');
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
