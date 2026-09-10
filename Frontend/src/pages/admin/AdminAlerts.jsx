import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  RefreshCw,
  Plus,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  X,
  FileCheck,
  Check,
  Ban,
  CheckCheck,
} from "lucide-react";
import AppShell from "../../components/AppShell";
import RiskBadge from "../../components/RiskBadge";
import { useAuth } from "../../context/AuthContext";
import {
  getAlerts,
  getAlertStats,
  acknowledgeAlert,
  resolveAlert,
  dismissAlert,
  createAlert,
} from "../../services/alert.service";
import { getInstitutions } from "../../services/institution.service";
import { createComplianceFromAlert } from "../../services/compliance.service";

const ALERT_SEVERITIES = [
  { value: "", label: "All Severities" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

const ALERT_STATUSES = [
  { value: "", label: "All Statuses" },
  { value: "OPEN", label: "Open" },
  { value: "ACKNOWLEDGED", label: "Acknowledged" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "DISMISSED", label: "Dismissed" },
];

const COMMON_ALERT_TYPES = [
  "GEOFENCE_BREACH",
  "COMPLIANCE_VIOLATION",
  "ATTENDANCE_ANOMALY",
  "INFRASTRUCTURE_HAZARD",
  "HIGH_RISK_TRIGGER",
  "OVERDUE_INSPECTION",
  "SYSTEM_ALERT",
];

export default function AdminAlerts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = ["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"].includes(user?.role);

  // Alerts List State
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Resolve Modal State
  const [resolveModalAlert, setResolveModalAlert] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolveLoading, setResolveLoading] = useState(false);
  const [resolveError, setResolveError] = useState("");

  // Create Alert Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [institutionsList, setInstitutionsList] = useState([]);
  const [createForm, setCreateForm] = useState({
    institutionId: "",
    alertType: "COMPLIANCE_VIOLATION",
    severity: "HIGH",
    title: "",
    description: "",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // Action states for inline buttons
  const [actionInProgress, setActionInProgress] = useState({});

  // Fetch Stats
  const loadStats = async () => {
    try {
      const res = await getAlertStats();
      const s = res?.data || res || null;
      setStats(s);
    } catch (err) {
      console.error("Failed to load alert stats", err);
    }
  };

  // Fetch Alerts
  const loadAlerts = async (page = 1) => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        limit: pagination.limit,
      };
      if (search.trim()) params.search = search.trim();
      if (severityFilter) params.severity = severityFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await getAlerts(params);
      const items = Array.isArray(res)
        ? res
        : Array.isArray(res?.alerts)
        ? res.alerts
        : Array.isArray(res?.data?.alerts)
        ? res.data.alerts
        : Array.isArray(res?.data)
        ? res.data
        : [];
      const pag = res?.pagination || res?.data?.pagination || {
        page,
        limit: pagination.limit,
        total: items.length,
        totalPages: Math.ceil(items.length / pagination.limit) || 1,
      };

      setAlerts(items);
      setPagination(pag);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadStats();
    loadAlerts(1);
  }, [severityFilter, statusFilter]);

  // Load institutions list for Create Alert Modal
  const loadInstitutions = async () => {
    if (institutionsList.length > 0) return;
    try {
      const res = await getInstitutions({ limit: 100 });
      const list = res?.data?.institutions || res?.data || res?.institutions || [];
      setInstitutionsList(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to load institutions", err);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadAlerts(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadAlerts(newPage);
    }
  };

  // Acknowledge Alert inline
  const handleAcknowledge = async (alertId) => {
    setActionInProgress((prev) => ({ ...prev, [alertId]: "ack" }));
    try {
      await acknowledgeAlert(alertId);
      setNotice("Alert acknowledged successfully.");
      setTimeout(() => setNotice(""), 4000);
      loadAlerts(pagination.page);
      loadStats();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to acknowledge alert");
    } finally {
      setActionInProgress((prev) => ({ ...prev, [alertId]: null }));
    }
  };

  // Open Resolve Modal
  const handleOpenResolve = (alert) => {
    setResolveModalAlert(alert);
    setResolutionNotes("");
    setResolveError("");
  };

  // Submit Resolution
  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!resolutionNotes.trim()) {
      setResolveError("Please provide resolution notes explaining how this alert was addressed.");
      return;
    }
    setResolveLoading(true);
    setResolveError("");
    try {
      await resolveAlert(resolveModalAlert.id, resolutionNotes.trim());
      setResolveModalAlert(null);
      setNotice("Alert resolved successfully.");
      setTimeout(() => setNotice(""), 4000);
      loadAlerts(pagination.page);
      loadStats();
    } catch (err) {
      setResolveError(err?.response?.data?.message || err.message || "Failed to resolve alert");
    } finally {
      setResolveLoading(false);
    }
  };

  // Dismiss Alert
  const handleDismiss = async (alertId) => {
    if (!window.confirm("Are you sure you want to dismiss this alert?")) return;
    setActionInProgress((prev) => ({ ...prev, [alertId]: "dismiss" }));
    try {
      await dismissAlert(alertId, "Dismissed by administrator");
      setNotice("Alert dismissed.");
      setTimeout(() => setNotice(""), 4000);
      loadAlerts(pagination.page);
      loadStats();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to dismiss alert");
    } finally {
      setActionInProgress((prev) => ({ ...prev, [alertId]: null }));
    }
  };

  // Create Corrective Action from Alert
  const handleCreateCompliance = async (alert) => {
    setActionInProgress((prev) => ({ ...prev, [alert.id]: "compliance" }));
    try {
      const defaultDeadline = new Date();
      defaultDeadline.setDate(defaultDeadline.getDate() + 14);

      await createComplianceFromAlert({
        alertId: alert.id,
        inspectionId: alert.inspectionId || null,
        title: `Action: ${alert.title}`,
        description: alert.description,
        severity: alert.severity,
        deadline: defaultDeadline.toISOString().split("T")[0],
      });

      setNotice(`Corrective action created for alert "${alert.title}".`);
      setTimeout(() => setNotice(""), 5000);
      loadAlerts(pagination.page);
      loadStats();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to create corrective action");
    } finally {
      setActionInProgress((prev) => ({ ...prev, [alert.id]: null }));
    }
  };

  // Open Create Alert Modal
  const handleOpenCreateModal = () => {
    loadInstitutions();
    setCreateForm({
      institutionId: "",
      alertType: "COMPLIANCE_VIOLATION",
      severity: "HIGH",
      title: "",
      description: "",
    });
    setCreateError("");
    setShowCreateModal(true);
  };

  // Submit Create Alert
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.institutionId) {
      setCreateError("Please select a target institution.");
      return;
    }
    if (!createForm.title.trim()) {
      setCreateError("Please provide an alert title.");
      return;
    }
    if (!createForm.description.trim()) {
      setCreateError("Please provide an alert description.");
      return;
    }

    setCreateLoading(true);
    setCreateError("");
    try {
      await createAlert({
        institutionId: createForm.institutionId,
        alertType: createForm.alertType,
        severity: createForm.severity,
        title: createForm.title.trim(),
        description: createForm.description.trim(),
      });
      setShowCreateModal(false);
      setNotice("Alert published successfully.");
      setTimeout(() => setNotice(""), 4000);
      loadAlerts(1);
      loadStats();
    } catch (err) {
      setCreateError(err?.response?.data?.message || err.message || "Failed to create alert");
    } finally {
      setCreateLoading(false);
    }
  };

  const getSeverityBadge = (severity = "MEDIUM") => {
    switch (severity) {
      case "CRITICAL":
        return (
          <span
            style={{
              background: "#fff0f0",
              color: "#c24141",
              border: "1px solid rgba(194, 65, 65, 0.3)",
              padding: "3px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.05em",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <ShieldAlert size={12} />
            CRITICAL
          </span>
        );
      case "HIGH":
        return (
          <span
            style={{
              background: "#fff5df",
              color: "#b56b00",
              border: "1px solid rgba(181, 107, 0, 0.3)",
              padding: "3px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.05em",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <AlertTriangle size={12} />
            HIGH
          </span>
        );
      case "MEDIUM":
        return (
          <span
            style={{
              background: "#fefde8",
              color: "#92710c",
              border: "1px solid rgba(146, 113, 12, 0.25)",
              padding: "3px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            MEDIUM
          </span>
        );
      case "LOW":
      default:
        return (
          <span
            style={{
              background: "#eef6ff",
              color: "#1f6feb",
              border: "1px solid rgba(31, 111, 235, 0.25)",
              padding: "3px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            LOW
          </span>
        );
    }
  };

  const getStatusBadge = (status = "OPEN") => {
    switch (status) {
      case "OPEN":
        return (
          <span
            style={{
              background: "#fef2f2",
              color: "#991b1b",
              padding: "3px 9px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            OPEN
          </span>
        );
      case "ACKNOWLEDGED":
        return (
          <span
            style={{
              background: "#eff6ff",
              color: "#1d4ed8",
              padding: "3px 9px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            ACKNOWLEDGED
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span
            style={{
              background: "#fffbeb",
              color: "#b45309",
              padding: "3px 9px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            IN PROGRESS
          </span>
        );
      case "RESOLVED":
        return (
          <span
            style={{
              background: "#ecfdf5",
              color: "#065f46",
              padding: "3px 9px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            RESOLVED
          </span>
        );
      case "DISMISSED":
      default:
        return (
          <span
            style={{
              background: "#f3f4f6",
              color: "#6b7280",
              padding: "3px 9px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            DISMISSED
          </span>
        );
    }
  };

  return (
    <AppShell>
      <div className="dashboard-body">
        {/* Top Intro Section */}
        <div
          className="page-intro"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}
        >
          <div>
            <span className="section-kicker">MONITORING & INCIDENT RESPONSE</span>
            <h2>Alert Monitoring Center</h2>
            <p>
              Real-time situational intelligence tracking institutional anomalies, geofence breaches, inspection triggers, and compliance risks.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              onClick={() => {
                loadStats();
                loadAlerts(pagination.page);
              }}
              style={{
                background: "#ffffff",
                border: "1px solid var(--line, #e4e9ef)",
                borderRadius: "8px",
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--ink, #18212b)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
              Refresh
            </button>

            {canManage && (
              <button
                onClick={handleOpenCreateModal}
                style={{
                  background: "var(--navy, #112d46)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 6px rgba(17, 45, 70, 0.2)",
                }}
              >
                <Plus size={16} />
                Generate Alert
              </button>
            )}
          </div>
        </div>

        {/* Notices and Alerts */}
        {notice && (
          <div
            style={{
              padding: "12px 18px",
              borderRadius: "8px",
              background: "#eaf8f1",
              border: "1px solid #c2ebd7",
              color: "#16835b",
              fontSize: "13px",
              fontWeight: 600,
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <CheckCircle2 size={16} />
            {notice}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "12px 18px",
              borderRadius: "8px",
              background: "#fff0f0",
              border: "1px solid #f8c2c2",
              color: "#c24141",
              fontSize: "13px",
              fontWeight: 600,
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {/* Metric Cards */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div
            className="stat-card"
            style={{
              background: "#ffffff",
              padding: "18px 20px",
              borderRadius: "12px",
              border: "1px solid var(--line, #e4e9ef)",
              boxShadow: "var(--shadow)",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted, #687789)", textTransform: "uppercase" }}>
              Total Alerts
            </span>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--ink, #18212b)", margin: "4px 0" }}>
              {stats?.total ?? "—"}
            </div>
            <span style={{ fontSize: "12px", color: "var(--muted, #687789)" }}>All jurisdiction logs</span>
          </div>

          <div
            className="stat-card"
            style={{
              background: "#ffffff",
              padding: "18px 20px",
              borderRadius: "12px",
              border: "1px solid rgba(194, 65, 65, 0.2)",
              borderLeft: "4px solid #c24141",
              boxShadow: "var(--shadow)",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#c24141", textTransform: "uppercase" }}>
              Critical Severity
            </span>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#c24141", margin: "4px 0" }}>
              {stats?.bySeverity?.critical ?? "—"}
            </div>
            <span style={{ fontSize: "12px", color: "#8a98a7" }}>Requires immediate intervention</span>
          </div>

          <div
            className="stat-card"
            style={{
              background: "#ffffff",
              padding: "18px 20px",
              borderRadius: "12px",
              border: "1px solid rgba(181, 107, 0, 0.2)",
              borderLeft: "4px solid #b56b00",
              boxShadow: "var(--shadow)",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#b56b00", textTransform: "uppercase" }}>
              High Severity
            </span>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#b56b00", margin: "4px 0" }}>
              {stats?.bySeverity?.high ?? "—"}
            </div>
            <span style={{ fontSize: "12px", color: "#8a98a7" }}>Heightened scrutiny</span>
          </div>

          <div
            className="stat-card"
            style={{
              background: "#ffffff",
              padding: "18px 20px",
              borderRadius: "12px",
              border: "1px solid var(--line, #e4e9ef)",
              boxShadow: "var(--shadow)",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase" }}>
              Open / In Progress
            </span>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#1d4ed8", margin: "4px 0" }}>
              {(stats?.open || 0) + (stats?.inProgress || 0) + (stats?.acknowledged || 0)}
            </div>
            <span style={{ fontSize: "12px", color: "#8a98a7" }}>Active response workflows</span>
          </div>

          <div
            className="stat-card"
            style={{
              background: "#ffffff",
              padding: "18px 20px",
              borderRadius: "12px",
              border: "1px solid var(--line, #e4e9ef)",
              boxShadow: "var(--shadow)",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#16835b", textTransform: "uppercase" }}>
              Resolved
            </span>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#16835b", margin: "4px 0" }}>
              {stats?.resolved ?? "—"}
            </div>
            <span style={{ fontSize: "12px", color: "#8a98a7" }}>Successfully rectified</span>
          </div>
        </section>

        {/* Main Card */}
        <section
          className="section-card"
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            border: "1px solid var(--line, #e4e9ef)",
            boxShadow: "var(--shadow)",
            padding: "24px",
          }}
        >
          {/* Section Header with Filters */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
              marginBottom: "20px",
              paddingBottom: "16px",
              borderBottom: "1px solid var(--line, #e4e9ef)",
            }}
          >
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line, #e4e9ef)",
                  background: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--ink, #18212b)",
                }}
              >
                {ALERT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              {/* Severity Filter */}
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line, #e4e9ef)",
                  background: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--ink, #18212b)",
                }}
              >
                {ALERT_SEVERITIES.map((sev) => (
                  <option key={sev.value} value={sev.value}>
                    {sev.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Bar */}
            <form
              onSubmit={handleSearchSubmit}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "var(--bg, #f5f7fa)",
                borderRadius: "8px",
                padding: "6px 12px",
                border: "1px solid var(--line, #e4e9ef)",
                width: "280px",
              }}
            >
              <Search size={15} color="#8a98a7" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search alerts, institutes..."
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontSize: "13px",
                  width: "100%",
                  color: "var(--ink, #18212b)",
                }}
              />
            </form>
          </div>

          {/* Alerts List Content */}
          {loading ? (
            <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--muted, #687789)" }}>
              <RefreshCw size={24} className="spin" style={{ margin: "0 auto 12px", display: "block" }} />
              <span>Loading alert intelligence...</span>
            </div>
          ) : alerts.length === 0 ? (
            <div style={{ padding: "54px 20px", textAlign: "center", color: "var(--muted, #687789)" }}>
              <Bell size={38} style={{ margin: "0 auto 14px", opacity: 0.35, display: "block" }} />
              <h3 style={{ fontSize: "16px", color: "var(--ink, #18212b)", margin: "0 0 6px" }}>
                No alerts found
              </h3>
              <p style={{ fontSize: "13px", maxWidth: "420px", margin: "0 auto" }}>
                {search || statusFilter || severityFilter
                  ? "No alerts match the active filter criteria. Try adjusting or clearing filters."
                  : "All monitored institutions are currently operating without active alerts or anomalies."}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    border: "1px solid var(--line, #e4e9ef)",
                    borderRadius: "10px",
                    padding: "16px 20px",
                    background: "#ffffff",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    transition: "border-color 0.15s ease",
                  }}
                >
                  {/* Top line: Severity, Type, Title, Status, Timestamp */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      {getSeverityBadge(alert.severity)}

                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "#687789",
                          background: "#f1f4f8",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          letterSpacing: "0.03em",
                        }}
                      >
                        {alert.alertType}
                      </span>

                      <strong style={{ fontSize: "15px", color: "var(--ink, #18212b)" }}>
                        {alert.title}
                      </strong>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {getStatusBadge(alert.status)}

                      <span style={{ fontSize: "12px", color: "#8a98a7", display: "flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={12} />
                        {new Date(alert.createdAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
                    {alert.description}
                  </p>

                  {/* Resolution notes if resolved/dismissed */}
                  {alert.resolutionNotes && (
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: "6px",
                        background: alert.status === "RESOLVED" ? "#f0fdf4" : "#f8fafc",
                        border: `1px solid ${alert.status === "RESOLVED" ? "#bbf7d0" : "#e2e8f0"}`,
                        fontSize: "12px",
                        color: alert.status === "RESOLVED" ? "#166534" : "#475569",
                      }}
                    >
                      <strong>Resolution Notes:</strong> {alert.resolutionNotes}
                      {alert.resolvedAt && (
                        <span style={{ marginLeft: "8px", fontSize: "11px", opacity: 0.8 }}>
                          (on {new Date(alert.resolvedAt).toLocaleDateString("en-IN")})
                        </span>
                      )}
                    </div>
                  )}

                  {/* Bottom Meta & Actions */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "12px",
                      paddingTop: "10px",
                      borderTop: "1px dashed var(--line, #e4e9ef)",
                    }}
                  >
                    {/* Institution and Inspection Info */}
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", fontSize: "12px" }}>
                      {alert.institution && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ink, #18212b)" }}>
                          <Building2 size={14} color="#687789" />
                          <strong style={{ fontWeight: 600 }}>{alert.institution.name}</strong>
                          <span style={{ color: "#8a98a7" }}>
                            ({alert.institution.district}, {alert.institution.state})
                          </span>
                          {alert.institution.latestRiskLevel && (
                            <RiskBadge level={alert.institution.latestRiskLevel} score={alert.institution.latestRiskScore} />
                          )}
                        </div>
                      )}

                      {alert.inspection && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#1f6feb" }}>
                          <ClipboardCheck size={14} />
                          <span>Inspection: {alert.inspection.inspectionType} ({alert.inspection.status})</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    {canManage && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        {alert.status === "OPEN" && (
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            disabled={actionInProgress[alert.id] === "ack"}
                            style={{
                              background: "#ffffff",
                              border: "1px solid #1f6feb",
                              color: "#1f6feb",
                              padding: "5px 12px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Check size={13} />
                            {actionInProgress[alert.id] === "ack" ? "Updating..." : "Acknowledge"}
                          </button>
                        )}

                        {alert.status !== "RESOLVED" && alert.status !== "DISMISSED" && (
                          <>
                            <button
                              onClick={() => handleOpenResolve(alert)}
                              style={{
                                background: "#16835b",
                                border: "none",
                                color: "#ffffff",
                                padding: "5px 12px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <CheckCheck size={13} />
                              Resolve
                            </button>

                            <button
                              onClick={() => handleCreateCompliance(alert)}
                              disabled={actionInProgress[alert.id] === "compliance"}
                              title="Turn this alert into a formal corrective action requirement"
                              style={{
                                background: "#ffffff",
                                border: "1px solid #b56b00",
                                color: "#b56b00",
                                padding: "5px 12px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <FileCheck size={13} />
                              {actionInProgress[alert.id] === "compliance" ? "Creating..." : "Create Corrective Action"}
                            </button>

                            <button
                              onClick={() => handleDismiss(alert.id)}
                              disabled={actionInProgress[alert.id] === "dismiss"}
                              style={{
                                background: "transparent",
                                border: "1px solid #e4e9ef",
                                color: "#8a98a7",
                                padding: "5px 10px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <Ban size={12} />
                              Dismiss
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "20px",
                paddingTop: "16px",
                borderTop: "1px solid var(--line, #e4e9ef)",
                fontSize: "13px",
                color: "var(--muted, #687789)",
              }}
            >
              <div>
                Showing <strong>{(pagination.page - 1) * pagination.limit + 1}</strong> to{" "}
                <strong>{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> of{" "}
                <strong>{pagination.total}</strong> alerts
              </div>

              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  style={{
                    background: "#ffffff",
                    border: "1px solid var(--line, #e4e9ef)",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    cursor: pagination.page <= 1 ? "not-allowed" : "pointer",
                    opacity: pagination.page <= 1 ? 0.5 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  <ChevronLeft size={14} />
                  Prev
                </button>

                <span>
                  Page <strong>{pagination.page}</strong> of {pagination.totalPages}
                </span>

                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  style={{
                    background: "#ffffff",
                    border: "1px solid var(--line, #e4e9ef)",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    cursor: pagination.page >= pagination.totalPages ? "not-allowed" : "pointer",
                    opacity: pagination.page >= pagination.totalPages ? 0.5 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Modal: Resolve Alert */}
        {resolveModalAlert && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(17, 45, 70, 0.45)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "20px",
            }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: "12px",
                width: "100%",
                maxWidth: "500px",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--line, #e4e9ef)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#fcfdfe",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <CheckCheck size={18} color="#16835b" />
                  <strong style={{ fontSize: "15px", color: "var(--ink, #18212b)" }}>
                    Resolve Alert
                  </strong>
                </div>
                <button
                  onClick={() => setResolveModalAlert(null)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "#8a98a7" }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleResolveSubmit} style={{ padding: "20px" }}>
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--muted, #687789)", marginBottom: "4px" }}>
                    ALERT TITLE
                  </label>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink, #18212b)" }}>
                    {resolveModalAlert.title}
                  </div>
                  {resolveModalAlert.institution && (
                    <div style={{ fontSize: "12px", color: "#687789", marginTop: "2px" }}>
                      {resolveModalAlert.institution.name} ({resolveModalAlert.institution.district})
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--muted, #687789)", marginBottom: "6px" }}>
                    RESOLUTION NOTES <span style={{ color: "#c24141" }}>*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Detail the verification steps, corrective actions taken, or justifications for resolving this alert..."
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--line, #e4e9ef)",
                      fontSize: "13px",
                      fontFamily: "inherit",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {resolveError && (
                  <div style={{ padding: "8px 12px", borderRadius: "6px", background: "#fff0f0", color: "#c24141", fontSize: "12px", marginBottom: "14px" }}>
                    {resolveError}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setResolveModalAlert(null)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "6px",
                      border: "1px solid var(--line, #e4e9ef)",
                      background: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resolveLoading}
                    style={{
                      padding: "8px 18px",
                      borderRadius: "6px",
                      border: "none",
                      background: "#16835b",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {resolveLoading ? "Resolving..." : "Confirm Resolution"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Create Alert */}
        {showCreateModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(17, 45, 70, 0.45)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "20px",
            }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: "12px",
                width: "100%",
                maxWidth: "540px",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--line, #e4e9ef)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#fcfdfe",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Bell size={18} color="var(--blue, #1f6feb)" />
                  <strong style={{ fontSize: "15px", color: "var(--ink, #18212b)" }}>
                    Generate Manual Incident Alert
                  </strong>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "#8a98a7" }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} style={{ padding: "20px" }}>
                {/* Institution Select */}
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--muted, #687789)", marginBottom: "6px" }}>
                    TARGET INSTITUTION <span style={{ color: "#c24141" }}>*</span>
                  </label>
                  <select
                    value={createForm.institutionId}
                    onChange={(e) => setCreateForm({ ...createForm, institutionId: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--line, #e4e9ef)",
                      fontSize: "13px",
                      boxSizing: "border-box",
                      background: "#ffffff",
                    }}
                  >
                    <option value="">Select target institution...</option>
                    {institutionsList.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name} ({inst.district}, {inst.state})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Alert Type and Severity */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--muted, #687789)", marginBottom: "6px" }}>
                      ALERT TYPE
                    </label>
                    <select
                      value={createForm.alertType}
                      onChange={(e) => setCreateForm({ ...createForm, alertType: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--line, #e4e9ef)",
                        fontSize: "13px",
                        boxSizing: "border-box",
                        background: "#ffffff",
                      }}
                    >
                      {COMMON_ALERT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--muted, #687789)", marginBottom: "6px" }}>
                      SEVERITY
                    </label>
                    <select
                      value={createForm.severity}
                      onChange={(e) => setCreateForm({ ...createForm, severity: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--line, #e4e9ef)",
                        fontSize: "13px",
                        boxSizing: "border-box",
                        background: "#ffffff",
                      }}
                    >
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="LOW">LOW</option>
                    </select>
                  </div>
                </div>

                {/* Alert Title */}
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--muted, #687789)", marginBottom: "6px" }}>
                    ALERT TITLE <span style={{ color: "#c24141" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    placeholder="e.g. Geofence violation reported outside boundary"
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--line, #e4e9ef)",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Alert Description */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--muted, #687789)", marginBottom: "6px" }}>
                    DETAILED DESCRIPTION <span style={{ color: "#c24141" }}>*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    placeholder="Describe the incident trigger, observed deviations, and context..."
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--line, #e4e9ef)",
                      fontSize: "13px",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {createError && (
                  <div style={{ padding: "8px 12px", borderRadius: "6px", background: "#fff0f0", color: "#c24141", fontSize: "12px", marginBottom: "14px" }}>
                    {createError}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "6px",
                      border: "1px solid var(--line, #e4e9ef)",
                      background: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    style={{
                      padding: "8px 18px",
                      borderRadius: "6px",
                      border: "none",
                      background: "var(--navy, #112d46)",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {createLoading ? "Publishing..." : "Dispatch Alert"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}