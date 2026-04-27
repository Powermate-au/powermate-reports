// Abstract jobs-source interface. Currently backed by ServiceM8.
// To migrate to SimPro: write a parallel module exposing the same shape
// (jobs, lineItems, contacts, companies) and switch the import here.

import * as sm8 from './servicem8';

export async function loadAll(opts) {
  const [jobs, lineItems, contacts, companies, materials, activities, staff] =
    await Promise.all([
      sm8.listJobs(opts),
      sm8.listJobMaterials(opts),
      sm8.listJobContacts(opts),
      sm8.listCompanies(opts),
      sm8.listMaterials(opts),
      sm8.listJobActivities(opts),
      sm8.listStaff(opts),
    ]);
  return { jobs, lineItems, contacts, companies, materials, activities, staff };
}
