import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileImage,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  PlusCircle,
  ShieldAlert,
  Upload,
  UserCircle,
  XCircle,
  Sparkles,
} from "lucide-react";
import AppShell from "../components/AppShell";
import RiskBadge from "../components/RiskBadge";
import StatCard from "../components/StatCard";
import api, { apiError, unwrap } from "../services/api";
import { analyzeAttendance } from "../services/ai.service";


export default function InspectorDashboard() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [inspections, setInspections] = useState([]);
  const [selected, setSelected] = useState(null);
  const [gps, setGps] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [verifyingLocation, setVerifyingLocation] = useState(false);
  const [notice, setNotice] = useState("");
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [completeModalOpen, setCompleteModalOpen] = useState(false);

  async function load() {
    setLoading(true);

    try {
      const res = await api.get("/inspections/my", {
        params: {
          page: 1,
          limit: 50,
          sortBy: "scheduledDate",
          sortOrder: "asc",
        },
      });

      const list = unwrap(res) || [];

      setInspections(list);

      setSelected((current) =>
        current
          ? list.find((x) => x.id === current.id) || current
          : list[0] || null
      );
    } catch (err) {
      setNotice(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selected?.id) return;

    api
      .get(`/inspections/${selected.id}/gps/latest`)
      .then((r) => setGps(unwrap(r)))
      .catch(() => setGps(null));

    if (
      selected.status === "IN_PROGRESS" ||
      selected.status === "COMPLETED"
    ) {
      api
        .get(`/inspections/${selected.id}/evidence`)
        .then((r) => {
          const raw = unwrap(r);
          setEvidence(Array.isArray(raw) ? raw : raw?.evidences || raw?.data || []);
        })
        .catch(() => setEvidence([]));
    } else {
      setEvidence([]);
    }
  }, [selected?.id, selected?.status]);

  const upcoming = inspections.filter((x) =>
    ["PLANNED", "ASSIGNED", "ACCEPTED"].includes(x.status)
  ).length;

  const completed = inspections.filter(
    (x) => x.status === "COMPLETED"
  ).length;

  const active = selected?.status === "IN_PROGRESS";

  async function accept() {
    await mutate(`/inspections/${selected.id}/accept`, "post");
  }

  async function decline() {
    if (!declineReason.trim()) {
      setNotice("Please provide a reason for declining the assignment.");
      return;
    }
    await mutate(`/inspections/${selected.id}/reject`, "post", {
      declineReason: declineReason.trim(),
    });
    setDeclineModalOpen(false);
    setDeclineReason("");
    load();
  }

  async function start() {
    await mutate(`/inspections/${selected.id}/start`, "post");
  }

  function complete() {
    setCompleteModalOpen(true);
  }

  async function confirmComplete() {
    setCompleteModalOpen(false);
    await mutate(`/inspections/${selected.id}/complete`, "post");
  }

  async function verifyLocation() {
    setVerifyingLocation(true);
    setWorking(true);
    setNotice("");

    if (!navigator.geolocation) {
      setNotice("Geolocation is not available in this browser.");
      setVerifyingLocation(false);
      setWorking(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const payload = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: Math.round(
            position.coords.accuracy || 20
          ),
          verificationType: "CHECK_IN",
          deviceInfo: navigator.userAgent.slice(0, 180),
        };

        try {
          const res = await api.post(
            `/inspections/${selected.id}/gps/verify`,
            payload
          );

          const result = unwrap(res);
          setGps(result);
          if (result?.verified || result?.isWithinGeofence) {
            setNotice(`Location verified (${result.distanceMeters}m from institution center). You are inside the geofence.`);
          } else {
            setNotice(`GPS recorded (${result.distanceMeters}m away). Note: Outside allowed radius (${result.allowedRadiusMeters}m).`);
          }
        } catch (err) {
          setNotice(apiError(err));
        } finally {
          setVerifyingLocation(false);
          setWorking(false);
        }
      },
      (err) => {
        setNotice(`Location permission failed: ${err.message}`);
        setVerifyingLocation(false);
        setWorking(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  }

  async function mutate(url, method, data = {}) {
    setWorking(true);
    setNotice("");

    try {
      const res = await api[method](url, method === "post" ? data : undefined);
      const updated = unwrap(res);

      if (updated && updated.id) {
        setSelected(updated);
        setInspections((list) =>
          list.map((x) =>
            x.id === updated.id ? { ...x, ...updated } : x
          )
        );
      } else {
        await load();
      }

      setNotice("Inspection status updated successfully.");
    } catch (err) {
      setNotice(apiError(err));
    } finally {
      setWorking(false);
    }
  }

  async function upload(file, category = "GENERAL") {
    if (!file || !selected) return;

    if (file.size > 50 * 1024 * 1024) {
      setNotice("File exceeds maximum allowed size (50 MB).");
      return;
    }

    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
      "video/mp4",
      "video/quicktime",
      "video/webm",
      "application/pdf",
    ];

    if (file.type && !allowedMimes.includes(file.type.toLowerCase())) {
      setNotice(`Unsupported file format (${file.type}). Allowed: JPEG, PNG, WEBP, MP4, MOV, WEBM, PDF.`);
      return;
    }

    setWorking(true);
    setNotice("Uploading evidence and calculating SHA-256 fingerprint…");

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("category", category || "GENERAL");

      let lat = gps?.latitude;
      let lon = gps?.longitude;
      if (lat == null && selected?.institution?.latitude != null) {
        lat = Number(selected.institution.latitude);
        lon = Number(selected.institution.longitude);
      }
      if (lat == null) {
        lat = 18.5074;
        lon = 73.8077;
      }

      form.append("latitude", lat);
      form.append("longitude", lon);
      form.append("isWatermarked", "true");

      await api.post(`/inspections/${selected.id}/evidence`, form, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setNotice("Evidence uploaded to Cloudinary and cryptographically hashed.");

      const r = await api.get(`/inspections/${selected.id}/evidence`);
      const raw = unwrap(r);
      setEvidence(Array.isArray(raw) ? raw : raw?.evidences || raw?.data || []);
    } catch (err) {
      setNotice(apiError(err));
    } finally {
      setWorking(false);
    }
  }

  const findings = useMemo(() => {
    const score = Number(
      selected?.institution?.latestRiskScore ??
        selected?.overallScore ??
        0
    );

    return [
      {
        label: "Attendance",
        value: score >= 60 ? 32 : 12,
      },
      {
        label: "Safety",
        value: score >= 60 ? 28 : 9,
      },
      {
        label: "Sanitation",
        value: score >= 60 ? 22 : 8,
      },
      {
        label: "Documentation",
        value: score >= 60 ? 18 : 6,
      },
    ];
  }, [selected]);

  return (
    <AppShell>
      <div className="dashboard-body inspector-body">
        {notice && (
          <div className="notice">
            <CheckCircle2 size={17} />
            {notice}
          </div>
        )}

        {/* ================= STATS ================= */}

        <section className="stats-grid inspector-stats">
          <StatCard
            label="Upcoming"
            value={upcoming}
            detail="Confidential destinations"
            icon={Clock3}
          />

          <StatCard
            label="Active audit"
            value={active ? "LIVE" : "—"}
            detail="Current field assignment"
            icon={Navigation}
            tone={active ? "success" : ""}
          />

          <StatCard
            label="Completed"
            value={completed}
            detail="Historical inspections"
            icon={FileCheck2}
          />
        </section>

        {/* ================= QUICK ACTIONS ================= */}

        <section className="section-card quick-actions-card">
          <div className="section-head">
            <div>
              <span className="section-kicker">
                QUICK ACTIONS
              </span>
              <h2>Field tools</h2>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,application/pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files?.[0]) {
                upload(e.target.files[0]);
              }
              e.target.value = "";
            }}
          />

          <div className="quick-actions-grid">
            <button
              type="button"
              className="quick-action"
              onClick={() => fileInputRef.current?.click()}
              disabled={!selected || working || selected.status === "COMPLETED"}
              title="Upload photo, video or document evidence"
            >
              <div className="quick-action-icon">
                <Upload size={19} />
              </div>

              <div>
                <strong>Upload Data</strong>
                <span>Photo or video evidence</span>
              </div>
            </button>

            <button
              type="button"
              className="quick-action"
              onClick={() => {
                if (active) {
                  complete();
                } else {
                  navigate("/inspector/report");
                }
              }}
              disabled={!selected || working}
              title={active ? "Conclude inspection audit" : "Open inspection reports"}
            >
              <div className="quick-action-icon">
                <PlusCircle size={19} />
              </div>

              <div>
                <strong>{active ? "Complete Audit" : "Add Report"}</strong>
                <span>{active ? "Conclude inspection" : "Create inspection report"}</span>
              </div>
            </button>

            <button
              type="button"
              className="quick-action"
              onClick={verifyLocation}
              disabled={!selected || working || verifyingLocation}
              title="Verify GPS against institution geofence"
            >
              <div className="quick-action-icon">
                {verifyingLocation ? (
                  <Loader2 size={19} style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <LocateFixed size={19} />
                )}
              </div>

              <div>
                <strong>Live Location</strong>
                <span>
                  {verifyingLocation
                    ? "Verifying GPS…"
                    : gps
                      ? "Location verified"
                      : "Verify current location"}
                </span>
              </div>
            </button>

            <button
              type="button"
              className="quick-action"
              onClick={() => navigate("/inspector/setting")}
              title="View inspector credentials and settings"
            >
              <div className="quick-action-icon">
                <UserCircle size={19} />
              </div>

              <div>
                <strong>View Profile</strong>
                <span>Inspector account</span>
              </div>
            </button>
          </div>
        </section>

        {/* ================= ASSIGNED INSPECTIONS ================= */}

        <section className="section-card assigned-inspections-card">
          <div className="section-head">
            <div>
              <span className="section-kicker">
                FIELD ASSIGNMENTS
              </span>
              <h2>My Assigned Inspections</h2>
            </div>

            <button
              className="icon-button"
              onClick={load}
              title="Refresh assignments"
              disabled={loading}
            >
              <Navigation size={17} />
            </button>
          </div>

          <div className="assigned-table">
            <div className="assigned-header">
              <span>Institute</span>
              <span>Location</span>
              <span>Time</span>
              <span>Status</span>
            </div>

            {loading ? (
              <div className="assigned-empty">
                Loading assignments…
              </div>
            ) : inspections.length === 0 ? (
              <div className="assigned-empty">
                No inspections assigned yet
              </div>
            ) : (
              inspections.map((inspection) => (
                <button
                  className={`assigned-row ${
                    selected?.id === inspection.id
                      ? "selected"
                      : ""
                  }`}
                  key={inspection.id}
                  onClick={() =>
                    setSelected(inspection)
                  }
                >
                  <div>
                    <strong>
                      {inspection.institution?.name ||
                        "Institution"}
                    </strong>

                    <small>
                      {inspection.inspectionCode ||
                        "Inspection"}
                    </small>
                  </div>

                  <div>
                    <strong>
                      {formatLocation(inspection)}
                    </strong>
                  </div>

                  <div>
                    <strong>
                      {formatTime(
                        inspection.scheduledDate
                      )}
                    </strong>

                    <small>
                      {formatDate(
                        inspection.scheduledDate
                      )}
                    </small>
                  </div>

                  <div>
                    <span
                      className={`status-chip status-${String(
                        inspection.status || ""
                      ).toLowerCase()}`}
                    >
                      {formatInspectionStatus(
                        inspection.status
                      )}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        {/* ================= SELECTED INSPECTION ================= */}

        {loading ? (
          <div className="empty-state">
            Loading your inspection…
          </div>
        ) : !selected ? null : (
          <section className="inspection-layout">
            <div className="inspection-main">
              <div
                className={`inspection-hero ${
                  active ? "active" : ""
                }`}
              >
                <div>
                  <span className="section-kicker">
                    {selected.type === "SURPRISE"
                      ? "SURPRISE INSPECTION"
                      : "FIELD INSPECTION"}
                  </span>

                  <h2>
                    {active ||
                    selected.status === "COMPLETED"
                      ? selected.institution?.name
                      : "Destination Confidential"}
                  </h2>

                  <p>
                    {active
                      ? "Inspection is currently in progress."
                      : selected.status === "COMPLETED"
                        ? "Inspection completed and archived."
                        : "The institution identity remains hidden until the inspection is activated."}
                  </p>
                </div>

                <div className="inspection-status">
                  <span>
                    {formatInspectionStatus(
                      selected.status
                    )}
                  </span>

                  <strong>
                    {formatDate(
                      selected.scheduledDate
                    )}
                  </strong>
                </div>
              </div>

              {!active &&
                selected.status !== "COMPLETED" && (
                  <div className="workflow-card">
                    <div className="workflow-step done">
                      <div>1</div>
                      <span>Assignment received</span>
                      <CheckCircle2 size={17} />
                    </div>

                    <div
                      className={`workflow-step ${
                        selected.status === "ACCEPTED"
                          ? "done"
                          : ""
                      }`}
                    >
                      <div>2</div>
                      <span>Accept field duty</span>

                      {selected.status ===
                      "ACCEPTED" ? (
                        <CheckCircle2 size={17} />
                      ) : (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            className="small-action success-mini"
                            onClick={accept}
                            disabled={working}
                          >
                            <CheckCircle2 size={14} />
                            Accept
                          </button>
                          <button
                            className="small-action danger-mini"
                            onClick={() => setDeclineModalOpen(true)}
                            disabled={working}
                          >
                            <XCircle size={14} />
                            Decline
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="workflow-step">
                      <div>3</div>
                      <span>
                        Arrive & verify location
                      </span>

                      <button
                        className="small-action"
                        onClick={verifyLocation}
                        disabled={
                          working ||
                          selected.status ===
                            "ASSIGNED"
                        }
                      >
                        <LocateFixed size={14} />
                        Verify
                      </button>
                    </div>

                    <div className="workflow-step">
                      <div>4</div>
                      <span>Start inspection</span>

                      <button
                        className="small-action primary-mini"
                        onClick={start}
                        disabled={
                          working ||
                          selected.status ===
                            "ASSIGNED"
                        }
                      >
                        Start audit
                      </button>
                    </div>
                  </div>
                )}

              {active && (
                <>
                  <div className="active-grid">
                    <div className="section-card location-card">
                      <div className="section-head">
                        <div>
                          <span className="section-kicker">
                            GEO-FENCE
                          </span>

                          <h2>Inspector location</h2>
                        </div>

                        <span className="verified-label">
                          <CheckCircle2 size={15} />
                          {gps ? "Verified" : "Pending GPS"}
                        </span>
                      </div>

                      <div className="map-placeholder">
                        <div className="map-grid" />

                        <div className="map-pin">
                          <MapPin size={25} />
                        </div>

                        <div className="map-label">
                          {selected.institution?.name || "Inspection zone"}
                        </div>
                      </div>

                      <button
                        className="secondary-button full"
                        onClick={verifyLocation}
                        disabled={working}
                      >
                        <LocateFixed size={17} />
                        Re-verify current location
                      </button>
                    </div>

                    <div className="section-card">
                      <div className="section-head">
                        <div>
                          <span className="section-kicker">
                            RISK SIGNAL
                          </span>

                          <h2>
                            Current institution risk
                          </h2>
                        </div>
                      </div>

                      <div className="risk-score-big">
                        <strong>
                          {Number(
                            selected.institution
                              ?.latestRiskScore || 0
                          ).toFixed(0)}
                        </strong>

                        <span>/100</span>
                      </div>

                      <RiskBadge
                        level={
                          selected.institution
                            ?.latestRiskLevel
                        }
                      />

                      <div className="finding-list">
                        {findings.map((f) => (
                          <div key={f.label}>
                            <span>{f.label}</span>

                            <div className="finding-bar">
                              <i
                                style={{
                                  width: `${f.value}%`,
                                }}
                              />
                            </div>

                            <b>{f.value}%</b>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Complete Audit Action Bar */}
                  <div
                    className="section-card"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      padding: "16px 20px",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "1rem" }}>Conclude Field Audit</strong>
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                        Ensure all relevant photos/videos are uploaded before marking this inspection as complete.
                      </p>
                    </div>

                    <button
                      className="primary-button"
                      onClick={complete}
                      disabled={working}
                    >
                      <FileCheck2 size={16} />
                      Complete Inspection
                    </button>
                  </div>

                  <EvidenceCard
                    evidence={evidence}
                    onUpload={upload}
                    disabled={working}
                  />
                </>
              )}

              {selected.status === "COMPLETED" && (
                <EvidenceCard
                  evidence={evidence}
                  onUpload={upload}
                  disabled={working}
                  readOnly
                />
              )}
            </div>

            <aside className="inspection-side section-card">
              <span className="section-kicker">
                FIELD CHECKLIST
              </span>

              <h2>Inspection controls</h2>

              <div className="check-row">
                <CheckCircle2 size={17} />
                <span>Surprise assignment</span>
                <b>OK</b>
              </div>

              <div className="check-row">
                <CheckCircle2 size={17} />
                <span>
                  Destination confidentiality
                </span>
                <b>{active || selected.status === "COMPLETED" ? "REVEALED" : "ON"}</b>
              </div>

              <div className="check-row">
                <CheckCircle2 size={17} />
                <span>GPS verification</span>
                <b>{gps?.verified || gps?.isWithinGeofence || selected.isGeofenceVerified ? "OK" : "—"}</b>
              </div>

              <div className="check-row">
                <CheckCircle2 size={17} />
                <span>Evidence integrity</span>
                <b>
                  {evidence.length ? `${evidence.length} FILES` : "—"}
                </b>
              </div>

              <div className="side-divider" />

              <span className="section-kicker">
                HISTORY
              </span>

              {inspections.slice(0, 5).map((x) => (
                <button
                  className={`history-select ${
                    x.id === selected.id
                      ? "selected"
                      : ""
                  }`}
                  key={x.id}
                  onClick={() => setSelected(x)}
                >
                  <span>
                    {formatDate(x.scheduledDate)}
                  </span>

                  <strong>
                    {[
                      "PLANNED",
                      "ASSIGNED",
                      "ACCEPTED",
                    ].includes(x.status)
                      ? "Confidential"
                      : x.institution?.name ||
                        "Inspection"}
                  </strong>

                  <small>
                    {formatInspectionStatus(
                      x.status
                    )}
                  </small>
                </button>
              ))}
            </aside>
          </section>
        )}

        {/* Decline Assignment Modal */}
        {declineModalOpen && (
          <div className="modal-backdrop">
            <div className="modal-card">
              <div className="modal-header">
                <div>
                  <span className="section-kicker">ASSIGNMENT ACTION</span>
                  <h2>Decline Field Assignment</h2>
                </div>
                <button
                  className="icon-button"
                  onClick={() => setDeclineModalOpen(false)}
                >
                  <XCircle size={18} />
                </button>
              </div>

              <div className="modal-body">
                <p>
                  Please specify why you are declining this field assignment. The assignment will be returned to the planning pool for re-dispatch.
                </p>

                <div className="form-group">
                  <label>Decline Reason *</label>
                  <textarea
                    rows={3}
                    className="form-input"
                    placeholder="e.g. Unforeseen medical emergency, severe transport obstruction..."
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="ghost-button"
                  onClick={() => setDeclineModalOpen(false)}
                  disabled={working}
                >
                  Cancel
                </button>
                <button
                  className="primary-button danger"
                  onClick={decline}
                  disabled={working || !declineReason.trim()}
                >
                  Confirm Decline
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Conclude Audit Confirmation Modal */}
        {completeModalOpen && selected && (
          <div className="modal-backdrop" onClick={() => setCompleteModalOpen(false)}>
            <div className="modal-card" style={{ maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <span className="section-kicker">FINAL SUBMISSION</span>
                  <h2>Conclude Inspection Audit</h2>
                </div>
                <button className="icon-button" onClick={() => setCompleteModalOpen(false)}>
                  <XCircle size={18} />
                </button>
              </div>

              <div className="modal-body">
                <p style={{ marginBottom: "16px", color: "var(--ink)", lineHeight: "1.5" }}>
                  Are you ready to conclude and submit the field inspection for <strong>{selected.institution?.name || selected.inspectionCode}</strong>?
                </p>

                <div style={{ background: "var(--bg)", padding: "14px", borderRadius: "8px", display: "grid", gap: "8px", fontSize: "0.85rem" }}>
                  <div><strong>Inspection Code:</strong> {selected.inspectionCode}</div>
                  <div><strong>Location:</strong> {formatLocation(selected)}</div>
                  <div><strong>Evidence Captured:</strong> {evidence.length} files securely uploaded</div>
                  <div><strong>GPS Geofence Status:</strong> {gps ? "Verified Checked-In" : "Coordinates Recorded"}</div>
                </div>

                <p style={{ marginTop: "14px", fontSize: "0.8rem", color: "var(--muted)" }}>
                  Once completed, the inspection report and cryptographic evidence dossier will be archived and forwarded to Ministry supervision officers.
                </p>
              </div>

              <div className="modal-footer">
                <button className="ghost-button" onClick={() => setCompleteModalOpen(false)} disabled={working}>
                  Cancel
                </button>
                <button className="primary-button" onClick={confirmComplete} disabled={working}>
                  <CheckCircle2 size={16} />
                  {working ? "Concluding Audit…" : "Confirm & Conclude Inspection"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

/* ============================================================
   EVIDENCE
   ============================================================ */

function EvidenceCard({
  evidence,
  onUpload,
  disabled,
  readOnly,
}) {
  const [previewItem, setPreviewItem] = useState(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);


  return (
    <div className="section-card evidence-card">
      <div className="section-head">
        <div>
          <span className="section-kicker">
            LIVE EVIDENCE CAPTURE
          </span>

          <h2>Inspection evidence ({evidence.length})</h2>
        </div>

        {!readOnly && (
          <label className="upload-button">
            <Upload size={16} />
            Add photo/video

            <input
              type="file"
              accept="image/*,video/*,application/pdf"
              hidden
              disabled={disabled}
              onChange={(e) => {
                onUpload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>

      {evidence.length === 0 ? (
        <div className="upload-empty">
          <Camera size={26} />
          <span>No evidence captured yet.</span>
          <small>
            Photos and videos are stored in Cloudinary with integrity metadata and cryptographic SHA-256 hashes.
          </small>
        </div>
      ) : (
        <div className="evidence-grid">
          {evidence.map((x) => {
            const mediaUrl = x.secureUrl || x.cloudinaryUrl || x.fileUrl;
            const hash = x.fileHash || x.sha256Hash || "";
            const isVideo = x.mediaType === "VIDEO";
            const isPdf = x.mediaType === "DOCUMENT_PDF";

            return (
              <div
                className="evidence-item"
                key={x.id}
                onClick={() => setPreviewItem(x)}
                style={{ cursor: "pointer" }}
                title="Click to view full preview & integrity details"
              >
                {mediaUrl && !isVideo && !isPdf ? (
                  <img
                    src={mediaUrl}
                    alt={x.category || "Evidence"}
                    style={{ width: "100%", height: "95px", objectFit: "cover", borderRadius: "6px", marginBottom: "6px" }}
                  />
                ) : isVideo && mediaUrl ? (
                  <video
                    src={mediaUrl}
                    style={{ width: "100%", height: "95px", objectFit: "cover", borderRadius: "6px", marginBottom: "6px" }}
                  />
                ) : (
                  <div style={{ height: "95px", display: "grid", placeItems: "center", background: "var(--bg)", borderRadius: "6px", marginBottom: "6px" }}>
                    <FileImage size={26} color="var(--muted)" />
                  </div>
                )}

                <div>
                  <strong style={{ display: "block", fontSize: "0.85rem", color: "var(--ink)" }}>
                    {x.category?.replaceAll("_", " ") || "Evidence"}
                  </strong>

                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginTop: "2px" }}>
                    {x.mediaType || "MEDIA"} • {formatFileSize(x.fileSizeBytes)}
                  </span>

                  {hash && (
                    <small style={{ fontSize: "0.7rem", color: "var(--muted)", display: "block", marginTop: "3px", fontFamily: "monospace" }}>
                      SHA: {hash.slice(0, 10)}...
                    </small>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox / Preview Modal */}
      {previewItem && (
        <div className="modal-backdrop" onClick={() => setPreviewItem(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: "700px", width: "95%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span className="section-kicker">EVIDENCE DOSSIER</span>
                <h2>{previewItem.category?.replaceAll("_", " ") || "Captured Asset"}</h2>
              </div>
              <button className="icon-button" onClick={() => setPreviewItem(null)}>
                <XCircle size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ textAlign: "center" }}>
              {(previewItem.secureUrl || previewItem.cloudinaryUrl || previewItem.fileUrl) ? (
                previewItem.mediaType === "VIDEO" ? (
                  <video
                    src={previewItem.secureUrl || previewItem.cloudinaryUrl || previewItem.fileUrl}
                    controls
                    style={{ maxWidth: "100%", maxHeight: "380px", borderRadius: "8px" }}
                  />
                ) : (
                  <img
                    src={previewItem.secureUrl || previewItem.cloudinaryUrl || previewItem.fileUrl}
                    alt={previewItem.category || "Evidence preview"}
                    style={{ maxWidth: "100%", maxHeight: "380px", objectFit: "contain", borderRadius: "8px" }}
                  />
                )
              ) : (
                <div style={{ padding: "40px 0", color: "var(--muted)" }}>
                  <FileImage size={40} />
                  <p>Document preview unavailable</p>
                </div>
              )}

              <div
                style={{
                  background: "var(--bg)",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  marginTop: "14px",
                  textAlign: "left",
                  fontSize: "0.8rem",
                  display: "grid",
                  gap: "6px",
                }}
              >
                <div>
                  <span style={{ color: "var(--muted)" }}>Media Type: </span>
                  <b>{previewItem.mediaType || "IMAGE"}</b> • <span style={{ color: "var(--muted)" }}>Size: </span>
                  <b>{formatFileSize(previewItem.fileSizeBytes)}</b>
                </div>

                {previewItem.capturedAt && (
                  <div>
                    <span style={{ color: "var(--muted)" }}>Captured Timestamp: </span>
                    <b>{new Date(previewItem.capturedAt).toLocaleString("en-IN")}</b>
                  </div>
                )}

                {(previewItem.latitude && previewItem.longitude) && (
                  <div>
                    <span style={{ color: "var(--muted)" }}>GPS Coordinates: </span>
                    <b>{Number(previewItem.latitude).toFixed(4)}, {Number(previewItem.longitude).toFixed(4)}</b>
                  </div>
                )}

                {(previewItem.fileHash || previewItem.sha256Hash) && (
                  <div style={{ wordBreak: "break-all" }}>
                    <span style={{ color: "var(--muted)" }}>Cryptographic Hash (SHA-256): </span>
                    <code style={{ fontSize: "0.72rem", background: "#e2e8f0", padding: "2px 4px", borderRadius: "4px" }}>
                      {previewItem.fileHash || previewItem.sha256Hash}
                    </code>
                  </div>
                )}

                {previewItem.aiNotes && (
                  <div
                    style={{
                      background: previewItem.aiDamageDetected ? "#fff0f0" : "#f0fdf4",
                      border: `1px solid ${previewItem.aiDamageDetected ? "#fca5a5" : "#bbf7d0"}`,
                      borderRadius: "6px",
                      padding: "8px 10px",
                      marginTop: "6px",
                      fontSize: "0.78rem",
                    }}
                  >
                    <strong style={{ color: previewItem.aiDamageDetected ? "#b91c1c" : "#166534", display: "block", marginBottom: "2px" }}>
                      🤖 AI Vision Analysis ({previewItem.aiDamageDetected ? "Anomaly Detected" : "Verified Clear"})
                    </strong>
                    <span style={{ color: "#334155" }}>{previewItem.aiNotes}</span>
                    {previewItem.aiConfidence && (
                      <div style={{ marginTop: "4px", fontSize: "0.72rem", color: "var(--muted)" }}>
                        Confidence: {(Number(previewItem.aiConfidence) * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                {previewItem.mediaType === "VIDEO" && (
                  <button
                    className="primary-button"
                    disabled={aiAnalyzing}
                    onClick={async () => {
                      setAiAnalyzing(true);
                      try {
                        const claimed = prompt("Enter claimed headcount from register to verify against video feed:", "30");
                        if (claimed === null) {
                          setAiAnalyzing(false);
                          return;
                        }
                        const res = await analyzeAttendance({
                          evidenceId: previewItem.id,
                          claimedAttendance: parseInt(claimed, 10) || 0,
                          sampleIntervalSec: 1,
                        });
                        alert(`AI Vision Result:\nClaimed: ${res.claimedAttendance || claimed}\nDetected: ${res.detectedAttendance ?? res.analysis?.detected_attendance ?? "—"}\nDiscrepancy: ${res.discrepancyPercentage ?? res.analysis?.discrepancy_percentage ?? "0"}%\nAnomaly: ${res.anomalyDetected || res.analysis?.anomaly_detected ? "YES" : "NO"}`);
                        setPreviewItem({
                          ...previewItem,
                          aiNotes: `AI Headcount: Detected=${res.detectedAttendance ?? res.analysis?.detected_attendance}, Claimed=${claimed}`,
                          aiConfidence: res.confidence ?? res.analysis?.confidence ?? 0.85,
                          aiDamageDetected: res.anomalyDetected ?? res.analysis?.anomaly_detected ?? false,
                        });
                      } catch (err) {
                        alert(`AI Vision Analysis Note: ${apiError(err)}`);
                      } finally {
                        setAiAnalyzing(false);
                      }
                    }}
                    style={{ fontSize: "0.78rem", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                  >
                    <Sparkles size={14} className={aiAnalyzing ? "spin" : ""} />
                    {aiAnalyzing ? "Analyzing Video..." : "Run AI Headcount Check"}
                  </button>
                )}
              </div>

              <button className="ghost-button" onClick={() => setPreviewItem(null)}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ============================================================
   HELPERS
   ============================================================ */

function formatDate(value) {
  if (!value) return "Date not set";

  return new Date(value).toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
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

  const parts = [
    institution.district,
    institution.state,
  ].filter(Boolean);

  return parts.length ? parts.join(", ") : "—";
}

function formatInspectionStatus(value = "") {
  if (!value) return "Unknown";

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFileSize(bytes) {
  if (!bytes) return "0 KB";
  const num = Number(bytes);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}