// Abstract jobs-source interface. Currently backed by ServiceM8.
// To migrate to SimPro: write a parallel module exposing the same shape
// (jobs, lineItems, contacts, companies) and switch the import here.

import * as sm8 from './servicem8';

export async function loadAll() {
  const [jobs, lineItems, contacts, companies] = await Promise.all([
    sm8.listJobs(),
    sm8.listJobMaterials(),
    sm8.listJobContacts(),
    sm8.listCompanies(),
  ]);
  return { jobs, lineItems, contacts, companies };
}
