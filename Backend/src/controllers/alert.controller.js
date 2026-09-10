import * as alertService from "../services/alert.service.js";
import {
  createAlertSchema,
  acknowledgeAlertSchema,
  resolveAlertSchema,
  dismissAlertSchema,
  validateBody,
  validateUuid,
} from "../utils/validation.js";
import { ApiResponse } from "../utils/apiResponse.js";

/**
 * Get Paginated List of Alerts
 * GET /api/alerts
 */
export const getAlerts = async (req, res, next) => {
  try {
    const { status, severity, alertType, institutionId, inspectionId, search, page, limit } = req.query;
    const filters = { status, severity, alertType, institutionId, inspectionId, search };
    const pagination = { page, limit };

    const result = await alertService.getAlerts(filters, pagination, req.user);

    return res.status(200).json({
      success: true,
      message: "Alerts retrieved successfully",
      data: {
        alerts: result.alerts,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Get Alert Summary Statistics
 * GET /api/alerts/stats
 */
export const getAlertStats = async (req, res, next) => {
  try {
    const stats = await alertService.getAlertStats(req.user);
    return ApiResponse.success(res, "Alert statistics retrieved successfully", stats, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Alert by ID
 * GET /api/alerts/:id
 */
export const getAlertById = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Alert ID");
    const alert = await alertService.getAlertById(id, req.user);
    return ApiResponse.success(res, "Alert details retrieved successfully", alert, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new Alert
 * POST /api/alerts
 */
export const createAlert = async (req, res, next) => {
  try {
    const validatedData = validateBody(createAlertSchema, req.body);
    const reqMeta = {
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"],
    };

    const alert = await alertService.createAlert(validatedData, req.user, reqMeta);
    return ApiResponse.success(res, "Alert generated successfully", alert, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Acknowledge an Alert
 * POST /api/alerts/:id/acknowledge
 */
export const acknowledgeAlert = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Alert ID");
    const validatedData = validateBody(acknowledgeAlertSchema, req.body || {});
    const reqMeta = {
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"],
    };

    const alert = await alertService.acknowledgeAlert(id, validatedData.notes, req.user, reqMeta);
    return ApiResponse.success(res, "Alert acknowledged successfully", alert, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Resolve an Alert
 * POST /api/alerts/:id/resolve
 */
export const resolveAlert = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Alert ID");
    const validatedData = validateBody(resolveAlertSchema, req.body);
    const reqMeta = {
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"],
    };

    const alert = await alertService.resolveAlert(id, validatedData.resolutionNotes, req.user, reqMeta);
    return ApiResponse.success(res, "Alert marked as resolved successfully", alert, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Dismiss an Alert
 * POST /api/alerts/:id/dismiss
 */
export const dismissAlert = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Alert ID");
    const validatedData = validateBody(dismissAlertSchema, req.body || {});
    const reqMeta = {
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"],
    };

    const alert = await alertService.dismissAlert(id, validatedData.resolutionNotes, req.user, reqMeta);
    return ApiResponse.success(res, "Alert dismissed successfully", alert, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get User Notifications
 * GET /api/alerts/notifications
 */
export const getUserNotifications = async (req, res, next) => {
  try {
    const { isRead, page, limit } = req.query;
    const result = await alertService.getUserNotifications(req.user, { isRead, page, limit });

    return res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully",
      data: {
        notifications: result.notifications,
        unreadCount: result.unreadCount,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Get Unread Notification Count
 * GET /api/alerts/notifications/unread-count
 */
export const getUnreadNotificationCount = async (req, res, next) => {
  try {
    const result = await alertService.getUnreadNotificationCount(req.user);
    return ApiResponse.success(res, "Unread count retrieved successfully", result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Mark Single Notification as Read
 * POST /api/alerts/notifications/:id/read
 */
export const markNotificationRead = async (req, res, next) => {
  try {
    const id = validateUuid(req.params.id, "Notification ID");
    const notification = await alertService.markNotificationRead(id, req.user);
    return ApiResponse.success(res, "Notification marked as read", notification, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Mark All Notifications as Read
 * POST /api/alerts/notifications/read-all
 */
export const markAllNotificationsRead = async (req, res, next) => {
  try {
    const result = await alertService.markAllNotificationsRead(req.user);
    return ApiResponse.success(res, result.message, result, 200);
  } catch (error) {
    next(error);
  }
};
