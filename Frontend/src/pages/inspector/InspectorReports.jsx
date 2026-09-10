import { useState, useEffect } from "react";
import {
  FileCheck2,
  FileText,
  Search,
  RefreshCw,
  Eye,
  XCircle,
  Building2,
  Camera,
  CheckCircle2,
  AlertCircle,
  Calendar,
  FileImage,
} from "lucide-react";
import AppShell from "../../components/AppShell";
import RiskBadge from "../../components/RiskBadge";
import {
  getMyInspections,
  getInspectionById,
  getInspectionEvidence,
} from "../../services/inspection.service";
import { apiError } from "../../services/api";

export default function InspectorReports() {
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
      const data = await getMyInspections({
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
        getInspectionEvidence(item.id),
      ]);
      setSelectedReport(fullInspection);
      setReportEvidence(Array.isArray(evidenceList) ? evidenceList : []);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setModalLoading(false);
    }
  }

  const filtered = inspections.filter((item) => {
    if (statusFilter === "COMPLETED" && item.status !== "COMPLETED") return false;
    if (statusFilter === "IN_PROGRESS" && item.status !== "IN_PROGRESS") return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const code = (item.inspectionCode || "").toLowerCase();
    const name = (item.institution?.name || "").toLowerCase();
    const district = (item.institution?.district || "").toLowerCase();
    return code.includes(q) || name.includes(q) || district.includes(q);
  });

  return (
    <AppShell>
      <div className="dashboard-body">
        <div className="page-intro">
          <div>
            <span className="section-kicker">INSPECTION DOCUMENTATION</span>
            <h2>Reports & Audit Archive</h2>
            <p>
              Review field documentation, captured geo-tagged evidence, and submitted reports from completed inspections.
            </p>
          </div>
        </div>

        {error && (
          <div className="error-box" style={{ marginBottom: "1rem" }}>
            <AlertCircle size={17} />
            {error}
          </div>
        )}

        <section className="section-card">
          <div className="section-head">
            <div>
              <span className="section-kicker">REPORT ARCHIVE</span>
              <h2>Submitted reports ({filtered.length})</h2>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div className="table-search">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search reports..."
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

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "18px", flexWrap: "wrap" }}>
            {[
              { key: "ALL", label: "All Reports" },
              { key: "COMPLETED", label: "Completed" },
              { key: "IN_PROGRESS", label: "In Progress" },
            ].map(({ key, label }) => {
              const count =
                key === "ALL"
                  ? inspections.length
                  : inspections.filter((x) => x.status === key).length;
              return (
                <button
                  key={key}
                  className={`tab-btn ${statusFilter === key ? "active" : ""}`}
                  onClick={() => setStatusFilter(key)}
                >
                  <span>{label}</span>
                  <span className="tab-count">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="inspector-report-list">
            <div
              className="inspector-report-header"
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1.2fr 1fr 0.8fr 0.6fr",
                padding: "10px 14px",
                fontWeight: 600,
                fontSize: "0.8rem",
                color: "var(--muted)",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <span>Inspection</span>
              <span>Institution</span>
              <span>Date</span>
              <span>Status</span>
              <span style={{ textAlign: "right" }}>Action</span>
            </div>

            {loading ? (
              <div className="inspector-report-empty">
                <RefreshCw size={26} className="spin" />
                <h3>Loading reports…</h3>
                <p>Retrieving your field inspection reports and audit history.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="inspector-report-empty">
                <FileText size={30} />
                <h3>No reports found</h3>
                <p>
                  {statusFilter === "COMPLETED"
                    ? "Reports for completed inspections will appear here."
                    : "No inspection reports match your search query."}
                </p>
              </div>
            ) : (
              filtered.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1.2fr 1fr 0.8fr 0.6fr",
                    alignItems: "center",
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "0.88rem" }}>{item.inspectionCode}</strong>
                    <small style={{ display: "block", color: "var(--muted)", fontSize: "0.75rem" }}>
                      {item.type}
                    </small>
                  </div>

                  <div>
                    <span style={{ fontSize: "0.88rem", fontWeight: 500 }}>
                      {item.institution?.name || "—"}
                    </span>
                    <small style={{ display: "block", color: "var(--muted)", fontSize: "0.75rem" }}>
                      {item.institution?.district}, {item.institution?.state}
                    </small>
                  </div>

                  <div>
                    <span style={{ fontSize: "0.85rem" }}>
                      {formatDate(item.completedAt || item.scheduledDate)}
                    </span>
                    <small style={{ display: "block", color: "var(--muted)", fontSize: "0.75rem" }}>
                      {item.completedAt ? "Concluded" : "Scheduled"}
                    </small>
                  </div>

                  <div>
                    <span className={`status-chip status-${String(item.status || "").toLowerCase()}`}>
                      {formatInspectionStatus(item.status)}
                    </span>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <button
                      className="small-action"
                      onClick={() => openReportDetail(item)}
                      title="View Report Details"
                    >
                      <Eye size={13} />
                      View
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="info-strip">
          <FileCheck2 size={19} />
          <div>
            <strong>Field documentation & Evidence Chain</strong>
            <span>
              All inspection findings, GPS check-in timestamps, and uploaded media are digitally sealed with cryptographic hashes for government compliance.
            </span>
          </div>
        </section>

        {/* Report Details Modal */}
        {selectedReport && (
          <div className="modal-backdrop">
            <div className="modal-card" style={{ maxWidth: "700px", width: "95%" }}>
              <div className="modal-header">
                <div>
                  <span className="section-kicker">INSPECTION REPORT SUMMARY</span>
                  <h2>{selectedReport.inspectionCode}</h2>
                </div>
                <button
                  className="icon-button"
                  onClick={() => setSelectedReport(null)}
                >
                  <XCircle size={18} />
                </button>
              </div>

              <div className="modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
                {modalLoading ? (
                  <div style={{ textAlign: "center", padding: "30px 0" }}>
                    <RefreshCw size={24} className="spin" />
                    <p style={{ color: "var(--muted)", marginTop: "8px" }}>Loading report metadata…</p>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                      <div>
                        <label style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Status</label>
                        <div>
                          <span className={`status-chip status-${String(selectedReport.status || "").toLowerCase()}`}>
                            {formatInspectionStatus(selectedReport.status)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Type & Schedule</label>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                          {selectedReport.type} • {formatDate(selectedReport.scheduledDate)}
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>GPS Geofence</label>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem", color: selectedReport.isGeofenceVerified ? "var(--success)" : "var(--muted)" }}>
                          {selectedReport.isGeofenceVerified ? "Geofence Check-in Verified" : "Not Verified"}
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Completed Timestamp</label>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                          {selectedReport.completedAt ? formatDate(selectedReport.completedAt) + " " + formatTime(selectedReport.completedAt) : "In Progress / Pending"}
                        </div>
                      </div>
                    </div>

                    {/* Facility Info */}
                    <div style={{ background: "var(--bg)", padding: "14px", borderRadius: "8px", marginBottom: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <Building2 size={16} color="var(--navy)" />
                        <strong style={{ fontSize: "0.95rem" }}>{selectedReport.institution?.name}</strong>
                      </div>
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                        {selectedReport.institution?.address || "—"}, {selectedReport.institution?.district}, {selectedReport.institution?.state}
                      </p>
                    </div>

                    {/* Evidence Gallery */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span className="section-kicker" style={{ fontSize: "0.75rem" }}>CAPTURED EVIDENCE ({reportEvidence.length})</span>
                      </div>

                      {reportEvidence.length === 0 ? (
                        <div style={{ padding: "20px", background: "var(--bg)", borderRadius: "8px", textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }}>
                          <Camera size={22} style={{ marginBottom: "6px" }} />
                          <div>No evidence media recorded for this inspection yet.</div>
                        </div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px" }}>
                          {reportEvidence.map((ev) => (
                            <div
                              key={ev.id}
                              style={{
                                border: "1px solid var(--line)",
                                borderRadius: "8px",
                                overflow: "hidden",
                                padding: "8px",
                                background: "white",
                              }}
                            >
                              {ev.fileUrl && (ev.mediaType === "IMAGE" || !ev.mediaType) ? (
                                <img
                                  src={ev.fileUrl}
                                  alt={ev.category || "Evidence"}
                                  style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "4px" }}
                                />
                              ) : (
                                <div style={{ height: "80px", display: "grid", placeItems: "center", background: "var(--bg)", borderRadius: "4px" }}>
                                  <FileImage size={24} color="var(--muted)" />
                                </div>
                              )}
                              <strong style={{ display: "block", fontSize: "0.75rem", marginTop: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {ev.category?.replaceAll("_", " ")}
                              </strong>
                              <small style={{ fontSize: "0.68rem", color: "var(--muted)" }}>
                                {ev.mediaType}
                              </small>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button
                  className="primary-button"
                  onClick={() => setSelectedReport(null)}
                >
                  Close Report
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatInspectionStatus(value = "") {
  if (!value) return "Unknown";
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}