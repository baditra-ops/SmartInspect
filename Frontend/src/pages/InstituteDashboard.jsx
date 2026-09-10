import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  CircleCheck,
  Video,
  MapPin,
  Tv,
  Play,
  X,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import AppShell from "../components/AppShell";
import RiskBadge from "../components/RiskBadge";
import StatCard from "../components/StatCard";
import api, { apiError, unwrap } from "../services/api";
import { cctvService } from "../services/cctv.service";
import { useAuth } from "../context/AuthContext";

export default function InstituteDashboard() {
  const { user } = useAuth();

  const [institution, setInstitution] = useState(null);
  const [inspections, setInspections] = useState([]);
  const [riskHistory, setRiskHistory] = useState([]);
  const [cctvDevices, setCctvDevices] = useState([]);
  const [selectedStreamDevice, setSelectedStreamDevice] = useState(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const instRes = await api.get("/institutions", {
          params: {
            page: 1,
            limit: 10,
          },
        });

        const rawList = unwrap(instRes);
        const list = Array.isArray(rawList)
          ? rawList
          : (Array.isArray(rawList?.data) ? rawList.data : (Array.isArray(rawList?.institutions) ? rawList.institutions : []));

        const own =
          list.find(
            (x) => x.id === user?.institutionId
          ) || list[0];

        setInstitution(own);

        if (own?.id) {
          const [inspRes, riskRes, cctvRes] =
            await Promise.all([
              api.get("/inspections", {
                params: {
                  institutionId: own.id,
                  page: 1,
                  limit: 20,
                  sortBy: "scheduledDate",
                  sortOrder: "desc",
                },
              }),

              api.get(
                `/ai/risk-assessments/${own.id}`,
                {
                  params: {
                    page: 1,
                    limit: 20,
                  },
                }
              ),

              cctvService.getCctvDevices({ institutionId: own.id }).catch(() => ({ devices: [] })),
            ]);

          const rawInsp = unwrap(inspRes);
          const inspList = Array.isArray(rawInsp)
            ? rawInsp
            : (Array.isArray(rawInsp?.data) ? rawInsp.data : (Array.isArray(rawInsp?.inspections) ? rawInsp.inspections : []));
          setInspections(inspList);

          const rawRisk = unwrap(riskRes);
          const riskList = Array.isArray(rawRisk)
            ? rawRisk
            : (Array.isArray(rawRisk?.data) ? rawRisk.data : (Array.isArray(rawRisk?.assessments) ? rawRisk.assessments : []));
          setRiskHistory(riskList);

          setCctvDevices(cctvRes.devices || []);
        }
      } catch (err) {
        setNotice(apiError(err));
      }
    }

    load();
  }, [user?.institutionId]);

  const latestInspection = Array.isArray(inspections) ? inspections[0] : null;

  /*
   * Build risk distribution from available risk
   * assessment records.
   *
   * If historical assessments exist, each assessment
   * is classified into Low / Potential / High.
   *
   * If there are no historical assessments, fall
   * back to the institution's current risk score.
   */
  const riskDistribution = useMemo(() => {
    const distribution = {
      Low: 0,
      Potential: 0,
      High: 0,
    };

    const items = Array.isArray(riskHistory)
      ? riskHistory
      : (Array.isArray(riskHistory?.data) ? riskHistory.data : []);

    if (items.length > 0) {
      items.forEach((item) => {
        const score = Number(
          item?.riskScore ??
          item?.score ??
          0
        );

        if (score < 40) {
          distribution.Low++;
        } else if (score < 70) {
          distribution.Potential++;
        } else {
          distribution.High++;
        }
      });
    } else if (institution) {
      const score = Number(
        institution.latestRiskScore || 0
      );

      if (score < 40) {
        distribution.Low = 1;
      } else if (score < 70) {
        distribution.Potential = 1;
      } else {
        distribution.High = 1;
      }
    }

    return distribution;
  }, [riskHistory, institution]);

  const totalRisk =
    riskDistribution.Low +
    riskDistribution.Potential +
    riskDistribution.High;

  const pieStyle = useMemo(() => {
    if (!totalRisk) {
      return {
        background:
          "conic-gradient(#e9edf2 0deg 360deg)",
      };
    }

    const lowDegrees =
      (riskDistribution.Low / totalRisk) * 360;

    const potentialDegrees =
      (riskDistribution.Potential / totalRisk) *
      360;

    const highStart =
      lowDegrees + potentialDegrees;

    return {
      background: `conic-gradient(
        #16835b 0deg ${lowDegrees}deg,
        #d6a000 ${lowDegrees}deg ${highStart}deg,
        #c24141 ${highStart}deg 360deg
      )`,
    };
  }, [riskDistribution, totalRisk]);

  return (
    <AppShell>
      <div className="dashboard-body">
        {notice && (
          <div className="notice">
            {notice}
          </div>
        )}

        {/* ================= STATS ================= */}

        <section className="stats-grid">
          <StatCard
            label="Latest inspection"
            value={
              latestInspection
                ? formatDate(
                  latestInspection.scheduledDate
                )
                : "—"
            }
            detail={
              latestInspection?.type ||
              "No inspection recorded"
            }
            icon={CalendarDays}
          />

          <StatCard
            label="CCTV status"
            value={
              cctvDevices.length === 0
                ? "No Cameras"
                : `${cctvDevices.filter((c) => c.status === "ONLINE").length}/${cctvDevices.length} Online`
            }
            detail={
              cctvDevices.length === 0
                ? "No surveillance feeds linked"
                : cctvDevices.every((c) => c.status === "ONLINE")
                ? "All surveillance units online"
                : `${cctvDevices.filter((c) => c.status !== "ONLINE").length} camera(s) offline / faulty`
            }
            icon={Video}
            tone={
              cctvDevices.length === 0
                ? undefined
                : cctvDevices.every((c) => c.status === "ONLINE")
                ? "success"
                : "warning"
            }
          />

          <StatCard
            label="Inspections"
            value={inspections.length}
            detail="Recorded for this facility"
            icon={Activity}
          />
        </section>

        {/* ================= RISK + PROFILE ================= */}

        <section className="institute-grid">
          <div className="section-card">
            <div className="section-head">
              <div>
                <span className="section-kicker">
                  CURRENT STATUS
                </span>

                <h2>Institution risk profile</h2>
              </div>

              <RiskBadge
                level={
                  institution?.latestRiskLevel
                }
                score={Number(
                  institution?.latestRiskScore || 0
                )}
              />
            </div>

            <div className="risk-meter">
              <div
                className="risk-meter-fill"
                style={{
                  width: `${Math.min(
                    Number(
                      institution?.latestRiskScore ||
                      0
                    ),
                    100
                  )}%`,
                }}
              />

              <span>
                {Number(
                  institution?.latestRiskScore || 0
                ).toFixed(0)}
              </span>
            </div>

            <div className="risk-scale">
              <span>Low</span>
              <span>Moderate</span>
              <span>High</span>
              <span>Critical</span>
            </div>

            <div className="profile-facts">
              <div>
                <span>Institution</span>
                <strong>
                  {institution?.name || "—"}
                </strong>
              </div>

              <div>
                <span>Location</span>
                <strong>
                  {institution?.district || "—"},{" "}
                  {institution?.state || "—"}
                </strong>
              </div>

              <div>
                <span>Occupancy</span>
                <strong>
                  {institution?.currentOccupancy ??
                    "—"}{" "}
                  /{" "}
                  {institution?.capacity ?? "—"}
                </strong>
              </div>
            </div>
          </div>

          {/* ================= RISK DISTRIBUTION ================= */}

          <div className="section-card">
            <div className="section-head">
              <div>
                <span className="section-kicker">
                  RISK ANALYTICS
                </span>

                <h2>Risk distribution</h2>
              </div>
            </div>

            {totalRisk === 0 ? (
              <div className="empty-state">
                No risk assessment data available.
              </div>
            ) : (
              <div className="institute-risk-chart">
                <div
                  className="institute-risk-pie"
                  style={pieStyle}
                >
                  <div className="institute-risk-pie-center">
                    <strong>{totalRisk}</strong>
                    <span>Assessments</span>
                  </div>
                </div>

                <div className="institute-risk-legend">
                  <div className="institute-risk-legend-row">
                    <span className="institute-risk-dot low" />

                    <span>Low risk</span>

                    <strong>
                      {riskDistribution.Low}
                    </strong>
                  </div>

                  <div className="institute-risk-legend-row">
                    <span className="institute-risk-dot potential" />

                    <span>
                      Potential / Medium
                    </span>

                    <strong>
                      {riskDistribution.Potential}
                    </strong>
                  </div>

                  <div className="institute-risk-legend-row">
                    <span className="institute-risk-dot high" />

                    <span>High risk</span>

                    <strong>
                      {riskDistribution.High}
                    </strong>
                  </div>

                  <div className="institute-risk-chart-note">
                    <span>
                      High-risk findings require
                      immediate attention.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ================= PAST INSPECTIONS ================= */}

        <section className="section-card">
          <div className="section-head">
            <div>
              <span className="section-kicker">
                INSPECTION RECORD
              </span>

              <h2>Past inspections</h2>
            </div>
          </div>

          {inspections.length === 0 ? (
            <div className="empty-state large">
              <CheckCircle2 size={30} />

              <h3>No inspection record</h3>

              <p>
                No inspections have been recorded
                for this institution.
              </p>
            </div>
          ) : (
            <div className="institute-history-table">
              <div className="institute-history-header">
                <span>Date</span>
                <span>Type</span>
                <span>Inspector</span>
                <span>Status</span>
              </div>

              {inspections.map((inspection) => (
                <div
                  className="institute-history-row"
                  key={inspection.id}
                >
                  <div>
                    <strong>
                      {formatDate(
                        inspection.scheduledDate
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      {formatInspectionType(
                        inspection.type
                      )}
                    </span>
                  </div>

                  <div>
                    <span>
                      {inspection.currentInspector
                        ?.fullName ||
                        inspection.inspector
                          ?.fullName ||
                        "Inspector assigned"}
                    </span>
                  </div>

                  <div>
                    <span
                      className={`status-chip status-${String(
                        inspection.status || ""
                      ).toLowerCase()}`}
                    >
                      {formatStatus(
                        inspection.status
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ================= SURVEILLANCE & CCTV FEEDS ================= */}
        <section className="section-card" style={{ marginTop: "24px" }}>
          <div className="section-head">
            <div>
              <span className="section-kicker">REAL-TIME SURVEILLANCE</span>
              <h2>Facility CCTV Cameras ({cctvDevices.length})</h2>
            </div>
          </div>

          {cctvDevices.length === 0 ? (
            <div className="institute-empty-state">
              <Video size={28} />
              <p>No CCTV surveillance units are registered for this facility.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px", marginTop: "16px" }}>
              {cctvDevices.map((cam) => {
                const isOnline = cam.status === "ONLINE";
                const isFaulty = cam.status === "FAULTY";
                return (
                  <div
                    key={cam.id}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: "10px",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "10px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                        <strong style={{ fontSize: "14px" }}>{cam.deviceName}</strong>
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
                        {cam.isAiMonitoringEnabled && (
                          <span style={{ fontSize: "11px", color: "var(--blue)", fontWeight: 600 }}>
                            ⚡ Automated AI Headcount Active
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: "10px" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                        {cam.lastPingAt ? `Pinged: ${new Date(cam.lastPingAt).toLocaleTimeString("en-IN")}` : "Active"}
                      </span>
                      <button
                        className="small-action"
                        style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}
                        onClick={() => setSelectedStreamDevice(cam)}
                      >
                        <Play size={12} /> View Feed
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Stream Viewer Modal */}
        {selectedStreamDevice && (
          <div
            className="modal-backdrop"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.7)",
              backdropFilter: "blur(4px)",
              display: "grid",
              placeItems: "center",
              zIndex: 1100,
              padding: "20px",
            }}
          >
            <div
              style={{
                background: "#0f172a",
                borderRadius: "16px",
                width: "min(600px, 100%)",
                padding: "20px",
                color: "white",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <div>
                  <strong style={{ fontSize: "15px" }}>
                    {selectedStreamDevice.deviceName} — {selectedStreamDevice.cameraLocation}
                  </strong>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                    Status: <span style={{ color: selectedStreamDevice.status === "ONLINE" ? "#22c55e" : "#ef4444" }}>{selectedStreamDevice.status}</span>
                  </div>
                </div>
                <button
                  className="icon-button"
                  style={{ color: "white", background: "rgba(255,255,255,0.1)" }}
                  onClick={() => setSelectedStreamDevice(null)}
                >
                  <X size={18} />
                </button>
              </div>

              {selectedStreamDevice.streamUrl &&
              (selectedStreamDevice.streamUrl.startsWith("http://") ||
                selectedStreamDevice.streamUrl.startsWith("https://") ||
                selectedStreamDevice.streamUrl.startsWith("/")) ? (
                <div style={{ borderRadius: "8px", overflow: "hidden", background: "#000" }}>
                  <video
                    src={selectedStreamDevice.streamUrl}
                    controls
                    autoPlay
                    muted
                    playsInline
                    style={{ width: "100%", maxHeight: "360px", display: "block" }}
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
                    Direct RTSP protocols require server-side transcoding for native browser playback.
                  </p>
                  <code style={{ fontSize: "11px", background: "rgba(0,0,0,0.4)", padding: "4px 10px", borderRadius: "4px", color: "#38bdf8" }}>
                    {selectedStreamDevice.streamUrl}
                  </code>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

/* ============================================================
   HELPERS
   ============================================================ */

function formatDate(value) {
  if (!value) return "Date not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date not set";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatStatus(value = "") {
  if (!value || typeof value !== "string") return "Unknown";

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatInspectionType(value = "") {
  if (!value || typeof value !== "string") return "Inspection";

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}