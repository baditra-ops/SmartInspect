import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  CircleCheck,
  Video,
} from "lucide-react";
import AppShell from "../components/AppShell";
import RiskBadge from "../components/RiskBadge";
import StatCard from "../components/StatCard";
import api, { apiError, unwrap } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function InstituteDashboard() {
  const { user } = useAuth();

  const [institution, setInstitution] = useState(null);
  const [inspections, setInspections] = useState([]);
  const [riskHistory, setRiskHistory] = useState([]);
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

        const list = unwrap(instRes) || [];

        console.log("Institute user:", user);
        console.log("Institutions API:", list);
        console.log("User institutionId:", user?.institutionId);

        const own =
          list.find(
            (x) => x.id === user?.institutionId
          ) || list[0];

        setInstitution(own);

        if (own?.id) {
          const [inspRes, riskRes] =
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
            ]);

          setInspections(unwrap(inspRes) || []);
          setRiskHistory(unwrap(riskRes) || []);
        }
      } catch (err) {
        setNotice(apiError(err));
      }
    }

    load();
  }, [user?.institutionId]);

  const latestInspection = inspections[0];

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

    if (riskHistory.length > 0) {
      riskHistory.forEach((item) => {
        const score = Number(
          item.riskScore ??
          item.score ??
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
            value="Online"
            detail="Surveillance system connected"
            icon={Video}
            tone="success"
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
  if (!value) return "Unknown";

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatInspectionType(value = "") {
  if (!value) return "Inspection";

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}