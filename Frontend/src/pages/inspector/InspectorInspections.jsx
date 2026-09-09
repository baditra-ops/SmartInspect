import {
  ClipboardCheck,
  Clock3,
  Search,
} from "lucide-react";
import AppShell from "../../components/AppShell";

export default function InspectorInspections() {
  return (
    <AppShell>
      <div className="dashboard-body">
        <div className="page-intro">
          <div>
            <span className="section-kicker">
              ASSIGNMENT CONTROL
            </span>
            <h2>Assigned Inspections</h2>
            <p>
              Review inspections assigned to you and manage
              the field inspection workflow.
            </p>
          </div>
        </div>

        <section className="section-card">
          <div className="section-head">
            <div>
              <span className="section-kicker">
                INSPECTION QUEUE
              </span>
              <h2>Your assignments</h2>
            </div>

            <div className="table-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search inspections..."
              />
            </div>
          </div>

          <div className="assigned-inspections-page">
            <div className="assigned-page-header">
              <span>Institute</span>
              <span>Location</span>
              <span>Time</span>
              <span>Status</span>
              <span></span>
            </div>

            <div className="assigned-page-empty">
              <ClipboardCheck size={30} />
              <h3>No inspections assigned yet</h3>
              <p>
                New inspection assignments will appear here
                when they are issued to you.
              </p>
            </div>
          </div>
        </section>

        <section className="info-strip">
          <Clock3 size={19} />
          <div>
            <strong>Inspection lifecycle</strong>
            <span>
              Assigned inspections progress through acceptance,
              location verification, field inspection, and
              completion.
            </span>
          </div>
        </section>
      </div>
    </AppShell>
  );
}