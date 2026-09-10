import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  ShieldAlert,
  Clock,
  ExternalLink,
} from "lucide-react";
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/alert.service";

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Load unread count on mount
  const loadCount = async () => {
    try {
      const res = await getUnreadNotificationCount();
      const count = typeof res === "number" ? res : res?.unreadCount ?? res?.data?.unreadCount ?? 0;
      setUnreadCount(count);
    } catch {
      // Non-blocking
    }
  };


  // Load notifications list when dropdown opens
  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await getUserNotifications({ limit: 10 });
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.notifications)
        ? res.notifications
        : Array.isArray(res?.data?.notifications)
        ? res.data.notifications
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setNotifications(list);
      const unread = res?.unreadCount ?? res?.data?.unreadCount;
      if (unread !== undefined) {
        setUnreadCount(unread);
      }

    } catch {
      // Non-blocking
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCount();
    // Refresh count on a gentle interval (every 60s)
    const interval = setInterval(loadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleDropdown = () => {
    if (!isOpen) {
      loadNotifications();
    }
    setIsOpen(!isOpen);
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Mark single item read and navigate
  const handleItemClick = async (item) => {
    if (!item.isRead) {
      try {
        await markNotificationRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        console.error("Failed to mark notification as read", err);
      }
    }
    setIsOpen(false);
    if (item.linkUrl) {
      navigate(item.linkUrl);
    }
  };

  // Mark all notifications read
  const handleMarkAllRead = async () => {
    setActionLoading(true);
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read", err);
    } finally {
      setActionLoading(false);
    }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "";
    const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getIconForType = (type = "") => {
    const t = type.toUpperCase();
    if (t.includes("CRITICAL") || t.includes("BREACH") || t.includes("GEOFENCE")) {
      return <ShieldAlert size={16} color="#c24141" />;
    }
    if (t.includes("WARN") || t.includes("RISK") || t.includes("COMPLIANCE")) {
      return <AlertTriangle size={16} color="#b56b00" />;
    }
    if (t.includes("SUCCESS") || t.includes("APPROVED") || t.includes("RESOLVED")) {
      return <CheckCircle2 size={16} color="#16835b" />;
    }
    return <Info size={16} color="#1f6feb" />;
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef} style={{ position: "relative" }}>
      <button
        className="notification-bell-btn"
        onClick={handleToggleDropdown}
        aria-label="Notifications"
        style={{
          background: "transparent",
          border: "1px solid var(--line, #e4e9ef)",
          borderRadius: "8px",
          width: "38px",
          height: "38px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          position: "relative",
          color: "var(--ink, #18212b)",
          transition: "all 0.15s ease",
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className="notification-badge"
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              background: "#c24141",
              color: "#fff",
              fontSize: "10px",
              fontWeight: 700,
              borderRadius: "10px",
              minWidth: "18px",
              height: "18px",
              padding: "0 4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              border: "2px solid #fff",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="notification-dropdown"
          style={{
            position: "absolute",
            right: 0,
            top: "46px",
            width: "360px",
            maxWidth: "90vw",
            background: "#ffffff",
            border: "1px solid var(--line, #e4e9ef)",
            borderRadius: "12px",
            boxShadow: "0 12px 36px rgba(18, 43, 66, 0.15)",
            zIndex: 1000,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            animation: "fadeIn 0.15s ease",
          }}
        >
          {/* Dropdown Header */}
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--line, #e4e9ef)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#fcfdfe",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <strong style={{ fontSize: "14px", color: "var(--ink, #18212b)" }}>Notifications</strong>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: "rgba(194, 65, 65, 0.1)",
                    color: "#c24141",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: "12px",
                  }}
                >
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={actionLoading}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--blue, #1f6feb)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 8px",
                  borderRadius: "6px",
                }}
              >
                <CheckCheck size={14} />
                {actionLoading ? "Updating..." : "Mark all read"}
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div
            style={{
              maxHeight: "360px",
              overflowY: "auto",
              divideY: "1px solid #f1f4f8",
            }}
          >
            {loading ? (
              <div style={{ padding: "28px", textAlign: "center", color: "var(--muted, #687789)", fontSize: "13px" }}>
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: "36px 20px", textAlign: "center", color: "var(--muted, #687789)" }}>
                <Bell size={28} style={{ margin: "0 auto 10px", opacity: 0.35, display: "block" }} />
                <p style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 4px" }}>No notifications</p>
                <span style={{ fontSize: "12px" }}>You are completely caught up!</span>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #f1f4f8",
                    background: item.isRead ? "#ffffff" : "#f7faff",
                    cursor: "pointer",
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = item.isRead ? "#fbfcfd" : "#eef5ff")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = item.isRead ? "#ffffff" : "#f7faff")}
                >
                  <div style={{ marginTop: "2px", flexShrink: 0 }}>
                    {getIconForType(item.type)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" }}>
                      <strong
                        style={{
                          fontSize: "13px",
                          color: item.isRead ? "#414e5c" : "#112d46",
                          fontWeight: item.isRead ? 600 : 700,
                          lineHeight: 1.3,
                        }}
                      >
                        {item.title}
                      </strong>
                      <span
                        style={{
                          fontSize: "10px",
                          color: "#8a98a7",
                          display: "flex",
                          alignItems: "center",
                          gap: "3px",
                          flexShrink: 0,
                        }}
                      >
                        <Clock size={10} />
                        {formatTimeAgo(item.createdAt)}
                      </span>
                    </div>

                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: "12px",
                        color: "#5c6c7d",
                        lineHeight: 1.4,
                        wordBreak: "break-word",
                      }}
                    >
                      {item.message}
                    </p>
                  </div>

                  {!item.isRead && (
                    <span
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        background: "#1f6feb",
                        flexShrink: 0,
                        marginTop: "6px",
                      }}
                    />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "10px 16px",
              borderTop: "1px solid var(--line, #e4e9ef)",
              background: "#fcfdfe",
              textAlign: "center",
            }}
          >
            <button
              onClick={() => {
                setIsOpen(false);
                navigate("/admin/alert");
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--blue, #1f6feb)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              View All Alerts & Activity
              <ExternalLink size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
