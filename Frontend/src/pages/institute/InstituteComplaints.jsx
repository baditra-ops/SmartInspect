import { useState, useEffect } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  XCircle,
  Eye,
  Send,
  PlayCircle,
  Check,
} from "lucide-react";
import AppShell from "../../components/AppShell";
import {
  getComplianceActions,
  getComplianceStats,
  getComplianceActionById,
  startComplianceAction,
  submitRectification,
} from "../../services/compliance.service";
import { apiError } from "../../services/api";

export default function InstituteComplaints() {
  const [actions, setActions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Modal / Detail state
  const [selectedAction, setSelectedAction] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [actionRes, statsRes] = await Promise.all([
        getComplianceActions({ page: 1, limit: 100, sortBy: "deadline", sortOrder: "asc" }),
        getComplianceStats().catch(() => null),
      ]);
      setActions(actionRes?.actions || actionRes?.data || []);
      setStats(statsRes);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function openActionDetail(item) {
    setModalLoading(true);
    setSelectedAction(item);
    setResponseText(item.institutionResponse || "");
    setEvidenceUrl(item.resolutionEvidenceUrl || "");
    try {
      const detailed = await getComplianceActionById(item.id);
      setSelectedAction(detailed);
      setResponseText(detailed.institutionResponse || "");
      setEvidenceUrl(detailed.resolutionEvidenceUrl || "");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setModalLoading(false);
    }
  }

  async function handleStartWork(actionId) {
    setSubmitting(true);
    setError("");
    try {
      const updated = await startComplianceAction(actionId);
      setNotice("Action marked as In Progress. You can now submit rectification details.");
      setSelectedAction(updated);
      await loadData();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitRectification(e) {
    e.preventDefault();
    if (!responseText.trim()) {
      setError("Please describe the rectification actions taken by your institution.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const updated = await submitRectification(selectedAction.id, {
        institutionResponse: responseText.trim(),
        resolutionEvidenceUrl: evidenceUrl.trim() || undefined,
      });
      setNotice("Rectification response submitted successfully for officer review.");
      setSelectedAction(updated);
      await loadData();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = actions.filter((item) => {
    if (statusFilter === "OPEN" && !["PENDING", "IN_PROGRESS"].includes(item.status)) return false;
    if (statusFilter === "REVIEW" && item.status !== "SUBMITTED_FOR_REVIEW") return false;
    if (statusFilter === "CLOSED" && item.status !== "VERIFIED_CLOSED") return false;
    if (statusFilter === "ESCALATED" && item.status !== "ESCALATED") return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const title = (item.title || "").toLowerCase();
    const desc = (item.description || "").toLowerCase();
    const inspCode = (item.inspection?.inspectionCode || "").toLowerCase();
    return title.includes(q) || desc.includes(q) || inspCode.includes(q);
  });

  const openCount = stats ? Number(stats.pending || 0) + Number(stats.inProgress || 0) : actions.filter((x) => ["PENDING", "IN_PROGRESS"].includes(x.status)).length;
  const reviewCount = stats ? Number(stats.submittedForReview || 0) : actions.filter((x) => x.status === "SUBMITTED_FOR_REVIEW").length;
  const closedCount = stats ? Number(stats.verifiedClosed || 0) : actions.filter((x) => x.status === "VERIFIED_CLOSED").length;
  const overdueCount = stats ? Number(stats.overdue || 0) : 0;

  return (
    <AppShell>
      <div className="dashboard-body">
        <div className="page-intro">
          <div>
            <span className="section-kicker">GRIEVANCE & RECTIFICATION</span>
            <h2>Compliance & Corrective Actions</h2>
            <p>
              Review inspection findings, non-compliance alerts, and submit official rectifications to Ministry officers.
            </p>
          </div>
        </div>

        {notice && (
          <div className="notice" style={{ marginBottom: "1rem" }}>
            <CheckCircle2 size={17} />
            {notice}
          </div>
        )}

        {error && (
          <div className="error-box" style={{ marginBottom: "1rem" }}>
            <AlertCircle size={17} />
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <section className="stats-grid">
          <div className="mini-info-card">
            <span>Open Actions</span>
            <strong>{openCount}</strong>
            <small>Awaiting resolution</small>
          </div>

          <div className="mini-info-card">
            <span>Under Review</span>
            <strong>{reviewCount}</strong>
            <small>Submitted to officer</small>
          </div>

          <div className="mini-info-card">
            <span>Verified & Closed</span>
            <strong>{closedCount}</strong>
            <small>Resolved compliance</small>
          </div>

          {overdueCount > 0 && (
            <div className="mini-info-card" style={{ borderColor: "#fca5a5", background: "#fef2f2" }}>
              <span style={{ color: "#b91c1c" }}>Overdue Deadlines</span>
              <strong style={{ color: "#b91c1c" }}>{overdueCount}</strong>
              <small style={{ color: "#b91c1c" }}>Immediate action needed</small>
            </div>
          )}
        </section>

        {/* Compliance Action List */}
        <section className="section-card">
          <div className="section-head">
            <div>
              <span className="section-kicker">COMPLIANCE REGISTER</span>
              <h2>Action Items & Findings ({filtered.length})</h2>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div className="table-search">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search by title, description, inspection…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <button
                className="icon-button"
                onClick={loadData}
                title="Refresh compliance list"
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? "spin" : ""} />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            {[
              { key: "ALL", label: `All Items (${actions.length})` },
              { key: "OPEN", label: `Action Required (${openCount})` },
              { key: "REVIEW", label: `Under Review (${reviewCount})` },
              { key: "CLOSED", label: `Closed (${closedCount})` },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`tab-btn ${statusFilter === key ? "active" : ""}`}
                onClick={() => setStatusFilter(key)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  border: "1px solid var(--line)",
                  background: statusFilter === key ? "var(--ink)" : "var(--surface)",
                  color: statusFilter === key ? "#fff" : "var(--ink)",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="complaint-list">
            <div className="complaint-header">
              <span>Action / Finding</span>
              <span>Severity</span>
              <span>Deadline</span>
              <span>Status</span>
              <span></span>
            </div>

            {loading ? (
              <div className="complaint-empty">
                <RefreshCw size={26} className="spin" />
                <p style={{ marginTop: "8px" }}>Loading corrective action register…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="complaint-empty">
                <MessageSquare size={28} />
                <h3>No corrective actions found</h3>
                <p>
                  Your institution currently has no pending compliance action items for this filter.
                </p>
              </div>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.id}
                  className="report-row report-row-item"
                  onClick={() => openActionDetail(item)}
                  type="button"
                >
                  <div>
                    <strong style={{ display: "block", color: "var(--ink)", fontSize: "0.88rem" }}>
                      {item.title}
                    </strong>
                    <small style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                      {item.inspection?.inspectionCode ? `Inspection: ${item.inspection.inspectionCode}` : "Direct Audit Finding"}
                    </small>
                  </div>

                  <div>
                    <span
                      className="status-chip"
                      style={{
                        background:
                          item.severity === "CRITICAL"
                            ? "var(--danger-bg)"
                            : item.severity === "HIGH"
                            ? "#ffedd5"
                            : "#f1f5f9",
                        color:
                          item.severity === "CRITICAL"
                            ? "var(--danger)"
                            : item.severity === "HIGH"
                            ? "#c2410c"
                            : "var(--ink)",
                        fontWeight: 700,
                      }}
                    >
                      {item.severity || "MEDIUM"}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: "0.82rem", color: "var(--ink)" }}>
                      {item.deadline
                        ? new Date(item.deadline).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </span>
                    {item.isOverdue && item.status !== "VERIFIED_CLOSED" && (
                      <small style={{ display: "block", color: "var(--danger)", fontWeight: 700, fontSize: "0.7rem" }}>
                        OVERDUE
                      </small>
                    )}
                  </div>

                  <div>
                    <span className={`status-chip status-${String(item.status || "").toLowerCase()}`}>
                      {String(item.status || "").replaceAll("_", " ")}
                    </span>
                  </div>

                  <div>
                    <span className="icon-button" style={{ border: "none", background: "transparent" }}>
                      <Eye size={16} />
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="info-strip warning-strip">
          <AlertCircle size={19} />
          <div>
            <strong>Rectification Workflow</strong>
            <span>
              When non-compliance items are assigned, please start the action, rectify the deficiencies on site, and submit your documentation for official officer review and closure.
            </span>
          </div>
        </section>

        {/* Detailed Compliance Action & Rectification Modal */}
        {selectedAction && (
          <div className="modal-backdrop" onClick={() => setSelectedAction(null)}>
            <div
              className="modal-card"
              style={{ maxWidth: "650px", width: "95%" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div>
                  <span className="section-kicker">CORRECTIVE ACTION DOSSIER</span>
                  <h2>{selectedAction.title}</h2>
                </div>
                <button className="icon-button" onClick={() => setSelectedAction(null)}>
                  <XCircle size={18} />
                </button>
              </div>

              <div className="modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
                {modalLoading ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
                    <RefreshCw size={24} className="spin" />
                    <p style={{ marginTop: "10px" }}>Loading action item details…</p>
                  </div>
                ) : (
                  <>
                    {/* Finding Info Card */}
                    <div
                      style={{
                        background: "var(--bg)",
                        padding: "16px",
                        borderRadius: "10px",
                        marginBottom: "18px",
                        display: "grid",
                        gap: "10px",
                        fontSize: "0.88rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                          Status: <strong style={{ color: "var(--ink)" }}>{selectedAction.status?.replaceAll("_", " ")}</strong>
                        </span>
                        <span
                          className="status-chip"
                          style={{
                            background: selectedAction.severity === "CRITICAL" ? "var(--danger-bg)" : "#ffedd5",
                            color: selectedAction.severity === "CRITICAL" ? "var(--danger)" : "#c2410c",
                            fontWeight: 700,
                          }}
                        >
                          {selectedAction.severity || "MEDIUM"} PRIORITY
                        </span>
                      </div>

                      <div>
                        <strong style={{ display: "block", marginBottom: "4px" }}>Audit Deficiency Description:</strong>
                        <p style={{ margin: 0, color: "var(--ink)", lineHeight: "1.5" }}>
                          {selectedAction.description}
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: "20px", marginTop: "4px", fontSize: "0.8rem", color: "var(--muted)" }}>
                        <span>
                          Deadline: <b>{selectedAction.deadline ? new Date(selectedAction.deadline).toLocaleDateString("en-IN") : "—"}</b>
                        </span>
                        {selectedAction.inspection && (
                          <span>
                            Inspection Code: <b>{selectedAction.inspection.inspectionCode}</b>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Step 1: Start Work if Pending */}
                    {selectedAction.status === "PENDING" && (
                      <div
                        style={{
                          border: "1px solid var(--line)",
                          padding: "16px",
                          borderRadius: "8px",
                          marginBottom: "16px",
                          background: "#f0fdf4",
                        }}
                      >
                        <strong style={{ display: "block", color: "var(--success)" }}>Step 1: Acknowledge & Start Rectification</strong>
                        <p style={{ fontSize: "0.85rem", color: "var(--ink)", margin: "6px 0 12px" }}>
                          Acknowledge this finding and mark it as In Progress to begin institutional remediation.
                        </p>
                        <button
                          className="primary-button"
                          onClick={() => handleStartWork(selectedAction.id)}
                          disabled={submitting}
                        >
                          <PlayCircle size={16} />
                          {submitting ? "Starting…" : "Start Rectification"}
                        </button>
                      </div>
                    )}

                    {/* Action Step 2: Submit Rectification if In Progress */}
                    {selectedAction.status === "IN_PROGRESS" && (
                      <form onSubmit={handleSubmitRectification} style={{ display: "grid", gap: "14px" }}>
                        <h4 style={{ fontSize: "0.95rem", margin: 0, color: "var(--ink)" }}>
                          Submit Rectification Details
                        </h4>

                        <div>
                          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "6px" }}>
                            Remedial Actions Taken *
                          </label>
                          <textarea
                            rows={4}
                            className="form-input"
                            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--line)", font: "inherit" }}
                            placeholder="Detail how the deficiency has been addressed, staff assigned, and maintenance conducted…"
                            value={responseText}
                            onChange={(e) => setResponseText(e.target.value)}
                            required
                          />
                        </div>

                        <div>
                          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "6px" }}>
                            Resolution Proof / Evidence URL (Optional)
                          </label>
                          <input
                            type="url"
                            className="form-input"
                            style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--line)", font: "inherit" }}
                            placeholder="https://..."
                            value={evidenceUrl}
                            onChange={(e) => setEvidenceUrl(e.target.value)}
                          />
                        </div>

                        <button type="submit" className="primary-button" disabled={submitting}>
                          <Send size={15} />
                          {submitting ? "Submitting…" : "Submit for Officer Review"}
                        </button>
                      </form>
                    )}

                    {/* Status Feedback for Submitted / Closed */}
                    {selectedAction.status === "SUBMITTED_FOR_REVIEW" && (
                      <div style={{ background: "#eff6ff", padding: "16px", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
                        <strong style={{ color: "#1d4ed8", display: "flex", alignItems: "center", gap: "6px" }}>
                          <Clock3 size={16} /> Under Officer Review
                        </strong>
                        <p style={{ margin: "6px 0 0", fontSize: "0.85rem", color: "var(--ink)" }}>
                          Your rectification details have been submitted and are currently awaiting review and closure by Ministry inspection officers.
                        </p>
                        {selectedAction.institutionResponse && (
                          <div style={{ marginTop: "10px", fontSize: "0.82rem", background: "#fff", padding: "8px 12px", borderRadius: "6px" }}>
                            <span style={{ color: "var(--muted)" }}>Submitted Response: </span>
                            {selectedAction.institutionResponse}
                          </div>
                        )}
                      </div>
                    )}

                    {selectedAction.status === "VERIFIED_CLOSED" && (
                      <div style={{ background: "var(--success-bg)", padding: "16px", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                        <strong style={{ color: "var(--success)", display: "flex", alignItems: "center", gap: "6px" }}>
                          <CheckCircle2 size={16} /> Verified & Closed
                        </strong>
                        <p style={{ margin: "6px 0 0", fontSize: "0.85rem", color: "var(--ink)" }}>
                          This compliance action was verified and officially closed by the supervising inspection officer.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button className="ghost-button" onClick={() => setSelectedAction(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}