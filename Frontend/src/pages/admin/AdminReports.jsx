import {
  BarChart3,
  Download,
  FileText,
  Search,
} from "lucide-react";
import AppShell from "../../components/AppShell";

export default function AdminReports() {
  return (
    <AppShell>
      <div className="dashboard-body">
        <div className="page-intro">
          <div>
            <span className="section-kicker">
              ANALYTICS & REPORTING
            </span>
            <h2>Reports</h2>
            <p>
              Review inspection activity, institutional risk,
              and compliance reporting at the administrative
              level.
            </p>
          </div>
        </div>

        <section className="section-card">
          <div className="section-head">
            <div>
              <span className="section-kicker">
                REPORT CENTRE
              </span>
              <h2>Generated reports</h2>
            </div>

            <div className="table-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search reports..."
              />
            </div>
          </div>

          <div className="admin-report-list">
            <div className="admin-report-header">
              <span>Report</span>
              <span>Category</span>
              <span>Generated</span>
              <span>Status</span>
              <span></span>
            </div>

            <div className="admin-page-empty">
              <FileText size={30} />
              <h3>No reports generated</h3>
              <p>
                Administrative reports will appear here once
                reporting data is available.
              </p>
            </div>
          </div>
        </section>

        <section className="admin-report-info-grid">
          <div className="section-card">
            <div className="admin-report-icon">
              <BarChart3 size={21} />
            </div>

            <span className="section-kicker">
              INSPECTION ANALYTICS
            </span>

            <h3>Inspection performance</h3>

            <p>
              Track inspection volume, completion activity,
              and inspection trends across monitored
              institutions.
            </p>
          </div>

          <div className="section-card">
            <div className="admin-report-icon">
              <Download size={21} />
            </div>

            <span className="section-kicker">
              EXPORT CENTRE
            </span>

            <h3>Report exports</h3>

            <p>
              Generated administrative reports can be
              exported for official review and documentation.
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}