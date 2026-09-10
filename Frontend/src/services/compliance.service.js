import api, { unwrap } from "./api";

/**
 * Compliance & Corrective Action API Service Layer
 * All endpoints interface directly with backend /api/compliance
 */

/**
 * Get Paginated List of Compliance Actions
 * GET /api/compliance
 */
export const getComplianceActions = async (params = {}) => {
  const res = await api.get("/compliance", { params });
  return unwrap(res);
};

/**
 * Get Compliance Summary Statistics
 * GET /api/compliance/stats
 */
export const getComplianceStats = async (params = {}) => {
  const res = await api.get("/compliance/stats", { params });
  return unwrap(res);
};

/**
 * Get Single Compliance Action Dossier by ID
 * GET /api/compliance/:id
 */
export const getComplianceActionById = async (id) => {
  const res = await api.get(`/compliance/${id}`);
  return unwrap(res);
};

/**
 * Create a New Compliance Action (Authorized Officers)
 * POST /api/compliance
 */
export const createComplianceAction = async (data) => {
  const res = await api.post("/compliance", data);
  return unwrap(res);
};

/**
 * Create a Compliance Action from an Alert (Authorized Officers)
 * POST /api/compliance/from-alert
 */
export const createComplianceFromAlert = async (data) => {
  const res = await api.post("/compliance/from-alert", data);
  return unwrap(res);
};

/**
 * Update Metadata for a Compliance Action
 * PATCH /api/compliance/:id
 */
export const updateComplianceAction = async (id, data) => {
  const res = await api.patch(`/compliance/${id}`, data);
  return unwrap(res);
};

/**
 * Assign Responsible User to a Compliance Action
 * POST /api/compliance/:id/assign
 */
export const assignComplianceAction = async (id, assignedToUserId) => {
  const res = await api.post(`/compliance/${id}/assign`, { assignedToUserId });
  return unwrap(res);
};

/**
 * Start Work on Action (PENDING -> IN_PROGRESS)
 * POST /api/compliance/:id/start
 */
export const startComplianceAction = async (id) => {
  const res = await api.post(`/compliance/${id}/start`);
  return unwrap(res);
};

/**
 * Submit Rectification (IN_PROGRESS -> SUBMITTED_FOR_REVIEW)
 * POST /api/compliance/:id/submit
 */
export const submitRectification = async (id, data) => {
  const res = await api.post(`/compliance/${id}/submit`, data);
  return unwrap(res);
};

/**
 * Officer Verification & Approval (SUBMITTED_FOR_REVIEW -> VERIFIED_CLOSED)
 * POST /api/compliance/:id/verify
 */
export const verifyComplianceAction = async (id, data = {}) => {
  const res = await api.post(`/compliance/${id}/verify`, data);
  return unwrap(res);
};

/**
 * Reject Rectification Submission (SUBMITTED_FOR_REVIEW -> IN_PROGRESS)
 * POST /api/compliance/:id/reject
 */
export const rejectRectification = async (id, data) => {
  const res = await api.post(`/compliance/${id}/reject`, data);
  return unwrap(res);
};

/**
 * Direct Officer Close (-> VERIFIED_CLOSED)
 * POST /api/compliance/:id/close
 */
export const closeComplianceAction = async (id, data = {}) => {
  const res = await api.post(`/compliance/${id}/close`, data);
  return unwrap(res);
};

/**
 * Reopen Closed Compliance Action (VERIFIED_CLOSED -> IN_PROGRESS)
 * POST /api/compliance/:id/reopen
 */
export const reopenComplianceAction = async (id, data) => {
  const res = await api.post(`/compliance/${id}/reopen`, data);
  return unwrap(res);
};

/**
 * Escalate Compliance Action (-> ESCALATED)
 * POST /api/compliance/:id/escalate
 */
export const escalateComplianceAction = async (id, data) => {
  const res = await api.post(`/compliance/${id}/escalate`, data);
  return unwrap(res);
};
