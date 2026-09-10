import api, { unwrap } from "./api";

/**
 * Fetch paginated list of institutions with filters
 */
export async function getInstitutions(params = {}) {
  const res = await api.get("/institutions", { params });
  const raw = unwrap(res);
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.institutions)
    ? raw.institutions
    : Array.isArray(raw?.data)
    ? raw.data
    : [];
  const pagination = res.data?.pagination || {
    page: params.page || 1,
    limit: params.limit || 20,
    total: list.length,
    totalPages: Math.ceil(list.length / (params.limit || 20)) || 1,
  };
  return { institutions: list, pagination };
}

/**
 * Fetch detailed institution by ID
 */
export async function getInstitutionById(id) {
  const res = await api.get(`/institutions/${id}`);
  return unwrap(res);
}

/**
 * Create a new institution
 */
export async function createInstitution(data) {
  const res = await api.post("/institutions", data);
  return unwrap(res);
}

/**
 * Update an existing institution
 */
export async function updateInstitution(id, data) {
  const res = await api.patch(`/institutions/${id}`, data);
  return unwrap(res);
}

/**
 * Soft-delete / deactivate an institution
 */
export async function deleteInstitution(id) {
  const res = await api.delete(`/institutions/${id}`);
  return unwrap(res);
}

/**
 * Fetch schemes associated with an institution
 */
export async function getInstitutionSchemes(id) {
  const res = await api.get(`/institutions/${id}/schemes`);
  return unwrap(res) || [];
}

/**
 * Link a scheme to an institution
 */
export async function linkInstitutionScheme(id, data) {
  const res = await api.post(`/institutions/${id}/schemes`, data);
  return unwrap(res);
}

/**
 * Unlink a scheme from an institution
 */
export async function unlinkInstitutionScheme(id, schemeId) {
  const res = await api.delete(`/institutions/${id}/schemes/${schemeId}`);
  return unwrap(res);
}

/**
 * Fetch beneficiaries enrolled in an institution
 */
export async function getInstitutionBeneficiaries(id, params = {}) {
  const res = await api.get(`/institutions/${id}/beneficiaries`, { params });
  const raw = unwrap(res);
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.beneficiaries)
    ? raw.beneficiaries
    : [];
  return {
    beneficiaries: list,
    pagination: res.data?.pagination || { page: 1, limit: 20, total: list.length, totalPages: 1 },
  };
}

/**
 * Fetch daily attendance logs for an institution
 */
export async function getInstitutionAttendance(id, params = {}) {
  const res = await api.get(`/institutions/${id}/attendance`, { params });
  return unwrap(res) || [];
}
