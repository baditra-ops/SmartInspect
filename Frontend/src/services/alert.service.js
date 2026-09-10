import api, { unwrap } from "./api";

/**
 * Alert & Notification API Service Layer
 * Interfaces directly with backend /api/alerts
 */

/**
 * Get Paginated List of Alerts
 * GET /api/alerts
 */
export const getAlerts = async (params = {}) => {
  const res = await api.get("/alerts", { params });
  return unwrap(res);
};

/**
 * Get Alert Summary Statistics
 * GET /api/alerts/stats
 */
export const getAlertStats = async () => {
  const res = await api.get("/alerts/stats");
  return unwrap(res);
};

/**
 * Get Single Alert by ID
 * GET /api/alerts/:id
 */
export const getAlertById = async (id) => {
  const res = await api.get(`/alerts/${id}`);
  return unwrap(res);
};

/**
 * Create a New Alert (Admin/Officers)
 * POST /api/alerts
 */
export const createAlert = async (data) => {
  const res = await api.post("/alerts", data);
  return unwrap(res);
};

/**
 * Acknowledge an Alert
 * POST /api/alerts/:id/acknowledge
 */
export const acknowledgeAlert = async (id, notes = null) => {
  const res = await api.post(`/alerts/${id}/acknowledge`, { notes });
  return unwrap(res);
};

/**
 * Resolve an Alert
 * POST /api/alerts/:id/resolve
 */
export const resolveAlert = async (id, resolutionNotes) => {
  const res = await api.post(`/alerts/${id}/resolve`, { resolutionNotes });
  return unwrap(res);
};

/**
 * Dismiss an Alert
 * POST /api/alerts/:id/dismiss
 */
export const dismissAlert = async (id, resolutionNotes = null) => {
  const res = await api.post(`/alerts/${id}/dismiss`, { resolutionNotes });
  return unwrap(res);
};

/**
 * Get User Notifications
 * GET /api/alerts/notifications
 */
export const getUserNotifications = async (params = {}) => {
  const res = await api.get("/alerts/notifications", { params });
  return unwrap(res);
};

/**
 * Get Unread Notification Count
 * GET /api/alerts/notifications/unread-count
 */
export const getUnreadNotificationCount = async () => {
  const res = await api.get("/alerts/notifications/unread-count");
  return unwrap(res);
};

/**
 * Mark a single Notification as Read
 * POST /api/alerts/notifications/:id/read
 */
export const markNotificationRead = async (id) => {
  const res = await api.post(`/alerts/notifications/${id}/read`);
  return unwrap(res);
};

/**
 * Mark All Notifications as Read
 * POST /api/alerts/notifications/read-all
 */
export const markAllNotificationsRead = async () => {
  const res = await api.post("/alerts/notifications/read-all");
  return unwrap(res);
};
