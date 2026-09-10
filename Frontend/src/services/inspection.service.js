import api, { unwrap } from "./api";

/**
 * Fetch paginated list of inspections with filters
 */
export async function getInspections(params = {}) {
  const res = await api.get("/inspections", { params });
  const raw = unwrap(res);
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.inspections)
    ? raw.inspections
    : Array.isArray(raw?.data)
    ? raw.data
    : [];
  const pagination = res.data?.pagination || {
    page: params.page || 1,
    limit: params.limit || 20,
    total: list.length,
    totalPages: Math.ceil(list.length / (params.limit || 20)) || 1,
  };
  return { inspections: list, pagination };
}

/**
 * Fetch detailed inspection by ID
 */
export async function getInspectionById(id) {
  const res = await api.get(`/inspections/${id}`);
  return unwrap(res);
}

/**
 * Create a new scheduled or surprise inspection
 */
export async function createInspection(data) {
  const res = await api.post("/inspections", data);
  return unwrap(res);
}

/**
 * Update inspection metadata
 */
export async function updateInspection(id, data) {
  const res = await api.patch(`/inspections/${id}`, data);
  return unwrap(res);
}

/**
 * Query eligible inspectors for assignment
 */
export async function getEligibleInspectors(params = {}) {
  const res = await api.get("/inspections/eligible-inspectors", { params });
  return unwrap(res) || [];
}

/**
 * Manually assign an inspector to an inspection
 */
export async function assignInspector(id, data) {
  const res = await api.post(`/inspections/${id}/assign`, data);
  return unwrap(res);
}

/**
 * Reassign an inspection to a new inspector
 */
export async function reassignInspector(id, data) {
  const res = await api.post(`/inspections/${id}/reassign`, data);
  return unwrap(res);
}

/**
 * Fetch assignment history for an inspection
 */
export async function getInspectionAssignments(id) {
  const res = await api.get(`/inspections/${id}/assignments`);
  return unwrap(res) || [];
}

/**
 * One-click JIT automated randomized dispatch for an inspection
 */
export async function jitDispatch(id, data = {}) {
  const res = await api.post(`/inspections/${id}/jit-dispatch`, data);
  return unwrap(res);
}

/**
 * Batch JIT dispatch across all pending planned inspections
 */
export async function batchJitDispatch(data = {}) {
  const res = await api.post("/inspections/batch-jit-dispatch", data);
  return unwrap(res);
}

/**
 * Trigger an immediate surprise inspection with JIT dispatch
 */
export async function triggerSurpriseInspection(data) {
  const res = await api.post("/inspections/trigger-surprise", data);
  return unwrap(res);
}

/**
 * Cancel an inspection
 */
export async function cancelInspection(id) {
  const res = await api.post(`/inspections/${id}/cancel`);
  return unwrap(res);
}
