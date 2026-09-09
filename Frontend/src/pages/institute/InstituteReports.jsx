import {
  ClipboardCheck,
  Download,
  FileText,
  Search,
} from "lucide-react";
import AppShell from "../../components/AppShell";

export default function InstituteReports() {
  return (
    <AppShell>
      <div className="dashboard-body">
        <div className="page-intro">
          <div>
            <span className="section-kicker">
              DOCUMENT CENTRE
            </span>
            <h2>Inspection Reports</h2>
            <p>
              Review inspection findings, compliance records,
              and reports issued for your institution.
            </p>
          </div>
        </div>

        <section className="section-card">
          <div className="section-head">
            <div>
              <span className="section-kicker">
                REPORT ARCHIVE
              </span>
              <h2>Available reports</h2>
            </div>

            <div className="table-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search reports..."
              />
            </div>
          </div>

          <div className="report-list">
            <div className="report-row report-header">
              <span>Report</span>
              <span>Inspection type</span>
              <span>Date</span>
              <span>Status</span>
              <span></span>
            </div>

            <div className="report-empty">
              <FileText size={28} />
              <h3>No reports available</h3>
              <p>
                Inspection reports will appear here after
                an inspection has been completed.
              </p>
            </div>
          </div>
        </section>

        <section className="info-strip">
          <ClipboardCheck size={19} />
          <div>
            <strong>Inspection reports</strong>
            <span>
              Completed inspection findings and compliance
              documentation will be available here.
            </span>
          </div>
        </section>
      </div>
    </AppShell>
  );
}