import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  Info,
  RefreshCw,
  Search,
  Send,
  Users,
} from "lucide-react";
import AppShell from "../components/AppShell";
import RiskBadge from "../components/RiskBadge";
import StatCard from "../components/StatCard";
import api, { apiError, unwrap } from "../services/api";

export default function AdminDashboard() {
  const [institutions, setInstitutions] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState(null);

  async function load() {
    setLoading(true);
    setMessage(null);

    try {
      const [instRes, inspRes] = await Promise.all([
        api.get("/institutions", {
          params: {
            page: 1,
            limit: 50,
            sortBy: "latestRiskScore",
            sortOrder: "desc",
          },
        }),
        api.get("/inspections", {
          params: {
            page: 1,
            limit: 20,
            sortBy: "scheduledDate",
            sortOrder: "desc",
          },
        }),
      ]);

      const rawInst = unwrap(instRes);
      const instList = Array.isArray(rawInst)
        ? rawInst
        : Array.isArray(rawInst?.institutions)
        ? rawInst.institutions
        : Array.isArray(rawInst?.data)
        ? rawInst.data
        : [];

      const rawInsp = unwrap(inspRes);
      const inspList = Array.isArray(rawInsp)
        ? rawInsp
        : Array.isArray(rawInsp?.inspections)
        ? rawInsp.inspections
        : Array.isArray(rawInsp?.data)
        ? rawInsp.data
        : [];

      setInstitutions(instList);
      setInspections(inspList);
    } catch (err) {
      setMessage({
        type: "error",
        text: apiError(err),
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const highRisk = useMemo(
    () =>
      institutions.filter((item) => {
        const score = Number(item.latestRiskScore || 0);
        return score >= 60 || item.latestRiskLevel === "HIGH";
      }).length,
    [institutions]
  );

  const activeInspections = useMemo(
    () =>
      inspections.filter((item) =>
        ["PLANNED", "ASSIGNED", "ACCEPTED", "IN_PROGRESS"].includes(
          item.status
        )
      ).length,
    [inspections]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return institutions;

    return institutions.filter((item) => {
      const name = item.name?.toLowerCase() || "";
      const code = item.code?.toLowerCase() || "";
      const district = item.district?.toLowerCase() || "";
      const state = item.state?.toLowerCase() || "";

      return (
        name.includes(q) ||
        code.includes(q) ||
        district.includes(q) ||
        state.includes(q)
      );
    });
  }, [institutions, query]);

  const monthlyInspectionData = useMemo(() => {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sept",
      "Oct",
      "Nov",
      "Dec",
    ];

    const counts = Array(12).fill(0);

    inspections.forEach((insp) => {
      const rawDate =
        insp.createdAt || insp.scheduledDate || insp.startedAt;
      if (!rawDate) return;

      const date = new Date(rawDate);
      if (!Number.isNaN(date.getTime())) {
        counts[date.getMonth()] += 1;
      }
    });

    return months.map((month, idx) => ({
      month,
      count: counts[idx],
    }));
  }, [inspections]);

  const maxInspectionCount = useMemo(() => {
    const max = Math.max(
      ...monthlyInspectionData.map((d) => d.count),
      1
    );
    return max;
  }, [monthlyInspectionData]);

  const riskDistribution = useMemo(() => {
    const distribution = {
      low: 0,
      potential: 0,
      high: 0,
    };

    institutions.forEach((item) => {
      const score = Number(item.latestRiskScore || 0);
      const level = item.latestRiskLevel;

      if (level === "HIGH" || score >= 60) {
        distribution.high += 1;
      } else if (
        level === "MEDIUM" ||
        level === "MODERATE" ||
        (score >= 30 && score < 60)
      ) {
        distribution.potential += 1;
      } else {
        distribution.low += 1;
      }
    });

    return distribution;
  }, [institutions]);

  async function trigger(institutionId) {
    setBusyId(institutionId);
    setMessage(null);

    try {
      const response = await api.post("/inspections/trigger-surprise", {
        institutionId,
      });

      const data = unwrap(response);
      const isNew = data?.isNew !== false;
      const text =
        data?.message ||
        response?.message ||
        (isNew
          ? "Surprise inspection created and dispatched through the JIT engine."
          : "An active inspection is already underway for this facility.");

      setMessage({
        type: isNew ? "success" : "info",
        text,
      });

      await load();
    } catch (err) {
      setMessage({
        type: "error",
        text: apiError(err) || "Failed to trigger surprise inspection.",
      });
    } finally {
      setBusyId(null);
    }
  }

  const renderNotice = (isTop = false) => {
    if (!message) return null;
    const text = typeof message === "string" ? message : message.text;
    const type = typeof message === "string" ? "success" : message.type;
    const className = `notice ${type === "error" ? "notice-error" : type === "info" ? "notice-info" : ""}`;

    return (
      <div className={className} style={isTop ? undefined : { marginBottom: "14px" }}>
        {type === "error" ? (
          <AlertTriangle size={17} />
        ) : type === "info" ? (
          <Info size={17} />
        ) : (
          <CheckCircle2 size={17} />
        )}
        <span>{text}</span>
      </div>
    );
  };

  return (
    <AppShell>
      <div className="dashboard-body">
        {renderNotice(true)}

        {/* ================= STATS ================= */}

        <section className="stats-grid">
          <StatCard
            label="Institutions monitored"
            value={institutions.length}
            detail="Across authorized scope"
            icon={Building2}
          />

          <StatCard
            label="High-risk facilities"
            value={highRisk}
            detail="Priority for intervention"
            icon={AlertTriangle}
            tone="warning"
          />

          <StatCard
            label="Active inspections"
            value={activeInspections}
            detail="Scheduled / assigned / active"
            icon={CalendarDays}
          />
        </section>

        {/* ================= ANALYTICS ================= */}

        <section className="admin-analytics-grid">
          <InspectionTrendChart
            data={monthlyInspectionData}
            maxValue={maxInspectionCount}
          />

          <RiskDistributionChart
            low={riskDistribution.low}
            potential={riskDistribution.potential}
            high={riskDistribution.high}
          />
        </section>

        {/* ================= RISK REGISTER ================= */}

        <section className="section-card">
          <div className="section-head">
            <div>
              <span className="section-kicker">RISK INTELLIGENCE</span>
              <h2>Institution risk register</h2>
            </div>

            <button
              className="icon-button"
              onClick={load}
              title="Refresh"
            >
              <RefreshCw size={17} />
            </button>
          </div>

          {renderNotice(false)}

          <div className="toolbar">
            <div className="search-wrap">
              <Search size={17} />

              <input
                placeholder="Search institution, district or code…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              Loading institutions…
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Institution</th>
                    <th>Location</th>
                    <th>Occupancy</th>
                    <th>Risk</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        <small>{item.code}</small>
                      </td>

                      <td>
                        {item.district || "—"},{" "}
                        {item.state || "—"}
                      </td>

                      <td>
                        {item.currentOccupancy ?? "—"} /{" "}
                        {item.capacity ?? "—"}
                      </td>

                      <td>
                        <RiskBadge
                          level={item.latestRiskLevel}
                          score={item.latestRiskScore}
                        />
                      </td>

                      <td>
                        <button
                          className="small-action"
                          onClick={() => trigger(item.id)}
                          disabled={busyId === item.id}
                        >
                          <Send size={14} />

                          {busyId === item.id
                            ? "Dispatching…"
                            : "Surprise inspect"}
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan="5">
                        <div className="empty-state">
                          No institutions match your search.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

/* ============================================================
   INSPECTION TREND CHART
   ============================================================ */

function InspectionTrendChart({ data, maxValue }) {
  return (
    <section className="section-card chart-card">
      <div className="section-head">
        <div>
          <span className="section-kicker">INSPECTION ACTIVITY</span>
          <h2>Monthly inspection trend</h2>
        </div>

        <BarChart3 size={20} />
      </div>

      {data.length === 0 ? (
        <div className="empty-state">
          No inspection records available for the trend.
        </div>
      ) : (
        <div className="inspection-chart">
          <div className="chart-y-axis">
            <span>{maxValue}</span>
            <span>{Math.ceil(maxValue / 2)}</span>
            <span>0</span>
          </div>

          <div className="chart-content">
            <div className="chart-bars">
              {data.map((item) => {
                const height =
                  (item.count / maxValue) * 100;

                return (
                  <div className="inspection-bar-column" key={item.month}>
                    <span className="chart-value">
                      {item.count}
                    </span>

                    <div className="inspection-bar-track">
                      <i
                        style={{
                          height: `${Math.max(height, 6)}%`,
                        }}
                      />
                    </div>

                    <small>{item.month}</small>
                  </div>
                );
              })}
            </div>

            <div className="chart-x-label">
              Month
            </div>
          </div>

          <div className="chart-y-label">
            Inspection Trend
          </div>
        </div>
      )}
    </section>
  );
}

/* ============================================================
   RISK DISTRIBUTION
   ============================================================ */

function RiskDistributionChart({
  low,
  potential,
  high,
}) {
  const total = low + potential + high;

  const lowPercent = total ? (low / total) * 100 : 0;
  const potentialPercent = total
    ? (potential / total) * 100
    : 0;

  const highPercent = total
    ? (high / total) * 100
    : 0;

  const lowEnd = lowPercent;
  const potentialEnd =
    lowPercent + potentialPercent;

  const pieStyle =
    total === 0
      ? {}
      : {
          background: `conic-gradient(
            #16835b 0% ${lowEnd}%,
            #e5b73b ${lowEnd}% ${potentialEnd}%,
            #c24141 ${potentialEnd}% 100%
          )`,
        };

  return (
    <section className="section-card chart-card">
      <div className="section-head">
        <div>
          <span className="section-kicker">
            RISK INTELLIGENCE
          </span>
          <h2>Risk distribution</h2>
        </div>
      </div>

      <div className="risk-chart-layout">
        <div
          className="risk-pie"
          style={pieStyle}
        >
          <div className="risk-pie-center">
            <strong>{total}</strong>
            <span>Institutions</span>
          </div>
        </div>

        <div className="risk-legend">
          <RiskLegend
            label="Low risk"
            value={low}
            percentage={lowPercent}
            className="low"
          />

          <RiskLegend
            label="Potential / Medium"
            value={potential}
            percentage={potentialPercent}
            className="potential"
          />

          <RiskLegend
            label="High risk"
            value={high}
            percentage={highPercent}
            className="high"
          />
        </div>
      </div>
    </section>
  );
}

function RiskLegend({
  label,
  value,
  percentage,
  className,
}) {
  return (
    <div className="risk-legend-row">
      <span className={`risk-dot ${className}`} />

      <div>
        <strong>{label}</strong>
        <small>
          {value} institution{value !== 1 ? "s" : ""}
        </small>
      </div>

      <b>{Math.round(percentage)}%</b>
    </div>
  );
}