import {
  LocateFixed,
  MapPin,
  Navigation,
  ShieldCheck,
} from "lucide-react";
import AppShell from "../../components/AppShell";

export default function InspectorLocations() {
  return (
    <AppShell>
      <div className="dashboard-body">
        <div className="page-intro">
          <div>
            <span className="section-kicker">
              FIELD OPERATIONS
            </span>
            <h2>Locations</h2>
            <p>
              View assigned inspection locations and verify
              your field position before starting an inspection.
            </p>
          </div>
        </div>

        <section className="inspector-location-grid">
          <div className="section-card location-status-card">
            <div className="location-icon">
              <LocateFixed size={25} />
            </div>

            <span className="section-kicker">
              CURRENT POSITION
            </span>

            <h2>Location verification</h2>

            <p>
              Your GPS position is checked against the
              designated inspection geofence before an
              inspection can begin.
            </p>

            <div className="location-status">
              <span className="status-dot" />
              GPS ready
            </div>
          </div>

          <div className="section-card">
            <div className="section-head">
              <div>
                <span className="section-kicker">
                  FIELD MAP
                </span>
                <h2>Inspection locations</h2>
              </div>
            </div>

            <div className="location-empty">
              <MapPin size={30} />
              <h3>No locations assigned</h3>
              <p>
                Inspection locations will appear here when
                assignments are issued to you.
              </p>
            </div>
          </div>
        </section>

        <section className="info-strip">
          <Navigation size={19} />
          <div>
            <strong>GPS verification</strong>
            <span>
              Location verification helps confirm that the
              inspector is physically present at the assigned
              institution.
            </span>
          </div>
        </section>

        <section className="info-strip">
          <ShieldCheck size={19} />
          <div>
            <strong>Protected inspection workflow</strong>
            <span>
              The inspection workflow uses location
              verification before field activities begin.
            </span>
          </div>
        </section>
      </div>
    </AppShell>
  );
}