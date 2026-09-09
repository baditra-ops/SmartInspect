import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import AppShell from "../../components/AppShell";
import api, { apiError, unwrap } from "../../services/api";

export default function AdminInspections() {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");

    try {
      const res = await api.get("/inspections", {
        params: {
          page: 1,
          limit: 50,
          sortBy: "scheduledDate",
          sortOrder: "desc",
        },
      });

      setInspections(unwrap(res) || []);
    } catch (err) {
      setMessage(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AppShell>
      <div className="dashboard-body">
        {message && (
          <div className="notice">
            <CheckCircle2 size={17} />
            {message}
          </div>
        )}

        <section className="section-card">
          <div className="section-head">
            <div>
              <span className="section-kicker">AUDIT TRAIL</span>
              <h2>Inspection history</h2>
            </div>

            <button
              className="icon-button"
              onClick={load}
              title="Refresh"
              disabled={loading}
            >
              <RefreshCw size={17} />
            </button>
          </div>

          {loading ? (
            <div className="empty-state">
              Loading inspection records…
            </div>
          ) : inspections.length === 0 ? (
            <div className="empty-state large">
              <CheckCircle2 size={30} />
              <h3>No inspection records</h3>
              <p>
                No inspection records are currently available.
              </p>
            </div>
          ) : (
            <div className="history-list">
              {inspections.map((item) => (
                <div className="history-row" key={item.id}>
                  <div className="history-code">
                    {item.inspectionCode || "INSPECTION"}
                  </div>

                  <div>
                    <strong>
                      {item.institution?.name || "Institution"}
                    </strong>

                    <span>
                      {formatDate(item.scheduledDate)} ·{" "}
                      {item.type || "Inspection"}
                    </span>
                  </div>

                  <span
                    className={`status-chip status-${String(
                      item.status || ""
                    ).toLowerCase()}`}
                  >
                    {formatStatus(item.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
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

function formatStatus(value = "") {
  return value.replaceAll("_", " ");
}