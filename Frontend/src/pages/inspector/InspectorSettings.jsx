import {
  Bell,
  Lock,
  Settings as SettingsIcon,
  ShieldCheck,
  User,
  BadgeCheck,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import AppShell from "../../components/AppShell";
import { useAuth } from "../../context/AuthContext";

export default function InspectorSettings() {
  const { user } = useAuth();
  const profile = user?.inspectorProfile || {};

  return (
    <AppShell>
      <div className="dashboard-body">
        <div className="page-intro">
          <div>
            <span className="section-kicker">ACCOUNT CONTROL</span>
            <h2>Inspector Profile & Settings</h2>
            <p>
              Manage inspection account preferences, view official designation credentials, and review security settings.
            </p>
          </div>
        </div>

        {/* Inspector Profile Overview Card */}
        <section className="section-card" style={{ marginBottom: "20px" }}>
          <div className="section-head">
            <div>
              <span className="section-kicker">OFFICIAL CREDENTIALS</span>
              <h2>Field Inspector Identity</h2>
            </div>

            <span
              className="status-chip"
              style={{
                background: profile.status === "ON_DUTY" ? "var(--warning-bg)" : "var(--success-bg)",
                color: profile.status === "ON_DUTY" ? "var(--warning)" : "var(--success)",
                fontWeight: 700,
              }}
            >
              {profile.status || "ACTIVE"}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              marginTop: "8px",
            }}
          >
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "8px", background: "var(--bg)", display: "grid", placeItems: "center" }}>
                <User size={18} color="var(--navy)" />
              </div>
              <div>
                <small style={{ color: "var(--muted)", fontSize: "0.75rem", display: "block" }}>Full Name</small>
                <strong style={{ fontSize: "0.92rem" }}>{user?.fullName || "Field Inspector"}</strong>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "8px", background: "var(--bg)", display: "grid", placeItems: "center" }}>
                <BadgeCheck size={18} color="var(--navy)" />
              </div>
              <div>
                <small style={{ color: "var(--muted)", fontSize: "0.75rem", display: "block" }}>Badge Number</small>
                <strong style={{ fontSize: "0.92rem" }}>{profile.badgeNumber || "INSP-FIELD-01"}</strong>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "8px", background: "var(--bg)", display: "grid", placeItems: "center" }}>
                <MapPin size={18} color="var(--navy)" />
              </div>
              <div>
                <small style={{ color: "var(--muted)", fontSize: "0.75rem", display: "block" }}>Assigned Jurisdiction</small>
                <strong style={{ fontSize: "0.92rem" }}>
                  {profile.assignedDistrict || user?.district || "District"} ({user?.state || "State"})
                </strong>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "8px", background: "var(--bg)", display: "grid", placeItems: "center" }}>
                <Mail size={18} color="var(--navy)" />
              </div>
              <div>
                <small style={{ color: "var(--muted)", fontSize: "0.75rem", display: "block" }}>Official Email</small>
                <strong style={{ fontSize: "0.92rem" }}>{user?.email || "inspector@smartinspect.gov.in"}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="settings-grid">
          <SettingCard
            icon={<ShieldCheck size={21} />}
            title="Account & Security"
            description="Manage account security, password credentials, and authenticated device sessions."
          />

          <SettingCard
            icon={<Bell size={21} />}
            title="Notifications"
            description="Configure real-time assignment dispatch notifications and emergency alerts."
          />

          <SettingCard
            icon={<Lock size={21} />}
            title="Privacy & Telemetry"
            description="Review location permissions, background GPS tracking, and field-data privacy settings."
          />

          <SettingCard
            icon={<SettingsIcon size={21} />}
            title="Application Preferences"
            description="Configure inspection cache policies, offline sync limits, and media resolution."
          />
        </section>

        <section className="info-strip">
          <ShieldCheck size={19} />
          <div>
            <strong>Secure field operations</strong>
            <span>
              Inspector access and inspection activities are protected through authenticated sessions, GPS tamper verification, and cryptographic audit hashing.
            </span>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function SettingCard({ icon, title, description }) {
  return (
    <section className="section-card setting-card">
      <div className="setting-icon">
        {icon}
      </div>

      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <button className="ghost-button">
        Manage
      </button>
    </section>
  );
}