// ServiceM8 REST API client. Server-side only — never import from client code.

const BASE = 'https://api.servicem8.com/api_1.0';

function authHeaders() {
  const key = process.env.SERVICEM8_API_KEY;
  if (!key) throw new Error('SERVICEM8_API_KEY is not set');
  // Newer ServiceM8 keys (smk-…) use x-api-key; older keys use Basic auth.
  if (key.startsWith('smk-')) {
    return { 'x-api-key': key };
  }
  return { Authorization: 'Basic ' + Buffer.from(`${key}:`).toString('base64') };
}

async function fetchAll(path, { revalidate = 600 } = {}) {
  const res = await fetch(`${BASE}/${path}`, {
    headers: {
      ...authHeaders(),
      Accept: 'application/json',
    },
    next: { revalidate },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`ServiceM8 ${res.status} on ${path}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function listJobs() {
  // ServiceM8 returns up to ~5000 records per call; large enough for current FY.
  return fetchAll('job.json');
}

export async function listJobMaterials() {
  // All material/labour line items across all jobs.
  return fetchAll('jobmaterial.json');
}

export async function listJobContacts() {
  return fetchAll('jobcontact.json');
}

export async function listCompanies() {
  return fetchAll('company.json');
}
