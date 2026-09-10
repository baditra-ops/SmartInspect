import api, { unwrap } from "./api";

/**
 * Fetch paginated list of CCTV devices
 * @param {Object} params { page, limit, institutionId, status, isAiMonitoringEnabled, search, state, district, sortBy, sortOrder }
 */
export async function getCctvDevices(params = {}) {
  const res = await api.get("/cctv", { params });
  const raw = unwrap(res);
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.data)
    ? raw.data
    : Array.isArray(raw?.devices)
    ? raw.devices
    : [];

  return {
    devices: list,
    pagination: raw?.pagination || {
      total: list.length,
      page: params.page || 1,
      limit: params.limit || 50,
      totalPages: 1,
    },
  };
}

/**
 * Fetch single CCTV device details by ID
 * @param {string} id
 */
export async function getCctvDeviceById(id) {
  const res = await api.get(`/cctv/${id}`);
  return unwrap(res);
}

/**
 * Fetch authorized CCTV stream metadata
 * @param {string} id
 */
export async function getCctvStream(id) {
  const res = await api.get(`/cctv/${id}/stream`);
  return unwrap(res);
}

/**
 * Register a new CCTV device
 * @param {Object} data { institutionId, deviceName, cameraLocation, streamUrl, status, isAiMonitoringEnabled }
 */
export async function createCctvDevice(data) {
  const res = await api.post("/cctv", data);
  return unwrap(res);
}

/**
 * Update CCTV device metadata
 * @param {string} id
 * @param {Object} data { deviceName, cameraLocation, streamUrl, isAiMonitoringEnabled }
 */
export async function updateCctvDevice(id, data) {
  const res = await api.patch(`/cctv/${id}`, data);
  return unwrap(res);
}

/**
 * Update CCTV device operational status
 * @param {string} id
 * @param {string} status "ONLINE" | "OFFLINE" | "FAULTY"
 */
export async function updateCctvStatus(id, status) {
  const res = await api.patch(`/cctv/${id}/status`, { status });
  return unwrap(res);
}

/**
 * Delete / Decommission a CCTV device
 * @param {string} id
 */
export async function deleteCctvDevice(id) {
  const res = await api.delete(`/cctv/${id}`);
  return unwrap(res);
}

export const cctvService = {
  getCctvDevices,
  getCctvDeviceById,
  getCctvStream,
  createCctvDevice,
  updateCctvDevice,
  updateCctvStatus,
  deleteCctvDevice,
};

export default cctvService;
