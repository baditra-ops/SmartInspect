import { useEffect, useState } from "react";
import {
  Building2,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Plus,
  Zap,
  Eye,
  UserPlus,
  RefreshCcw,
  XCircle,
  X,
  MapPin,
  Clock,
  ShieldAlert,
  User,
  ChevronLeft,
  ChevronRight,
  Send,
  FileCheck2,
  Compass,
} from "lucide-react";
import AppShell from "../../components/AppShell";
import RiskBadge from "../../components/RiskBadge";
import { useAuth } from "../../context/AuthContext";
import { apiError } from "../../services/api";
import { getInstitutions } from "../../services/institution.service";
import {
  getInspections,
  getInspectionById,
  createInspection,
  getEligibleInspectors,
  assignInspector,
  reassignInspector,
  getInspectionAssignments,
  jitDispatch,
  batchJitDispatch,
  cancelInspection,
} from "../../services/inspection.service";

const INSPECTION_TYPES = [
  { value: "SCHEDULED", label: "Scheduled Audit" },
  { value: "SURPRISE", label: "Surprise Inspection" },
  { value: "FOLLOW_UP", label: "Follow-Up Audit" },
  { value: "COMPLAINT_DRIVEN", label: "Complaint Driven" },
];

const INSPECTION_STATUSES = [
  { value: "PLANNED", label: "Planned / Unassigned" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "ACCEPTED", label: "Accepted by Inspector" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REPORT_SUBMITTED", label: "Report Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function AdminInspections() {
  const { user } = useAuth();
  const canManage = ["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"].includes(user?.role);

  // Inspections List State
  const [inspections, setInspections] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Filter States
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // Details Modal State
  const [selectedInspId, setSelectedInspId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState("overview"); // overview, inspector, history
  const [assignments, setAssignments] = useState([]);

  // Schedule Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [institutionsList, setInstitutionsList] = useState([]);
  const [scheduleForm, setScheduleForm] = useState({
    institutionId: "",
    type: "SCHEDULED",
    scheduledDate: new Date().toISOString().split("T")[0],
    remarks: "",
  });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState("");

  // Assign / Reassign Modal State
  const [assignModalData, setAssignModalData] = useState(null); // { inspection, isReassign: boolean }
  const [eligibleInspectors, setEligibleInspectors] = useState([]);
  const [selectedInspectorId, setSelectedInspectorId] = useState("");
  const [inspectorsLoading, setInspectorsLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState("");

  // JIT & Cancel Action States
  const [actionBusyId, setActionBusyId] = useState(null);
  const [cancelingInsp, setCancelingInsp] = useState(null);
  const [cancelingSaving, setCancelingSaving] = useState(false);

  // Load Inspections List
  async function load(page = pagination.page) {
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        limit: pagination.limit,
        sortBy: "scheduledDate",
        sortOrder: "desc",
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;

      const res = await getInspections(params);
      setInspections(res.inspections);
      setPagination(res.pagination);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
  }, [statusFilter, typeFilter]);

  // Load Institutions for Create Modal
  async function loadInstitutionsForSchedule() {
    try {
      const res = await getInstitutions({ page: 1, limit: 100 });
      setInstitutionsList(res.institutions);
      if (res.institutions.length > 0 && !scheduleForm.institutionId) {
        setScheduleForm((prev) => ({ ...prev, institutionId: res.institutions[0].id }));
      }
    } catch (err) {
      console.error("Failed to load institutions list:", err);
    }
  }

  // Open Inspection Details
  async function openDetails(inspId) {
    setSelectedInspId(inspId);
    setDetailLoading(true);
    setDetailTab("overview");
    try {
      const [insp, assignList] = await Promise.all([
        getInspectionById(inspId),
        getInspectionAssignments(inspId).catch(() => []),
      ]);
      setDetailData(insp);
      setAssignments(assignList);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetails() {
    setSelectedInspId(null);
    setDetailData(null);
  }

  // Open Schedule Modal
  function handleOpenSchedule() {
    loadInstitutionsForSchedule();
    setScheduleForm({
      institutionId: institutionsList[0]?.id || "",
      type: "SCHEDULED",
      scheduledDate: new Date().toISOString().split("T")[0],
      remarks: "",
    });
    setScheduleError("");
    setShowScheduleModal(true);
  }

  // Submit Schedule Inspection
  async function handleScheduleSubmit(e) {
    e.preventDefault();
    setScheduleSaving(true);
    setScheduleError("");
    try {
      const created = await createInspection(scheduleForm);
      setNotice(`Inspection "${created.inspectionCode}" scheduled successfully.`);
      setShowScheduleModal(false);
      await load(1);
    } catch (err) {
      setScheduleError(apiError(err));
    } finally {
      setScheduleSaving(false);
    }
  }

  // Open Assign / Reassign Modal
  async function handleOpenAssign(insp, isReassign = false) {
    setAssignModalData({ inspection: insp, isReassign });
    setSelectedInspectorId("");
    setAssignError("");
    setInspectorsLoading(true);
    try {
      const list = await getEligibleInspectors({ institutionId: insp.institutionId });
      setEligibleInspectors(list);
      if (list.length > 0) {
        setSelectedInspectorId(list[0].id);
      }
    } catch (err) {
      setAssignError(apiError(err));
    } finally {
      setInspectorsLoading(false);
    }
  }

  // Submit Inspector Assignment
  async function handleAssignSubmit(e) {
    e.preventDefault();
    if (!selectedInspectorId) return;
    setAssignSaving(true);
    setAssignError("");
    try {
      const { inspection, isReassign } = assignModalData;
      if (isReassign) {
        await reassignInspector(inspection.id, { inspectorId: selectedInspectorId });
        setNotice(`Inspection ${inspection.inspectionCode} reassigned successfully.`);
      } else {
        await assignInspector(inspection.id, { inspectorId: selectedInspectorId });
        setNotice(`Inspector assigned to ${inspection.inspectionCode} successfully.`);
      }
      setAssignModalData(null);
      await load();
      if (selectedInspId === inspection.id) {
        await openDetails(selectedInspId);
      }
    } catch (err) {
      setAssignError(apiError(err));
    } finally {
      setAssignSaving(false);
    }
  }

  // One-Click JIT Dispatch
  async function handleJitDispatch(inspId) {
    setActionBusyId(inspId);
    setError("");
    try {
      const res = await jitDispatch(inspId);
      setNotice(res.message || "Inspection successfully dispatched via Automated JIT Engine.");
      await load();
      if (selectedInspId === inspId) {
        await openDetails(selectedInspId);
      }
    } catch (err) {
      setError(apiError(err));
    } finally {
      setActionBusyId(null);
    }
  }

  // Batch JIT Dispatch for all pending planned inspections
  async function handleBatchJitDispatch() {
    setActionBusyId("batch");
    setError("");
    try {
      const res = await batchJitDispatch({});
      setNotice(
        `Batch JIT completed: ${res.dispatchedCount || 0} inspections dispatched, ${res.failedCount || 0} skipped.`
      );
      await load(1);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setActionBusyId(null);
    }
  }

  // Cancel Inspection
  async function handleConfirmCancel() {
    if (!cancelingInsp) return;
    setCancelingSaving(true);
    try {
      await cancelInspection(cancelingInsp.id);
      setNotice(`Inspection "${cancelingInsp.inspectionCode}" has been cancelled.`);
      setCancelingInsp(null);
      if (selectedInspId === cancelingInsp.id) {
        closeDetails();
      }
      await load();
    } catch (err) {
      setError(apiError(err));
      setCancelingInsp(null);
    } finally {
      setCancelingSaving(false);
    }
  }

  const formatStatus = (val = "") => val.replace(/_/g, " ");
  const formatType = (val = "") => {
    const match = INSPECTION_TYPES.find((t) => t.value === val);
    return match ? match.label : val.replace(/_/g, " ");
  };

  return (
    <AppShell>
      <div className="dashboard-body">
        {/* Page Intro */}
        <div className="page-intro" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span className="section-kicker">AUDIT & STATUTORY OVERSIGHT</span>
            <h2>Inspections</h2>
            <p>
              Monitor statutory audits, dispatch field inspectors, track assignments, and view verified records across your jurisdiction.
            </p>
          </div>

          {canManage && (
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                className="secondary-button"
                style={{ height: "42px", padding: "0 14px", fontSize: "12px", cursor: "pointer" }}
                onClick={handleBatchJitDispatch}
                disabled={actionBusyId === "batch"}
                title="Automatically dispatch all planned inspections"
              >
                <Zap size={15} style={{ color: "#d97706" }} />
                {actionBusyId === "batch" ? "Dispatching..." : "Batch JIT Dispatch"}
              </button>
              <button
                className="primary-button"
                style={{ height: "42px", padding: "0 18px", fontSize: "13px", cursor: "pointer" }}
                onClick={handleOpenSchedule}
              >
                <Plus size={16} /> Schedule Inspection
              </button>
            </div>
          )}
        </div>

        {notice && (
          <div className="notice" style={{ marginBottom: "18px" }}>
            <CheckCircle2 size={17} />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="error-box" style={{ marginBottom: "18px" }}>
            <AlertCircle size={17} />
            <span>{error}</span>
          </div>
        )}

        {/* Inspections Table Card */}
        <section className="section-card">
          <div className="section-head" style={{ flexWrap: "wrap", gap: "12px" }}>
            <div>
              <span className="section-kicker">AUDIT TRAIL & LOGS</span>
              <h2>Inspection Registry ({pagination.total})</h2>
            </div>

            {/* Toolbar: Search, Filters & Refresh */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  load(1);
                }}
                className="table-search"
                style={{ width: "240px" }}
              >
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search code, institution..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </form>

              <select
                className="small-action"
                style={{ height: "36px", padding: "0 10px", cursor: "pointer" }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                {INSPECTION_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              <select
                className="small-action"
                style={{ height: "36px", padding: "0 10px", cursor: "pointer" }}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">All Types</option>
                {INSPECTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>

              <button
                className="icon-button"
                onClick={() => load()}
                title="Refresh List"
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Table Area */}
          {loading ? (
            <div className="empty-state large">
              <RefreshCw size={24} className="animate-spin" style={{ color: "var(--blue)" }} />
              <h3>Loading inspection records…</h3>
              <p>Fetching scheduled audits and JIT assignment status from database.</p>
            </div>
          ) : inspections.length === 0 ? (
            <div className="admin-page-empty">
              <CalendarCheck size={36} style={{ color: "var(--muted)" }} />
              <h3>No inspection records match your query</h3>
              <p>Schedule a new inspection or adjust your filter parameters.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Inspection Code</th>
                    <th>Target Institution</th>
                    <th>Audit Type</th>
                    <th>Scheduled Date</th>
                    <th>Assigned Inspector</th>
                    <th>Lifecycle Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inspections.map((item) => {
                    const isPlanned = item.status === "PLANNED";
                    const isAssigned = ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"].includes(item.status);
                    const isActionable = !["COMPLETED", "CANCELLED", "REPORT_SUBMITTED", "APPROVED"].includes(
                      item.status
                    );

                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.inspectionCode}</strong>
                          <small>Created: {new Date(item.createdAt).toLocaleDateString("en-IN")}</small>
                        </td>
                        <td>
                          <strong>{item.institution?.name || "Target Institution"}</strong>
                          <small>
                            {item.institution?.district || "—"}, {item.institution?.state || "—"}
                          </small>
                        </td>
                        <td>
                          <span style={{ fontSize: "11px", fontWeight: 600 }}>
                            {formatType(item.type)}
                          </span>
                        </td>
                        <td>
                          <strong>
                            {item.scheduledDate
                              ? new Date(item.scheduledDate).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "Date not set"}
                          </strong>
                        </td>
                        <td>
                          {item.currentInspector ? (
                            <div>
                              <strong>{item.currentInspector.fullName}</strong>
                              <small>{item.currentInspector.inspectorProfile?.badgeNumber || "Inspector"}</small>
                            </div>
                          ) : (
                            <span style={{ color: "var(--muted)", fontStyle: "italic", fontSize: "11px" }}>
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`status-chip status-${String(item.status || "").toLowerCase()}`}>
                            {formatStatus(item.status)}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "6px" }}>
                            <button
                              className="small-action"
                              onClick={() => openDetails(item.id)}
                              title="View Full Details"
                            >
                              <Eye size={13} /> View
                            </button>

                            {canManage && isPlanned && (
                              <>
                                <button
                                  className="small-action"
                                  onClick={() => handleOpenAssign(item, false)}
                                  title="Manually Assign Inspector"
                                >
                                  <UserPlus size={13} />
                                </button>
                                <button
                                  className="small-action"
                                  style={{ color: "#b45309", borderColor: "#fde68a" }}
                                  onClick={() => handleJitDispatch(item.id)}
                                  disabled={actionBusyId === item.id}
                                  title="Auto-Assign via JIT Engine"
                                >
                                  <Zap size={13} /> {actionBusyId === item.id ? "…" : "JIT"}
                                </button>
                              </>
                            )}

                            {canManage && isAssigned && (
                              <button
                                className="small-action"
                                onClick={() => handleOpenAssign(item, true)}
                                title="Reassign to Another Inspector"
                              >
                                <RefreshCcw size={13} />
                              </button>
                            )}

                            {canManage && isActionable && (
                              <button
                                className="small-action"
                                style={{ color: "var(--danger)" }}
                                onClick={() => setCancelingInsp(item)}
                                title="Cancel Inspection"
                              >
                                <XCircle size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination Bar */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "16px",
                  paddingTop: "14px",
                  borderTop: "1px solid var(--line)",
                  fontSize: "12px",
                  color: "var(--muted)",
                }}
              >
                <div>
                  Showing {inspections.length} of {pagination.total} inspections (Page {pagination.page} of {pagination.totalPages})
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    className="small-action"
                    disabled={pagination.page <= 1 || loading}
                    onClick={() => load(pagination.page - 1)}
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <button
                    className="small-action"
                    disabled={pagination.page >= pagination.totalPages || loading}
                    onClick={() => load(pagination.page + 1)}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* =========================================================================
            INSPECTION DETAIL MODAL / DRAWER
           ========================================================================= */}
        {selectedInspId && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(17, 45, 70, 0.45)",
              backdropFilter: "blur(4px)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
              padding: "20px",
            }}
          >
            <div
              style={{
                background: "var(--surface)",
                borderRadius: "14px",
                width: "min(920px, 100%)",
                maxHeight: "90vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
                overflow: "hidden",
                border: "1px solid var(--line)",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "18px 24px",
                  borderBottom: "1px solid var(--line)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#f8fafc",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <h2 style={{ margin: 0, fontSize: "18px", color: "var(--ink)" }}>
                      {detailData?.inspectionCode || "Inspection Details"}
                    </h2>
                    {detailData && (
                      <span className={`status-chip status-${String(detailData.status || "").toLowerCase()}`}>
                        {formatStatus(detailData.status)}
                      </span>
                    )}
                  </div>
                  <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                    {formatType(detailData?.type)} · Target: {detailData?.institution?.name}
                  </small>
                </div>
                <button className="icon-button" onClick={closeDetails} title="Close Dialog">
                  <X size={18} />
                </button>
              </div>

              {/* Tabs */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  padding: "10px 24px",
                  borderBottom: "1px solid var(--line)",
                  background: "var(--surface)",
                }}
              >
                {[
                  { id: "overview", label: "Overview", icon: Building2 },
                  { id: "inspector", label: "Inspector & Geofence", icon: User },
                  { id: "history", label: `Assignment History (${assignments.length})`, icon: Clock },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = detailTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setDetailTab(tab.id)}
                      className="small-action"
                      style={{
                        background: isActive ? "var(--navy)" : "transparent",
                        color: isActive ? "white" : "var(--muted)",
                        borderColor: isActive ? "var(--navy)" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <Icon size={14} /> {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Body */}
              <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
                {detailLoading ? (
                  <div className="empty-state">
                    <RefreshCw size={24} className="animate-spin" style={{ color: "var(--blue)" }} />
                    <h3>Loading inspection details…</h3>
                  </div>
                ) : detailData ? (
                  <>
                    {/* TAB: OVERVIEW */}
                    {detailTab === "overview" && (
                      <div style={{ display: "grid", gap: "18px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
                          <div className="mini-info-card">
                            <span>Scheduled Date</span>
                            <strong>
                              {detailData.scheduledDate
                                ? new Date(detailData.scheduledDate).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "N/A"}
                            </strong>
                            <small>Audit Type: {formatType(detailData.type)}</small>
                          </div>

                          <div className="mini-info-card">
                            <span>Institution Risk</span>
                            <div style={{ marginTop: "6px" }}>
                              <RiskBadge
                                level={detailData.institution?.latestRiskLevel || "LOW"}
                                score={detailData.institution?.latestRiskScore ?? 0}
                              />
                            </div>
                            <small style={{ marginTop: "4px" }}>Computed at assignment</small>
                          </div>

                          <div className="mini-info-card">
                            <span>GPS Geofence Status</span>
                            <strong>{detailData.isGeofenceVerified ? "Verified" : "Pending Presence"}</strong>
                            <small>{detailData.startedAt ? "Audit Started" : "Not yet checked-in"}</small>
                          </div>
                        </div>

                        {/* Facility Details */}
                        <div className="section-card" style={{ padding: "16px", marginBottom: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                            <Building2 size={16} style={{ color: "var(--blue)" }} />
                            <strong style={{ fontSize: "13px" }}>Target Institution Profile</strong>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "12px" }}>
                            <div>
                              <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>Name:</span>
                              <strong>{detailData.institution?.name}</strong>
                            </div>
                            <div>
                              <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>Facility Code:</span>
                              <strong>{detailData.institution?.code}</strong>
                            </div>
                            <div>
                              <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>Location:</span>
                              <strong>
                                {detailData.institution?.district}, {detailData.institution?.state}
                              </strong>
                            </div>
                            <div>
                              <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>Address:</span>
                              <strong>{detailData.institution?.address || "—"}</strong>
                            </div>
                          </div>
                        </div>

                        {/* Audit Remarks */}
                        <div className="section-card" style={{ padding: "16px", marginBottom: 0 }}>
                          <strong style={{ fontSize: "13px", display: "block", marginBottom: "6px" }}>
                            Statutory Remarks & Directives
                          </strong>
                          <p style={{ margin: 0, fontSize: "12px", color: "var(--ink)", lineHeight: 1.5 }}>
                            {detailData.remarks || "Standard statutory compliance inspection directive issued."}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* TAB: INSPECTOR & GPS */}
                    {detailTab === "inspector" && (
                      <div style={{ display: "grid", gap: "18px" }}>
                        {detailData.currentInspector ? (
                          <div className="section-card" style={{ padding: "16px", marginBottom: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                              <div className="avatar" style={{ width: "42px", height: "42px", fontSize: "16px" }}>
                                {detailData.currentInspector.fullName.charAt(0)}
                              </div>
                              <div>
                                <h3 style={{ margin: 0, fontSize: "15px", color: "var(--ink)" }}>
                                  {detailData.currentInspector.fullName}
                                </h3>
                                <small style={{ color: "var(--muted)" }}>
                                  {detailData.currentInspector.inspectorProfile?.designation || "Field Inspector"} · Badge:{" "}
                                  {detailData.currentInspector.inspectorProfile?.badgeNumber || "N/A"}
                                </small>
                              </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", fontSize: "12px" }}>
                              <div>
                                <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>Email:</span>
                                <strong>{detailData.currentInspector.email}</strong>
                              </div>
                              <div>
                                <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>Phone:</span>
                                <strong>{detailData.currentInspector.phone || "—"}</strong>
                              </div>
                              <div>
                                <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>
                                  Assigned District:
                                </span>
                                <strong>
                                  {detailData.currentInspector.inspectorProfile?.assignedDistrict ||
                                    detailData.currentInspector.district ||
                                    "—"}
                                </strong>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="admin-page-empty" style={{ minHeight: "150px" }}>
                            <User size={32} />
                            <h3>No Inspector Currently Assigned</h3>
                            <p>Use manual assignment or automated JIT dispatch to assign a field auditor.</p>
                          </div>
                        )}

                        {/* Geofence & Check-in Details */}
                        <div className="section-card" style={{ padding: "16px", marginBottom: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                            <Compass size={16} style={{ color: "var(--blue)" }} />
                            <strong style={{ fontSize: "13px" }}>Geofence Check-in Verification</strong>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "12px" }}>
                            <div>
                              <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>
                                Geofence Verification Status:
                              </span>
                              <strong>
                                {detailData.isGeofenceVerified
                                  ? "✓ Geo-presence Authenticated"
                                  : "Awaiting physical presence at facility"}
                              </strong>
                            </div>
                            <div>
                              <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>
                                Check-in / Start Timestamp:
                              </span>
                              <strong>
                                {detailData.startedAt ? new Date(detailData.startedAt).toLocaleString("en-IN") : "Not started"}
                              </strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB: ASSIGNMENT HISTORY */}
                    {detailTab === "history" && (
                      <div>
                        {assignments.length === 0 ? (
                          <div className="admin-page-empty" style={{ minHeight: "150px" }}>
                            <Clock size={32} />
                            <h3>No Assignment History</h3>
                            <p>Assignments created manually or by the JIT dispatch engine will be recorded here.</p>
                          </div>
                        ) : (
                          <table>
                            <thead>
                              <tr>
                                <th>Inspector</th>
                                <th>Dispatch Method</th>
                                <th>Assignment Status</th>
                                <th>Assigned At</th>
                                <th>Decline Reason / Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {assignments.map((a) => (
                                <tr key={a.id}>
                                  <td>
                                    <strong>{a.inspector?.fullName || "Field Inspector"}</strong>
                                    <small>{a.inspector?.email}</small>
                                  </td>
                                  <td>
                                    <span style={{ fontSize: "11px", fontWeight: 600 }}>
                                      {formatStatus(a.assignmentMethod || "MANUAL_DISPATCH")}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`status-chip status-${String(a.status || "").toLowerCase()}`}>
                                      {formatStatus(a.status)}
                                    </span>
                                  </td>
                                  <td>{new Date(a.assignedAt).toLocaleString("en-IN")}</td>
                                  <td>
                                    {a.declineReason ? (
                                      <span style={{ color: "var(--danger)", fontSize: "11px" }}>
                                        Declined: {a.declineReason}
                                      </span>
                                    ) : a.acceptedAt ? (
                                      <span style={{ color: "var(--success)", fontSize: "11px" }}>
                                        Accepted: {new Date(a.acceptedAt).toLocaleTimeString("en-IN")}
                                      </span>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </>
                ) : null}
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: "14px 24px",
                  borderTop: "1px solid var(--line)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#f8fafc",
                }}
              >
                <div style={{ display: "flex", gap: "8px" }}>
                  {canManage && detailData && !["COMPLETED", "CANCELLED"].includes(detailData.status) && (
                    <>
                      {detailData.status === "PLANNED" ? (
                        <>
                          <button
                            className="small-action"
                            onClick={() => handleOpenAssign(detailData, false)}
                          >
                            <UserPlus size={13} /> Assign Inspector
                          </button>
                          <button
                            className="small-action"
                            style={{ color: "#b45309", borderColor: "#fde68a" }}
                            onClick={() => handleJitDispatch(detailData.id)}
                            disabled={actionBusyId === detailData.id}
                          >
                            <Zap size={13} /> JIT Dispatch
                          </button>
                        </>
                      ) : (
                        <button
                          className="small-action"
                          onClick={() => handleOpenAssign(detailData, true)}
                        >
                          <RefreshCcw size={13} /> Reassign Inspector
                        </button>
                      )}

                      <button
                        className="small-action"
                        style={{ color: "var(--danger)" }}
                        onClick={() => setCancelingInsp(detailData)}
                      >
                        <XCircle size={13} /> Cancel Inspection
                      </button>
                    </>
                  )}
                </div>
                <button className="secondary-button" onClick={closeDetails}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SCHEDULE INSPECTION MODAL
           ========================================================================= */}
        {showScheduleModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(17, 45, 70, 0.45)",
              backdropFilter: "blur(4px)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1100,
              padding: "20px",
            }}
          >
            <div
              style={{
                background: "var(--surface)",
                borderRadius: "14px",
                width: "min(600px, 100%)",
                maxHeight: "90vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
                overflow: "hidden",
                border: "1px solid var(--line)",
              }}
            >
              <div
                style={{
                  padding: "16px 24px",
                  borderBottom: "1px solid var(--line)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#f8fafc",
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: "17px", color: "var(--ink)" }}>Schedule New Inspection</h2>
                  <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                    Create an audit directive for field dispatch
                  </small>
                </div>
                <button className="icon-button" onClick={() => setShowScheduleModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleScheduleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ padding: "24px", overflowY: "auto", flex: 1, display: "grid", gap: "16px" }}>
                  {scheduleError && (
                    <div className="error-box">
                      <AlertCircle size={16} />
                      <span>{scheduleError}</span>
                    </div>
                  )}

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                      Target Institution *
                    </label>
                    <select
                      className="input-wrap"
                      style={{ width: "100%", height: "42px", fontSize: "12px" }}
                      required
                      value={scheduleForm.institutionId}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, institutionId: e.target.value })}
                    >
                      {institutionsList.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          [{inst.code}] {inst.name} ({inst.district}, {inst.state})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                        Inspection Type *
                      </label>
                      <select
                        className="input-wrap"
                        style={{ width: "100%", height: "42px", fontSize: "12px" }}
                        value={scheduleForm.type}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, type: e.target.value })}
                      >
                        {INSPECTION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                        Scheduled Date *
                      </label>
                      <input
                        type="date"
                        className="input-wrap"
                        style={{ width: "100%", height: "42px", fontSize: "12px" }}
                        required
                        value={scheduleForm.scheduledDate}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledDate: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                      Directives / Remarks
                    </label>
                    <textarea
                      rows={3}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "1px solid var(--line)",
                        borderRadius: "10px",
                        fontFamily: "inherit",
                        fontSize: "12px",
                        outline: "none",
                      }}
                      placeholder="Special focus areas (e.g. food quality, CCTV functionality, attendance verification)..."
                      value={scheduleForm.remarks}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, remarks: e.target.value })}
                    />
                  </div>
                </div>

                <div
                  style={{
                    padding: "16px 24px",
                    borderTop: "1px solid var(--line)",
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                    background: "#f8fafc",
                  }}
                >
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setShowScheduleModal(false)}
                    disabled={scheduleSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    style={{ height: "42px", padding: "0 22px" }}
                    disabled={scheduleSaving}
                  >
                    {scheduleSaving ? "Scheduling…" : "Create & Schedule"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================================
            ASSIGN / REASSIGN INSPECTOR MODAL
           ========================================================================= */}
        {assignModalData && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(17, 45, 70, 0.45)",
              backdropFilter: "blur(4px)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1100,
              padding: "20px",
            }}
          >
            <div
              style={{
                background: "var(--surface)",
                borderRadius: "14px",
                width: "min(640px, 100%)",
                maxHeight: "90vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
                overflow: "hidden",
                border: "1px solid var(--line)",
              }}
            >
              <div
                style={{
                  padding: "16px 24px",
                  borderBottom: "1px solid var(--line)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#f8fafc",
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: "17px", color: "var(--ink)" }}>
                    {assignModalData.isReassign ? "Reassign Field Inspector" : "Assign Field Inspector"}
                  </h2>
                  <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                    Target: {assignModalData.inspection?.inspectionCode} · {assignModalData.inspection?.institution?.name}
                  </small>
                </div>
                <button className="icon-button" onClick={() => setAssignModalData(null)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAssignSubmit} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ padding: "24px", overflowY: "auto", flex: 1, display: "grid", gap: "16px" }}>
                  {assignError && (
                    <div className="error-box">
                      <AlertCircle size={16} />
                      <span>{assignError}</span>
                    </div>
                  )}

                  <div className="notice" style={{ margin: 0 }}>
                    <ShieldAlert size={16} />
                    <span>
                      Eligible inspectors are dynamically filtered based on jurisdiction boundary and anti-collusion rotation algorithms.
                    </span>
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "8px" }}>
                      Select Available Field Auditor *
                    </label>

                    {inspectorsLoading ? (
                      <div className="empty-state" style={{ minHeight: "120px" }}>
                        <RefreshCw size={20} className="animate-spin" style={{ color: "var(--blue)" }} />
                        <small>Querying eligible inspectors in jurisdiction…</small>
                      </div>
                    ) : eligibleInspectors.length === 0 ? (
                      <div className="error-box">
                        <span>No eligible inspectors found matching current anti-collusion constraints.</span>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: "8px" }}>
                        {eligibleInspectors.map((insp) => {
                          const isSelected = selectedInspectorId === insp.id;
                          return (
                            <div
                              key={insp.id}
                              onClick={() => setSelectedInspectorId(insp.id)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "12px 14px",
                                border: `1px solid ${isSelected ? "var(--blue)" : "var(--line)"}`,
                                borderRadius: "10px",
                                background: isSelected ? "#f0f7ff" : "var(--surface)",
                                cursor: "pointer",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div className="avatar" style={{ width: "36px", height: "36px", fontSize: "14px" }}>
                                  {insp.fullName.charAt(0)}
                                </div>
                                <div>
                                  <strong style={{ fontSize: "13px", color: "var(--ink)" }}>{insp.fullName}</strong>
                                  <small style={{ color: "var(--muted)", display: "block" }}>
                                    {insp.profile?.badgeNumber || "INSP"} · {insp.district}, {insp.state}
                                  </small>
                                </div>
                              </div>

                              <div style={{ textAlign: "right" }}>
                                <span className="status-chip status-accepted" style={{ fontSize: "10px" }}>
                                  {insp.activeInspectionsCount || 0} Active Audits
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    padding: "16px 24px",
                    borderTop: "1px solid var(--line)",
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                    background: "#f8fafc",
                  }}
                >
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setAssignModalData(null)}
                    disabled={assignSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    style={{ height: "42px", padding: "0 22px" }}
                    disabled={assignSaving || !selectedInspectorId}
                  >
                    {assignSaving
                      ? "Assigning…"
                      : assignModalData.isReassign
                      ? "Confirm Reassignment"
                      : "Confirm Assignment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================================
            CANCEL CONFIRMATION DIALOG
           ========================================================================= */}
        {cancelingInsp && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(17, 45, 70, 0.45)",
              backdropFilter: "blur(4px)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1200,
              padding: "20px",
            }}
          >
            <div
              style={{
                background: "var(--surface)",
                borderRadius: "14px",
                width: "min(460px, 100%)",
                padding: "24px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
                border: "1px solid var(--line)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    background: "var(--danger-bg)",
                    color: "var(--danger)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <XCircle size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", color: "var(--ink)" }}>Cancel Inspection Directive</h3>
                  <small style={{ color: "var(--muted)" }}>{cancelingInsp.inspectionCode}</small>
                </div>
              </div>

              <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.5, margin: "0 0 20px" }}>
                Are you sure you want to cancel the inspection for <strong>{cancelingInsp.institution?.name}</strong>?
                Any active inspector assignments will be terminated and logged in the permanent audit trail.
              </p>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  className="secondary-button"
                  onClick={() => setCancelingInsp(null)}
                  disabled={cancelingSaving}
                >
                  Keep Active
                </button>
                <button
                  className="primary-button"
                  style={{ height: "42px", padding: "0 18px", background: "var(--danger)" }}
                  onClick={handleConfirmCancel}
                  disabled={cancelingSaving}
                >
                  {cancelingSaving ? "Cancelling…" : "Confirm Cancellation"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}