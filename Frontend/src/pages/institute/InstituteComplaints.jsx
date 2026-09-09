

import {
  AlertCircle,
  MessageSquare,
  Plus,
  Search,
} from "lucide-react";
import AppShell from "../../components/AppShell";

export default function InstituteComplaints() {
  return (
    <AppShell>
      <div className="dashboard-body">
        <div className="page-intro">
          <div>
            <span className="section-kicker">
              GRIEVANCE MANAGEMENT
            </span>
            <h2>Complaints</h2>
            <p>
              Raise and track complaints related to
              inspection findings and institutional concerns.
            </p>
          </div>

          <button className="primary-button">
            <Plus size={17} />
            New complaint
          </button>
        </div>

        <section className="stats-grid">
          <div className="mini-info-card">
            <span>Open complaints</span>
            <strong>—</strong>
            <small>Awaiting resolution</small>
          </div>

          <div className="mini-info-card">
            <span>Under review</span>
            <strong>—</strong>
            <small>Currently being reviewed</small>
          </div>

          <div className="mini-info-card">
            <span>Resolved</span>
            <strong>—</strong>
            <small>Closed complaints</small>
          </div>
        </section>

        <section className="section-card">
          <div className="section-head">
            <div>
              <span className="section-kicker">
                COMPLAINT REGISTER
              </span>
              <h2>Complaint history</h2>
            </div>

            <div className="table-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search complaints..."
              />
            </div>
          </div>

          <div className="complaint-list">
            <div className="complaint-header">
              <span>Complaint</span>
              <span>Category</span>
              <span>Date</span>
              <span>Status</span>
            </div>

            <div className="complaint-empty">
              <MessageSquare size={28} />
              <h3>No complaints recorded</h3>
              <p>
                Your institution's complaints will appear
                here once submitted.
              </p>
            </div>
          </div>
        </section>

        <section className="info-strip warning-strip">
          <AlertCircle size={19} />
          <div>
            <strong>Need to report an issue?</strong>
            <span>
              Use the New complaint button to submit an
              institutional concern for review.
            </span>
          </div>
        </section>
      </div>
    </AppShell>
  );
}