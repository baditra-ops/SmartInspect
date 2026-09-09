import {
  FileCheck2,
  FileText,
  Search,
} from "lucide-react";
import AppShell from "../../components/AppShell";

export default function InspectorReports() {
  return (
    <AppShell>
      <div className="dashboard-body">
        <div className="page-intro">
          <div>
            <span className="section-kicker">
              INSPECTION DOCUMENTATION
            </span>
            <h2>Reports</h2>
            <p>
              Review inspection reports and documentation
              submitted during field operations.
            </p>
          </div>
        </div>

        <section className="section-card">
          <div className="section-head">
            <div>
              <span className="section-kicker">
                REPORT ARCHIVE
              </span>
              <h2>Submitted reports</h2>
            </div>

            <div className="table-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search reports..."
              />
            </div>
          </div>

          <div className="inspector-report-list">
            <div className="inspector-report-header">
              <span>Inspection</span>
              <span>Institution</span>
              <span>Date</span>
              <span>Status</span>
            </div>

            <div className="inspector-report-empty">
              <FileText size={30} />
              <h3>No reports available</h3>
              <p>
                Reports submitted after completed inspections
                will appear here.
              </p>
            </div>
          </div>
        </section>

        <section className="info-strip">
          <FileCheck2 size={19} />
          <div>
            <strong>Field documentation</strong>
            <span>
              Inspection findings, evidence, and submitted
              reports can be reviewed from this section.
            </span>
          </div>
        </section>
      </div>
    </AppShell>
  );
}