import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardCheck,
  Clock3,
  Search,
  CheckCircle2,
  XCircle,
  PlayCircle,
  Eye,
  RefreshCw,
  MapPin,
  Building2,
  Calendar,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import AppShell from "../../components/AppShell";
import {
  getMyInspections,
  getInspectionById,
  acceptAssignment,
  rejectAssignment,
  startInspection,
  completeInspection,
} from "../../services/inspection.service";
import { apiError } from "../../services/api";

export default function InspectorInspections() {
  const navigate = useNavigate();
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState(null);

  // Detail Modal State
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Decline Modal State
  const [declineTarget, setDeclineTarget] = useState(null);
  const [declineReason, setDeclineReason] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const params = {
        page: 1,
        limit: 100,
        sortBy: "scheduledDate",
        sortOrder: "desc",
      };
      if (statusFilter !== "ALL") {
        params.status = statusFilter;
      }
      const data = await getMyInspections(params);
      setInspections(data.inspections || []);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  async function handleAccept(id) {
    setWorkingId(id);
    setNotice("");
    setError("");
    try {
      await acceptAssignment(id);
      setNotice("Inspection assignment accepted successfully.");
      await loadData();
      if (selectedInspection?.id === id) {
        openDetail(id);
      }
    } catch (err) {
      setError(apiError(err));
    } finally {
      setWorkingId(null);
    }
  }

  async function handleDecline() {
    if (!declineTarget) return;
    if (!declineReason.trim()) {
      setError("Please provide a reason for declining the assignment.");
      return;
    }
    setWorkingId(declineTarget.id);
    setNotice("");
    setError("");
    try {
      await rejectAssignment(declineTarget.id, declineReason.trim());
      setNotice("Inspection assignment declined and returned to planning pool.");
      setDeclineTarget(null);
      setDeclineReason("");
      setSelectedInspection(null);
      await loadData();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setWorkingId(null);
    }
  }

  async function handleStart(id) {
    setWorkingId(id);
    setNotice("");
    setError("");
    try {
      await startInspection(id);
      setNotice("Inspection started! Switched status to In Progress.");
      await loadData();
      navigate("/inspector");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setWorkingId(null);
    }
  }

  async function openDetail(id) {
    setDetailLoading(true);
    try {
      const detail = await getInspectionById(id);
      setSelectedInspection(detail);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setDetailLoading(false);
    }
  }

  const filtered = inspections.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const code = (item.inspectionCode || "").toLowerCase();
    const instName = (item.institution?.name || "").toLowerCase();
    const instCode = (item.institution?.code || "").toLowerCase();
    const district = (item.institution?.district || "").toLowerCase();
    return (
      code.includes(q) ||
      instName.includes(q) ||
      instCode.includes(q) ||
      district.includes(q)
    );
  });

  return (
    <AppShell>
      <div className="dashboard-body">
        <div className="page-intro">
          <div>
            <span className="section-kicker">ASSIGNMENT CONTROL</span>
            <h2>Assigned Inspections</h2>
            <p>
              Review inspections assigned to you, accept field duties, and manage the field inspection lifecycle.
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

        <section className="section-card">
          <div className="section-head">
            <div>
              <span className="section-kicker">INSPECTION QUEUE</span>
              <h2>Your assignments ({filtered.length})</h2>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div className="table-search">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search inspections..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <button
                className="icon-button"
                onClick={loadData}
                title="Refresh assignments"
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? "spin" : ""} />
              </button>
            </div>
          </div>

          {/* Status Tabs */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            {["ALL", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "COMPLETED"].map((tab) => (
              <button
                key={tab}
                className={statusFilter === tab ? "primary-button" : "ghost-button"}
                style={{ height: "36px", padding: "0 14px", fontSize: "0.82rem" }}
                onClick={() => setStatusFilter(tab)}
              >
                {tab.replaceAll("_", " ")}
              </button>
            ))}
          </div>

          <div className="assigned-inspections-page">
            <div className="assigned-page-header">
              <span>Institute</span>
              <span>Location</span>
              <span>Schedule</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            {loading ? (
              <div className="assigned-page-empty">
                <RefreshCw size={26} className="spin" />
                <h3>Loading assignments…</h3>
                <p>Retrieving your field inspection queue from the server.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="assigned-page-empty">
                <ClipboardCheck size={30} />
                <h3>No inspections found</h3>
                <p>
                  {statusFilter === "ALL"
                    ? "New inspection assignments will appear here when they are issued to you."
                    : `No inspections found with status: ${statusFilter}.`}
                </p>
              </div>
            ) : (
              filtered.map((item) => {
                const isWorking = workingId === item.id;
                const canAccept = item.status === "ASSIGNED";
                const canStart = item.status === "ACCEPTED" || item.status === "ASSIGNED";
                const isInProgress = item.status === "IN_PROGRESS";

                return (
                  <div
                    key={item.id}
                    className="assigned-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1fr 1fr 0.8fr 1.2fr",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 14px",
                      borderBottom: "1px solid var(--line)",
                    }}
                  >
                    <div>
                      <strong>{item.institution?.name || "Target Institution"}</strong>
                      <small style={{ display: "block", color: "var(--muted)", fontSize: "0.75rem" }}>
                        {item.inspectionCode} • {item.type}
                      </small>
                    </div>

                    <div>
                      <span style={{ fontSize: "0.85rem", color: "var(--ink)" }}>
                        {formatLocation(item)}
                      </span>
                    </div>

                    <div>
                      <strong style={{ fontSize: "0.85rem" }}>
                        {formatDate(item.scheduledDate)}
                      </strong>
                      <small style={{ display: "block", color: "var(--muted)", fontSize: "0.75rem" }}>
                        {formatTime(item.scheduledDate)}
                      </small>
                    </div>

                    <div>
                      <span className={`status-chip status-${String(item.status || "").toLowerCase()}`}>
                        {formatInspectionStatus(item.status)}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      {canAccept && (
                        <>
                          <button
                            className="small-action"
                            onClick={() => handleAccept(item.id)}
                            disabled={isWorking}
                            title="Accept duty"
                          >
                            Accept
                          </button>
                          <button
                            className="small-action danger-mini"
                            onClick={() => {
                              setDeclineTarget(item);
                              setDeclineReason("");
                            }}
                            disabled={isWorking}
                            title="Decline duty"
                          >
                            Decline
                          </button>
                        </>
                      )}

                      {canStart && (
                        <button
                          className="small-action primary-mini"
                          onClick={() => handleStart(item.id)}
                          disabled={isWorking}
                          title="Start field audit"
                        >
                          <PlayCircle size={13} />
                          Start
                        </button>
                      )}

                      {isInProgress && (
                        <button
                          className="small-action primary-mini"
                          onClick={() => navigate("/inspector")}
                          title="Open Console"
                        >
                          Console
                        </button>
                      )}

                      <button
                        className="small-action"
                        onClick={() => openDetail(item.id)}
                        title="View inspection details"
                      >
                        <Eye size={13} />
                        Details
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="info-strip">
          <Clock3 size={19} />
          <div>
            <strong>Inspection lifecycle</strong>
            <span>
              Assigned inspections progress sequentially through Acceptance $\rightarrow$ GPS Geofence Verification $\rightarrow$ Field Evidence Capture $\rightarrow$ Report Submission.
            </span>
          </div>
        </section>

        {/* Inspection Details Modal */}
        {selectedInspection && (
          <div className="modal-backdrop">
            <div className="modal-card" style={{ maxWidth: "650px", width: "95%" }}>
              <div className="modal-header">
                <div>
                  <span className="section-kicker">INSPECTION AUDIT PROFILE</span>
                  <h2>{selectedInspection.inspectionCode}</h2>
                </div>
                <button
                  className="icon-button"
                  onClick={() => setSelectedInspection(null)}
                >
                  <XCircle size={18} />
                </button>
              </div>

              <div className="modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Status</label>
                    <div>
                      <span className={`status-chip status-${String(selectedInspection.status || "").toLowerCase()}`}>
                        {formatInspectionStatus(selectedInspection.status)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Inspection Type</label>
                    <div style={{ fontWeight: 600 }}>{selectedInspection.type}</div>
                  </div>

                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Scheduled Date</label>
                    <div style={{ fontWeight: 600 }}>{formatDate(selectedInspection.scheduledDate)} {formatTime(selectedInspection.scheduledDate)}</div>
                  </div>

                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>GPS Geofence Status</label>
                    <div style={{ fontWeight: 600, color: selectedInspection.isGeofenceVerified ? "var(--success)" : "var(--muted)" }}>
                      {selectedInspection.isGeofenceVerified ? "Verified Inside Geofence" : "Pending Field Check-In"}
                    </div>
                  </div>
                </div>

                {/* Facility Details */}
                <div style={{ background: "var(--bg)", padding: "14px", borderRadius: "8px", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <Building2 size={16} color="var(--navy)" />
                    <strong style={{ fontSize: "0.95rem" }}>{selectedInspection.institution?.name}</strong>
                  </div>

                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                    Code: <b>{selectedInspection.institution?.code}</b> • Type: <b>{selectedInspection.institution?.type}</b>
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
                    Address: {selectedInspection.institution?.address || "—"}, {selectedInspection.institution?.district}, {selectedInspection.institution?.state}
                  </p>
                  {selectedInspection.institution?.latitude && (
                    <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
                      GPS Center: {selectedInspection.institution.latitude}, {selectedInspection.institution.longitude} (Radius: {selectedInspection.institution.geofenceRadiusMeters || 150}m)
                    </p>
                  )}
                </div>

                {selectedInspection.remarks && (
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Assignment Remarks</label>
                    <p style={{ fontSize: "0.85rem", margin: "4px 0" }}>{selectedInspection.remarks}</p>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  {selectedInspection.status === "ASSIGNED" && (
                    <button
                      className="small-action danger-mini"
                      onClick={() => {
                        setDeclineTarget(selectedInspection);
                        setDeclineReason("");
                      }}
                      disabled={workingId === selectedInspection.id}
                    >
                      Decline Assignment
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="ghost-button"
                    onClick={() => setSelectedInspection(null)}
                  >
                    Close
                  </button>

                  {selectedInspection.status === "ASSIGNED" && (
                    <button
                      className="primary-button"
                      style={{ height: "38px", padding: "0 16px" }}
                      onClick={() => handleAccept(selectedInspection.id)}
                      disabled={workingId === selectedInspection.id}
                    >
                      Accept Assignment
                    </button>
                  )}

                  {(selectedInspection.status === "ACCEPTED" || selectedInspection.status === "ASSIGNED") && (
                    <button
                      className="primary-button"
                      style={{ height: "38px", padding: "0 16px" }}
                      onClick={() => handleStart(selectedInspection.id)}
                      disabled={workingId === selectedInspection.id}
                    >
                      <PlayCircle size={15} />
                      Start Audit
                    </button>
                  )}

                  {selectedInspection.status === "IN_PROGRESS" && (
                    <button
                      className="primary-button"
                      style={{ height: "38px", padding: "0 16px" }}
                      onClick={() => navigate("/inspector")}
                    >
                      Open Execution Console
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Decline Assignment Reason Modal */}
        {declineTarget && (
          <div className="modal-backdrop">
            <div className="modal-card">
              <div className="modal-header">
                <div>
                  <span className="section-kicker">ASSIGNMENT REFUSAL</span>
                  <h2>Decline Field Assignment</h2>
                </div>
                <button
                  className="icon-button"
                  onClick={() => setDeclineTarget(null)}
                >
                  <XCircle size={18} />
                </button>
              </div>

              <div className="modal-body">
                <p>
                  Declining <b>{declineTarget.inspectionCode}</b> ({declineTarget.institution?.name}).
                  Please provide a clear justification. This audit will be returned to the dispatch queue.
                </p>

                <div className="form-group" style={{ marginTop: "12px" }}>
                  <label style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: "6px" }}>
                    Decline Reason *
                  </label>
                  <textarea
                    rows={3}
                    className="form-input"
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--line)" }}
                    placeholder="e.g. Schedule conflict with prior official duty, vehicle breakdown, regional roadblock..."
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="ghost-button"
                  onClick={() => setDeclineTarget(null)}
                  disabled={workingId === declineTarget.id}
                >
                  Cancel
                </button>
                <button
                  className="primary-button danger"
                  onClick={handleDecline}
                  disabled={workingId === declineTarget.id || !declineReason.trim()}
                >
                  Confirm Decline
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
  if (!value) return "Date not set";
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

function formatLocation(inspection) {
  const institution = inspection?.institution;
  if (!institution) return "—";
  const parts = [institution.district, institution.state].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

function formatInspectionStatus(value = "") {
  if (!value) return "Unknown";
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}