import { useEffect, useState, useMemo } from "react";
import {
  Building2,
  Search,
  ShieldCheck,
  Plus,
  RefreshCw,
  Eye,
  Edit2,
  Trash2,
  X,
  MapPin,
  Users,
  Award,
  CalendarCheck,
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  User,
  Compass,
} from "lucide-react";
import AppShell from "../../components/AppShell";
import RiskBadge from "../../components/RiskBadge";
import { useAuth } from "../../context/AuthContext";
import { apiError } from "../../services/api";
import {
  getInstitutions,
  getInstitutionById,
  createInstitution,
  updateInstitution,
  deleteInstitution,
  getInstitutionSchemes,
  getInstitutionBeneficiaries,
  getInstitutionAttendance,
} from "../../services/institution.service";
import { calculateInstitutionRisk } from "../../services/ai.service";
import { cctvService } from "../../services/cctv.service";
import { useRealtime } from "../../context/RealtimeContext";
import { WS_EVENTS } from "../../services/socket";
import { Sparkles, Brain, Zap, Video, Play, Tv, Check } from "lucide-react";


const INSTITUTION_TYPES = [
  { value: "SENIOR_CITIZEN_HOME", label: "Senior Citizen Home" },
  { value: "DE_ADDICTION_CENTRE", label: "De-Addiction Centre" },
  { value: "RESIDENTIAL_HOSTEL_SC_OBC", label: "SC/OBC Residential Hostel" },
  { value: "DIVYANGJAN_REHAB_CENTRE", label: "Divyangjan Rehab Centre" },
  { value: "NGO_AIDED_CENTRE", label: "NGO Aided Centre" },
  { value: "OTHER", label: "Other Facility" },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "UNDER_SCRUTINY", label: "Under Scrutiny" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "CLOSED", label: "Closed" },
];

const RISK_OPTIONS = [
  { value: "LOW", label: "Low Risk" },
  { value: "MEDIUM", label: "Medium Risk" },
  { value: "HIGH", label: "High Risk" },
  { value: "CRITICAL", label: "Critical Risk" },
];

export default function AdminInstitutes() {
  const { user } = useAuth();
  const { on } = useRealtime();
  const canManage = ["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"].includes(user?.role);
  const canDelete = ["ADMIN", "STATE_OFFICER"].includes(user?.role);

  // Institution List State
  const [institutions, setInstitutions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Filters State
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Details Modal State
  const [selectedInstId, setSelectedInstId] = useState(null);
  const [detailsData, setDetailsData] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailTab, setDetailTab] = useState("overview"); // overview, schemes, beneficiaries, attendance, risk, cctv
  const [schemes, setSchemes] = useState([]);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [cctvDevices, setCctvDevices] = useState([]);

  // CCTV Modal & Stream Viewer State
  const [cctvModalOpen, setCctvModalOpen] = useState(false);
  const [cctvFormData, setCctvFormData] = useState({
    deviceName: "",
    cameraLocation: "",
    streamUrl: "",
    status: "ONLINE",
    isAiMonitoringEnabled: false,
  });
  const [cctvSaving, setCctvSaving] = useState(false);
  const [cctvFormError, setCctvFormError] = useState("");
  const [selectedStreamDevice, setSelectedStreamDevice] = useState(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamInfo, setStreamInfo] = useState(null);
  const [streamError, setStreamError] = useState("");

  // Create / Edit Modal State
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | null
  const [formData, setFormData] = useState(getInitialFormData());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Deactivate Confirmation State
  const [deletingInst, setDeletingInst] = useState(null);
  const [deactivating, setDeactivating] = useState(false);

  // AI Calculation State
  const [aiCalculating, setAiCalculating] = useState(false);
  const [aiError, setAiError] = useState("");

  const handleRunAiAssessment = async () => {
    if (!detailsData?.id) return;
    setAiCalculating(true);
    setAiError("");
    try {
      const res = await calculateInstitutionRisk({ institutionId: detailsData.id });
      setNotice(`AI Risk assessment completed for ${detailsData.name}. Risk Score: ${res.riskScore ?? res.risk_score ?? "—"}/100.`);
      setTimeout(() => setNotice(""), 5000);
      const updated = await getInstitutionById(detailsData.id);
      setDetailsData(updated);
      loadInstitutions(pagination.page);
    } catch (err) {
      setAiError(apiError(err));
    } finally {
      setAiCalculating(false);
    }
  };


  function getInitialFormData(existing = null) {
    if (!existing) {
      return {
        code: "",
        name: "",
        type: "SENIOR_CITIZEN_HOME",
        registrationNumber: "",
        address: "",
        state: user?.state || "",
        district: user?.district || "",
        pincode: "",
        latitude: "",
        longitude: "",
        geofenceRadiusMeters: 150,
        contactPerson: "",
        contactPhone: "",
        contactEmail: "",
        capacity: 50,
        currentOccupancy: 0,
        status: "ACTIVE",
        isAidedByGovt: true,
      };
    }
    return {
      code: existing.code || "",
      name: existing.name || "",
      type: existing.type || "SENIOR_CITIZEN_HOME",
      registrationNumber: existing.registrationNumber || "",
      address: existing.address || "",
      state: existing.state || "",
      district: existing.district || "",
      pincode: existing.pincode || "",
      latitude: existing.latitude ? String(existing.latitude) : "",
      longitude: existing.longitude ? String(existing.longitude) : "",
      geofenceRadiusMeters: existing.geofenceRadiusMeters || 150,
      contactPerson: existing.contactPerson || "",
      contactPhone: existing.contactPhone || "",
      contactEmail: existing.contactEmail || "",
      capacity: existing.capacity ?? 50,
      currentOccupancy: existing.currentOccupancy ?? 0,
      status: existing.status || "ACTIVE",
      isAidedByGovt: existing.isAidedByGovt ?? true,
    };
  }

  // Load institutions list
  async function loadInstitutions(page = pagination.page) {
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        limit: pagination.limit,
        sortBy: "createdAt",
        sortOrder: "desc",
      };
      if (search.trim()) params.search = search.trim();
      if (typeFilter) params.type = typeFilter;
      if (riskFilter) params.riskLevel = riskFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await getInstitutions(params);
      setInstitutions(res.institutions);
      setPagination(res.pagination);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInstitutions(1);
  }, [typeFilter, riskFilter, statusFilter]);

  // Real-time WebSocket event listeners for CCTV and Risk updates
  useEffect(() => {
    if (!on) return;

    const cleanCctvStatus = on(WS_EVENTS.CCTV_STATUS_CHANGED, (eventData) => {
      const payload = eventData?.data || eventData;
      if (payload && payload.id) {
        setCctvDevices((prev) => prev.map((c) => (c.id === payload.id ? { ...c, status: payload.status } : c)));
      }
    });

    const cleanCctvCreated = on(WS_EVENTS.CCTV_CREATED, (eventData) => {
      const payload = eventData?.data || eventData;
      if (payload && payload.id && (!selectedInstId || payload.institutionId === selectedInstId)) {
        setCctvDevices((prev) => [payload, ...prev.filter((c) => c.id !== payload.id)]);
      }
    });

    const cleanCctvDeleted = on(WS_EVENTS.CCTV_DELETED, (eventData) => {
      const payload = eventData?.data || eventData;
      if (payload && payload.id) {
        setCctvDevices((prev) => prev.filter((c) => c.id !== payload.id));
      }
    });

    const cleanRiskAssessed = on(WS_EVENTS.AI_RISK_ASSESSED, (eventData) => {
      const payload = eventData?.data || eventData;
      if (payload && payload.institutionId) {
        setInstitutions((prev) =>
          prev.map((i) =>
            i.id === payload.institutionId
              ? { ...i, latestRiskScore: payload.riskScore, latestRiskLevel: payload.riskLevel }
              : i
          )
        );
        if (selectedInstId === payload.institutionId) {
          setDetailsData((prev) =>
            prev
              ? { ...prev, latestRiskScore: payload.riskScore, latestRiskLevel: payload.riskLevel }
              : prev
          );
        }
      }
    });

    return () => {
      cleanCctvStatus();
      cleanCctvCreated();
      cleanCctvDeleted();
      cleanRiskAssessed();
    };
  }, [on, selectedInstId]);

  // Load detailed view
  async function openDetails(instId) {
    setSelectedInstId(instId);
    setDetailsLoading(true);
    setDetailTab("overview");
    try {
      const [inst, sch, ben, att, cctv] = await Promise.all([
        getInstitutionById(instId),
        getInstitutionSchemes(instId).catch(() => []),
        getInstitutionBeneficiaries(instId).then((r) => r.beneficiaries).catch(() => []),
        getInstitutionAttendance(instId).catch(() => []),
        cctvService.getCctvDevices({ institutionId: instId }).then((r) => r.devices).catch(() => []),
      ]);
      setDetailsData(inst);
      setSchemes(sch);
      setBeneficiaries(ben);
      setAttendance(att);
      setCctvDevices(cctv);
      setSelectedStreamDevice(null);
      setStreamInfo(null);
      setStreamError("");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setDetailsLoading(false);
    }
  }

  function closeDetails() {
    setSelectedInstId(null);
    setDetailsData(null);
  }

  // Open Create Modal
  function handleOpenCreate() {
    setFormData(getInitialFormData());
    setFormError("");
    setModalMode("create");
  }

  // Open Edit Modal
  function handleOpenEdit(inst) {
    setFormData(getInitialFormData(inst));
    setFormError("");
    setModalMode(inst.id);
  }

  // Save Create or Edit
  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    const payload = {
      ...formData,
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
      geofenceRadiusMeters: parseInt(formData.geofenceRadiusMeters, 10),
      capacity: parseInt(formData.capacity, 10),
      currentOccupancy: parseInt(formData.currentOccupancy, 10),
      contactEmail: formData.contactEmail ? formData.contactEmail.trim() : null,
    };

    try {
      if (modalMode === "create") {
        await createInstitution(payload);
        setNotice(`Institution "${formData.name}" successfully registered.`);
      } else {
        await updateInstitution(modalMode, payload);
        setNotice(`Institution "${formData.name}" updated successfully.`);
      }
      setModalMode(null);
      await loadInstitutions();
      if (selectedInstId === modalMode) {
        await openDetails(selectedInstId);
      }
    } catch (err) {
      setFormError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  // Confirm Deactivate
  async function handleConfirmDelete() {
    if (!deletingInst) return;
    setDeactivating(true);
    try {
      await deleteInstitution(deletingInst.id);
      setNotice(`Institution "${deletingInst.name}" has been deactivated.`);
      setDeletingInst(null);
      if (selectedInstId === deletingInst.id) {
        closeDetails();
      }
      await loadInstitutions();
    } catch (err) {
      setError(apiError(err));
      setDeletingInst(null);
    } finally {
      setDeactivating(false);
    }
  }

  const formatTypeName = (type) => {
    const match = INSTITUTION_TYPES.find((t) => t.value === type);
    return match ? match.label : (type || "—").replace(/_/g, " ");
  };

  return (
    <AppShell>
      <div className="dashboard-body">
        {/* Page Intro */}
        <div className="page-intro" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span className="section-kicker">INSTITUTION REGISTRY</span>
            <h2>Institutes</h2>
            <p>
              Monitor registered institutions, compliance readiness, capacity utilization, and welfare schemes across your jurisdiction.
            </p>
          </div>
          {canManage && (
            <button
              className="primary-button"
              style={{ height: "42px", padding: "0 18px", fontSize: "13px", cursor: "pointer" }}
              onClick={handleOpenCreate}
            >
              <Plus size={16} /> Register Institution
            </button>
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

        {/* Registered Institutions Section */}
        <section className="section-card">
          <div className="section-head" style={{ flexWrap: "wrap", gap: "12px" }}>
            <div>
              <span className="section-kicker">REGISTERED INSTITUTIONS</span>
              <h2>Institution Registry ({pagination.total})</h2>
            </div>

            {/* Toolbar: Search, Filters & Refresh */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadInstitutions(1);
                }}
                className="table-search"
                style={{ width: "240px" }}
              >
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search code, name, district..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </form>

              <select
                className="small-action"
                style={{ height: "36px", padding: "0 10px", cursor: "pointer" }}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">All Types</option>
                {INSTITUTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>

              <select
                className="small-action"
                style={{ height: "36px", padding: "0 10px", cursor: "pointer" }}
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
              >
                <option value="">All Risk Levels</option>
                {RISK_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>

              <select
                className="small-action"
                style={{ height: "36px", padding: "0 10px", cursor: "pointer" }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              <button
                className="icon-button"
                onClick={() => loadInstitutions()}
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
              <h3>Loading institution data…</h3>
              <p>Connecting to SmartInspect registry and computing metrics.</p>
            </div>
          ) : institutions.length === 0 ? (
            <div className="admin-page-empty">
              <Building2 size={36} style={{ color: "var(--muted)" }} />
              <h3>No institution records match your query</h3>
              <p>Try adjusting your search criteria or register a new institution.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Institute</th>
                    <th>Type</th>
                    <th>Location</th>
                    <th>Occupancy</th>
                    <th>Risk Level</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {institutions.map((inst) => (
                    <tr key={inst.id}>
                      <td>
                        <strong>{inst.name}</strong>
                        <small>{inst.code} · Reg: {inst.registrationNumber || "N/A"}</small>
                      </td>
                      <td>
                        <span style={{ fontSize: "11px", color: "var(--ink)", fontWeight: 500 }}>
                          {formatTypeName(inst.type)}
                        </span>
                      </td>
                      <td>
                        {inst.district || "—"}, {inst.state || "—"}
                        {inst.pincode && <small>PIN: {inst.pincode}</small>}
                      </td>
                      <td>
                        <strong>{inst.currentOccupancy ?? 0} / {inst.capacity ?? 0}</strong>
                        <small>
                          {inst.capacity > 0
                            ? `${Math.round(((inst.currentOccupancy || 0) / inst.capacity) * 100)}% capacity`
                            : "No limit set"}
                        </small>
                      </td>
                      <td>
                        <RiskBadge
                          level={inst.latestRiskLevel || "LOW"}
                          score={inst.latestRiskScore ?? 0}
                        />
                      </td>
                      <td>
                        <span
                          className={`status-chip status-${(inst.status || "active").toLowerCase()}`}
                        >
                          {inst.status || "ACTIVE"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            className="small-action"
                            onClick={() => openDetails(inst.id)}
                            title="View Full Profile"
                          >
                            <Eye size={13} /> View
                          </button>
                          {canManage && (
                            <button
                              className="small-action"
                              onClick={() => handleOpenEdit(inst)}
                              title="Edit Institution"
                            >
                              <Edit2 size={13} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              className="small-action"
                              style={{ color: "var(--danger)" }}
                              onClick={() => setDeletingInst(inst)}
                              title="Deactivate Institution"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
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
                  Showing {institutions.length} of {pagination.total} institutions (Page {pagination.page} of {pagination.totalPages})
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    className="small-action"
                    disabled={pagination.page <= 1 || loading}
                    onClick={() => loadInstitutions(pagination.page - 1)}
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <button
                    className="small-action"
                    disabled={pagination.page >= pagination.totalPages || loading}
                    onClick={() => loadInstitutions(pagination.page + 1)}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Info Strip */}
        <section className="info-strip">
          <ShieldCheck size={20} />
          <div>
            <strong>Jurisdiction Monitoring & Statutory Compliance</strong>
            <span>
              Institution data is synced directly with Department Welfare databases. Real-time AI Risk Scores update automatically following computer vision attendance audits and geo-verified surprise inspections.
            </span>
          </div>
        </section>

        {/* =========================================================================
            INSTITUTION DETAIL DRAWER / MODAL
           ========================================================================= */}
        {selectedInstId && (
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
                width: "min(950px, 100%)",
                maxHeight: "90vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
                overflow: "hidden",
                border: "1px solid var(--line)",
              }}
            >
              {/* Modal Header */}
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
                      {detailsData?.name || "Institution Details"}
                    </h2>
                    {detailsData && (
                      <span className={`status-chip status-${(detailsData.status || "active").toLowerCase()}`}>
                        {detailsData.status}
                      </span>
                    )}
                  </div>
                  <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                    Code: {detailsData?.code} · {formatTypeName(detailsData?.type)}
                  </small>
                </div>
                <button
                  className="icon-button"
                  onClick={closeDetails}
                  title="Close Dialog"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Tabs */}
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
                  { id: "schemes", label: `Welfare Schemes (${schemes.length})`, icon: Award },
                  { id: "beneficiaries", label: `Beneficiaries (${beneficiaries.length})`, icon: Users },
                  { id: "attendance", label: `Attendance (${attendance.length})`, icon: CalendarCheck },
                  { id: "risk", label: "AI Risk Factors", icon: Activity },
                  { id: "cctv", label: `CCTV Feeds (${cctvDevices.length})`, icon: Video },
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

              {/* Modal Body */}
              <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
                {detailsLoading ? (
                  <div className="empty-state">
                    <RefreshCw size={24} className="animate-spin" style={{ color: "var(--blue)" }} />
                    <h3>Loading comprehensive facility profile…</h3>
                  </div>
                ) : detailsData ? (
                  <>
                    {/* TAB: OVERVIEW */}
                    {detailTab === "overview" && (
                      <div style={{ display: "grid", gap: "20px" }}>
                        {/* Stats Row */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
                          <div className="mini-info-card">
                            <span>Capacity & Occupancy</span>
                            <strong>{detailsData.currentOccupancy ?? 0} / {detailsData.capacity ?? 0}</strong>
                            <small>
                              {detailsData.capacity > 0
                                ? `${Math.round(((detailsData.currentOccupancy || 0) / detailsData.capacity) * 100)}% utilization`
                                : "N/A"}
                            </small>
                          </div>
                          <div className="mini-info-card">
                            <span>Risk Classification</span>
                            <div style={{ marginTop: "6px" }}>
                              <RiskBadge
                                level={detailsData.latestRiskLevel || "LOW"}
                                score={detailsData.latestRiskScore ?? 0}
                              />
                            </div>
                            <small style={{ marginTop: "4px" }}>Based on automated metrics</small>
                          </div>
                          <div className="mini-info-card">
                            <span>Government Grant</span>
                            <strong>{detailsData.isAidedByGovt ? "Govt Aided" : "Private / Self"}</strong>
                            <small>Reg: {detailsData.registrationNumber || "Unregistered"}</small>
                          </div>
                        </div>

                        {/* Location & Geo Details */}
                        <div className="section-card" style={{ padding: "16px", marginBottom: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                            <MapPin size={16} style={{ color: "var(--blue)" }} />
                            <strong style={{ fontSize: "13px" }}>Location & Geofence Coordinates</strong>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "12px" }}>
                            <div>
                              <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>Address:</span>
                              <strong>{detailsData.address || "—"}</strong>
                            </div>
                            <div>
                              <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>Jurisdiction:</span>
                              <strong>{detailsData.district}, {detailsData.state} · PIN: {detailsData.pincode || "—"}</strong>
                            </div>
                            <div>
                              <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>GPS Coordinates:</span>
                              <strong>Lat: {detailsData.latitude} · Long: {detailsData.longitude}</strong>
                            </div>
                            <div>
                              <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>Geofence Radius:</span>
                              <strong>{detailsData.geofenceRadiusMeters || 150} meters</strong>
                            </div>
                          </div>
                        </div>

                        {/* Contact Information */}
                        <div className="section-card" style={{ padding: "16px", marginBottom: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                            <User size={16} style={{ color: "var(--blue)" }} />
                            <strong style={{ fontSize: "13px" }}>Administrative Contact Person</strong>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", fontSize: "12px" }}>
                            <div>
                              <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>Contact Person:</span>
                              <strong>{detailsData.contactPerson || "—"}</strong>
                            </div>
                            <div>
                              <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>Phone Number:</span>
                              <strong>{detailsData.contactPhone || "—"}</strong>
                            </div>
                            <div>
                              <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>Email:</span>
                              <strong>{detailsData.contactEmail || "—"}</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB: SCHEMES */}
                    {detailTab === "schemes" && (
                      <div>
                        {schemes.length === 0 ? (
                          <div className="admin-page-empty" style={{ minHeight: "160px" }}>
                            <Award size={30} />
                            <h3>No Welfare Schemes Linked</h3>
                            <p>No government grant schemes have been associated with this facility yet.</p>
                          </div>
                        ) : (
                          <table>
                            <thead>
                              <tr>
                                <th>Scheme Name</th>
                                <th>Code</th>
                                <th>Grant Year</th>
                                <th>Sanctioned Amount</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {schemes.map((s) => (
                                <tr key={s.id}>
                                  <td>
                                    <strong>{s.scheme?.name || "Welfare Scheme"}</strong>
                                    <small>{s.scheme?.sponsoringDepartment || "Social Justice Dept"}</small>
                                  </td>
                                  <td>{s.scheme?.code || "—"}</td>
                                  <td>{s.grantYear || "—"}</td>
                                  <td>
                                    <strong>₹{Number(s.grantSanctionedAmount || 0).toLocaleString("en-IN")}</strong>
                                  </td>
                                  <td>
                                    <span className="status-chip status-completed">{s.approvalStatus || "SANCTIONED"}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {/* TAB: BENEFICIARIES */}
                    {detailTab === "beneficiaries" && (
                      <div>
                        {beneficiaries.length === 0 ? (
                          <div className="admin-page-empty" style={{ minHeight: "160px" }}>
                            <Users size={30} />
                            <h3>No Enrolled Beneficiaries Found</h3>
                            <p>No resident or beneficiary records have been enrolled for this facility.</p>
                          </div>
                        ) : (
                          <table>
                            <thead>
                              <tr>
                                <th>Enrollment #</th>
                                <th>Full Name</th>
                                <th>Category</th>
                                <th>Age / Gender</th>
                                <th>Admission Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {beneficiaries.map((b) => (
                                <tr key={b.id}>
                                  <td>
                                    <strong>{b.enrollmentNumber}</strong>
                                  </td>
                                  <td>{b.fullName}</td>
                                  <td>
                                    <span style={{ textTransform: "capitalize" }}>
                                      {(b.category || "—").replace(/_/g, " ").toLowerCase()}
                                    </span>
                                  </td>
                                  <td>
                                    {b.age ? `${b.age} yrs` : "—"} · {b.gender || "—"}
                                  </td>
                                  <td>
                                    {b.admissionDate ? new Date(b.admissionDate).toLocaleDateString("en-IN") : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {/* TAB: ATTENDANCE */}
                    {detailTab === "attendance" && (
                      <div>
                        {attendance.length === 0 ? (
                          <div className="admin-page-empty" style={{ minHeight: "160px" }}>
                            <CalendarCheck size={30} />
                            <h3>No Attendance Logs Recorded</h3>
                            <p>Attendance records verified via roll call or computer vision will display here.</p>
                          </div>
                        ) : (
                          <table>
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Present / Enrolled</th>
                                <th>Percentage</th>
                                <th>Anomaly Flag</th>
                                <th>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {attendance.map((a) => {
                                const rate = a.totalEnrolled > 0 ? Math.round((a.totalPresent / a.totalEnrolled) * 100) : 0;
                                return (
                                  <tr key={a.id}>
                                    <td>
                                      <strong>{new Date(a.attendanceDate).toLocaleDateString("en-IN")}</strong>
                                    </td>
                                    <td>
                                      <strong>{a.totalPresent} / {a.totalEnrolled}</strong>
                                    </td>
                                    <td>
                                      <span style={{ fontWeight: 700, color: rate < 60 ? "var(--danger)" : "var(--success)" }}>
                                        {rate}%
                                      </span>
                                    </td>
                                    <td>
                                      {a.anomalyFlag ? (
                                        <span className="risk-badge risk-high">Anomaly Detected</span>
                                      ) : (
                                        <span className="risk-badge risk-low">Normal</span>
                                      )}
                                    </td>
                                    <td>{a.notes || "Regular roll-call conducted"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {/* TAB: RISK */}
                    {detailTab === "risk" && (
                      <div>
                        <div style={{ display: "flex", gap: "16px", marginBottom: "18px", alignItems: "center", flexWrap: "wrap" }}>
                          <div className="stat-card" style={{ flex: 1, margin: 0, minWidth: "220px" }}>
                            <div className="stat-icon" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
                              <Activity size={20} />
                            </div>
                            <div>
                              <span>Current Risk Score</span>
                              <strong>{detailsData.latestRiskScore ?? 0} / 100</strong>
                              <small>Classification: {detailsData.latestRiskLevel || "LOW"}</small>
                            </div>
                          </div>

                          {canManage && (
                            <button
                              className="primary-button"
                              onClick={handleRunAiAssessment}
                              disabled={aiCalculating}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "10px 18px",
                              }}
                            >
                              <Sparkles size={16} className={aiCalculating ? "spin" : ""} />
                              {aiCalculating ? "Evaluating Risk Engine..." : "Run AI Risk Assessment"}
                            </button>
                          )}
                        </div>

                        {aiError && (
                          <div
                            style={{
                              padding: "10px 14px",
                              borderRadius: "8px",
                              background: "#fff0f0",
                              border: "1px solid #f8c2c2",
                              color: "#c24141",
                              fontSize: "12px",
                              marginBottom: "16px",
                            }}
                          >
                            <strong>AI Engine Note:</strong> {aiError}
                          </div>
                        )}

                        {detailsData.riskAssessments && detailsData.riskAssessments.length > 0 ? (
                          <div>
                            {/* Latest Assessment Factor Breakdown */}
                            {detailsData.riskAssessments[0]?.factors?.breakdown && (
                              <div
                                style={{
                                  background: "#f8fafc",
                                  border: "1px solid var(--line)",
                                  borderRadius: "10px",
                                  padding: "14px 16px",
                                  marginBottom: "18px",
                                }}
                              >
                                <strong style={{ fontSize: "13px", display: "block", marginBottom: "10px" }}>
                                  Latest Assessment Factor Weights (0 - 100 Scale)
                                </strong>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", fontSize: "12px" }}>
                                  <div>
                                    <span style={{ color: "var(--muted)" }}>Attendance Discrepancy (30%): </span>
                                    <b>{detailsData.riskAssessments[0].factors.breakdown.attendance_discrepancy_weight ?? "—"}</b>
                                  </div>
                                  <div>
                                    <span style={{ color: "var(--muted)" }}>Audit Recency (20%): </span>
                                    <b>{detailsData.riskAssessments[0].factors.breakdown.inspection_recency_weight ?? "—"}</b>
                                  </div>
                                  <div>
                                    <span style={{ color: "var(--muted)" }}>CCTV Downtime (20%): </span>
                                    <b>{detailsData.riskAssessments[0].factors.breakdown.cctv_downtime_weight ?? "—"}</b>
                                  </div>
                                  <div>
                                    <span style={{ color: "var(--muted)" }}>Grievances (15%): </span>
                                    <b>{detailsData.riskAssessments[0].factors.breakdown.grievance_weight ?? "—"}</b>
                                  </div>
                                  <div>
                                    <span style={{ color: "var(--muted)" }}>Enrollment Volatility (15%): </span>
                                    <b>{detailsData.riskAssessments[0].factors.breakdown.enrollment_volatility_weight ?? "—"}</b>
                                  </div>
                                  {detailsData.riskAssessments[0].factors.anomaly_detected && (
                                    <div style={{ color: "#c24141", fontWeight: 700 }}>
                                      ⚡ Isolation Forest Anomaly Outlier (+{detailsData.riskAssessments[0].factors.anomaly_boost_points || 0} pts)
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            <strong style={{ fontSize: "13px", display: "block", marginBottom: "10px" }}>
                              Recent AI Risk Assessments History
                            </strong>
                            <table>
                              <thead>
                                <tr>
                                  <th>Assessment Date</th>
                                  <th>Risk Score</th>
                                  <th>Level</th>
                                  <th>Model Version</th>
                                  <th>Factors Analyzed</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detailsData.riskAssessments.map((ra) => (
                                  <tr key={ra.id}>
                                    <td>{new Date(ra.assessmentDate).toLocaleString("en-IN")}</td>
                                    <td><strong>{ra.riskScore}</strong></td>
                                    <td><RiskBadge level={ra.riskLevel} /></td>
                                    <td>{ra.modelVersion || "v1.0"}</td>
                                    <td>
                                      {ra.factors?.breakdown
                                        ? `Att: ${ra.factors.breakdown.attendance_discrepancy_weight || 0}, Rec: ${ra.factors.breakdown.inspection_recency_weight || 0}, CCTV: ${ra.factors.breakdown.cctv_downtime_weight || 0}`
                                        : (ra.factors && typeof ra.factors === "object"
                                            ? Object.entries(ra.factors)
                                                .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
                                                .join(", ")
                                            : "Standard metrics")}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="admin-page-empty" style={{ minHeight: "140px" }}>
                            <Activity size={28} />
                            <h3>No Historical AI Risk Logs</h3>
                            <p>Click "Run AI Risk Assessment" to evaluate this institution's compliance factors.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB: CCTV FEEDS */}
                    {detailTab === "cctv" && (
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "16px",
                          }}
                        >
                          <div>
                            <h3 style={{ margin: 0, fontSize: "16px", color: "var(--navy)" }}>
                              Registered CCTV Surveillance Cameras ({cctvDevices.length})
                            </h3>
                            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                              Live CCTV stream integration and automated AI headcount surveillance.
                            </p>
                          </div>
                          {canManage && (
                            <button
                              className="small-action"
                              style={{
                                background: "var(--navy)",
                                color: "white",
                                borderColor: "var(--navy)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                              onClick={() => {
                                setCctvFormData({
                                  deviceName: "",
                                  cameraLocation: "",
                                  streamUrl: "",
                                  status: "ONLINE",
                                  isAiMonitoringEnabled: false,
                                });
                                setCctvFormError("");
                                setCctvModalOpen(true);
                              }}
                            >
                              <Plus size={14} /> Register CCTV Camera
                            </button>
                          )}
                        </div>

                        {/* Stream Player View */}
                        {selectedStreamDevice && (
                          <div
                            style={{
                              background: "#0f172a",
                              borderRadius: "12px",
                              padding: "16px",
                              marginBottom: "20px",
                              color: "white",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "12px",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <span
                                  style={{
                                    display: "inline-block",
                                    width: "10px",
                                    height: "10px",
                                    borderRadius: "50%",
                                    background: selectedStreamDevice.status === "ONLINE" ? "#22c55e" : "#ef4444",
                                  }}
                                />
                                <strong style={{ fontSize: "14px" }}>
                                  {selectedStreamDevice.deviceName} — {selectedStreamDevice.cameraLocation}
                                </strong>
                                {selectedStreamDevice.isAiMonitoringEnabled && (
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      background: "rgba(59, 130, 246, 0.2)",
                                      color: "#60a5fa",
                                      padding: "2px 8px",
                                      borderRadius: "12px",
                                      border: "1px solid rgba(59, 130, 246, 0.4)",
                                    }}
                                  >
                                    AI Headcount Enabled
                                  </span>
                                )}
                              </div>
                              <button
                                className="small-action"
                                style={{ background: "rgba(255,255,255,0.1)", color: "white", borderColor: "transparent" }}
                                onClick={() => {
                                  setSelectedStreamDevice(null);
                                  setStreamInfo(null);
                                  setStreamError("");
                                }}
                              >
                                <X size={14} /> Close Stream
                              </button>
                            </div>

                            {streamLoading ? (
                              <div style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
                                <RefreshCw size={24} className="spin" style={{ margin: "0 auto 10px" }} />
                                <p style={{ margin: 0, fontSize: "13px" }}>Authorizing secure CCTV stream channel...</p>
                              </div>
                            ) : streamError ? (
                              <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", padding: "16px", textAlign: "center", color: "#fca5a5" }}>
                                <AlertCircle size={20} style={{ margin: "0 auto 8px" }} />
                                <p style={{ margin: 0, fontSize: "13px" }}>{streamError}</p>
                              </div>
                            ) : (
                              <div>
                                {selectedStreamDevice.streamUrl &&
                                (selectedStreamDevice.streamUrl.startsWith("http://") ||
                                  selectedStreamDevice.streamUrl.startsWith("https://") ||
                                  selectedStreamDevice.streamUrl.startsWith("/")) ? (
                                  <div style={{ borderRadius: "8px", overflow: "hidden", background: "#000", position: "relative" }}>
                                    <video
                                      src={selectedStreamDevice.streamUrl}
                                      controls
                                      autoPlay
                                      muted
                                      playsInline
                                      style={{ width: "100%", maxHeight: "360px", display: "block", objectFit: "contain" }}
                                      onError={() => setStreamError("Video feed could not be loaded from configured stream URL. Please ensure stream is active.")}
                                    />
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      background: "rgba(30, 41, 59, 0.8)",
                                      border: "1px dashed rgba(255, 255, 255, 0.2)",
                                      borderRadius: "8px",
                                      padding: "30px",
                                      textAlign: "center",
                                    }}
                                  >
                                    <Tv size={32} style={{ color: "#94a3b8", margin: "0 auto 10px" }} />
                                    <h4 style={{ margin: "0 0 6px", fontSize: "14px" }}>RTSP / Network Camera Stream</h4>
                                    <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#94a3b8" }}>
                                      Direct RTSP protocols require server-side transcoding for native HTML5 browser playback.
                                    </p>
                                    <code style={{ fontSize: "11px", background: "rgba(0,0,0,0.4)", padding: "4px 10px", borderRadius: "4px", color: "#38bdf8" }}>
                                      {selectedStreamDevice.streamUrl}
                                    </code>
                                  </div>
                                )}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", fontSize: "11px", color: "#94a3b8" }}>
                                  <span>Last ping received: {selectedStreamDevice.lastPingAt ? new Date(selectedStreamDevice.lastPingAt).toLocaleString("en-IN") : "Just now"}</span>
                                  <span>Stream Protocol: {selectedStreamDevice.streamUrl?.startsWith("rtsp://") ? "RTSP IP-Cam" : "HTTP/HTTPS Stream"}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {cctvDevices.length === 0 ? (
                          <div className="admin-page-empty" style={{ minHeight: "160px" }}>
                            <Video size={32} />
                            <h3>No CCTV Cameras Registered</h3>
                            <p>No surveillance devices are currently linked to this institution.</p>
                            {canManage && (
                              <button
                                className="small-action"
                                style={{ marginTop: "10px" }}
                                onClick={() => {
                                  setCctvFormData({
                                    deviceName: "",
                                    cameraLocation: "",
                                    streamUrl: "",
                                    status: "ONLINE",
                                    isAiMonitoringEnabled: false,
                                  });
                                  setCctvFormError("");
                                  setCctvModalOpen(true);
                                }}
                              >
                                <Plus size={14} /> Add First Camera
                              </button>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
                            {cctvDevices.map((cam) => {
                              const isOnline = cam.status === "ONLINE";
                              const isFaulty = cam.status === "FAULTY";
                              return (
                                <div
                                  key={cam.id}
                                  style={{
                                    background: "#ffffff",
                                    border: "1px solid var(--line)",
                                    borderRadius: "10px",
                                    padding: "16px",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    gap: "12px",
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                                  }}
                                >
                                  <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                                      <strong style={{ fontSize: "14px", color: "var(--navy)" }}>{cam.deviceName}</strong>
                                      <span
                                        style={{
                                          fontSize: "11px",
                                          fontWeight: 600,
                                          padding: "2px 8px",
                                          borderRadius: "12px",
                                          background: isOnline ? "#dcfce7" : isFaulty ? "#fef3c7" : "#fee2e2",
                                          color: isOnline ? "#15803d" : isFaulty ? "#b45309" : "#b91c1c",
                                        }}
                                      >
                                        {cam.status}
                                      </span>
                                    </div>

                                    <div style={{ fontSize: "12px", color: "var(--muted)", display: "flex", flexDirection: "column", gap: "4px" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                        <MapPin size={13} /> {cam.cameraLocation}
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                        <Tv size={13} />
                                        <span style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                          {cam.streamUrl}
                                        </span>
                                      </div>
                                      {cam.isAiMonitoringEnabled && (
                                        <span style={{ marginTop: "4px", fontSize: "11px", color: "var(--blue)", fontWeight: 600 }}>
                                          ⚡ YOLO AI Headcount Enabled
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      paddingTop: "10px",
                                      borderTop: "1px solid var(--line)",
                                      gap: "6px",
                                    }}
                                  >
                                    <button
                                      className="small-action"
                                      style={{
                                        background: "var(--navy)",
                                        color: "white",
                                        borderColor: "var(--navy)",
                                        fontSize: "12px",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "4px",
                                      }}
                                      onClick={async () => {
                                        setSelectedStreamDevice(cam);
                                        setStreamLoading(true);
                                        setStreamError("");
                                        try {
                                          const info = await cctvService.getCctvStream(cam.id);
                                          setStreamInfo(info);
                                        } catch (err) {
                                          setStreamError(apiError(err));
                                        } finally {
                                          setStreamLoading(false);
                                        }
                                      }}
                                    >
                                      <Play size={12} /> View Feed
                                    </button>

                                    {canManage && (
                                      <div style={{ display: "flex", gap: "4px" }}>
                                        <select
                                          value={cam.status}
                                          onChange={async (e) => {
                                            const newStatus = e.target.value;
                                            try {
                                              await cctvService.updateCctvStatus(cam.id, newStatus);
                                              setCctvDevices((prev) =>
                                                prev.map((c) => (c.id === cam.id ? { ...c, status: newStatus } : c))
                                              );
                                              setNotice(`Camera ${cam.deviceName} status updated to ${newStatus}.`);
                                              setTimeout(() => setNotice(""), 4000);
                                            } catch (err) {
                                              setError(apiError(err));
                                            }
                                          }}
                                          style={{
                                            fontSize: "11px",
                                            padding: "3px 6px",
                                            borderRadius: "6px",
                                            border: "1px solid var(--line)",
                                            background: "var(--surface)",
                                            cursor: "pointer",
                                          }}
                                        >
                                          <option value="ONLINE">ONLINE</option>
                                          <option value="OFFLINE">OFFLINE</option>
                                          <option value="FAULTY">FAULTY</option>
                                        </select>

                                        {user?.role === "ADMIN" && (
                                          <button
                                            className="small-action"
                                            style={{
                                              color: "var(--danger)",
                                              borderColor: "transparent",
                                              background: "transparent",
                                              padding: "4px",
                                              cursor: "pointer",
                                            }}
                                            title="Decommission Camera"
                                            onClick={async () => {
                                              if (!window.confirm(`Are you sure you want to delete camera "${cam.deviceName}"?`)) return;
                                              try {
                                                await cctvService.deleteCctvDevice(cam.id);
                                                setCctvDevices((prev) => prev.filter((c) => c.id !== cam.id));
                                                if (selectedStreamDevice?.id === cam.id) {
                                                  setSelectedStreamDevice(null);
                                                }
                                                setNotice(`Camera ${cam.deviceName} removed successfully.`);
                                                setTimeout(() => setNotice(""), 4000);
                                              } catch (err) {
                                                setError(apiError(err));
                                              }
                                            }}
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                  </>
                ) : null}
              </div>

              {/* Modal Footer Actions */}
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
                  {canManage && detailsData && (
                    <button
                      className="small-action"
                      onClick={() => {
                        handleOpenEdit(detailsData);
                      }}
                    >
                      <Edit2 size={13} /> Edit Institution
                    </button>
                  )}
                  {canDelete && detailsData && (
                    <button
                      className="small-action"
                      style={{ color: "var(--danger)" }}
                      onClick={() => setDeletingInst(detailsData)}
                    >
                      <Trash2 size={13} /> Deactivate
                    </button>
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
            CREATE / EDIT INSTITUTION MODAL
           ========================================================================= */}
        {modalMode && (
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
                width: "min(800px, 100%)",
                maxHeight: "92vh",
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
                    {modalMode === "create" ? "Register New Institution" : "Edit Institution Details"}
                  </h2>
                  <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                    {modalMode === "create"
                      ? "Add a facility to the government social justice monitoring network"
                      : `Update records for ${formData.code}`}
                  </small>
                </div>
                <button
                  className="icon-button"
                  onClick={() => setModalMode(null)}
                  title="Cancel"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                <div style={{ padding: "24px", overflowY: "auto", flex: 1, display: "grid", gap: "16px" }}>
                  {formError && (
                    <div className="error-box">
                      <AlertCircle size={16} />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Row 1: Code & Name */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "14px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                        Institution Code *
                      </label>
                      <input
                        className="input-wrap"
                        style={{ width: "100%", height: "40px", fontSize: "12px" }}
                        placeholder="e.g. INST-MH-PUN-005"
                        required
                        disabled={modalMode !== "create"}
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                        Institution Full Name *
                      </label>
                      <input
                        className="input-wrap"
                        style={{ width: "100%", height: "40px", fontSize: "12px" }}
                        placeholder="e.g. Anand Seva Old Age Home"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Row 2: Type, Registration & Status */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                        Facility Type *
                      </label>
                      <select
                        className="input-wrap"
                        style={{ width: "100%", height: "40px", fontSize: "12px" }}
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      >
                        {INSTITUTION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                        Registration Number *
                      </label>
                      <input
                        className="input-wrap"
                        style={{ width: "100%", height: "40px", fontSize: "12px" }}
                        placeholder="e.g. MH/PUN/SR/2018/0094"
                        required
                        value={formData.registrationNumber}
                        onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                        Operating Status *
                      </label>
                      <select
                        className="input-wrap"
                        style={{ width: "100%", height: "40px", fontSize: "12px" }}
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 3: Address, State, District, Pincode */}
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                      Physical Address *
                    </label>
                    <input
                      className="input-wrap"
                      style={{ width: "100%", height: "40px", fontSize: "12px" }}
                      placeholder="Street, locality, landmark"
                      required
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                        State *
                      </label>
                      <input
                        className="input-wrap"
                        style={{ width: "100%", height: "40px", fontSize: "12px" }}
                        placeholder="e.g. Maharashtra"
                        required
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                        District *
                      </label>
                      <input
                        className="input-wrap"
                        style={{ width: "100%", height: "40px", fontSize: "12px" }}
                        placeholder="e.g. Pune"
                        required
                        value={formData.district}
                        onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                        Pincode (6 Digits) *
                      </label>
                      <input
                        className="input-wrap"
                        style={{ width: "100%", height: "40px", fontSize: "12px" }}
                        placeholder="411038"
                        pattern="\d{6}"
                        required
                        value={formData.pincode}
                        onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Row 4: Geo & Geofence */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                        Latitude *
                      </label>
                      <input
                        type="number"
                        step="any"
                        className="input-wrap"
                        style={{ width: "100%", height: "40px", fontSize: "12px" }}
                        placeholder="18.5074"
                        required
                        value={formData.latitude}
                        onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                        Longitude *
                      </label>
                      <input
                        type="number"
                        step="any"
                        className="input-wrap"
                        style={{ width: "100%", height: "40px", fontSize: "12px" }}
                        placeholder="73.8077"
                        required
                        value={formData.longitude}
                        onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                        Geofence Radius (meters) *
                      </label>
                      <input
                        type="number"
                        min="50"
                        max="2000"
                        className="input-wrap"
                        style={{ width: "100%", height: "40px", fontSize: "12px" }}
                        required
                        value={formData.geofenceRadiusMeters}
                        onChange={(e) => setFormData({ ...formData, geofenceRadiusMeters: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Row 5: Contact Info */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                        Contact Person *
                      </label>
                      <input
                        className="input-wrap"
                        style={{ width: "100%", height: "40px", fontSize: "12px" }}
                        placeholder="Dr. Suresh Joshi"
                        required
                        value={formData.contactPerson}
                        onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                        Contact Phone *
                      </label>
                      <input
                        className="input-wrap"
                        style={{ width: "100%", height: "40px", fontSize: "12px" }}
                        placeholder="+919822001122"
                        required
                        value={formData.contactPhone}
                        onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                        Contact Email
                      </label>
                      <input
                        type="email"
                        className="input-wrap"
                        style={{ width: "100%", height: "40px", fontSize: "12px" }}
                        placeholder="contact@anandseva.org"
                        value={formData.contactEmail}
                        onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Row 6: Capacity & Occupancy */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                        Sanctioned Capacity *
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="input-wrap"
                        style={{ width: "100%", height: "40px", fontSize: "12px" }}
                        required
                        value={formData.capacity}
                        onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                        Current Occupancy
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="input-wrap"
                        style={{ width: "100%", height: "40px", fontSize: "12px" }}
                        value={formData.currentOccupancy}
                        onChange={(e) => setFormData({ ...formData, currentOccupancy: e.target.value })}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "22px" }}>
                      <input
                        type="checkbox"
                        id="isAidedByGovt"
                        checked={formData.isAidedByGovt}
                        onChange={(e) => setFormData({ ...formData, isAidedByGovt: e.target.checked })}
                      />
                      <label htmlFor="isAidedByGovt" style={{ fontSize: "12px", color: "var(--ink)", cursor: "pointer", margin: 0 }}>
                        Govt. Grant Aided
                      </label>
                    </div>
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
                    onClick={() => setModalMode(null)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    style={{ height: "42px", padding: "0 22px" }}
                    disabled={saving}
                  >
                    {saving ? "Saving…" : modalMode === "create" ? "Register Institution" : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================================
            DEACTIVATION CONFIRMATION DIALOG
           ========================================================================= */}
        {deletingInst && (
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
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", color: "var(--ink)" }}>Deactivate Institution</h3>
                  <small style={{ color: "var(--muted)" }}>{deletingInst.code}</small>
                </div>
              </div>

              <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.5, margin: "0 0 20px" }}>
                Are you sure you want to deactivate <strong>{deletingInst.name}</strong>? Its status will be changed to <strong>CLOSED</strong> and audit logs will be permanently recorded.
              </p>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  className="secondary-button"
                  onClick={() => setDeletingInst(null)}
                  disabled={deactivating}
                >
                  Cancel
                </button>
                <button
                  className="primary-button"
                  style={{ height: "42px", padding: "0 18px", background: "var(--danger)" }}
                  onClick={handleConfirmDelete}
                  disabled={deactivating}
                >
                  {deactivating ? "Deactivating…" : "Confirm Deactivation"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= REGISTER CCTV CAMERA MODAL ================= */}
        {cctvModalOpen && (
          <div
            className="modal-backdrop"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(4px)",
              display: "grid",
              placeItems: "center",
              zIndex: 1100,
              padding: "20px",
            }}
          >
            <div
              style={{
                background: "var(--surface)",
                borderRadius: "16px",
                width: "min(520px, 100%)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
                border: "1px solid var(--line)",
              }}
            >
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
                  <h2 style={{ margin: 0, fontSize: "17px", color: "var(--navy)" }}>Register CCTV Camera</h2>
                  <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                    Link video surveillance feed to {detailsData?.name}
                  </small>
                </div>
                <button
                  className="icon-button"
                  onClick={() => setCctvModalOpen(false)}
                  title="Cancel"
                >
                  <X size={18} />
                </button>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!cctvFormData.deviceName.trim()) {
                    setCctvFormError("Device name is required");
                    return;
                  }
                  if (!cctvFormData.cameraLocation.trim()) {
                    setCctvFormError("Camera location is required");
                    return;
                  }
                  if (!cctvFormData.streamUrl.trim()) {
                    setCctvFormError("Stream URL is required");
                    return;
                  }

                  setCctvSaving(true);
                  setCctvFormError("");
                  try {
                    const newDev = await cctvService.createCctvDevice({
                      ...cctvFormData,
                      institutionId: detailsData.id,
                    });
                    setCctvDevices((prev) => [newDev, ...prev]);
                    setCctvModalOpen(false);
                    setNotice(`CCTV device "${newDev.deviceName}" registered successfully.`);
                    setTimeout(() => setNotice(""), 4000);
                  } catch (err) {
                    setCctvFormError(apiError(err));
                  } finally {
                    setCctvSaving(false);
                  }
                }}
                style={{ display: "flex", flexDirection: "column" }}
              >
                <div style={{ padding: "24px", display: "grid", gap: "16px" }}>
                  {cctvFormError && (
                    <div className="error-box">
                      <AlertCircle size={16} />
                      <span>{cctvFormError}</span>
                    </div>
                  )}

                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                      Device Name *
                    </label>
                    <input
                      className="input-wrap"
                      style={{ width: "100%", height: "40px", fontSize: "13px" }}
                      placeholder="e.g. Main Entrance Gate Camera 01"
                      value={cctvFormData.deviceName}
                      onChange={(e) => setCctvFormData({ ...cctvFormData, deviceName: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                      Camera Location *
                    </label>
                    <input
                      className="input-wrap"
                      style={{ width: "100%", height: "40px", fontSize: "13px" }}
                      placeholder="e.g. Dining Hall, Dormitory Wing A, Main Gate"
                      value={cctvFormData.cameraLocation}
                      onChange={(e) => setCctvFormData({ ...cctvFormData, cameraLocation: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                      Stream URL *
                    </label>
                    <input
                      className="input-wrap"
                      style={{ width: "100%", height: "40px", fontSize: "13px" }}
                      placeholder="e.g. https://domain.com/feed.mp4 or rtsp://192.168.1.100:554/live"
                      value={cctvFormData.streamUrl}
                      onChange={(e) => setCctvFormData({ ...cctvFormData, streamUrl: e.target.value })}
                      required
                    />
                    <small style={{ fontSize: "11px", color: "var(--muted)", display: "block", marginTop: "4px" }}>
                      Supports HTTPS/HTTP video feeds (MP4/WebM) or standard RTSP IP-camera endpoints.
                    </small>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                    <div>
                      <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                        Initial Status
                      </label>
                      <select
                        className="input-wrap"
                        style={{ width: "100%", height: "40px", fontSize: "13px", background: "var(--surface)" }}
                        value={cctvFormData.status}
                        onChange={(e) => setCctvFormData({ ...cctvFormData, status: e.target.value })}
                      >
                        <option value="ONLINE">ONLINE</option>
                        <option value="OFFLINE">OFFLINE</option>
                        <option value="FAULTY">FAULTY</option>
                      </select>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                        AI Headcount Surveillance
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={cctvFormData.isAiMonitoringEnabled}
                          onChange={(e) => setCctvFormData({ ...cctvFormData, isAiMonitoringEnabled: e.target.checked })}
                        />
                        Enable YOLO Headcount AI
                      </label>
                    </div>
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
                    onClick={() => setCctvModalOpen(false)}
                    disabled={cctvSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    style={{ height: "42px", padding: "0 22px" }}
                    disabled={cctvSaving}
                  >
                    {cctvSaving ? "Registering..." : "Register Camera"}
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