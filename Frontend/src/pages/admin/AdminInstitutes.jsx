import {
  Building2,
  Search,
  ShieldCheck,
} from "lucide-react";
import AppShell from "../../components/AppShell";

export default function AdminInstitutes() {
  return (
    <AppShell>
      <div className="dashboard-body">
        <div className="page-intro">
          <div>
            <span className="section-kicker">
              INSTITUTION REGISTRY
            </span>
            <h2>Institutes</h2>
            <p>
              Monitor registered institutions and their
              inspection readiness across the jurisdiction.
            </p>
          </div>
        </div>

        <section className="section-card">
          <div className="section-head">
            <div>
              <span className="section-kicker">
                REGISTERED INSTITUTIONS
              </span>
              <h2>Institute registry</h2>
            </div>

            <div className="table-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search institutes..."
              />
            </div>
          </div>

          <div className="admin-institute-table">
            <div className="admin-institute-header">
              <span>Institute</span>
              <span>Location</span>
              <span>Risk level</span>
              <span>Status</span>
            </div>

            <div className="admin-page-empty">
              <Building2 size={30} />
              <h3>No institute records available</h3>
              <p>
                Registered institutions will appear here when
                institution data is available.
              </p>
            </div>
          </div>
        </section>

        <section className="info-strip">
          <ShieldCheck size={19} />
          <div>
            <strong>Institution monitoring</strong>
            <span>
              Institute information, risk levels, and
              inspection activity can be monitored from this
              registry.
            </span>
          </div>
        </section>
      </div>
    </AppShell>
  );
}