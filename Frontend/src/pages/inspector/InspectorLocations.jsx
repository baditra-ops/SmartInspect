import { useState, useEffect } from "react";
import {
  LocateFixed,
  MapPin,
  Navigation,
  ShieldCheck,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock3,
  RefreshCw,
} from "lucide-react";
import AppShell from "../../components/AppShell";
import {
  getMyInspections,
  verifyGpsLocation,
  getGpsHistory,
  getLatestGps,
} from "../../services/inspection.service";
import { apiError } from "../../services/api";

export default function InspectorLocations() {
  const [inspections, setInspections] = useState([]);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [gpsHistory, setGpsHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [currentPosition, setCurrentPosition] = useState(null);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const data = await getMyInspections({ page: 1, limit: 50 });
      const list = data.inspections || [];
      setInspections(list);

      // Select active or first pending inspection
      const activeOrFirst =
        list.find((x) => x.status === "IN_PROGRESS") ||
        list.find((x) => x.status === "ACCEPTED") ||
        list.find((x) => x.status === "ASSIGNED") ||
        list[0] ||
        null;

      setSelectedInspection(activeOrFirst);
      if (activeOrFirst) {
        loadGps(activeOrFirst.id);
      }
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadGps(inspectionId) {
    try {
      const history = await getGpsHistory(inspectionId);
      setGpsHistory(Array.isArray(history) ? history : []);
    } catch (err) {
      setGpsHistory([]);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedInspection?.id) {
      loadGps(selectedInspection.id);
    }
  }, [selectedInspection?.id]);

  function handleSelectInspection(item) {
    setSelectedInspection(item);
    setNotice("");
    setError("");
  }

  async function handleVerifyLocation() {
    if (!selectedInspection) {
      setError("Please select an assigned inspection first.");
      return;
    }

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setVerifying(true);
    setNotice("");
    setError("");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: Math.round(pos.coords.accuracy || 15),
          verificationType: "CHECK_IN",
          deviceInfo: navigator.userAgent.slice(0, 180),
        };
        setCurrentPosition(coords);

        try {
          const result = await verifyGpsLocation(selectedInspection.id, coords);

          if (result.verified || result.isWithinGeofence) {
            setNotice(
              `GPS Verified! Distance to ${selectedInspection.institution?.name || "facility"} is ${result.distanceMeters}m (within allowed ${result.allowedRadiusMeters}m radius).`
            );
          } else {
            setError(
              `Outside Geofence! Current distance is ${result.distanceMeters}m from institution center (allowed radius: ${result.allowedRadiusMeters}m). Recorded in audit trail.`
            );
          }

          await loadGps(selectedInspection.id);
        } catch (err) {
          setError(apiError(err));
        } finally {
          setVerifying(false);
        }
      },
      (err) => {
        setError(`Location access failed: ${err.message}. Please allow GPS permissions.`);
        setVerifying(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  const latestGps = gpsHistory[0] || null;

  return (
    <AppShell>
      <div className="dashboard-body">
        <div className="page-intro">
          <div>
            <span className="section-kicker">FIELD OPERATIONS</span>
            <h2>Locations</h2>
            <p>
              View assigned inspection locations, check geographic coordinates, and verify your field position before starting an audit.
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

        <section className="inspector-location-grid">
          {/* Left Card: Location Verification Console */}
          <div className="section-card location-status-card">
            <div className="location-icon">
              <LocateFixed size={25} />
            </div>

            <span className="section-kicker">CURRENT POSITION</span>
            <h2>Location verification</h2>

            <p>
              Your live device GPS position is evaluated authoritatively against the designated inspection geofence boundary using the Haversine formula.
            </p>

            {selectedInspection ? (
              <div style={{ background: "var(--bg)", padding: "12px", borderRadius: "8px", margin: "14px 0" }}>
                <strong style={{ fontSize: "0.9rem", display: "block" }}>
                  {selectedInspection.institution?.name || "Selected Facility"}
                </strong>
                <small style={{ color: "var(--muted)", display: "block", marginTop: "2px" }}>
                  {selectedInspection.inspectionCode} • {selectedInspection.institution?.district}, {selectedInspection.institution?.state}
                </small>

                {selectedInspection.institution?.latitude && (
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "6px" }}>
                    Target GPS: <b>{Number(selectedInspection.institution.latitude).toFixed(4)}</b>,{" "}
                    <b>{Number(selectedInspection.institution.longitude).toFixed(4)}</b> (Radius: {selectedInspection.institution.geofenceRadiusMeters || 150}m)
                  </div>
                )}
              </div>
            ) : null}

            <div className="location-status" style={{ marginBottom: "14px" }}>
              <span
                className="status-dot"
                style={{
                  background: latestGps?.isWithinGeofence
                    ? "var(--success)"
                    : latestGps
                    ? "var(--danger)"
                    : "#b56b00",
                }}
              />
              {latestGps?.isWithinGeofence
                ? `Verified (${latestGps.distanceFromInstitutionMeters || 0}m away)`
                : latestGps
                ? `Outside Boundary (${latestGps.distanceFromInstitutionMeters || 0}m)`
                : "GPS Check-In Pending"}
            </div>

            <button
              className="primary-button"
              style={{ width: "100%", height: "44px" }}
              onClick={handleVerifyLocation}
              disabled={verifying || !selectedInspection || loading}
            >
              <LocateFixed size={16} className={verifying ? "spin" : ""} />
              {verifying ? "Verifying GPS Coordinates…" : "Verify Field Location"}
            </button>

            {/* GPS History Summary */}
            {gpsHistory.length > 0 && (
              <div style={{ marginTop: "16px", borderTop: "1px solid var(--line)", paddingTop: "12px" }}>
                <span className="section-kicker" style={{ fontSize: "0.72rem" }}>CHECK-IN LOGS ({gpsHistory.length})</span>
                <div style={{ maxHeight: "140px", overflowY: "auto", marginTop: "6px" }}>
                  {gpsHistory.map((g) => (
                    <div
                      key={g.id}
                      style={{
                        fontSize: "0.78rem",
                        padding: "6px 0",
                        borderBottom: "1px solid var(--line)",
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>
                        {g.isWithinGeofence ? "Verified" : "Outside"} • {g.distanceFromInstitutionMeters || 0}m
                      </span>
                      <span style={{ color: "var(--muted)" }}>
                        {formatTime(g.capturedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Card: Assigned Inspection Locations List */}
          <div className="section-card">
            <div className="section-head">
              <div>
                <span className="section-kicker">FIELD MAP & QUEUE</span>
                <h2>Inspection locations ({inspections.length})</h2>
              </div>

              <button
                className="icon-button"
                onClick={loadData}
                title="Refresh locations"
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? "spin" : ""} />
              </button>
            </div>

            {loading ? (
              <div className="location-empty">
                <RefreshCw size={26} className="spin" />
                <h3>Loading locations…</h3>
                <p>Retrieving facility coordinates for your assigned inspections.</p>
              </div>
            ) : inspections.length === 0 ? (
              <div className="location-empty">
                <MapPin size={30} />
                <h3>No locations assigned</h3>
                <p>
                  Inspection locations will appear here when assignments are issued to you.
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "10px", maxHeight: "450px", overflowY: "auto" }}>
                {inspections.map((item) => {
                  const isSelected = selectedInspection?.id === item.id;
                  const inst = item.institution;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectInspection(item)}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "8px",
                        border: isSelected ? "2px solid var(--blue)" : "1px solid var(--line)",
                        background: isSelected ? "#f0f6ff" : "white",
                        cursor: "pointer",
                        transition: "0.2s",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <strong style={{ fontSize: "0.9rem", color: "var(--ink)" }}>
                            {inst?.name || "Assigned Institution"}
                          </strong>
                          <span style={{ display: "block", color: "var(--muted)", fontSize: "0.78rem", marginTop: "2px" }}>
                            {item.inspectionCode} • {item.type}
                          </span>
                        </div>

                        <span className={`status-chip status-${String(item.status || "").toLowerCase()}`}>
                          {formatInspectionStatus(item.status)}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", fontSize: "0.8rem", color: "var(--muted)" }}>
                        <MapPin size={13} color="var(--navy)" />
                        <span>
                          {inst?.address || "—"}, {inst?.district}, {inst?.state}
                        </span>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "0.78rem" }}>
                        <span style={{ color: "var(--muted)" }}>
                          Scheduled: <b>{formatDate(item.scheduledDate)}</b>
                        </span>
                        <span style={{ color: item.isGeofenceVerified ? "var(--success)" : "var(--muted)" }}>
                          {item.isGeofenceVerified ? "Geofence Verified" : "Pending Verification"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="info-strip">
          <Navigation size={19} />
          <div>
            <strong>Authoritative Geofence Validation</strong>
            <span>
              Coordinates are sent from your device and validated server-side against official registry boundaries. Tamper flags are automatically raised if GPS accuracy exceeds acceptable field thresholds.
            </span>
          </div>
        </section>

        <section className="info-strip">
          <ShieldCheck size={19} />
          <div>
            <strong>Protected inspection workflow</strong>
            <span>
              Real-time check-in coordinates are logged immutably in the PostgreSQL audit log and broadcasted to authorized monitoring dashboards.
            </span>
          </div>
        </section>
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

function formatInspectionStatus(value = "") {
  if (!value) return "Unknown";
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}