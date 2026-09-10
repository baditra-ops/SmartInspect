import { useState, useEffect } from "react";
import {
  BarChart3,
  Download,
  FileText,
  Search,
  RefreshCw,
  Eye,
  XCircle,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Printer,
  ShieldCheck,
  FileImage,
  MapPin,
  UserCheck,
} from "lucide-react";
import AppShell from "../../components/AppShell";
import RiskBadge from "../../components/RiskBadge";
import { getInspections, getInspectionById, getInspectionEvidence } from "../../services/inspection.service";
import { apiError } from "../../services/api";

export default function AdminReports() {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [error, setError] = useState("");

  // Report Modal State
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportEvidence, setReportEvidence] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const data = await getInspections({
        page: 1,
        limit: 100,
        sortBy: "scheduledDate",
        sortOrder: "desc",
      });
      setInspections(data.inspections || []);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function openReportDetail(item) {
    setModalLoading(true);
    setSelectedReport(item);
    setReportEvidence([]);
    try {
      const [fullInspection, evidenceList] = await Promise.all([
        getInspectionById(item.id),
        getInspectionEvidence(item.id).catch(() => []),
      ]);
      setSelectedReport(fullInspection);
      setReportEvidence(Array.isArray(evidenceList) ? evidenceList : evidenceList?.evidences || []);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setModalLoading(false);
    }
  }

  const completedCount = inspections.filter((x) => x.status === "COMPLETED").length;
  const inProgressCount = inspections.filter((x) => x.status === "IN_PROGRESS").length;
  const plannedCount = inspections.filter((x) => ["PLANNED", "ASSIGNED", "ACCEPTED"].includes(x.status)).length;

  const filtered = inspections.filter((item) => {
    if (statusFilter === "COMPLETED" && item.status !== "COMPLETED") return false;
    if (statusFilter === "IN_PROGRESS" && item.status !== "IN_PROGRESS") return false;
    if (statusFilter === "PLANNED" && !["PLANNED", "ASSIGNED", "ACCEPTED"].includes(item.status)) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const code = (item.inspectionCode || "").toLowerCase();
    const name = (item.institution?.name || "").toLowerCase();
    const district = (item.institution?.district || "").toLowerCase();
    const state = (item.institution?.state || "").toLowerCase();
    return code.includes(q) || name.includes(q) || district.includes(q) || state.includes(q);
  });

  return (
    <AppShell>
      <div className="dashboard-body">
        <div className="page-intro">
          <div>
            <span className="section-kicker">ANALYTICS & REPORTING</span>
            <h2>Reports & Audit Dossiers</h2>
            <p>
              Review inspection activity, official field audit documentation, and compliance records at the administrative level.
            </p>
          </div>
        </div>

        {error && (
          <div className="error-box" style={{ marginBottom: "1rem" }}>
            <AlertCircle size={17} />
            {error}
          </div>
        )}

        {/* Overview Stats */}
        <section className="stats-grid" style={{ marginBottom: "20px" }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#eef5fc", color: "var(--blue)" }}>
              <FileText size={20} />
            </div>
            <div>
              <span className="stat-label">Total Audits</span>
              <strong className="stat-value">{inspections.length}</strong>
              <small className="stat-detail">Monitored inspections</small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <span className="stat-label">Completed Reports</span>
              <strong className="stat-value">{completedCount}</strong>
              <small className="stat-detail">Official archived dossiers</small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#fef3c7", color: "#d97706" }}>
              <BarChart3 size={20} />
            </div>
            <div>
              <span className="stat-label">In Progress</span>
              <strong className="stat-value">{inProgressCount}</strong>
              <small className="stat-detail">Active field investigations</small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#f1f5f9", color: "#64748b" }}>
              <Calendar size={20} />
            </div>
            <div>
              <span className="stat-label">Scheduled / Pending</span>
              <strong className="stat-value">{plannedCount}</strong>
              <small className="stat-detail">Upcoming inspections</small>
            </div>
          </div>
        </section>

        {/* Reports Table Section */}
        <section className="section-card">
          <div className="section-head">
            <div>
              <span className="section-kicker">REPORT CENTRE</span>
              <h2>Generated reports ({filtered.length})</h2>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div className="table-search">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search reports by code, institution, district…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <button
                className="icon-button"
                onClick={loadData}
                title="Refresh reports"
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? "spin" : ""} />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            {[
              { key: "ALL", label: `All Audits (${inspections.length})` },
              { key: "COMPLETED", label: `Completed Reports (${completedCount})` },
              { key: "IN_PROGRESS", label: `Active (${inProgressCount})` },
              { key: "PLANNED", label: `Scheduled (${plannedCount})` },
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

          <div className="admin-report-list">
            <div className="admin-report-header">
              <span>Report / Institution</span>
              <span>Category</span>
              <span>Date</span>
              <span>Status</span>
              <span></span>
            </div>

            {loading ? (
              <div className="admin-page-empty">
                <RefreshCw size={26} className="spin" />
                <p style={{ marginTop: "8px" }}>Loading administrative reports…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="admin-page-empty">
                <FileText size={30} />
                <h3>No reports match your filters</h3>
                <p>
                  Administrative reports will appear here once inspections are conducted and recorded.
                </p>
              </div>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.id}
                  className="admin-report-row"
                  onClick={() => openReportDetail(item)}
                  type="button"
                >
                  <div>
                    <strong style={{ display: "block", color: "var(--ink)", fontSize: "0.88rem" }}>
                      {item.institution?.name || "Confidential Institution"}
                    </strong>
                    <small style={{ color: "var(--muted)", fontFamily: "monospace", fontSize: "0.75rem" }}>
                      {item.inspectionCode}
                    </small>
                  </div>

                  <div>
                    <span style={{ fontSize: "0.82rem", color: "var(--ink)" }}>
                      {item.institution?.type?.replaceAll("_", " ") || "General"}
                    </span>
                    <small style={{ display: "block", color: "var(--muted)", fontSize: "0.72rem" }}>
                      {[item.institution?.district, item.institution?.state].filter(Boolean).join(", ") || "—"}
                    </small>
                  </div>

                  <div>
                    <span style={{ fontSize: "0.82rem", color: "var(--ink)" }}>
                      {item.scheduledDate
                        ? new Date(item.scheduledDate).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </span>
                    <small style={{ display: "block", color: "var(--muted)", fontSize: "0.72rem" }}>
                      Type: {item.type || "SCHEDULED"}
                    </small>
                  </div>

                  <div>
                    <span
                      className={`status-chip status-${String(item.status || "").toLowerCase()}`}
                    >
                      {String(item.status || "").replaceAll("_", " ")}
                    </span>
                  </div>

                  <div>
                    <span
                      className="icon-button"
                      style={{ border: "none", background: "transparent" }}
                      title="View Report Dossier"
                    >
                      <Eye size={16} />
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        {/* Report Info Grid */}
        <section className="admin-report-info-grid">
          <div className="section-card">
            <div className="admin-report-icon">
              <BarChart3 size={21} />
            </div>

            <span className="section-kicker">INSPECTION ANALYTICS</span>
            <h3>Inspection Performance</h3>
            <p>
              Track inspection volume, completion activity, and institutional compliance trends across monitored state jurisdictions.
            </p>
          </div>

          <div className="section-card">
            <div className="admin-report-icon">
              <Download size={21} />
            </div>

            <span className="section-kicker">EXPORT & AUDIT DOSSIERS</span>
            <h3>Official Documentation</h3>
            <p>
              Official inspection dossiers include tamper-evident cryptographic SHA-256 evidence, GPS geofence stamps, and superintendent signatures.
            </p>
          </div>
        </section>

        {/* Detailed Inspection Report Modal */}
        {selectedReport && (
          <div className="modal-backdrop" onClick={() => setSelectedReport(null)}>
            <div
              className="modal-card"
              style={{ maxWidth: "720px", width: "95%" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div>
                  <span className="section-kicker">OFFICIAL INSPECTION DOSSIER</span>
                  <h2>{selectedReport.inspectionCode}</h2>
                </div>
                <button className="icon-button" onClick={() => setSelectedReport(null)}>
                  <XCircle size={18} />
                </button>
              </div>

              <div className="modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
                {modalLoading ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
                    <RefreshCw size={24} className="spin" />
                    <p style={{ marginTop: "10px" }}>Loading audit report dossier…</p>
                  </div>
                ) : (
                  <>
                    {/* Institution & Overview Info */}
                    <div
                      style={{
                        background: "var(--bg)",
                        padding: "16px",
                        borderRadius: "10px",
                        marginBottom: "18px",
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: "12px",
                      }}
                    >
                      <div>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Institution</span>
                        <strong style={{ display: "block", fontSize: "0.95rem" }}>
                          {selectedReport.institution?.name || "Confidential Destination"}
                        </strong>
                        <small style={{ color: "var(--muted)" }}>
                          {[selectedReport.institution?.district, selectedReport.institution?.state].filter(Boolean).join(", ")}
                        </small>
                      </div>

                      <div>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Inspection Status</span>
                        <div style={{ marginTop: "4px" }}>
                          <span className={`status-chip status-${String(selectedReport.status || "").toLowerCase()}`}>
                            {String(selectedReport.status || "").replaceAll("_", " ")}
                          </span>
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Auditor in Charge</span>
                        <strong style={{ display: "block", fontSize: "0.85rem" }}>
                          {selectedReport.currentInspector?.fullName || "Unassigned"}
                        </strong>
                        <small style={{ color: "var(--muted)" }}>
                          {selectedReport.currentInspector?.email || ""}
                        </small>
                      </div>

                      <div>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>GPS Verification</span>
                        <strong style={{ display: "block", fontSize: "0.85rem", color: selectedReport.isGeofenceVerified ? "var(--success)" : "var(--ink)" }}>
                          {selectedReport.isGeofenceVerified ? "✔ Geofence Verified" : "Coordinates Recorded"}
                        </strong>
                      </div>
                    </div>

                    {/* Overall Score & Risk */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                        gap: "12px",
                        marginBottom: "18px",
                      }}
                    >
                      <div className="section-card" style={{ padding: "12px 16px", margin: 0, textAlign: "center" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Institutional Risk Score</span>
                        <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--blue)", marginTop: "4px" }}>
                          {selectedReport.institution?.latestRiskScore != null
                            ? `${Number(selectedReport.institution.latestRiskScore).toFixed(0)}/100`
                            : selectedReport.overallScore != null
                            ? `${Number(selectedReport.overallScore).toFixed(0)}/100`
                            : "0/100"}
                        </div>
                      </div>

                      <div className="section-card" style={{ padding: "12px 16px", margin: 0, textAlign: "center" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Risk Category</span>
                        <div style={{ marginTop: "6px" }}>
                          <RiskBadge level={selectedReport.institution?.latestRiskLevel || selectedReport.riskLevelAtInspection || "LOW"} />
                        </div>
                      </div>

                      <div className="section-card" style={{ padding: "12px 16px", margin: 0, textAlign: "center" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Evidence Files</span>
                        <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--ink)", marginTop: "4px" }}>
                          {reportEvidence.length}
                        </div>
                      </div>
                    </div>

                    {/* Evidence Gallery */}
                    <div style={{ marginTop: "16px" }}>
                      <h4 style={{ fontSize: "0.95rem", marginBottom: "12px", color: "var(--ink)" }}>
                        Cryptographic Evidence Dossier ({reportEvidence.length})
                      </h4>

                      {reportEvidence.length === 0 ? (
                        <div style={{ padding: "24px", textAlign: "center", background: "var(--bg)", borderRadius: "8px", color: "var(--muted)" }}>
                          <FileImage size={28} />
                          <p style={{ marginTop: "6px", fontSize: "0.85rem" }}>No photographic evidence uploaded for this inspection.</p>
                        </div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px" }}>
                          {reportEvidence.map((ev) => {
                            const mediaUrl = ev.secureUrl || ev.cloudinaryUrl || ev.fileUrl;
                            const isVideo = ev.mediaType === "VIDEO";
                            return (
                              <div
                                key={ev.id}
                                style={{
                                  border: "1px solid var(--line)",
                                  borderRadius: "8px",
                                  overflow: "hidden",
                                  background: "var(--surface)",
                                  padding: "6px",
                                }}
                              >
                                {mediaUrl && !isVideo ? (
                                  <img
                                    src={mediaUrl}
                                    alt={ev.category || "Evidence"}
                                    style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "4px" }}
                                  />
                                ) : isVideo && mediaUrl ? (
                                  <video
                                    src={mediaUrl}
                                    style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "4px" }}
                                  />
                                ) : (
                                  <div style={{ height: "80px", display: "grid", placeItems: "center", background: "var(--bg)" }}>
                                    <FileImage size={24} color="var(--muted)" />
                                  </div>
                                )}
                                <div style={{ marginTop: "4px", fontSize: "0.72rem" }}>
                                  <strong>{ev.category?.replaceAll("_", " ") || "Evidence"}</strong>
                                  {ev.fileHash && (
                                    <span style={{ display: "block", color: "var(--muted)", fontFamily: "monospace", fontSize: "0.65rem" }}>
                                      SHA: {ev.fileHash.slice(0, 8)}…
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between" }}>
                <button
                  className="secondary-button"
                  onClick={() => window.print()}
                  title="Print official report"
                >
                  <Printer size={15} />
                  Print Official Dossier
                </button>

                <button className="ghost-button" onClick={() => setSelectedReport(null)}>
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