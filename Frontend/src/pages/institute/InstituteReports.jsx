import { useState, useEffect } from "react";
import {
  ClipboardCheck,
  Download,
  FileText,
  Search,
  RefreshCw,
  Eye,
  XCircle,
  Building2,
  Calendar,
  AlertCircle,
  Printer,
  ShieldCheck,
  FileImage,
} from "lucide-react";
import AppShell from "../../components/AppShell";
import RiskBadge from "../../components/RiskBadge";
import { getInspections, getInspectionById, getInspectionEvidence } from "../../services/inspection.service";
import { apiError } from "../../services/api";

export default function InstituteReports() {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
        limit: 50,
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

  const filtered = inspections.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const code = (item.inspectionCode || "").toLowerCase();
    const type = (item.type || "").toLowerCase();
    const status = (item.status || "").toLowerCase();
    return code.includes(q) || type.includes(q) || status.includes(q);
  });

  return (
    <AppShell>
      <div className="dashboard-body">
        <div className="page-intro">
          <div>
            <span className="section-kicker">DOCUMENT CENTRE</span>
            <h2>Inspection Reports</h2>
            <p>
              Review official inspection findings, compliance audits, and verified documentation issued for your institution.
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
              <h2>Available reports ({filtered.length})</h2>
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

          <div className="report-list">
            <div className="report-row report-header">
              <span>Report Code</span>
              <span>Inspection Type</span>
              <span>Date</span>
              <span>Status</span>
              <span></span>
            </div>

            {loading ? (
              <div className="report-empty">
                <RefreshCw size={26} className="spin" />
                <p style={{ marginTop: "8px" }}>Loading institution inspection reports…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="report-empty">
                <FileText size={28} />
                <h3>No reports available</h3>
                <p>
                  Inspection reports will appear here after an inspection has been conducted and submitted.
                </p>
              </div>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.id}
                  className="report-row report-row-item"
                  onClick={() => openReportDetail(item)}
                  type="button"
                >
                  <div>
                    <strong style={{ display: "block", color: "var(--ink)", fontSize: "0.88rem" }}>
                      {item.inspectionCode}
                    </strong>
                    <small style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                      {item.institution?.name || "My Facility"}
                    </small>
                  </div>

                  <div>
                    <span style={{ fontSize: "0.82rem", color: "var(--ink)" }}>
                      {item.type || "SCHEDULED"}
                    </span>
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
                      title="View Report Details"
                    >
                      <Eye size={16} />
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="info-strip">
          <ClipboardCheck size={19} />
          <div>
            <strong>Official Inspection Records</strong>
            <span>
              All field inspections include cryptographic SHA-256 evidence logs, GPS geofence stamps, and compliance evaluation notes.
            </span>
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
                  <span className="section-kicker">INSTITUTION INSPECTION REPORT</span>
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
                    <p style={{ marginTop: "10px" }}>Loading report details…</p>
                  </div>
                ) : (
                  <>
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
                          {selectedReport.institution?.name || "Facility"}
                        </strong>
                        <small style={{ color: "var(--muted)" }}>
                          {[selectedReport.institution?.district, selectedReport.institution?.state].filter(Boolean).join(", ")}
                        </small>
                      </div>

                      <div>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Status</span>
                        <div style={{ marginTop: "4px" }}>
                          <span className={`status-chip status-${String(selectedReport.status || "").toLowerCase()}`}>
                            {String(selectedReport.status || "").replaceAll("_", " ")}
                          </span>
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Risk Score</span>
                        <strong style={{ display: "block", fontSize: "1.1rem", color: "var(--blue)" }}>
                          {selectedReport.institution?.latestRiskScore != null
                            ? `${Number(selectedReport.institution.latestRiskScore).toFixed(0)} / 100`
                            : selectedReport.overallScore != null
                            ? `${Number(selectedReport.overallScore).toFixed(0)} / 100`
                            : "0 / 100"}
                        </strong>
                      </div>

                      <div>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Risk Rating</span>
                        <div style={{ marginTop: "4px" }}>
                          <RiskBadge level={selectedReport.institution?.latestRiskLevel || selectedReport.riskLevelAtInspection || "LOW"} />
                        </div>
                      </div>
                    </div>

                    {/* Evidence Section */}
                    <div style={{ marginTop: "16px" }}>
                      <h4 style={{ fontSize: "0.95rem", marginBottom: "12px", color: "var(--ink)" }}>
                        Inspection Evidence ({reportEvidence.length})
                      </h4>

                      {reportEvidence.length === 0 ? (
                        <div style={{ padding: "20px", textAlign: "center", background: "var(--bg)", borderRadius: "8px", color: "var(--muted)" }}>
                          <FileImage size={26} />
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
                <button className="secondary-button" onClick={() => window.print()}>
                  <Printer size={15} />
                  Print Report
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